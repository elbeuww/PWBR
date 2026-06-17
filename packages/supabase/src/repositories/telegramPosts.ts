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
import type { Database, TelegramPostInsert } from '../database.types'

type ServiceClient = SupabaseClient<Database>

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
    .upsert([row], { onConflict: 'dedupe_key', ignoreDuplicates: true })

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
