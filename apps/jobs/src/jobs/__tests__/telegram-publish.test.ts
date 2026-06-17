/**
 * Test telegram-publish — publication idempotente bilingue (Plan 06-03, TG-01/02/03).
 *
 * Vérifie SANS RÉSEAU (mock client service_role en store mémoire + vi.mock('grammy'))
 * que le job :
 *  - poste les NOTABLES frais (realized_r ≥ 2.0, D-02) à chaque run ; ignore < 2.0R.
 *  - 2e run consécutif → posted=0 et sendMessage NON rappelé (idempotence TG-03).
 *  - produit des dedupe_key distincts par type (notable/recap/winrate) sans collision.
 *  - au run récap (~21h UTC) sans trade clos → 1 post recap « Aucun trade » + win rate (D-10).
 *  - applique le seuil N<30 (« échantillon insuffisant ») vs N≥30 (« % ») (D-11).
 *  - ne fuite jamais le token dans le Json retourné (T-06-TOKEN).
 *
 * Déterminisme : `now` est injecté via telegramPublish(DateTime) — pas de mock d'horloge.
 * Le store mock du client miroir outcome-tracker.test.ts (thenable + builder chaînable).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DateTime } from 'luxon'

// ─── Store en mémoire ──────────────────────────────────────────────────────────

interface OutcomeJoinRow {
  setup_id: string
  outcome: 'hit_tp' | 'hit_sl' | 'flat'
  realized_r: number
  resolved_at: string
  trade_setups: { direction: 'long' | 'short'; instruments: { symbol: string } }
}
interface PatternStatRow {
  dimension: string
  bucket: string
  period: string
  n: number
  win_rate: number | null
  avg_r: number | null
  expectancy: number | null
}
interface PostRow {
  dedupe_key: string
  post_type: string
  tg_message_id: number | null
}

let outcomes: OutcomeJoinRow[]
let stats: PatternStatRow[]
let posts: PostRow[]

// Compteur d'appels sendMessage (mock grammy).
const sendMessage = vi.fn(async () => ({ message_id: Math.floor(Math.random() * 1e6) }))

// ─── Mock grammy (publication-only) ────────────────────────────────────────────

vi.mock('grammy', () => ({
  Bot: class {
    api = { sendMessage }
  },
}))

// ─── Mock p-retry (passe-plat) ──────────────────────────────────────────────────
// sendPost enveloppe sendMessage dans pRetry({ retries: 3 }) avec backoff exponentiel
// (~7s). En test on veut un échec immédiat et déterministe : une seule tentative.
vi.mock('p-retry', () => ({
  default: (fn: () => Promise<unknown>) => fn(),
}))

// ─── Mock client service_role (store-backed) ────────────────────────────────────

function makeClient() {
  return {
    from(table: string) {
      const filters: { gteResolvedAt?: string } = {}

      const resolveSelect = () => {
        if (table === 'pattern_stats') {
          return { data: stats, error: null }
        }
        if (table === 'prediction_outcomes') {
          const eligible = outcomes.filter(
            (o) => !filters.gteResolvedAt || o.resolved_at >= filters.gteResolvedAt,
          )
          return { data: eligible, error: null }
        }
        if (table === 'telegram_posts') {
          return { data: posts.map((p) => ({ dedupe_key: p.dedupe_key })), error: null }
        }
        return { data: [], error: null }
      }

      // Opération courante de la chaîne (select par défaut, upsert/delete sinon) +
      // lignes réellement insérées par un upsert (pour .select() de reservePost).
      let op: 'select' | 'upsert' | 'delete' = 'select'
      let inserted: { dedupe_key: string }[] = []

      const builder = {
        select(_cols: string) {
          // reservePost : upsert(...).select('dedupe_key') → lignes réellement créées.
          if (op === 'upsert') {
            return Promise.resolve({ data: inserted, error: null })
          }
          return builder
        },
        gte(_col: string, iso: string) {
          filters.gteResolvedAt = iso
          return builder
        },
        order(_col: string, _opts: { ascending: boolean }) {
          return Promise.resolve(resolveSelect())
        },
        upsert(rows: PostRow[], _opts: { onConflict: string; ignoreDuplicates: boolean }) {
          op = 'upsert'
          const existing = new Set(posts.map((p) => p.dedupe_key))
          inserted = []
          for (const r of rows) {
            if (!existing.has(r.dedupe_key)) {
              posts.push(r)
              existing.add(r.dedupe_key)
              inserted.push({ dedupe_key: r.dedupe_key })
            }
          }
          return builder
        },
        delete() {
          op = 'delete'
          return builder
        },
        eq(col: string, val: string) {
          // releasePost : delete().eq('dedupe_key', key) → rollback de la réservation.
          if (op === 'delete' && col === 'dedupe_key') {
            posts = posts.filter((p) => p.dedupe_key !== val)
          }
          return Promise.resolve({ error: null })
        },
        then(onFulfilled: (v: { data: unknown; error: null }) => unknown) {
          if (op === 'upsert') {
            return Promise.resolve({ data: inserted, error: null }).then(onFulfilled)
          }
          return Promise.resolve(resolveSelect()).then(onFulfilled)
        },
      }
      return builder
    },
  }
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => makeClient(),
}))

import { telegramPublish } from '../telegram-publish'

// ─── Fixtures ───────────────────────────────────────────────────────────────────

function notableTrade(id: string, r: number): OutcomeJoinRow {
  return {
    setup_id: id,
    outcome: r >= 0 ? 'hit_tp' : 'hit_sl',
    realized_r: r,
    resolved_at: '2026-06-16T10:00:00.000Z',
    trade_setups: { direction: 'long', instruments: { symbol: 'BTCUSDT' } },
  }
}

function globalStat(n: number, winRate: number | null): PatternStatRow {
  return {
    dimension: 'overall',
    bucket: 'all',
    period: 'all_time',
    n,
    win_rate: winRate,
    avg_r: 0.5,
    expectancy: 0.3,
  }
}

// Un mardi 10h UTC (ni récap ni vendredi) → seuls les notables passent.
const TUESDAY_10H = DateTime.fromISO('2026-06-16T10:00:00.000Z', { zone: 'UTC' })
// Le run récap (~21h UTC) un mardi → recap quotidien.
const TUESDAY_RECAP = DateTime.fromISO('2026-06-16T21:00:00.000Z', { zone: 'UTC' })
// Un vendredi 10h UTC → post winrate.
const FRIDAY_10H = DateTime.fromISO('2026-06-19T10:00:00.000Z', { zone: 'UTC' })

describe('telegram-publish — publication idempotente (TG-01/02/03)', () => {
  beforeEach(() => {
    process.env['SUPABASE_URL'] = 'http://localhost'
    process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'test-service-role'
    process.env['TELEGRAM_BOT_TOKEN'] = 'test-token'
    process.env['TELEGRAM_CHANNEL_ID'] = '-1001234567890'
    outcomes = []
    stats = [globalStat(142, 0.55)]
    posts = []
    sendMessage.mockClear()
  })

  it('poste les notables ≥ 2.0R et ignore les < 2.0R (D-02)', async () => {
    outcomes = [notableTrade('su1', 2.5), notableTrade('su2', 1.2)]
    const stats1 = (await telegramPublish(TUESDAY_10H)) as { posted: number }
    expect(stats1.posted).toBe(1) // su1 seulement
    expect(posts.map((p) => p.dedupe_key)).toEqual(['notable:su1'])
    expect(sendMessage).toHaveBeenCalledTimes(1)
  })

  it('2e run consécutif : posted=0 et sendMessage NON rappelé (idempotence TG-03)', async () => {
    outcomes = [notableTrade('su1', 2.5), notableTrade('su3', 3.1)]
    const first = (await telegramPublish(TUESDAY_10H)) as { posted: number }
    expect(first.posted).toBe(2)
    expect(sendMessage).toHaveBeenCalledTimes(2)

    sendMessage.mockClear()
    const second = (await telegramPublish(TUESDAY_10H)) as { posted: number; skipped: number }
    expect(second.posted).toBe(0)
    expect(second.skipped).toBe(2)
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('clés distinctes par type : notable / recap / winrate coexistent sans collision', async () => {
    // resolved_at dans la fenêtre 24h du run récap vendredi pour activer la notable.
    outcomes = [{ ...notableTrade('su1', 2.5), resolved_at: '2026-06-19T18:00:00.000Z' }]
    // Run récap un vendredi → notable + recap + winrate dans le même run.
    const FRIDAY_RECAP = DateTime.fromISO('2026-06-19T21:00:00.000Z', { zone: 'UTC' })
    const r = (await telegramPublish(FRIDAY_RECAP)) as { posted: number }
    expect(r.posted).toBe(3)
    const keys = posts.map((p) => p.dedupe_key).sort()
    expect(keys).toEqual(['notable:su1', 'recap:2026-06-19', 'winrate:2026-06-19'])
  })

  it('jour vide au run récap : 1 post recap envoyé, pas de skip silencieux (D-10)', async () => {
    outcomes = [] // aucun trade clos
    const r = (await telegramPublish(TUESDAY_RECAP)) as { posted: number }
    expect(r.posted).toBe(1)
    expect(posts.map((p) => p.dedupe_key)).toEqual(['recap:2026-06-16'])
    expect(sendMessage).toHaveBeenCalledTimes(1)
  })

  it('seuil N<30 → échantillon insuffisant ; N≥30 → % (D-11)', async () => {
    // Capture l'HTML envoyé pour vérifier le bloc win rate.
    outcomes = [notableTrade('su1', 2.5)]

    stats = [globalStat(12, 0.5)]
    await telegramPublish(TUESDAY_10H)
    const htmlLow = sendMessage.mock.calls[0]?.[1] as string
    expect(htmlLow).toContain('insuffisant')

    posts = []
    sendMessage.mockClear()
    stats = [globalStat(142, 0.55)]
    await telegramPublish(TUESDAY_10H)
    const htmlHigh = sendMessage.mock.calls[0]?.[1] as string
    expect(htmlHigh).toContain('%')
  })

  it('le token n’apparaît jamais dans le Json retourné (T-06-TOKEN)', async () => {
    outcomes = [notableTrade('su1', 2.5)]
    const r = await telegramPublish(TUESDAY_10H)
    expect(JSON.stringify(r)).not.toContain('test-token')
  })

  it('vendredi hors récap : poste winrate-seul (D-09)', async () => {
    outcomes = []
    const r = (await telegramPublish(FRIDAY_10H)) as { posted: number }
    expect(r.posted).toBe(1)
    expect(posts.map((p) => p.dedupe_key)).toEqual(['winrate:2026-06-19'])
  })

  it('CR-02 : envoi échoué après réservation → clé libérée, retry propre (anti double-post)', async () => {
    outcomes = [notableTrade('su1', 2.5)]
    // L'envoi échoue après que la clé a été réservée (reserve THEN send).
    sendMessage.mockRejectedValueOnce(new Error('telegram 500'))
    await expect(telegramPublish(TUESDAY_10H)).rejects.toThrow('telegram 500')
    // La réservation a été libérée : aucune trace fantôme → pas de skip silencieux.
    expect(posts).toEqual([])
    // Retry : le run suivant réémet et trace normalement (D-10, jamais de skip).
    sendMessage.mockClear()
    const r = (await telegramPublish(TUESDAY_10H)) as { posted: number }
    expect(r.posted).toBe(1)
    expect(posts.map((p) => p.dedupe_key)).toEqual(['notable:su1'])
    expect(sendMessage).toHaveBeenCalledTimes(1)
  })

  it('CR-02 : clé déjà réservée (run concurrent) → sendMessage NON rappelé', async () => {
    // Simule une réservation antérieure non encore vue par getPostedKeys du run courant :
    // ici la clé est en base avant le run → reservePost renvoie false → pas de réémission.
    outcomes = [notableTrade('su1', 2.5)]
    posts = [{ dedupe_key: 'notable:su1', post_type: 'notable', tg_message_id: null }]
    const r = (await telegramPublish(TUESDAY_10H)) as { posted: number; skipped: number }
    expect(r.posted).toBe(0)
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('CR-01 : récap rattrapé après 21h UTC si le run de 21h a été manqué (D-10)', async () => {
    outcomes = []
    // Run à 23h UTC — le run de 21h n'a jamais eu lieu (PC éteint). Le récap reste dû.
    const TUESDAY_23H = DateTime.fromISO('2026-06-16T23:00:00.000Z', { zone: 'UTC' })
    const r = (await telegramPublish(TUESDAY_23H)) as { posted: number }
    expect(r.posted).toBe(1)
    expect(posts.map((p) => p.dedupe_key)).toEqual(['recap:2026-06-16'])
  })

  it('CR-01 : récap non redupliqué si déjà posté le même jour (idempotent au rattrapage)', async () => {
    outcomes = []
    posts = [{ dedupe_key: 'recap:2026-06-16', post_type: 'recap', tg_message_id: 1 }]
    const TUESDAY_23H = DateTime.fromISO('2026-06-16T23:00:00.000Z', { zone: 'UTC' })
    const r = (await telegramPublish(TUESDAY_23H)) as { posted: number; skipped: number }
    expect(r.posted).toBe(0)
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('WR-03 : trade sans symbol/direction → fail-fast (ne publie pas de placeholder)', async () => {
    outcomes = [
      {
        setup_id: 'su1',
        outcome: 'hit_tp',
        realized_r: 2.5,
        resolved_at: '2026-06-16T10:00:00.000Z',
        trade_setups: null as unknown as OutcomeJoinRow['trade_setups'],
      },
    ]
    await expect(telegramPublish(TUESDAY_10H)).rejects.toThrow(/symbol|direction|incomplete/i)
    expect(sendMessage).not.toHaveBeenCalled()
  })
})
