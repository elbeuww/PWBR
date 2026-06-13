/**
 * Schema Binance — normalisation des klines vers CandleInsert.
 *
 * T-02-04 : frontière Zod obligatoire (données externes non fiables).
 * Les tuples bruts klines sont parsés et convertis en lignes typées UTC.
 *
 * Référence : CLAUDE.md §binance — klines = tuples
 * [openTime, open, high, low, close, volume, closeTime, ...]
 */
import { z } from 'zod'
import { DateTime } from 'luxon'
import type { CandleInsert } from '@app/supabase'

// Schéma d'un tuple kline Binance (12 éléments minimum)
const KlineTupleSchema = z.tuple([
  z.number(), // 0: openTime (ms)
  z.string(), // 1: open
  z.string(), // 2: high
  z.string(), // 3: low
  z.string(), // 4: close
  z.string(), // 5: volume
  z.number(), // 6: closeTime (ms)
]).rest(z.unknown()) // éléments supplémentaires ignorés

/**
 * Parse les tuples klines Binance bruts et les normalise en CandleInsert[].
 *
 * @param tuples - Tableau de tuples klines bruts (réponse SDK)
 * @param instrumentId - UUID de l'instrument (injection)
 * @param timeframe - Timeframe string ('H1' | 'H4' | 'D')
 * @returns CandleInsert[] normalisés UTC
 */
export function parseBinanceKlines(
  tuples: unknown[],
  instrumentId: string,
  timeframe: string,
): CandleInsert[] {
  if (tuples.length === 0) return []

  return tuples.map((rawTuple) => {
    const parsed = KlineTupleSchema.parse(rawTuple)
    const openTimeMs = parsed[0]
    const ts = DateTime.fromMillis(openTimeMs, { zone: 'utc' }).toISO()

    if (!ts) {
      throw new Error(`parseBinanceKlines: invalid openTime ${String(openTimeMs)}`)
    }

    return {
      instrument_id: instrumentId,
      timeframe,
      ts,
      open: Number(parsed[1]),
      high: Number(parsed[2]),
      low: Number(parsed[3]),
      close: Number(parsed[4]),
      volume: Number(parsed[5]),
    } satisfies CandleInsert
  })
}
