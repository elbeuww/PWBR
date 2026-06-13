/**
 * Repository snapshots — écriture via service_role (bypass RLS).
 *
 * Idempotence : upsert onConflict (instrument_id, style, kind, computed_for_ts)
 * correspond à l'index unique `snapshots_uniq` de la migration 0005.
 * Un re-run du même snapshot ne crée aucun doublon (D-41).
 *
 * content_hash (= raw_indicators_ref, D-41) est référencé par la Phase 4
 * via getSnapshotByHash.
 *
 * JAMAIS importé depuis apps/web.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, SnapshotInsert, SnapshotRow } from '../database.types'

type ServiceClient = SupabaseClient<Database>

/**
 * Upsert un snapshot.
 * Idempotent : un appel avec le même (instrument_id, style, kind, computed_for_ts)
 * laisse le count inchangé.
 */
export async function upsertSnapshot(client: ServiceClient, row: SnapshotInsert): Promise<void> {
  const { error } = await client
    .from('snapshots')
    .upsert([row], {
      onConflict: 'instrument_id,style,kind,computed_for_ts',
      ignoreDuplicates: false,
    })

  if (error) {
    throw new Error(`upsertSnapshot failed: ${error.message}`)
  }
}

/**
 * Retourne le snapshot dont le content_hash correspond, ou null (D-41).
 * Référencé par la Phase 4 pour résoudre un snapshot par son hash de contenu.
 */
export async function getSnapshotByHash(
  client: ServiceClient,
  hash: string,
): Promise<SnapshotRow | null> {
  const { data, error } = await client
    .from('snapshots')
    .select('*')
    .eq('content_hash', hash)
    .maybeSingle()

  if (error) {
    throw new Error(`getSnapshotByHash failed: ${error.message}`)
  }

  return data ?? null
}
