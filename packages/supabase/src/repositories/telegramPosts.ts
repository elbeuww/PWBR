/**
 * Repository telegram_posts — écriture via service_role (bypass RLS).
 *
 * Idempotence (TG-03) : upsert onConflict 'dedupe_key' ignoreDuplicates (UNIQUE
 * GLOBAL de la migration 0015). Un re-run du même événement publiable n'insère
 * aucun doublon (filet DB inviolable, miroir UNIQUE tx_hash P4 + onConflict P5).
 * getPostedKeys fournit le niveau 1 (sélection bornée applicative) ; l'UNIQUE
 * fournit le niveau 2 (filet inviolable même en course concurrente).
 *
 * Frontière producteur-unique (D-05) : seul le job Telegram (service_role) écrit
 * cette table. JAMAIS importé depuis apps/web (D-07).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../database.types'

type ServiceClient = SupabaseClient<Database>

// TODO(Task 2) : remplacé après gen types — `TelegramPostInsert` sera régénéré dans
// database.types.ts puis ré-exporté depuis l'index (alias maison, Pitfall 6 / D-05-02-F).
// Type provisoire minimal aligné sur la DDL 0015 (id/posted_at = defaults DB → optionnels).
type TelegramPostInsert = {
  dedupe_key: string
  post_type: 'recap' | 'notable' | 'winrate'
  tg_message_id?: number | null
  run_id?: string | null
}

/**
 * Insère une publication. Idempotent : onConflict 'dedupe_key' ignoreDuplicates.
 * Un re-run du même dedupe_key est silencieusement ignoré (pas d'erreur, pas de doublon).
 */
export async function insertPost(
  client: ServiceClient,
  row: TelegramPostInsert,
): Promise<void> {
  const { error } = await client
    .from('telegram_posts')
    // Cast provisoire retiré en Task 2 une fois le type régénéré présent dans Database.
    .upsert([row] as never, { onConflict: 'dedupe_key', ignoreDuplicates: true })

  if (error) {
    throw new Error(`insertPost failed: ${error.message}`)
  }
}

/**
 * Retourne l'ensemble des dedupe_key déjà postés (sélection bornée, idempotence niveau 1).
 */
export async function getPostedKeys(client: ServiceClient): Promise<Set<string>> {
  const { data, error } = await client.from('telegram_posts').select('dedupe_key')

  if (error) {
    throw new Error(`getPostedKeys failed: ${error.message}`)
  }

  return new Set((data ?? []).map((r) => r.dedupe_key))
}
