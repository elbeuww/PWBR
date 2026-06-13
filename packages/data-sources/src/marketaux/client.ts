/**
 * Client Marketaux — news fallback via fetch+Zod maison.
 *
 * D-29 : Marketaux est tiré SEULEMENT si Finnhub échoue/rate-limité.
 *        La logique fallback est câblée dans le job (plan 04), pas ici.
 * D-30 : sentiment du provider stocké tel quel avec la source.
 * T-02-09 : MARKETAUX_API_KEY depuis env uniquement (throw si absent), jamais loggée.
 * Rate limit : 100 req/jour (free), 3 articles/req — pas de pLimit agressif requis.
 *
 * Référence : api.marketaux.com/v1/news/all (endpoint public)
 */
import { z } from 'zod'
import pRetry from 'p-retry'
import { DateTime } from 'luxon'
import { createHash } from 'crypto'
import type { NewsInsert } from '@app/supabase'

const MARKETAUX_BASE = 'https://api.marketaux.com'

// Schéma d'un article Marketaux — tolérant (champs inattendus ignorés)
const MarketauxArticleSchema = z
  .object({
    uuid: z.string().optional(),
    title: z.string(),
    description: z.string().nullable().optional(),
    url: z.string(),
    published_at: z.string(), // ISO datetime
    // D-30 : sentiment borné [-1, 1] pour correspondre au check constraint DB.
    // .catch(null) : si la valeur est hors plage ou invalide, elle est ramenée à null
    // plutôt que de faire échouer tout le lot (l'article reste ingéré sans sentiment).
    sentiment_score: z.number().min(-1).max(1).nullable().optional().catch(null),
    entities: z
      .array(
        z.object({
          symbol: z.string().optional(),
          sentiment_score: z.number().min(-1).max(1).nullable().optional().catch(null),
        }),
      )
      .optional(),
  })
  .passthrough()

const MarketauxResponseSchema = z.object({
  data: z.array(MarketauxArticleSchema),
})

export type MarketauxResponse = z.infer<typeof MarketauxResponseSchema>

/**
 * Dérive un url_hash déterministe depuis l'url (sha256 hex).
 */
function deriveUrlHash(url: string): string {
  return createHash('sha256').update(url).digest('hex')
}

/**
 * Télécharge les news Marketaux pour un ensemble de symboles.
 *
 * @param symbols - Symboles ciblés ex: ['BTCUSDT', 'EURUSD']
 * @param limit - Nombre d'articles par requête (default 10, max 100 free)
 * @returns NewsInsert[] normalisés
 */
export async function fetchMarketauxNews(symbols: string[], limit = 10): Promise<NewsInsert[]> {
  // T-02-09 : clé depuis env, throw si absente
  const apiKey = process.env['MARKETAUX_API_KEY']
  if (!apiKey) {
    throw new Error('MARKETAUX_API_KEY must be set in apps/jobs/.env')
  }

  return pRetry(
    async () => {
      const symbolsParam = symbols.join(',')
      const url =
        `${MARKETAUX_BASE}/v1/news/all` +
        `?api_token=${encodeURIComponent(apiKey)}` +
        `&symbols=${encodeURIComponent(symbolsParam)}` +
        `&limit=${limit}`

      const res = await fetch(url)

      if (!res.ok) {
        const err = new Error(`Marketaux: HTTP ${res.status} ${res.statusText}`)
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
      const parsed = MarketauxResponseSchema.parse(json)
      return parseMarketauxNews(parsed)
    },
    {
      retries: 2,
      onFailedAttempt: async ({ error }) => {
        // Respect Retry-After propagé depuis la Response (voir throw ci-dessus)
        const waitMs = (error as Error & { retryAfterMs?: number }).retryAfterMs
        if (waitMs && Number.isFinite(waitMs)) {
          await new Promise((resolve) => setTimeout(resolve, waitMs))
        }
      },
    },
  )
}

/**
 * Parse la réponse Marketaux brute et normalise en NewsInsert[].
 *
 * D-30 : sentiment = sentiment_score du provider tel quel, null si absent.
 * source = 'marketaux' toujours.
 * url_hash = sha256(url).
 *
 * @param raw - Réponse JSON brute Marketaux (MarketauxResponse ou unknown)
 * @returns NewsInsert[] normalisés
 */
export function parseMarketauxNews(raw: unknown): NewsInsert[] {
  const parsed = MarketauxResponseSchema.parse(raw)

  return parsed.data.map((article): NewsInsert => {
    // Normaliser published_at en ISO UTC
    const publishedAt = DateTime.fromISO(article.published_at, { zone: 'utc' }).toISO()
    if (!publishedAt) {
      throw new Error(`parseMarketauxNews: invalid published_at "${article.published_at}"`)
    }

    return {
      source: 'marketaux',
      url_hash: deriveUrlHash(article.url),
      title: article.title,
      summary: article.description ?? null,
      published_at: publishedAt,
      // D-30 : sentiment provider tel quel
      sentiment: article.sentiment_score ?? null,
      // D-28 : instrument_ids vide — câblé par le job (plan 04)
      instrument_ids: [],
      impact: null,
    } satisfies NewsInsert
  })
}
