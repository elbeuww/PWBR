/**
 * Job technical-engine — read candles → indicators + structure → §3 snapshot → hash → upsert.
 *
 * Premier slice vertical complet (TECH-04) : lit les bougies réelles en base,
 * assemble un technical_snapshot conforme §3 LOCKED par instrument × style
 * (D-36 : Day=H4/H1, Swing=Daily/H4), Zod-valide, hashe (D-41), upserte.
 *
 * Conventions :
 *  - D-10 : bougie clôturée via lastClosedCandleStart (@app/core), jamais recalculée.
 *  - D-23 : logique pure (buildTechnicalSnapshot) séparée de l'IO pour testabilité.
 *  - D-35 : volume_source 'real' (Binance) | 'proxy' (OANDA tick), flag d'honnêteté.
 *  - T-02-13 : stats.errors = message normalisé only, jamais de valeur de clé.
 *  - T-03-10 : TechnicalSnapshotSchema.parse AVANT upsert (fail fast sur dérive).
 *  - Pitfall 2 : < 200 bougies → snapshot partial:true + missing ['ema200'], pas de zéro silencieux.
 *  - Pitfall 5 : per-instrument try/catch, un instrument vide ne crash pas le job.
 *  - WR-04 : 0 produit + erreurs → throw, pas de succès silencieux.
 *  - D-07 : service-client jamais importé depuis le barrel @app/supabase.
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { DateTime } from 'luxon'
import {
  rsi,
  macd,
  ema,
  atr,
  atrSeries,
  detectSwings,
  detectBosChoch,
  clusterLevels,
  computePoc,
  snapshotContentHash,
  TechnicalSnapshotSchema,
  toOhlcv,
  type TechnicalSnapshot,
  type VolumeSource,
} from '@app/indicators'
import { upsertSnapshot, listActiveInstruments } from '@app/supabase'
import type { Json, Database, CandleRow, InstrumentRow, SnapshotInsert } from '@app/supabase'
import { lastClosedCandleStart, TIMEFRAMES } from '@app/core'

export type Style = 'day' | 'swing'

export interface BuildResult {
  readonly snapshot: TechnicalSnapshot
  readonly partial: boolean
  readonly missing: string[]
}

/** Mapping style → (HTF, LTF) timeframe + libellé timeframe_set (D-36). */
const STYLE_TF: Record<Style, { htf: 'H4' | 'D'; ltf: 'H1' | 'H4'; set: string }> = {
  day: { htf: 'H4', ltf: 'H1', set: 'H4/H1' },
  swing: { htf: 'D', ltf: 'H4', set: 'D/H4' },
}

/** Période EMA longue requise pour une tendance "complète" (Pitfall 2). */
const EMA_LONG = 200
const EMA_MID = 50

/**
 * Nombre de bougies les plus récentes à charger par (instrument, TF).
 * Couvre EMA200 + marge confortable pour ATR14, percentiles et structure,
 * tout en restant SOUS le cap 1000 lignes implicite de PostgREST (BUGFIX-CAP1000).
 */
const CANDLE_WARMUP = 500

// ─── Logique pure (D-23, testable hors-ligne) ─────────────────────────────────

/** Tendance d'un TF : close vs EMA200 (ou EMA50 en repli), confirmée par structure. */
function trendOf(rows: readonly CandleRow[]): 'bullish' | 'bearish' | 'range' {
  const close = rows.at(-1)?.close
  if (close === undefined) return 'range'
  const ref = ema(rows, EMA_LONG) ?? ema(rows, EMA_MID)
  if (ref === null) return 'range'
  const band = Math.abs(ref) * 0.001 // bande neutre 0.1% pour éviter le bruit
  if (close > ref + band) return 'bullish'
  if (close < ref - band) return 'bearish'
  return 'range'
}

/** Percentile rank (0..1) de la dernière valeur ATR dans sa série. */
function atrPercentile(rows: readonly CandleRow[]): number {
  const series = atrSeries(rows)
  const last = series.at(-1)
  if (last === undefined || series.length === 0) return 0
  const below = series.filter((v) => v <= last).length
  return Math.round((below / series.length) * 1000) / 1000
}

/** Volume récent (1/4 final) vs antérieur → expanding | contracting. */
function volumeState(rows: readonly CandleRow[]): 'expanding' | 'contracting' {
  const { vols } = toOhlcv(rows)
  if (vols.length < 4) return 'contracting'
  const cut = Math.floor(vols.length * 0.75)
  const prior = vols.slice(0, cut)
  const recent = vols.slice(cut)
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
  return mean(recent) > mean(prior) ? 'expanding' : 'contracting'
}

/**
 * Fonction pure d'assemblage du technical_snapshot §3.
 * @param candlesByTf - bougies clôturées par TF (HTF, LTF), ts ascendant
 * @param style - 'day' (H4/H1) | 'swing' (D/H4)
 * @param volumeSource - 'real' (Binance) | 'proxy' (OANDA tick)
 */
export function buildTechnicalSnapshot(
  candlesByTf: { htf: readonly CandleRow[]; ltf: readonly CandleRow[] },
  _style: Style,
  volumeSource: VolumeSource,
): BuildResult {
  const { htf, ltf } = candlesByTf

  // Pitfall 2 : historique insuffisant pour EMA200 → partial flaggé, jamais silencieux.
  const missing: string[] = []
  const enoughForEma200 =
    toOhlcv(htf).closes.length >= EMA_LONG && toOhlcv(ltf).closes.length >= EMA_LONG
  if (!enoughForEma200) missing.push('ema200')

  // Momentum / volatilité sur le LTF (timing d'entrée).
  const rsiVal = rsi(ltf) ?? 50
  const macdVal = macd(ltf)
  const atrVal = atr(ltf) ?? 0

  // Structure + niveaux sur le LTF.
  const swings = detectSwings(ltf)
  const structure = detectBosChoch(ltf, swings)
  const { highs, lows } = toOhlcv(ltf)
  const lastSwingHigh = structure.lastSwingHigh ?? Math.max(...highs)
  const lastSwingLow = structure.lastSwingLow ?? Math.min(...lows)

  const levels = clusterLevels(ltf, swings).map((l) => ({
    price: l.price,
    type: l.type as 'support' | 'resistance',
    strength: l.strength,
  }))
  const poc = computePoc(ltf, volumeSource)

  const snapshot: TechnicalSnapshot = {
    trend_htf: trendOf(htf),
    trend_ltf: trendOf(ltf),
    momentum: {
      rsi: Math.round(rsiVal * 100) / 100,
      macd_hist: Math.round(macdVal.histogram * 1e6) / 1e6,
      // slope = pente du momentum, dérivée de l'écart MACD↔signal.
      slope: Math.round((macdVal.macd - macdVal.signal) * 1e6) / 1e6,
    },
    volatility: {
      atr: Math.round(atrVal * 1e6) / 1e6,
      atr_percentile: atrPercentile(ltf),
    },
    key_levels: [
      ...levels,
      { price: poc.price, type: 'poc' as const, strength: 1, volume_source: poc.volume_source },
    ],
    structure: {
      last_swing_high: Math.round(lastSwingHigh * 100) / 100,
      last_swing_low: Math.round(lastSwingLow * 100) / 100,
      bos_choch: structure.signal,
    },
    volume_state: volumeState(ltf),
  }

  return { snapshot, partial: missing.length > 0, missing }
}

// ─── IO : client + lecture bougies ────────────────────────────────────────────

type ServiceClient = ReturnType<typeof createClient<Database>>

function getServiceClient(): ServiceClient {
  const url = process.env['SUPABASE_URL']
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!url || !key) {
    throw new Error(
      'technical-engine: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in apps/jobs/.env',
    )
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Lit les CANDLE_WARMUP bougies clôturées les PLUS RÉCENTES d'un (instrument, timeframe),
 * bougie en cours exclue (D-10), puis les retourne ré-ordonnées ascendant.
 *
 * La requête trie `ts desc` + `.limit(CANDLE_WARMUP)` pour ne charger que les N plus
 * récentes — sans cette borne, PostgREST plafonne implicitement à 1000 lignes et
 * renvoie les 1000 plus VIEILLES en ordre ascendant (BUGFIX-CAP1000). Le ré-ordre
 * ascendant se fait sur une COPIE (immutabilité CLAUDE.md), jamais en mutant `data`.
 *
 * @returns bougies ts ascendant, dernière = bougie clôturée la plus récente.
 */
async function readClosedCandles(
  client: ServiceClient,
  instrumentId: string,
  timeframe: 'H1' | 'H4' | 'D',
): Promise<CandleRow[]> {
  const tfMinutes = TIMEFRAMES[timeframe]
  const cutoff = lastClosedCandleStart(DateTime.utc(), tfMinutes)
  const { data, error } = await client
    .from('candles')
    .select('*')
    .eq('instrument_id', instrumentId)
    .eq('timeframe', timeframe)
    .lte('ts', cutoff.toISO())
    .order('ts', { ascending: false })
    .limit(CANDLE_WARMUP)
  if (error) {
    throw new Error(`readClosedCandles failed: ${error.message}`)
  }
  return (data ?? []).slice().reverse()
}

/** Source de volume selon le broker : Binance = volume réel, OANDA = tick proxy (D-35). */
function volumeSourceFor(instrument: InstrumentRow): VolumeSource {
  return instrument.broker === 'binance' ? 'real' : 'proxy'
}

// ─── Job principal ──────────────────────────────────────────────────────────��─

const STYLES: Style[] = ['day', 'swing']

/**
 * Job technical-engine : pour chaque instrument actif × style, assemble et persiste
 * un technical_snapshot §3 déterministe. Isolé par instrument (Pitfall 5).
 */
export async function technicalEngine(): Promise<Json> {
  const stats = {
    inserted: 0,
    skipped: 0,
    errors: [] as Array<{ instrument: string; msg: string }>,
  }

  const client = getServiceClient()
  const instruments = await listActiveInstruments(client)

  for (const instrument of instruments) {
    try {
      const volumeSource = volumeSourceFor(instrument)
      let producedForInstrument = 0

      for (const style of STYLES) {
        const tf = STYLE_TF[style]
        const [htf, ltf] = await Promise.all([
          readClosedCandles(client, instrument.id, tf.htf),
          readClosedCandles(client, instrument.id, tf.ltf),
        ])

        // Instrument/style sans bougies (ex. OANDA en attente) → skip isolé.
        if (htf.length === 0 || ltf.length === 0) {
          stats.skipped++
          continue
        }

        const { snapshot, partial } = buildTechnicalSnapshot({ htf, ltf }, style, volumeSource)

        // T-03-10 : valider §3 AVANT persist (fail fast sur dérive de forme).
        const validated = TechnicalSnapshotSchema.parse(snapshot)
        const payload = validated as unknown as Json
        const computedForTs = ltf.at(-1)!.ts

        const row: SnapshotInsert = {
          instrument_id: instrument.id,
          style,
          timeframe_set: tf.set,
          kind: 'technical',
          computed_for_ts: computedForTs,
          content_hash: snapshotContentHash(payload),
          payload,
          partial,
        }

        await upsertSnapshot(client, row)
        stats.inserted++
        producedForInstrument++
      }

      if (producedForInstrument === 0) stats.skipped++
    } catch (err) {
      // T-02-13 : message normalisé uniquement, jamais la valeur de clé.
      stats.errors.push({
        instrument: instrument.symbol,
        msg: err instanceof Error ? err.message : String(err),
      })
    }
  }

  // WR-04 : 0 produit total + erreurs → échec, pas de succès silencieux.
  if (stats.inserted === 0 && stats.errors.length > 0) {
    throw new Error(
      `technical-engine: 0 snapshot produit sur ${stats.errors.length} erreur(s) — ${stats.errors[0]?.msg ?? 'voir stats.errors'}`,
    )
  }

  return stats as Json
}
