/**
 * Job macro-ingest — ingestion des séries macro FRED sur 2 ans.
 *
 * D-23 : historique 2 ans (fenêtre calculée dans fetchFredSeries).
 * D-25 : cadence 1×/jour via Windows Task Scheduler.
 * T-02-13 : stats.errors ne contient que la série + message normalisé, jamais la valeur de clé.
 *
 * Séries : DFF, CPIAUCSL, DTWEXBGS (proxy DXY), DFII10.
 * Isolation : une série en échec n'interrompt pas les autres (DATA-07).
 *
 * Références : 02-PATTERNS.md §macro-ingest / market-ingest.ts (squelette)
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { upsertMacroSeries } from '@app/supabase'
import type { Json, Database } from '@app/supabase'
import { fetchFredSeries, parseFredObservations } from '@app/data-sources'

// Séries FRED à ingérer (D-23 : DFF, CPIAUCSL, DTWEXBGS, DFII10)
const FRED_SERIES = ['DFF', 'CPIAUCSL', 'DTWEXBGS', 'DFII10'] as const

// ─── Client service_role lazy ────────────────────────────────────────────────

function getServiceClient() {
  const url = process.env['SUPABASE_URL']
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!url || !key) {
    throw new Error(
      'macro-ingest: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in apps/jobs/.env',
    )
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// ─── Job principal ────────────────────────────────────────────────────────────

/**
 * Job macro-ingest : tire chaque série FRED sur 2 ans et upserte macro_series.
 * Chaque série est dans un try/catch isolé (DATA-07).
 */
export async function macroIngest(): Promise<Json> {
  const stats = {
    inserted: 0,
    skipped: 0,
    errors: [] as Array<{ series: string; msg: string }>,
  }

  const client = getServiceClient()

  for (const seriesCode of FRED_SERIES) {
    try {
      const raw = await fetchFredSeries(seriesCode)
      const rows = parseFredObservations(raw, seriesCode)

      if (rows.length === 0) {
        stats.skipped++
        continue
      }

      await upsertMacroSeries(client, rows)
      stats.inserted += rows.length
    } catch (err) {
      // T-02-13 : message normalisé uniquement, jamais la valeur de la clé
      stats.errors.push({
        series: seriesCode,
        msg: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return stats as Json
}
