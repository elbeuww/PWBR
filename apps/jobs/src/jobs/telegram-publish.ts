/**
 * Job telegram-publish — publication horaire idempotente du « fil de l'eau » (TG-01/TG-03).
 *
 * Exécuté chaque heure APRÈS outcome-tracker (Windows Task Scheduler / routine Claude).
 * Miroir STRUCTUREL de outcome-tracker.ts : service_role lazy, fonction async retournant
 * Json, enregistrée dans dispatch.ts (runJob trace job_runs — RIEN à coder ici).
 *
 * Décision de cadence (D-01) à chaque run, horloge UTC (luxon) :
 *  - À chaque run : poste les NOTABLES fraîchement résolus (realized_r ≥ 2.0, D-02).
 *  - Au run récap (~21h UTC, RECAP_HOUR_UTC = 21, D-08) : récap quotidien — même un
 *    jour sans trade clos poste « aucun trade » + win rate (D-10), jamais de skip.
 *  - Le vendredi (weekday === 5, D-09) : post win-rate-seul.
 *
 * Idempotence à 2 niveaux (TG-03, T-06-DUP) :
 *  1. getPostedKeys (sélection bornée applicative) — on n'envoie que les dedupe_key absents.
 *  2. insertPost onConflict 'dedupe_key' ignoreDuplicates (filet DB inviolable).
 *  Un 2e run consécutif n'envoie aucun message en double (posted=0, sendMessage non rappelé).
 *
 * Ordre send THEN insert (Pitfall 2) : on envoie d'abord, on insère le dedupe_key ensuite.
 * Si l'insert échoue, on logge BRUYAMMENT (pino error) sans masquer — ne jamais swallow.
 *
 * Secrets (T-06-TOKEN) : token/channel_id lus uniquement via getBot/getChannelId
 * (apps/jobs/.env). JAMAIS loggés, JAMAIS dans le Json retourné / job_runs.stats.
 *
 * Minimisation (D-03, T-06-LEAK) : le SELECT trades ne lit QUE
 * symbol+direction+outcome+realized_r — JAMAIS entry_price/stop_loss/take_profits.
 *
 * Référence : outcome-tracker.ts (squelette) ; 06-RESEARCH §Pattern 1/6/7 + Pitfalls 1/2.
 */
import 'dotenv/config'
import pino from 'pino'
import { DateTime } from 'luxon'
import { createClient } from '@supabase/supabase-js'
import { applyThreshold, formatMessage } from '@app/core'
import type { StatRow, FormatTrade, FormatInput, Outcome } from '@app/core'
import { getPatternStats, insertPost, getPostedKeys } from '@app/supabase'
import type { Json, Database, TelegramPostInsert } from '@app/supabase'
import { getBot, getChannelId, sendPost } from '../telegram/bot'

const logger = pino({ level: 'info' })

/**
 * Heure UTC du run récap quotidien (D-08).
 * Aligner sur DAILY_ANCHOR/constants.ts si l'ancre quotidienne évolue.
 */
const RECAP_HOUR_UTC = 21

/** Seuil R d'un trade « notable » publiable à chaque run (D-02). */
const NOTABLE_R = 2.0

/** Fenêtre de sélection des trades fraîchement résolus (Open Q1 = resolved_at). */
const WINDOW_HOURS = 24

// ─── Client service_role lazy ────────────────────────────────────────────────

function getServiceClient() {
  const url = process.env['SUPABASE_URL']
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!url || !key) {
    throw new Error(
      'telegram-publish: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in apps/jobs/.env',
    )
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// ─── Forme minimale d'un trade clos (D-03 — JAMAIS entry/sl/tp) ────────────────

interface ResolvedTrade extends FormatTrade {
  setup_id: string
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Sélectionne la ligne win rate globale (overall / all / all_time) de pattern_stats.
 * Source UNIQUE partagée avec la vitrine (D-11). N brut + applyThreshold côté app.
 */
async function loadGlobalStat(
  client: ReturnType<typeof getServiceClient>,
): Promise<StatRow> {
  const { rows, error } = await getPatternStats(client)
  if (error) {
    throw new Error(`telegram-publish: getPatternStats failed: ${error}`)
  }
  const global = rows.find(
    (r) => r.dimension === 'overall' && r.bucket === 'all' && r.period === 'all_time',
  )
  return {
    n: global?.n ?? 0,
    win_rate: global?.win_rate ?? null,
    expectancy: global?.expectancy ?? null,
    avg_r: global?.avg_r ?? null,
  }
}

/**
 * SELECT trades fraîchement résolus sur resolved_at (Open Q1, Pitfall 1 — JAMAIS valid_until).
 * Minimisation D-03 : on ne mappe QUE symbol+direction+outcome+realized_r.
 */
async function loadResolvedTrades(
  client: ReturnType<typeof getServiceClient>,
  windowStart: string,
): Promise<ResolvedTrade[]> {
  const { data, error } = await client
    .from('prediction_outcomes')
    .select('setup_id, outcome, realized_r, resolved_at, trade_setups(direction, instruments(symbol))')
    .gte('resolved_at', windowStart)
    .order('resolved_at', { ascending: false })

  if (error) {
    throw new Error(`telegram-publish: select prediction_outcomes failed: ${error.message}`)
  }

  // Le shape joint Supabase peut renvoyer trade_setups en objet ou tableau selon la
  // cardinalité inférée — on normalise défensivement sans jamais lire de niveau premium.
  return (data ?? []).map((r) => {
    const row = r as unknown as {
      setup_id: string
      outcome: Outcome['outcome']
      realized_r: number
      trade_setups:
        | { direction: 'long' | 'short'; instruments: { symbol: string } | { symbol: string }[] }
        | { direction: 'long' | 'short'; instruments: { symbol: string } | { symbol: string }[] }[]
        | null
    }
    const setup = Array.isArray(row.trade_setups) ? row.trade_setups[0] : row.trade_setups
    const inst = Array.isArray(setup?.instruments) ? setup?.instruments[0] : setup?.instruments
    return {
      setup_id: row.setup_id,
      symbol: inst?.symbol ?? '?',
      direction: setup?.direction ?? 'long',
      outcome: row.outcome,
      realized_r: row.realized_r,
    }
  })
}

// ─── Job principal ────────────────────────────────────────────────────────────

/**
 * Décide du/des post(s) à publier, envoie via grammY puis trace l'idempotence.
 * Idempotent : un 2e run consécutif retourne posted=0 sans réémettre.
 *
 * @param injectedNow Horloge UTC injectable (tests déterministes) — défaut now() UTC.
 */
export async function telegramPublish(injectedNow?: DateTime): Promise<Json> {
  const client = getServiceClient()
  const now = (injectedNow ?? DateTime.now()).setZone('UTC')
  const dayKey = now.toISODate() ?? now.toFormat('yyyy-MM-dd') // YYYY-MM-DD UTC

  // Bornes & cadence (luxon, UTC).
  const windowStart = now.minus({ hours: WINDOW_HOURS }).toISO() ?? ''
  const isFriday = now.weekday === 5 // luxon : 1=lundi .. 7=dimanche (D-09)
  const isRecapHour = now.hour === RECAP_HOUR_UTC // D-08

  // Données partagées (win rate global + trades clos récents).
  const winRate = await loadGlobalStat(client)
  const trades = await loadResolvedTrades(client, windowStart)
  const posted = await getPostedKeys(client)

  const bot = getBot()
  const channelId = getChannelId()

  let postedCount = 0
  let skippedCount = 0

  /**
   * Envoie un post si sa clé est absente (niveau 1) puis trace (niveau 2).
   * send THEN insert (Pitfall 2) : insert échoué → log bruyant, jamais masqué.
   */
  const publish = async (
    dedupeKey: string,
    postType: TelegramPostInsert['post_type'],
    input: FormatInput,
  ): Promise<void> => {
    if (posted.has(dedupeKey)) {
      skippedCount += 1
      return
    }
    const html = formatMessage(input)
    const messageId = await sendPost(bot, channelId, html)
    try {
      await insertPost(client, {
        dedupe_key: dedupeKey,
        post_type: postType,
        tg_message_id: messageId,
      })
    } catch (err: unknown) {
      // Pitfall 2 : message déjà envoyé mais trace échouée — surface bruyamment,
      // ne jamais swallow (le filet onConflict couvrira le doublon au prochain run).
      const msg = err instanceof Error ? err.message : String(err)
      logger.error({ dedupeKey, postType }, `telegram-publish: insertPost failed after send: ${msg}`)
      throw err
    }
    posted.add(dedupeKey)
    postedCount += 1
  }

  // 1. NOTABLES fraîchement résolus (à CHAQUE run) — realized_r ≥ 2.0 (D-02).
  for (const tr of trades) {
    if (tr.realized_r >= NOTABLE_R) {
      const input: FormatInput = {
        kind: 'notable',
        winRate,
        trades: [{ symbol: tr.symbol, direction: tr.direction, outcome: tr.outcome, realized_r: tr.realized_r }],
      }
      await publish(`notable:${tr.setup_id}`, 'notable', input)
    }
  }

  // 2. RÉCAP quotidien au run récap (~21h UTC) — jour vide → poste quand même (D-10).
  if (isRecapHour) {
    const input: FormatInput = {
      kind: 'recap',
      winRate,
      trades: trades.map((t) => ({
        symbol: t.symbol,
        direction: t.direction,
        outcome: t.outcome,
        realized_r: t.realized_r,
      })),
    }
    await publish(`recap:${dayKey}`, 'recap', input)
  }

  // 3. WIN-RATE-SEUL le vendredi (D-09).
  if (isFriday) {
    const input: FormatInput = { kind: 'winrate', winRate, trades: [] }
    await publish(`winrate:${dayKey}`, 'winrate', input)
  }

  // applyThreshold est appelé en interne par formatMessage (D-11) ; on l'invoque
  // ici uniquement pour exposer le statut de seuil dans les stats sans fuiter de %.
  const threshold = applyThreshold(winRate)

  // NE JAMAIS inclure token/contenu brut dans les stats (T-06-TOKEN).
  return {
    posted: postedCount,
    skipped: skippedCount,
    sample_sufficient: threshold.sufficient,
    n: threshold.n,
  } as Json
}
