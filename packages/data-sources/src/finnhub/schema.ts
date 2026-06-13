/**
 * Schema Finnhub — parse des articles news vers NewsInsert.
 *
 * D-28 : mapping par catégorie ciblée, JAMAIS d'heuristique mots-clés.
 * D-30 : sentiment du provider stocké tel quel (null si absent — free tier ne fournit pas sentiment).
 * T-02-09 : aucune clé API manipulée ici.
 * T-02-11 : frontière Zod obligatoire sur les données externes.
 *
 * Pitfall 2 : ne PAS utiliser company-news ou news-sentiment (premium-locked).
 */
import { z } from 'zod'
import { createHash } from 'crypto'
import { DateTime } from 'luxon'
import type { NewsInsert } from '@app/supabase'

// Schéma d'un article Finnhub marketNews (free tier)
// Schéma tolérant : champs inconnus ignorés, valeurs optionnelles nullables
const FinnhubArticleSchema = z.object({
  category: z.string().optional(),
  datetime: z.number(), // Unix timestamp secondes
  headline: z.string(),
  id: z.number().optional(),
  image: z.string().nullable().optional(),
  related: z.string().nullable().optional(),
  source: z.string().optional(),
  summary: z.string().nullable().optional(),
  url: z.string(),
})

const FinnhubNewsResponseSchema = z.array(FinnhubArticleSchema)

export type FinnhubArticle = z.infer<typeof FinnhubArticleSchema>

/**
 * Dérive un url_hash déterministe depuis l'url (sha256 hex).
 * Même url => même hash, toujours. Permet la déduplication upsert.
 */
function deriveUrlHash(url: string): string {
  return createHash('sha256').update(url).digest('hex')
}

/**
 * Parse les articles bruts Finnhub et normalise en NewsInsert[].
 *
 * D-28 : instrument_ids vide — le job (plan 04) injecte le mapping catégorie→instruments.
 * D-30 : sentiment null (Finnhub free ne retourne pas de sentiment structuré pour forex/crypto).
 * source = 'finnhub' toujours.
 *
 * @param rawArticles - Réponse JSON brute Finnhub (unknown)
 * @param _category - Catégorie marketNews ('crypto'|'forex'|'general') — réservé au job pour mapping
 * @returns NewsInsert[] normalisés
 */
export function parseFinnhubNews(rawArticles: unknown, _category: string): NewsInsert[] {
  const parsed = FinnhubNewsResponseSchema.parse(rawArticles)

  return parsed.map((article): NewsInsert => {
    // Convertir unix timestamp secondes -> ISO UTC
    const publishedAt = DateTime.fromSeconds(article.datetime, { zone: 'utc' }).toISO()
    if (!publishedAt) {
      throw new Error(`parseFinnhubNews: invalid datetime "${article.datetime}"`)
    }

    return {
      source: 'finnhub',
      url_hash: deriveUrlHash(article.url),
      title: article.headline,
      summary: article.summary ?? null,
      published_at: publishedAt,
      // D-30 : sentiment null (free tier — pas de sentiment structuré crypto/forex)
      sentiment: null,
      // D-28 : instrument_ids vide — câblé par le job (plan 04), pas ici
      instrument_ids: [],
      impact: null,
    } satisfies NewsInsert
  })
}
