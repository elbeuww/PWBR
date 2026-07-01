/**
 * Client Twelve Data — time_series OHLCV via fetch+Zod maison (remplace OANDA).
 *
 * T-1ib-02 : TWELVEDATA_API_KEY depuis env uniquement (throw si absent), JAMAIS
 *   loggée ni mise dans un message d'erreur.
 * T-1ib-03 : rate limit FREE = 8 crédits/min (1 appel time_series = 1 crédit) →
 *   throttle STRICT module-level (pLimit(1) + MIN_INTERVAL_MS 8s) + p-retry (429).
 * Gère les DEUX modes d'erreur : HTTP !ok (429 → retry-after) ET body 200 avec
 *   status=error (code 429 = retryable ; 404/autres = non-retryable via AbortError
 *   pour ne pas gaspiller le quota sur un instrument non couvert).
 *
 * Calque : oanda/client.ts. NE PARSE PAS en CandleInsert (retourne le JSON brut).
 */
import pRetry, { AbortError } from 'p-retry'
import pLimit from 'p-limit'

const TWELVEDATA_BASE = 'https://api.twelvedata.com'

// FREE = 8 crédits/min → 1 appel/instant (pLimit(1)) + ≥7.5s entre appels (marge à 8s).
const limit = pLimit(1)
const MIN_INTERVAL_MS = 8000
let lastCallAt = 0

async function throttle(): Promise<void> {
  const wait = lastCallAt + MIN_INTERVAL_MS - Date.now()
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait))
  }
  lastCallAt = Date.now()
}

/**
 * Télécharge la série time_series Twelve Data pour un symbole/intervalle/fenêtre.
 * Retourne le JSON brut (non parsé) — la validation Zod se fait dans schema.ts.
 *
 * @param tdSymbol - Symbole Twelve Data ex 'EUR/USD'
 * @param tdInterval - Intervalle Twelve Data ex '1h' | '4h' | '1day'
 * @param startDate - Borne basse SQL UTC 'yyyy-MM-dd HH:mm:ss' (inclusive)
 * @param endDate - Borne haute SQL UTC 'yyyy-MM-dd HH:mm:ss' (exclusive côté ingest)
 * @returns Réponse JSON brute (unknown)
 */
export async function fetchTwelveDataTimeSeries(
  tdSymbol: string,
  tdInterval: string,
  startDate: string,
  endDate: string,
): Promise<unknown> {
  const token = process.env['TWELVEDATA_API_KEY']
  if (!token) {
    throw new Error('TWELVEDATA_API_KEY must be set in apps/jobs/.env')
  }

  return limit(() =>
    pRetry(
      async () => {
        await throttle()

        // apikey JAMAIS incluse dans un message d'erreur (T-1ib-02).
        const url =
          `${TWELVEDATA_BASE}/time_series` +
          `?symbol=${encodeURIComponent(tdSymbol)}` +
          `&interval=${tdInterval}` +
          `&outputsize=5000` +
          `&start_date=${encodeURIComponent(startDate)}` +
          `&end_date=${encodeURIComponent(endDate)}` +
          `&timezone=UTC` +
          `&apikey=${token}`

        const res = await fetch(url, {
          headers: { 'Content-Type': 'application/json' },
        })

        if (!res.ok) {
          const err = new Error(
            `Twelve Data ${tdSymbol} ${tdInterval}: HTTP ${res.status} ${res.statusText}`,
          )
          if (res.status === 429) {
            const retryAfterSec = Number(res.headers.get('retry-after') ?? 0)
            if (Number.isFinite(retryAfterSec) && retryAfterSec > 0) {
              ;(err as Error & { retryAfterMs?: number }).retryAfterMs = retryAfterSec * 1000
            }
          }
          throw err
        }

        const json: unknown = await res.json()

        // HTTP 200 peut porter un body { status:'error', code, message }.
        if (
          typeof json === 'object' &&
          json !== null &&
          'status' in json &&
          (json as { status?: unknown }).status === 'error'
        ) {
          const body = json as { code?: unknown; message?: unknown }
          const code = typeof body.code === 'number' ? body.code : 0
          const message = typeof body.message === 'string' ? body.message : 'unknown error'
          const err = new Error(`Twelve Data ${tdSymbol} ${tdInterval}: ${code} ${message}`)

          if (code === 429) {
            // rate limit → retryable : p-retry ré-essaie après throttle.
            throw err
          }
          // 404 (instrument non couvert) & autres erreurs métier → non-retryable :
          // AbortError coupe court (pas de gaspillage de quota), l'erreur remonte
          // et est isolée par instrument côté market-ingest.
          throw new AbortError(err)
        }

        return json
      },
      {
        retries: 3,
        onFailedAttempt: async ({ error }) => {
          const waitMs = (error as Error & { retryAfterMs?: number }).retryAfterMs
          if (waitMs && Number.isFinite(waitMs)) {
            await new Promise((resolve) => setTimeout(resolve, waitMs))
          }
        },
      },
    ),
  )
}
