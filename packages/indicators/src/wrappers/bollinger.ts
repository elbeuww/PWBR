/**
 * Wrapper Bollinger Bands 20/2 (TECH-01).
 *
 * Source API : BollingerBands.calculate({ period, stdDev, values })
 *   → { middle, upper, lower, pb }[]  (length = values.length - period + 1)
 *   [npmjs.com/package/technicalindicators]
 * D-37 : 20/2 standard. Valeur alignée sur la dernière bougie clôturée (at(-1)).
 * Le type interne de la lib n'est jamais exposé — on retourne un BollingerValue propre.
 */
import { BollingerBands } from 'technicalindicators'
import type { CandleRow } from '@app/supabase'
import { toOhlcv } from '../ohlcv.js'

export const BB_PERIOD = 20
export const BB_STDDEV = 2

export interface BollingerValue {
  readonly middle: number
  readonly upper: number
  readonly lower: number
  readonly pb: number
}

/** Série Bollinger complète (warmup offset = period - 1). */
export function bollingerSeries(rows: readonly CandleRow[]): BollingerValue[] {
  const raw = BollingerBands.calculate({
    period: BB_PERIOD,
    stdDev: BB_STDDEV,
    values: toOhlcv(rows).closes,
  })
  return raw.map((r) => ({
    middle: r.middle,
    upper: r.upper,
    lower: r.lower,
    pb: r.pb ?? 0,
  }))
}

/** Valeur Bollinger alignée sur la dernière bougie clôturée, ou null si historique insuffisant. */
export function bollinger(rows: readonly CandleRow[]): BollingerValue {
  return bollingerSeries(rows).at(-1) ?? { middle: 0, upper: 0, lower: 0, pb: 0 }
}
