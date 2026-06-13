/**
 * Client FRED — séries macro via fetch+Zod maison.
 *
 * Séries : DFF (Fed funds), CPIAUCSL (CPI), DTWEXBGS (USD broad — proxy DXY, A5),
 *          DFII10 (real yield 10Y).
 * A5 : DTWEXBGS = Trade Weighted U.S. Dollar Index: Broad, Goods and Services.
 *      Ce n'est pas l'ICE DXY exact, mais c'est le meilleur proxy macro gratuit sur FRED.
 *
 * T-02-09 : FRED_API_KEY depuis env uniquement (throw si absent), jamais loggée.
 * Rate limit : 120 req/min → pLimit(2) suffisant.
 * Observation value === '.' = donnée manquante FRED → exclure (parseFredObservations).
 *
 * Référence : fred.stlouisfed.org (series/observations endpoint)
 */
import { z } from 'zod'
import pLimit from 'p-limit'
import pRetry from 'p-retry'
import { DateTime } from 'luxon'
import type { MacroSeriesInsert } from '@app/supabase'

const FRED_BASE = 'https://api.stlouisfed.org/fred'

// Rate limit FRED : 120 req/min → pLimit(2)
const limit = pLimit(2)

// Schéma d'une observation FRED
const FredObservationSchema = z.object({
  realtime_start: z.string().optional(),
  realtime_end: z.string().optional(),
  date: z.string(), // 'YYYY-MM-DD'
  value: z.string(), // '5.33' ou '.' si manquant
})

// Schéma de la réponse FRED series/observations
const FredObservationsResponseSchema = z.object({
  observations: z.array(FredObservationSchema),
})

export type FredObservationsResponse = z.infer<typeof FredObservationsResponseSchema>

/**
 * Télécharge les observations FRED pour une série sur 2 ans.
 *
 * @param seriesCode - Code série FRED ex: 'DFF', 'CPIAUCSL', 'DTWEXBGS', 'DFII10'
 * @returns Réponse brute parsée Zod (utiliser parseFredObservations pour normaliser)
 */
export async function fetchFredSeries(seriesCode: string): Promise<FredObservationsResponse> {
  // T-02-09 : clé depuis env, throw si absente
  const apiKey = process.env['FRED_API_KEY']
  if (!apiKey) {
    throw new Error('FRED_API_KEY must be set in apps/jobs/.env')
  }

  // Fenêtre de 2 ans en arrière depuis aujourd'hui (UTC)
  const twoYearsAgo = DateTime.utc().minus({ years: 2 }).toISODate()

  return limit(() =>
    pRetry(
      async () => {
        const url =
          `${FRED_BASE}/series/observations` +
          `?series_id=${encodeURIComponent(seriesCode)}` +
          `&api_key=${encodeURIComponent(apiKey)}` +
          `&file_type=json` +
          `&observation_start=${twoYearsAgo ?? ''}`

        const res = await fetch(url)

        if (!res.ok) {
          const err = new Error(`FRED ${seriesCode}: HTTP ${res.status} ${res.statusText}`)
          // Propager Retry-After pour onFailedAttempt (p-retry v8)
          if (res.status === 429) {
            const retryAfterSec = Number(res.headers.get('retry-after') ?? 0)
            if (Number.isFinite(retryAfterSec) && retryAfterSec > 0) {
              ;(err as Error & { retryAfterMs?: number }).retryAfterMs = retryAfterSec * 1000
            }
          }
          throw err
        }

        const json: unknown = await res.json()
        return FredObservationsResponseSchema.parse(json)
      },
      {
        retries: 3,
        onFailedAttempt: async ({ error }) => {
          // Respect Retry-After propagé depuis la Response (voir throw ci-dessus)
          const waitMs = (error as Error & { retryAfterMs?: number }).retryAfterMs
          if (waitMs && Number.isFinite(waitMs)) {
            await new Promise((resolve) => setTimeout(resolve, waitMs))
          }
        },
      },
    ),
  )
}

/**
 * Parse la réponse FRED brute et normalise en MacroSeriesInsert[].
 *
 * Règle : ignorer les observations avec value === '.' (donnée manquante FRED).
 * ts = date FRED (YYYY-MM-DD) interprétée en UTC minuit (ISO UTC).
 * value = Number(value) (déjà validé non-'.').
 *
 * @param raw - Réponse JSON brute FRED (unknown)
 * @param seriesCode - Code série FRED injecté
 * @returns MacroSeriesInsert[] normalisés UTC
 */
export function parseFredObservations(raw: unknown, seriesCode: string): MacroSeriesInsert[] {
  const parsed = FredObservationsResponseSchema.parse(raw)

  return parsed.observations
    .filter((obs) => obs.value !== '.') // Exclure les observations manquantes FRED
    .map((obs): MacroSeriesInsert => {
      // Normaliser la date FRED (YYYY-MM-DD) en ISO UTC minuit
      const ts = DateTime.fromISO(obs.date, { zone: 'utc' }).toISO()
      if (!ts) {
        throw new Error(`parseFredObservations: invalid date "${obs.date}"`)
      }

      return {
        series_code: seriesCode,
        ts,
        value: Number(obs.value),
      } satisfies MacroSeriesInsert
    })
}
