/**
 * Wrapper RSI 14 (TECH-01).
 *
 * Source API : RSI.calculate({ period, values }) → number[]
 *   (length = values.length - period — warmup offset)  [npmjs.com/package/technicalindicators]
 * D-37 : période standard 14, identique sur tous les TF.
 * La valeur exposée est alignée sur la DERNIÈRE bougie clôturée (at(-1)),
 * jamais index-alignée sur le tableau de bougies (RESEARCH Pitfall 1).
 */
import { RSI } from 'technicalindicators'
import type { CandleRow } from '@app/supabase'
import { toOhlcv } from '../ohlcv.js'

export const RSI_PERIOD = 14

/** Série RSI complète (plus courte que l'entrée du warmup). */
export function rsiSeries(rows: readonly CandleRow[]): number[] {
  return RSI.calculate({ period: RSI_PERIOD, values: toOhlcv(rows).closes })
}

/** Valeur RSI alignée sur la dernière bougie clôturée, ou null si historique insuffisant. */
export function rsi(rows: readonly CandleRow[]): number | null {
  return rsiSeries(rows).at(-1) ?? null
}
