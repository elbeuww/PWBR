/**
 * Job news-ingest — ingestion des news marché par catégorie.
 *
 * D-28 : mapping par catégorie ciblée (crypto/forex/general), JAMAIS heuristique mots-clés.
 * D-29 : Finnhub primaire ; si Finnhub échoue/rate-limité, fallback Marketaux.
 *        Le fallback Marketaux est mémoïsé (1 seul appel par run, pas 1 par catégorie).
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
    errors: [] as Array<{ category: string; msg: string; fallback_used?: true }>,
  }

  const client = getServiceClient()

  // D-29 : fallback Marketaux mémoïsé — 1 seul appel par run max (quota 100 req/jour).
  // La promesse est créée à la demande et réutilisée pour les catégories suivantes.
  let marketauxFallbackPromise: Promise<Awaited<ReturnType<typeof fetchMarketauxNews>>> | null = null
  function getMarketauxOnce() {
    if (!marketauxFallbackPromise) {
      marketauxFallbackPromise = fetchMarketauxNews([])
    }
    return marketauxFallbackPromise
  }

  for (const category of NEWS_CATEGORIES) {
    try {
      const articles = await fetchFinnhubNews(category)

      if (articles.length === 0) {
        stats.skipped++
        continue
      }

      await upsertNews(client, articles)
      stats.inserted += articles.length
    } catch (err) {
      // Tracer l'erreur Finnhub — ne jamais avaler silencieusement (règle « never swallow »)
      const finnhubMsg = err instanceof Error ? err.message : String(err)

      // D-29 : Finnhub a échoué → fallback Marketaux (1 appel mémoïsé pour tout le run)
      try {
        const fallbackArticles = await getMarketauxOnce()
        if (fallbackArticles.length > 0) {
          await upsertNews(client, fallbackArticles)
          stats.inserted += fallbackArticles.length
        } else {
          stats.skipped++
        }
        // T-02-13 : message normalisé ; noter que le fallback a réussi
        stats.errors.push({
          category,
          msg: `finnhub: ${finnhubMsg} (fallback marketaux utilise)`,
          fallback_used: true,
        })
      } catch (fallbackErr) {
        // T-02-13 : message normalisé uniquement, jamais la valeur de la clé
        stats.errors.push({
          category,
          msg: `finnhub: ${finnhubMsg} | marketaux: ${fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)}`,
        })
      }
    }
  }

  return stats as Json
}
