/**
 * Job calendar-ingest — ingestion du calendrier économique FairEconomy.
 *
 * D-31 : calendrier FairEconomy → economic_calendar → alimentera news_risk Phase 3.
 * D-25 : cadence 1×/jour (le cache in-process de fetchFairEconomyCalendar garantit ≤ 1 fetch/jour).
 * T-02-10 : rate limit FairEconomy 2 req/5min couvert par le cache 24h du client.
 * T-02-13 : stats.errors ne contient que message normalisé, jamais de clé API (FairEconomy n'en requiert pas).
 *
 * Source unique → try/catch global (A3 : source communautaire, Phase 3 dégradée si indisponible).
 *
 * Références : 02-PATTERNS.md §calendar-ingest / market-ingest.ts (squelette)
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { upsertEconomicCalendar } from '@app/supabase'
import type { Json, Database } from '@app/supabase'
import { fetchFairEconomyCalendar } from '@app/data-sources'

// ─── Client service_role lazy ────────────────────────────────────────────────

function getServiceClient() {
  const url = process.env['SUPABASE_URL']
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!url || !key) {
    throw new Error(
      'calendar-ingest: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in apps/jobs/.env',
    )
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// ─── Job principal ────────────────────────────────────────────────────────────

/**
 * Job calendar-ingest : tire le calendrier FairEconomy (caché 1×/jour) et upserte economic_calendar.
 * try/catch global car source unique (A3 : indisponibilité = Phase 3 dégradée, pas bloquant).
 */
export async function calendarIngest(): Promise<Json> {
  const stats = {
    inserted: 0,
    skipped: 0,
    errors: [] as Array<{ source: string; msg: string }>,
  }

  const client = getServiceClient()

  try {
    const rows = await fetchFairEconomyCalendar()

    if (rows.length === 0) {
      stats.skipped++
      return stats as Json
    }

    await upsertEconomicCalendar(client, rows)
    stats.inserted += rows.length
  } catch (err) {
    // Source unique en échec → stats.errors, non bloquant (A3)
    stats.errors.push({
      source: 'faireconomy',
      msg: err instanceof Error ? err.message : String(err),
    })
  }

  return stats as Json
}
