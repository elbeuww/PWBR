/**
 * Client Binance — klines OHLCV via SDK mainnet public.
 *
 * T-02-SC : binance@3.5.9 verrouillé (tiagosiebler, audité RESEARCH §Package Legitimacy).
 * Pitfall 1 : MainClient{} sans clé = klines mainnet public (testnet n'a PAS d'historique).
 * T-02-06 : rate limit via p-limit(3) + p-retry (respect Retry-After).
 *
 * Référence : CLAUDE.md §binance / 02-PATTERNS.md §binance/client.ts
 */
import { MainClient } from 'binance'
import pLimit from 'p-limit'
import pRetry from 'p-retry'

// Mainnet public — AUCUNE clé : klines non signés (Pitfall 1)
const binanceClient = new MainClient({})

// Rate limit : Binance = 1200 weight/min, klines = poids faible → pLimit(3) suffisant
const limit = pLimit(3)

/**
 * Télécharge les klines Binance pour un symbole/interval/fenêtre donnés.
 * Retourne les tuples bruts (normalisation dans schema.ts).
 *
 * @param sourceSymbol - Symbole Binance ex: 'BTCUSDT'
 * @param interval - Interval Binance ex: '1h', '4h', '1d'
 * @param startTimeMs - Borne basse inclusive (ms epoch)
 * @param endTimeMs - Borne haute exclusive (ms epoch)
 * @returns Tuples klines bruts
 */
export async function fetchBinanceKlines(
  sourceSymbol: string,
  interval: string,
  startTimeMs: number,
  endTimeMs: number,
): Promise<unknown[][]> {
  return limit(() =>
    pRetry(
      async () => {
        const klines = await binanceClient.getKlines({
          symbol: sourceSymbol,
          interval: interval as Parameters<typeof binanceClient.getKlines>[0]['interval'],
          startTime: startTimeMs,
          endTime: endTimeMs,
          limit: 1000,
        })
        return klines as unknown[][]
      },
      {
        retries: 3,
        onFailedAttempt: (error) => {
          // Respect Retry-After si header présent
          const retryAfter = (error as { headers?: Record<string, string> }).headers?.[
            'retry-after'
          ]
          if (retryAfter) {
            const waitMs = Number(retryAfter) * 1000
            return new Promise((resolve) => setTimeout(resolve, waitMs))
          }
        },
      },
    ),
  )
}
