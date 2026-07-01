/**
 * Schema Twelve Data — normalisation time_series vers CandleInsert.
 *
 * Frontière Zod obligatoire (données externes non fiables — T-1ib-01).
 * Twelve Data renvoie les `values` du PLUS RÉCENT au plus ancien → on force
 * l'ordre ASCENDANT (le pipeline attend des ts croissants).
 * HTTP 200 peut porter un body `{ status:'error', code, message }` → throw explicite.
 *
 * Réponse succès :
 * { "values":[{ "datetime":"2026-07-01 10:00:00","open","high","low","close","volume" }], "status":"ok" }
 * `datetime` intraday = "yyyy-MM-dd HH:mm:ss" (espace, pas ISO) ; daily = "yyyy-MM-dd".
 * `volume` forex souvent "0" ou absent.
 */
import { z } from 'zod'
import { DateTime } from 'luxon'
import type { CandleInsert } from '@app/supabase'

const TwelveDataValueSchema = z.object({
  datetime: z.string(),
  open: z.string(),
  high: z.string(),
  low: z.string(),
  close: z.string(),
  volume: z.string().optional(),
})

const TwelveDataSuccessSchema = z.object({
  status: z.literal('ok'),
  values: z.array(TwelveDataValueSchema),
})

const TwelveDataErrorSchema = z.object({
  status: z.literal('error'),
  code: z.number(),
  message: z.string(),
})

/**
 * Parse la réponse Twelve Data brute et normalise en CandleInsert[] ASCENDANTS.
 *
 * @param rawResponse - Réponse JSON brute Twelve Data (unknown)
 * @param instrumentId - UUID de l'instrument (injection)
 * @param timeframe - Timeframe string ('H1' | 'H4' | 'D')
 * @returns CandleInsert[] normalisés UTC, triés ts croissants
 * @throws si body `status:'error'` (code + message dans le message d'erreur)
 */
export function parseTwelveDataTimeSeries(
  rawResponse: unknown,
  instrumentId: string,
  timeframe: string,
): CandleInsert[] {
  // Frontière : détecter un body d'erreur AVANT le parse succès (HTTP 200 + status=error).
  const errorParse = TwelveDataErrorSchema.safeParse(rawResponse)
  if (errorParse.success) {
    throw new Error(`Twelve Data ${errorParse.data.code}: ${errorParse.data.message}`)
  }

  const parsed = TwelveDataSuccessSchema.parse(rawResponse)

  const candles = parsed.values.map((v) => {
    // fromSQL gère "yyyy-MM-dd HH:mm:ss" (intraday) ET "yyyy-MM-dd" (daily → 00:00 UTC)
    const ts = DateTime.fromSQL(v.datetime, { zone: 'utc' }).toISO()
    if (!ts) {
      throw new Error(`parseTwelveDataTimeSeries: invalid datetime "${v.datetime}"`)
    }

    return {
      instrument_id: instrumentId,
      timeframe,
      ts,
      open: Number(v.open),
      high: Number(v.high),
      low: Number(v.low),
      close: Number(v.close),
      volume: v.volume ? Number(v.volume) : 0,
    } satisfies CandleInsert
  })

  // TD renvoie récent→ancien → réordonner ASCENDANT (ts croissants).
  return candles.sort(
    (a, b) =>
      DateTime.fromISO(a.ts, { zone: 'utc' }).toMillis() -
      DateTime.fromISO(b.ts, { zone: 'utc' }).toMillis(),
  )
}
