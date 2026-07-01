/**
 * Job market-ingest — gap-fill OHLCV multi-instrument/timeframe.
 *
 * Pull les klines crypto (Binance mainnet public) et les candles OANDA démo
 * (forex + or + argent + pétrole), les normalise UTC et les upserte sans doublon.
 *
 * D-17 : lit uniquement les instruments actifs (active = true).
 * D-18 : mapping canonical_symbol → source_symbol via instruments.source_symbol en base.
 * D-20 : instrument indisponible = skip + erreur dans stats.errors, les autres continuent.
 * D-21 : backfill initial 2 ans Daily / 6 mois H4/H1.
 * D-22 : un seul job auto-rattrapant (gap-fill depuis la dernière bougie en base).
 *
 * Références : 02-PATTERNS.md §market-ingest / heartbeat.ts (signature job)
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { DateTime } from 'luxon'
import {
  TIMEFRAMES,
  lastClosedCandleStart,
  dailyAnchorStart,
} from '@app/core'
import type { DataSource } from '@app/core'
import {
  listActiveInstruments,
  upsertCandles,
  getLastCandleTs,
} from '@app/supabase'
import type { Json, Database, CandleInsert } from '@app/supabase'
import { fetchBinanceKlines, parseBinanceKlines } from '@app/data-sources'
import {
  fetchTwelveDataTimeSeries,
  parseTwelveDataTimeSeries,
  toTwelveDataSymbol,
  toTwelveDataInterval,
} from '@app/data-sources'

type Timeframe = keyof typeof TIMEFRAMES

// ─── Utilitaire gap-fill exporté pour les tests ──────────────────────────────

/**
 * Calcule la fenêtre since/until pour le gap-fill d'un instrument/timeframe.
 * Exporté pour être testé unitairement (gap-fill.test.ts).
 *
 * @param tf - Timeframe ('H1' | 'H4' | 'D')
 * @param lastTs - Dernier ts en base (ISO UTC) ou null pour backfill complet
 * @param broker - Source de données ('binance' | 'oanda')
 * @param now - Instant de référence (pour les tests déterministes)
 * @returns { since: DateTime, until: DateTime }
 */
export function computeGapFillWindow(
  tf: Timeframe,
  lastTs: string | null,
  broker: DataSource,
  now: DateTime,
): { since: DateTime; until: DateTime } {
  // Borne basse : dernier ts ou backfill initial (D-21)
  const since = lastTs
    ? DateTime.fromISO(lastTs, { zone: 'utc' })
    : tf === 'D'
      ? now.toUTC().minus({ years: 2 })
      : now.toUTC().minus({ months: 6 })

  // Borne haute exclusive (anti look-ahead DATA-05 D-10) :
  // until = début de la bougie EN COURS (la première non-clôturée).
  // Toute bougie avec openTime < until est clôturée → safe à ingérer.
  // lastClosedCandleStart / dailyAnchorStart retournent l'ouverture de la
  // DERNIÈRE bougie clôturée ; on y ajoute la durée du timeframe pour obtenir
  // l'ouverture de la bougie en cours (borne exclusive correcte).
  const lastClosed =
    tf === 'D'
      ? dailyAnchorStart(broker, now)
      : lastClosedCandleStart(now, TIMEFRAMES[tf])
  const until = lastClosed.plus({ minutes: TIMEFRAMES[tf] })

  return { since, until }
}

// ─── Client service_role lazy ────────────────────────────────────────────────

function getServiceClient() {
  const url = process.env['SUPABASE_URL']
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!url || !key) {
    throw new Error(
      'market-ingest: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in apps/jobs/.env',
    )
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// ─── Pagination Binance ───────────────────────────────────────────────────────

const BINANCE_INTERVAL_MAP: Record<Timeframe, string> = {
  H1: '1h',
  H4: '4h',
  D: '1d',
}

const BINANCE_LIMIT = 1000

async function ingestBinance(
  sourceSymbol: string,
  instrumentId: string,
  tf: Timeframe,
  since: DateTime,
  until: DateTime,
): Promise<CandleInsert[]> {
  const interval = BINANCE_INTERVAL_MAP[tf]
  const tfMs = TIMEFRAMES[tf] * 60 * 1000
  const allCandles: CandleInsert[] = []

  let currentStart = since
  while (currentStart.toMillis() < until.toMillis()) {
    const pageEnd = DateTime.fromMillis(
      Math.min(
        currentStart.toMillis() + BINANCE_LIMIT * tfMs,
        until.toMillis(),
      ),
      { zone: 'utc' },
    )

    const rawKlines = await fetchBinanceKlines(
      sourceSymbol,
      interval,
      currentStart.toMillis(),
      pageEnd.toMillis() - 1, // endTime inclusif dans Binance
    )

    if (rawKlines.length === 0) break

    const candles = parseBinanceKlines(rawKlines, instrumentId, tf)
    allCandles.push(...candles)

    // Avancer pour la page suivante
    const lastCandle = candles[candles.length - 1]
    if (!lastCandle) break
    const lastTs = DateTime.fromISO(lastCandle.ts, { zone: 'utc' })
    currentStart = lastTs.plus({ milliseconds: tfMs })
  }

  return allCandles
}

// ─── Twelve Data (forex + or) ─────────────────────────────────────────────────
//
// APPROCHE : OANDA remplacé par Twelve Data (token OANDA mort → 401). On CONSERVE
// broker='oanda' en DB (pas de churn de schéma) ; le dataSource 'oanda' est routé
// ici vers Twelve Data. Réversible = revert de ce code.
//
// TD FREE couvre EUR/USD, GBP/USD, AUD/USD, USD/JPY, XAU/USD. XAG/USD + WTI ne sont
// PAS couverts (404 Grow/Venture) → désactivés en DB via migration 0022.
//
// PAS de pagination : un seul appel (outputsize=5000) couvre le backfill max
// (2 ans daily ≈730 bougies, 6 mois H1 ≈4320 < 5000) → 1 crédit/(instrument×tf),
// compatible avec le rate limit FREE 8/min (throttle strict dans le client).
//
// NOTE anti look-ahead : TD n'expose PAS de flag `complete` (contrairement à OANDA) ;
// la bougie EN COURS peut apparaître → on filtre ici `ts < until` (borne haute exclusive).
// NOTE daily : les bougies daily TD sont datées 00:00 UTC (≠ ancre OANDA 17:00 NY de
// computeGapFillWindow, inchangée) → nouveaux ts, dédup upsert sûre (clé
// instrument_id+timeframe+ts), aucun conflit ; forward-only.
async function ingestTwelveData(
  sourceSymbol: string,
  instrumentId: string,
  tf: Timeframe,
  since: DateTime,
  until: DateTime,
): Promise<CandleInsert[]> {
  // Bornes UTC au format SQL attendu par TD (start_date / end_date).
  const startDate = since.toUTC().toFormat('yyyy-MM-dd HH:mm:ss')
  const endDate = until.toUTC().toFormat('yyyy-MM-dd HH:mm:ss')

  const raw = await fetchTwelveDataTimeSeries(
    toTwelveDataSymbol(sourceSymbol),
    toTwelveDataInterval(tf),
    startDate,
    endDate,
  )
  const candles = parseTwelveDataTimeSeries(raw, instrumentId, tf)

  // Anti look-ahead : ne garder que les bougies strictement AVANT la borne exclusive.
  const untilMs = until.toMillis()
  return candles.filter(
    (c) => DateTime.fromISO(c.ts, { zone: 'utc' }).toMillis() < untilMs,
  )
}

// ─── Job principal ────────────────────────────────────────────────────────────

/**
 * Job market-ingest : gap-fill OHLCV pour tous les instruments actifs × H1/H4/D.
 * Chaque (instrument × tf) est dans un try/catch isolé (DATA-07 / D-20).
 */
export async function marketIngest(): Promise<Json> {
  const stats = {
    inserted: 0,
    skipped: 0,
    errors: [] as Array<{ instrument: string; timeframe: string; msg: string }>,
  }

  const client = getServiceClient()
  const instruments = await listActiveInstruments(client)
  const now = DateTime.utc()

  const timeframes: Timeframe[] = ['H1', 'H4', 'D']

  for (const inst of instruments) {
    for (const tf of timeframes) {
      try {
        // Vérifier que le broker est défini et mapper vers DataSource
        const broker = inst.broker
        if (!broker) {
          stats.skipped++
          continue
        }

        // Mapper broker vers source de données
        const dataSource: DataSource | null =
          broker === 'binance'
            ? 'binance'
            : broker === 'oanda'
              ? 'oanda'
              : null

        if (!dataSource) {
          stats.skipped++
          continue
        }

        // source_symbol depuis la base (D-18)
        const sourceSymbol = inst.source_symbol
        if (!sourceSymbol) {
          stats.errors.push({
            instrument: inst.canonical_symbol ?? inst.symbol,
            timeframe: tf,
            msg: `source_symbol manquant pour instrument ${inst.id}`,
          })
          continue
        }

        // Gap-fill : calculer la fenêtre depuis le dernier ts en base
        const lastTs = await getLastCandleTs(client, inst.id, tf)
        const { since, until } = computeGapFillWindow(tf, lastTs, dataSource, now)

        // Si fenêtre vide (since >= until), rien à faire
        if (since.toMillis() >= until.toMillis()) {
          stats.skipped++
          continue
        }

        // Pull + normalisation selon la source
        let candles: CandleInsert[]
        if (dataSource === 'binance') {
          candles = await ingestBinance(sourceSymbol, inst.id, tf, since, until)
        } else {
          candles = await ingestTwelveData(sourceSymbol, inst.id, tf, since, until)
        }

        // Upsert idempotent (DATA-06)
        if (candles.length > 0) {
          await upsertCandles(client, candles)
          stats.inserted += candles.length
        } else {
          stats.skipped++
        }
      } catch (e) {
        // D-20 : isolation par instrument — erreur push dans stats, les autres continuent
        stats.errors.push({
          instrument: inst.canonical_symbol ?? inst.symbol,
          timeframe: tf,
          msg: e instanceof Error ? e.message : String(e),
        })
      }
    }
  }

  // WR-04 : si 0 instrument ingéré et des erreurs → job en échec total, pas succès silencieux
  if (stats.inserted === 0 && stats.skipped === 0 && stats.errors.length > 0) {
    throw new Error(
      `market-ingest: 0 cible ingérée sur ${stats.errors.length} erreur(s) — ${stats.errors[0]?.msg ?? 'voir stats.errors'}`,
    )
  }

  return stats as Json
}
