/**
 * Repository economic_calendar — écriture via service_role (bypass RLS).
 *
 * Idempotence : upsert onConflict (event_key)
 * correspond à l'index unique `economic_calendar_uniq` de la migration 0003.
 * Un re-run du même lot ne crée aucun doublon (DATA-06).
 *
 * JAMAIS importé depuis apps/web.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, EconomicCalendarInsert } from '../database.types'

type ServiceClient = SupabaseClient<Database>

/**
 * Upsert un lot d'événements de calendrier économique.
 * Idempotent : un appel avec les mêmes event_key laisse le count inchangé.
 */
export async function upsertEconomicCalendar(
  client: ServiceClient,
  rows: EconomicCalendarInsert[],
): Promise<void> {
  if (rows.length === 0) return

  const { error } = await client
    .from('economic_calendar')
    .upsert(rows, { onConflict: 'event_key', ignoreDuplicates: false })

  if (error) {
    throw new Error(`upsertEconomicCalendar failed: ${error.message}`)
  }
}
