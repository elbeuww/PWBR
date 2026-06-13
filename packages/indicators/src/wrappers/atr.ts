/**
 * Wrapper ATR 14 (TECH-01).
 *
 * Source API : ATR.calculate({ period, high, low, close }) → number[]
 *   (length = bougies - period — warmup offset)  [npmjs.com/package/technicalindicators]
 * D-37 : période standard 14. Valeur alignée sur la dernière bougie clôturée (at(-1)).
 * L'ATR alimente le filtre de swings (D-32) et la tolérance de clustering S/R (D-34).
 */
import { ATR } from 'technicalindicators'
import type { CandleRow } from '@app/supabase'
import { toOhlcv } from '../ohlcv.js'

export const ATR_PERIOD = 14

/** Série ATR complète (warmup offset = period). */
export function atrSeries(rows: readonly CandleRow[]): number[] {
  const { highs, lows, closes } = toOhlcv(rows)
  return ATR.calculate({ period: ATR_PERIOD, high: highs, low: lows, close: closes })
}

/** Valeur ATR alignée sur la dernière bougie clôturée, ou null si historique insuffisant. */
export function atr(rows: readonly CandleRow[]): number | null {
  return atrSeries(rows).at(-1) ?? null
}
