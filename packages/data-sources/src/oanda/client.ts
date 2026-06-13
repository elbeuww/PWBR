/**
 * Client OANDA — candles OHLCV via fetch+Zod maison (compte démo).
 *
 * T-02-05 : OANDA_API_TOKEN depuis env uniquement (throw si absent), jamais loggé.
 * Pitfall 3 : count XOR from/to — on utilise TOUJOURS from+to, jamais count seul.
 * T-02-06 : rate limit via p-limit(2) + p-retry (respect Retry-After).
 *
 * Référence : CLAUDE.md §OANDA / 02-PATTERNS.md §oanda/client.ts
 */
import { z } from 'zod'
import pLimit from 'p-limit'
import pRetry from 'p-retry'

const OANDA_BASE = 'https://api-fxpractice.oanda.com' // compte démo

// Rate limit : OANDA ~120 req/s → pLimit(2) suffisant pour pulls multi-TF
const limit = pLimit(2)

// Schéma de validation de la réponse (frontière Zod — T-02-04)
const OandaCandlesResponseSchema = z.object({
  candles: z.array(
    z.object({
      time: z.string(),
      mid: z.object({
        o: z.string(),
        h: z.string(),
        l: z.string(),
        c: z.string(),
      }),
      volume: z.number(),
      complete: z.boolean(),
    }),
  ),
})

export type OandaCandlesResponse = z.infer<typeof OandaCandlesResponseSchema>

/**
 * Télécharge les candles OANDA pour un symbole/granularity/fenêtre donnés.
 *
 * Pitfall 3 : utilise TOUJOURS from+to (jamais count seul).
 * Retourne la réponse parsée et validée Zod.
 *
 * @param sourceSymbol - Symbole OANDA ex: 'EUR_USD', 'WTICO_USD'
 * @param granularity - Granularity OANDA ex: 'H1', 'H4', 'D'
 * @param fromIso - Borne basse ISO UTC (inclusive)
 * @param toIso - Borne haute ISO UTC (exclusive)
 * @returns Réponse parsée Zod
 */
export async function fetchOandaCandles(
  sourceSymbol: string,
  granularity: string,
  fromIso: string,
  toIso: string,
): Promise<OandaCandlesResponse> {
  // T-02-05 : token depuis env, throw si absent
  const token = process.env['OANDA_API_TOKEN']
  if (!token) {
    throw new Error('OANDA_API_TOKEN must be set in apps/jobs/.env')
  }

  return limit(() =>
    pRetry(
      async () => {
        // Pitfall 3 : count XOR from/to → utiliser from+to
        const url =
          `${OANDA_BASE}/v3/instruments/${sourceSymbol}/candles` +
          `?granularity=${granularity}&from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}&price=M`

        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        })

        if (!res.ok) {
          const err = new Error(`OANDA ${sourceSymbol} ${granularity}: HTTP ${res.status} ${res.statusText}`)
          // Propager Retry-After pour onFailedAttempt (p-retry v8)
          if (res.status === 429) {
            const retryAfterSec = Number(res.headers.get('retry-after') ?? 0)
            ;(err as Error & { retryAfterMs?: number }).retryAfterMs =
              Number.isFinite(retryAfterSec) && retryAfterSec > 0
                ? retryAfterSec * 1000
                : undefined
          }
          throw err
        }

        const json: unknown = await res.json()
        return OandaCandlesResponseSchema.parse(json)
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
