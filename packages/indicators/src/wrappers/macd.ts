/**
 * Wrapper MACD 12/26/9 (TECH-01).
 *
 * Source API : MACD.calculate({ values, fastPeriod, slowPeriod, signalPeriod,
 *   SimpleMAOscillator:false, SimpleMASignal:false }) → { MACD, signal, histogram }[]
 *   [npmjs.com/package/technicalindicators]
 * D-37 : 12/26/9 standard. Valeur alignée sur la dernière bougie clôturée (at(-1)).
 * Le type interne de la lib n'est jamais exposé — on retourne un MacdValue propre.
 */
import { MACD } from 'technicalindicators'
import type { CandleRow } from '@app/supabase'
import { toOhlcv } from '../ohlcv.js'

export const MACD_FAST = 12
export const MACD_SLOW = 26
export const MACD_SIGNAL = 9

export interface MacdValue {
  readonly macd: number
  readonly signal: number
  readonly histogram: number
}

/** Série MACD complète (warmup offset slow+signal). */
export function macdSeries(rows: readonly CandleRow[]): MacdValue[] {
  const raw = MACD.calculate({
    values: toOhlcv(rows).closes,
    fastPeriod: MACD_FAST,
    slowPeriod: MACD_SLOW,
    signalPeriod: MACD_SIGNAL,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  })
  return raw.map((r) => ({
    macd: r.MACD ?? 0,
    signal: r.signal ?? 0,
    histogram: r.histogram ?? 0,
  }))
}

/** Valeur MACD alignée sur la dernière bougie clôturée, ou null si historique insuffisant. */
export function macd(rows: readonly CandleRow[]): MacdValue {
  return macdSeries(rows).at(-1) ?? { macd: 0, signal: 0, histogram: 0 }
}
