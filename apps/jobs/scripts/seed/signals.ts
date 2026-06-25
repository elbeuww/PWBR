/**
 * signals.ts — dimension SIGNAUX de la cohorte démo (Plan 18-03 Task 1, D-02/SEED-02).
 *
 * Chaîne FK-cohérente analyses → trade_setups → prediction_outcomes :
 *   1. analyses          (source='demo') — instrument_id RÉUTILISÉ depuis les
 *                          instruments déjà seedés (0001/0003), JAMAIS re-seedés
 *                          (anti-pattern, RESEARCH §Anti-Patterns).
 *   2. trade_setups      (source='demo') — analysis_id = id d'analyse RÉELLE seedée
 *                          (pas d'orphelin) ; mix status active/expired/invalidated.
 *   3. prediction_outcomes (source='demo') — UNIQUEMENT sur les setups expired/
 *                          invalidated (PK = setup_id) ; OUTCOMES BRUTS uniquement :
 *                          `outcome` ∈ {hit_tp,hit_sl,flat} + `realized_r` borné.
 *
 * ⚠️ ZÉRO chiffre de perf fabriqué (D-02 / VITR-03 / SEED-02) : aucune colonne de
 * taux de réussite agrégé n'est écrite ICI. La distribution 55/35/10 est un POIDS
 * de génération (faker.weightedArrayElement), PAS un taux stocké ; le ratio de
 * réussite émerge EXCLUSIVEMENT de la vue pattern_stats (0014) qui agrège les
 * outcomes bruts. Scan statique : no-perf-seed-claims.test.ts.
 *
 * created_at étalés via luxon (jamais identiques — Pitfall 1 keyset). Inserts batchés
 * (chunks 1000), throw sur erreur, ids retournés conservés pour la cohérence FK.
 *
 * Déterminisme (D-06) : Faker seedé FAKER_SEED ; ordre de génération stable (boucle
 * par index croissant) → re-run = même dataset = N stable.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { Faker, en, base } from '@faker-js/faker'
import { DateTime } from 'luxon'
import type { Database } from '@app/supabase'
import {
  FAKER_SEED,
  SEED_SOURCE,
  DEMO_VOLUMES,
  DEMO_TIMELINE,
  scaled,
} from './config'
import type { SeededUser } from './users'

type Client = SupabaseClient<Database>
type AnalysisInsert = Database['public']['Tables']['analyses']['Insert']
type TradeSetupInsert = Database['public']['Tables']['trade_setups']['Insert']
type PredictionOutcomeInsert = Database['public']['Tables']['prediction_outcomes']['Insert']

/** Ancre temporelle commune au seed (cohérente avec users/subscriptions/payments). */
const ANCHOR = DateTime.utc(2026, 6, 25)

/** Statut d'un trade_setup (check 0006). */
type SetupStatus = 'active' | 'expired' | 'invalidated'

/** Outcome BRUT d'un setup résolu (check 0014). Aucun % — donnée factuelle. */
type Outcome = 'hit_tp' | 'hit_sl' | 'flat'

const SESSIONS = ['asia', 'london', 'newyork', 'eod-swing'] as const
const STYLES = ['day', 'swing'] as const
const DIRECTIONS = ['long', 'short'] as const
const RISK_LEVELS = ['low', 'medium', 'high', 'extreme'] as const
const CONFIDENCES = ['low', 'moderate', 'high'] as const

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/**
 * created_at étalé sur la fenêtre d'historique (monthsBack), volume croissant vers le
 * récent. Jamais identique (jitter minute déterministe → keyset, Pitfall 1).
 */
function spreadCreatedAt(f: Faker, total: number, i: number): DateTime {
  const linear = total > 1 ? i / (total - 1) : 1
  const skewed = Math.sqrt(linear)
  const daysSpan = DEMO_TIMELINE.monthsBack * 30
  const daysAgo = Math.round((1 - skewed) * daysSpan)
  const jitterMinutes = f.number.int({ min: 0, max: 24 * 60 - 1 })
  return ANCHOR.minus({ days: daysAgo, minutes: jitterMinutes })
}

/**
 * realized_r BORNÉ par outcome (RESEARCH Pattern 3) — donnée factuelle, PAS un %.
 *   hit_tp → [0.8 .. 3.5] (gain en R) · hit_sl → [-1.2 .. -0.8] · flat → [-0.3 .. 0.3]
 */
function realizedRFor(f: Faker, outcome: Outcome): number {
  if (outcome === 'hit_tp') return Number(f.number.float({ min: 0.8, max: 3.5, fractionDigits: 2 }))
  if (outcome === 'hit_sl') return Number(f.number.float({ min: -1.2, max: -0.8, fractionDigits: 2 }))
  return Number(f.number.float({ min: -0.3, max: 0.3, fractionDigits: 2 }))
}

/** Lit les instruments existants (RÉUTILISE — ne re-seede JAMAIS, anti-pattern). */
async function readInstrumentIds(client: Client): Promise<string[]> {
  const { data, error } = await client.from('instruments').select('id')
  if (error) throw new Error(`seed signals: read instruments: ${error.message}`)
  const ids = (data ?? []).map((r) => r.id)
  if (ids.length === 0) {
    throw new Error('seed signals: aucun instrument seedé (0001/0003) — re-seed instruments interdit')
  }
  return ids
}

/**
 * Seede analyses → trade_setups → prediction_outcomes (outcomes BRUTS). FK-cohérent,
 * source='demo'. Instruments RÉUTILISÉS (lus, jamais insérés). Retourne un récap de
 * volumétrie pour le log de l'orchestrateur.
 */
export async function seedSignals(
  client: Client,
  _users: SeededUser[],
): Promise<{ analyses: number; setups: number; outcomes: number }> {
  const f = new Faker({ locale: [en, base] })
  f.seed(FAKER_SEED)

  const instrumentIds = await readInstrumentIds(client)

  // ── 1. analyses ────────────────────────────────────────────────────────────
  const analysisTarget = scaled(DEMO_VOLUMES.analyses)
  const analysisRows: AnalysisInsert[] = []
  for (let i = 0; i < analysisTarget; i += 1) {
    const createdAt = spreadCreatedAt(f, analysisTarget, i)
    analysisRows.push({
      run_id: `demo-run-${i}`,
      session: SESSIONS[i % SESSIONS.length],
      style: STYLES[i % STYLES.length],
      instrument_id: instrumentIds[i % instrumentIds.length],
      snapshot: { seed: true, idx: i },
      model: 'demo-seed',
      prompt_version: 'demo',
      schema_version: 'demo',
      created_at: createdAt.toISO() as string,
      source: SEED_SOURCE,
    })
  }

  const analysisIds: string[] = []
  for (const batch of chunk(analysisRows, 1000)) {
    const { data, error } = await client.from('analyses').insert(batch).select('id')
    if (error) throw new Error(`seed signals (analyses): ${error.message}`)
    for (const row of data ?? []) analysisIds.push(row.id)
  }
  if (analysisIds.length === 0 && analysisTarget > 0) {
    throw new Error('seed signals: aucun id analyse retourné — cohérence FK impossible')
  }

  // ── 2. trade_setups (analysis_id = analyse RÉELLE ; mix status) ──────────────
  const setupTarget = scaled(DEMO_VOLUMES.tradeSetups)
  const setupRows: TradeSetupInsert[] = []
  // Statut déterministe : ~40% active, ~40% expired, ~20% invalidated (assez
  // d'expired/invalidated → ≥30 outcomes par bucket pattern_stats significatif).
  const statusOf = (i: number): SetupStatus => {
    const m = i % 5
    if (m < 2) return 'active'
    if (m < 4) return 'expired'
    return 'invalidated'
  }
  for (let i = 0; i < setupTarget; i += 1) {
    const createdAt = spreadCreatedAt(f, setupTarget, i)
    const status = statusOf(i)
    const style = STYLES[i % STYLES.length]
    const session = SESSIONS[i % SESSIONS.length]
    const direction = DIRECTIONS[i % DIRECTIONS.length]
    const entry = Number(f.number.float({ min: 1, max: 50000, fractionDigits: 4 }))
    const slDelta = Number(f.number.float({ min: 0.5, max: 5, fractionDigits: 4 }))
    const stop = direction === 'long' ? entry * (1 - slDelta / 100) : entry * (1 + slDelta / 100)
    const tp = direction === 'long' ? entry * (1 + (slDelta * 2) / 100) : entry * (1 - (slDelta * 2) / 100)
    setupRows.push({
      analysis_id: analysisIds[i % analysisIds.length],
      instrument_id: instrumentIds[i % instrumentIds.length],
      style,
      session,
      session_day: createdAt.toISODate() as string,
      direction,
      opportunity_score: f.number.int({ min: 40, max: 99 }),
      risk_level: RISK_LEVELS[i % RISK_LEVELS.length],
      confidence: CONFIDENCES[i % CONFIDENCES.length],
      entry_price: entry,
      stop_loss: Number(stop.toFixed(4)),
      take_profits: [Number(tp.toFixed(4))],
      risk_reward: 2,
      payload: { seed: true, idx: i },
      status,
      valid_until: createdAt.plus({ days: 7 }).toISO() as string,
      created_at: createdAt.toISO() as string,
      source: SEED_SOURCE,
    })
  }

  // Garder les (id, status, createdAt) pour seeder les outcomes des résolus.
  const setups: Array<{ id: string; status: SetupStatus; resolvedAt: string }> = []
  let setupIdx = 0
  for (const batch of chunk(setupRows, 1000)) {
    const { data, error } = await client.from('trade_setups').insert(batch).select('id')
    if (error) throw new Error(`seed signals (trade_setups): ${error.message}`)
    for (const row of data ?? []) {
      const original = setupRows[setupIdx]
      // resolved_at = valid_until du setup (sortie à expiration) — étalé, jamais constant.
      const resolvedAt = DateTime.fromISO(original.valid_until as string).toISO() as string
      setups.push({ id: row.id, status: original.status as SetupStatus, resolvedAt })
      setupIdx += 1
    }
  }

  // ── 3. prediction_outcomes (UNIQUEMENT expired/invalidated, OUTCOMES BRUTS) ──
  // weightedArrayElement = POIDS de génération (55/35/10), PAS un % stocké.
  const outcomeRows: PredictionOutcomeInsert[] = []
  for (const setup of setups) {
    if (setup.status === 'active') continue // un setup actif n'a pas encore d'issue
    const outcome = f.helpers.weightedArrayElement<Outcome>([
      { weight: 55, value: 'hit_tp' },
      { weight: 35, value: 'hit_sl' },
      { weight: 10, value: 'flat' },
    ])
    outcomeRows.push({
      setup_id: setup.id, // PK = setup_id (1 outcome / setup résolu)
      outcome,
      realized_r: realizedRFor(f, outcome),
      resolved_at: setup.resolvedAt,
      candle_count: f.number.int({ min: 5, max: 200 }),
      source: SEED_SOURCE,
    })
  }

  let outcomeCount = 0
  for (const batch of chunk(outcomeRows, 1000)) {
    const { error } = await client.from('prediction_outcomes').insert(batch)
    if (error) throw new Error(`seed signals (prediction_outcomes): ${error.message}`)
    outcomeCount += batch.length
  }

  return { analyses: analysisIds.length, setups: setups.length, outcomes: outcomeCount }
}
