/**
 * Repository macro_series — écriture via service_role (bypass RLS).
 *
 * Idempotence : upsert onConflict (series_code, ts)
 * correspond à l'index unique `macro_series_uniq` de la migration 0003.
 * Un re-run du même lot ne crée aucun doublon (DATA-06).
 *
 * JAMAIS importé depuis apps/web.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, MacroSeriesInsert } from '../database.types'

type ServiceClient = SupabaseClient<Database>

/**
 * Upsert un lot de points de série macro (FRED).
 * Idempotent : un appel avec les mêmes (series_code, ts) laisse le count inchangé.
 */
export async function upsertMacroSeries(
  client: ServiceClient,
  rows: MacroSeriesInsert[],
): Promise<void> {
  if (rows.length === 0) return

  const { error } = await client
    .from('macro_series')
    .upsert(rows, { onConflict: 'series_code,ts', ignoreDuplicates: false })

  if (error) {
    throw new Error(`upsertMacroSeries failed: ${error.message}`)
  }
}
