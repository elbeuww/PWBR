/**
 * Job news-ingest — ingestion des news marché par catégorie.
 *
 * D-28 : mapping par catégorie ciblée (crypto/forex/general), JAMAIS heuristique mots-clés.
 * D-29 : Finnhub primaire ; si Finnhub échoue/rate-limité, fallback Marketaux.
 * D-30 : sentiment du provider stocké tel quel avec la source.
 * T-02-13 : stats.errors ne contient que la catégorie + message normalisé, jamais la valeur de clé.
 *
 * Isolation : une catégorie en échec n'interrompt pas les autres (DATA-07).
 *
 * Références : 02-PATTERNS.md §news-ingest / market-ingest.ts (squelette)
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { upsertNews } from '@app/supabase'
import type { Json, Database } from '@app/supabase'
import {
  fetchFinnhubNews,
  parseFinnhubNews,
  fetchMarketauxNews,
} from '@app/data-sources'
import type { FinnhubCategory } from '@app/data-sources'

// Catégories supportées (D-28 : marketNews par catégorie)
const NEWS_CATEGORIES: FinnhubCategory[] = ['crypto', 'forex', 'general']

// ─── Client service_role lazy ────────────────────────────────────────────────

function getServiceClient() {
  const url = process.env['SUPABASE_URL']
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!url || !key) {
    throw new Error(
      'news-ingest: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in apps/jobs/.env',
    )
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// ─── Job principal ────────────────────────────────────────────────────────────

/**
 * Job news-ingest : tire les news Finnhub par catégorie avec fallback Marketaux (D-29).
 * Chaque catégorie est dans un try/catch isolé (DATA-07).
 * Déduplication par url_hash (upsertNews).
 */
export async function newsIngest(): Promise<Json> {
  const stats = {
    inserted: 0,
    skipped: 0,
    errors: [] as Array<{ category: string; msg: string }>,
  }

  const client = getServiceClient()

  for (const category of NEWS_CATEGORIES) {
    try {
      let articles = await fetchFinnhubNews(category)

      // D-29 : Finnhub est primaire ; si 0 résultats ou rate-limit, fallback Marketaux
      if (articles.length === 0) {
        // Finnhub ne retourne rien pour cette catégorie → tenter Marketaux
        articles = await fetchMarketauxNews([])
      }

      if (articles.length === 0) {
        stats.skipped++
        continue
      }

      await upsertNews(client, articles)
      stats.inserted += articles.length
    } catch (err) {
      // D-29 : Finnhub a échoué → fallback Marketaux
      try {
        const fallbackArticles = await fetchMarketauxNews([])
        if (fallbackArticles.length > 0) {
          await upsertNews(client, fallbackArticles)
          stats.inserted += fallbackArticles.length
        } else {
          stats.skipped++
        }
      } catch (fallbackErr) {
        // T-02-13 : message normalisé uniquement, jamais la valeur de la clé
        stats.errors.push({
          category,
          msg:
            fallbackErr instanceof Error
              ? fallbackErr.message
              : String(fallbackErr),
        })
      }
    }
  }

  return stats as Json
}
