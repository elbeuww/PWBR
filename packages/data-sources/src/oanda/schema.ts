/**
 * Schema OANDA — normalisation des candles vers CandleInsert.
 *
 * T-02-04 : frontière Zod obligatoire (données externes non fiables).
 * T-02-07 : filtre complete:true uniquement (anti bougie en cours).
 *
 * Référence : CLAUDE.md §OANDA — réponse :
 * { candles: [{ time, mid:{o,h,l,c}, volume, complete }] }
 */
import { z } from 'zod'
import { DateTime } from 'luxon'
import type { CandleInsert } from '@app/supabase'

// Schéma de la réponse OANDA candles
const OandaCandleSchema = z.object({
  time: z.string(),
  mid: z.object({
    o: z.string(),
    h: z.string(),
    l: z.string(),
    c: z.string(),
  }),
  volume: z.number(),
  complete: z.boolean(),
})

const OandaCandlesResponseSchema = z.object({
  candles: z.array(OandaCandleSchema),
})

/**
 * Parse la réponse OANDA brute et normalise en CandleInsert[].
 * Filtre les bougies complete:false (bougie en cours — T-02-07).
 *
 * @param rawResponse - Réponse JSON brute OANDA (unknown)
 * @param instrumentId - UUID de l'instrument (injection)
 * @param timeframe - Timeframe string ('H1' | 'H4' | 'D')
 * @returns CandleInsert[] normalisés UTC (bougies complètes uniquement)
 */
export function parseOandaCandles(
  rawResponse: unknown,
  instrumentId: string,
  timeframe: string,
): CandleInsert[] {
  const parsed = OandaCandlesResponseSchema.parse(rawResponse)

  return parsed.candles
    .filter((c) => c.complete)
    .map((c) => {
      // Normaliser le timestamp en ISO UTC
      const ts = DateTime.fromISO(c.time, { zone: 'utc' }).toISO()

      if (!ts) {
        throw new Error(`parseOandaCandles: invalid time "${c.time}"`)
      }

      return {
        instrument_id: instrumentId,
        timeframe,
        ts,
        open: Number(c.mid.o),
        high: Number(c.mid.h),
        low: Number(c.mid.l),
        close: Number(c.mid.c),
        volume: c.volume,
      } satisfies CandleInsert
    })
}
