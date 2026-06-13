/**
 * Wrapper EMA (TECH-01).
 *
 * Source API : EMA.calculate({ period, values }) → number[]
 *   (length = values.length - period + 1)  [npmjs.com/package/technicalindicators]
 * D-37 : périodes standard 20/50/200, identiques sur tous les TF.
 * Valeur alignée sur la dernière bougie clôturée (at(-1)).
 */
import { EMA } from 'technicalindicators'
import type { CandleRow } from '@app/supabase'
import { toOhlcv } from '../ohlcv.js'

export const EMA_PERIODS = [20, 50, 200] as const

/** Série EMA complète pour la période donnée (warmup offset = period - 1). */
export function emaSeries(rows: readonly CandleRow[], period: number): number[] {
  return EMA.calculate({ period, values: toOhlcv(rows).closes })
}

/** Valeur EMA alignée sur la dernière bougie clôturée, ou null si historique insuffisant. */
export function ema(rows: readonly CandleRow[], period: number): number | null {
  return emaSeries(rows, period).at(-1) ?? null
}
