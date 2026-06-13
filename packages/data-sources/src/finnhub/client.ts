/**
 * Client Finnhub — news marché par catégorie (free tier).
 *
 * D-28 : utilise UNIQUEMENT marketNews(category) — JAMAIS companyNews/news-sentiment.
 * Pitfall 2 : companyNews = US equities only ; news-sentiment = premium-locked.
 * T-02-09 : FINNHUB_API_KEY depuis env uniquement (throw si absent), jamais loggée.
 * Rate limit : Finnhub free = 60 req/min → pLimit(1) + respect Retry-After.
 *
 * Référence : github.com/Finnhub-Stock-API/finnhub-js README
 */
import finnhub from 'finnhub'
import pLimit from 'p-limit'
import pRetry from 'p-retry'
import { parseFinnhubNews } from './schema.js'
import type { NewsInsert } from '@app/supabase'

// Rate limit Finnhub free : 60 req/min — pLimit(1) = 1 requête à la fois
const limit = pLimit(1)

export type FinnhubCategory = 'crypto' | 'forex' | 'general'

/**
 * Télécharge les news marché Finnhub pour une catégorie donnée.
 *
 * D-28 : marketNews(category) uniquement — pas de matching mots-clés.
 * Retourne NewsInsert[] normalisés et parsés Zod.
 *
 * @param category - Catégorie news : 'crypto' | 'forex' | 'general'
 * @returns NewsInsert[] parsés
 */
export async function fetchFinnhubNews(category: FinnhubCategory): Promise<NewsInsert[]> {
  // T-02-09 : clé depuis env, throw si absente
  const apiKey = process.env['FINNHUB_API_KEY']
  if (!apiKey) {
    throw new Error('FINNHUB_API_KEY must be set in apps/jobs/.env')
  }

  return limit(() =>
    pRetry(
      async () => {
        return new Promise<NewsInsert[]>((resolve, reject) => {
          // Initialiser le client SDK avec la clé
          const apiClient = new finnhub.DefaultApi()
          const apiConfig = finnhub.ApiClient.instance.authentications['api_key']
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          apiConfig.apiKey = apiKey

          // D-28 : marketNews UNIQUEMENT (PAS companyNews/news-sentiment — Pitfall 2)
          apiClient.marketNews(category, {}, (error: unknown, data: unknown) => {
            if (error) {
              reject(new Error(`Finnhub marketNews(${category}): ${String(error)}`))
              return
            }
            try {
              resolve(parseFinnhubNews(data, category))
            } catch (parseError) {
              reject(parseError)
            }
          })
        })
      },
      {
        retries: 3,
        // Note : le SDK finnhub (callback) ne propage pas les headers HTTP dans
        // son callback error — impossible d'extraire Retry-After ici. Le backoff
        // exponentiel par défaut de p-retry reste actif. pLimit(1) borne la
        // concurrence pour éviter les 429.
      },
    ),
  )
}
