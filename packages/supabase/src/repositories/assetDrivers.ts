/**
 * Repository asset_drivers — lecture via service_role (bypass RLS).
 *
 * Table data-not-code (D-38) : drivers macro par actif, seedés en SQL et
 * extensibles par UPDATE. Consommé en lecture par le fundamental-engine.
 *
 * JAMAIS importé depuis apps/web.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { AssetDriverRow, Database } from '../database.types'

type ServiceClient = SupabaseClient<Database>

/**
 * Retourne les drivers macro associés à un instrument.
 * Liste vide si l'actif n'a aucun driver seedé.
 */
export async function getAssetDrivers(
  client: ServiceClient,
  instrumentId: string,
): Promise<AssetDriverRow[]> {
  const { data, error } = await client
    .from('asset_drivers')
    .select('*')
    .eq('instrument_id', instrumentId)

  if (error) {
    throw new Error(`getAssetDrivers failed: ${error.message}`)
  }

  return data ?? []
}
