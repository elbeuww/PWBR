/**
 * Job telegram-publish — publication horaire idempotente du « fil de l'eau » (TG-01/TG-03).
 *
 * Exécuté chaque heure APRÈS outcome-tracker (Windows Task Scheduler / routine Claude).
 * Miroir STRUCTUREL de outcome-tracker.ts : service_role lazy, fonction async retournant
 * Json, enregistrée dans dispatch.ts (runJob trace job_runs — RIEN à coder ici).
 *
 * Décision de cadence (D-01) à chaque run, horloge UTC (luxon) :
 *  - À chaque run : poste les NOTABLES fraîchement résolus (realized_r ≥ 2.0, D-02).
 *  - Au run récap (à/après 21h UTC, now.hour >= RECAP_HOUR_UTC, D-08) : récap quotidien —
 *    même un jour sans trade clos poste « aucun trade » + win rate (D-10), jamais de skip.
 *    Le seuil >= (et non ===) rattrape un run de 21h manqué (PC éteint) aux heures suivantes
 *    du même jour UTC ; l'idempotence (recap:<jour>) garantit un seul récap par jour.
 *  - Le vendredi (weekday === 5, D-09) : post win-rate-seul.
 *
 * Idempotence anti double-post (TG-03, T-06-DUP) — RÉSERVER AVANT D'ENVOYER :
 *  1. getPostedKeys (sélection applicative) — on saute les dedupe_key déjà connus.
 *  2. reservePost (upsert ignoreDuplicates + select) AVANT le sendMessage : on n'envoie
 *     QUE si la réservation est gagnée. Un crash entre réservation et envoi laisse la clé
 *     en base → le run suivant SKIP (post manqué, JAMAIS un doublon public). Si l'envoi
 *     échoue, releasePost annule la réservation (retry propre, pas de skip silencieux).
 *  Un 2e run consécutif n'envoie aucun message en double (posted=0, sendMessage non rappelé).
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
import { getPatternStats, reservePost, releasePost, getPostedKeys } from '@app/supabase'
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
    const symbol = inst?.symbol
    const direction = setup?.direction
    // WR-03 fail-fast : ne JAMAIS publier un symbole placeholder ('?') ni une direction
    // devinée par défaut ('long') sur un canal public de réputation. Un trade incomplet
    // fait échouer le job BRUYAMMENT (remonté dans job_runs), il n'est pas publié à tort.
    if (!symbol || !direction) {
      throw new Error(
        `telegram-publish: trade ${row.setup_id} missing symbol/direction — refusing to publish incomplete data`,
      )
    }
    return {
      setup_id: row.setup_id,
      symbol,
      direction,
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
  // D-08/D-10 : récap dû à/après 21h UTC. `>=` (et non `===`) rattrape un run de 21h
  // manqué (PC éteint) aux heures suivantes ; recap:<jour> garantit l'unicité quotidienne.
  const isRecapDue = now.hour >= RECAP_HOUR_UTC

  // Données partagées (win rate global + trades clos récents).
  const winRate = await loadGlobalStat(client)
  const trades = await loadResolvedTrades(client, windowStart)
  const posted = await getPostedKeys(client)

  const bot = getBot()
  const channelId = getChannelId()

  let postedCount = 0
  let skippedCount = 0

  /**
   * RÉSERVE la clé (niveau 2) AVANT d'envoyer (anti double-post, T-06-DUP) puis envoie.
   *
   * Ordre reserve THEN send (CR-02) : si le process meurt entre la réservation et
   * l'envoi, la clé existe déjà → le run suivant SKIP (post manqué, JAMAIS un doublon
   * visible sur le canal public). Si l'envoi échoue, on LIBÈRE la réservation pour
   * autoriser un retry propre (pas de skip silencieux, D-10) et on surface bruyamment.
   */
  const publish = async (
    dedupeKey: string,
    postType: TelegramPostInsert['post_type'],
    input: FormatInput,
  ): Promise<void> => {
    // Niveau 1 (applicatif) : clé déjà connue de ce run → rien à faire.
    if (posted.has(dedupeKey)) {
      skippedCount += 1
      return
    }
    // Niveau 2 (DB, inviolable) : réserver le créneau AVANT tout envoi.
    const won = await reservePost(client, {
      dedupe_key: dedupeKey,
      post_type: postType,
      // tg_message_id renseigné à null : la réservation précède l'envoi, donc le
      // message_id n'est pas encore connu. La table ne sert qu'à l'idempotence (P6
      // publication-only : aucune édition/suppression de post ne le consomme).
      tg_message_id: null,
    })
    if (!won) {
      // Clé déjà prise (run concurrent ou réservation antérieure) → ne pas réémettre.
      posted.add(dedupeKey)
      skippedCount += 1
      return
    }
    const html = formatMessage(input)
    try {
      await sendPost(bot, channelId, html)
    } catch (err: unknown) {
      // Envoi échoué après réservation : libérer la clé pour permettre un retry
      // (sinon le post serait marqué fait mais jamais envoyé). Ne jamais swallow.
      const msg = err instanceof Error ? err.message : String(err)
      logger.error(
        { dedupeKey, postType },
        `telegram-publish: sendPost failed after reserve, releasing key: ${msg}`,
      )
      await releasePost(client, dedupeKey)
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

  // 2. RÉCAP quotidien au run récap (à/après 21h UTC) — jour vide → poste quand même (D-10).
  if (isRecapDue) {
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
