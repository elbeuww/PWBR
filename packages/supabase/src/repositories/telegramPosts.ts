/**
 * Repository telegram_posts — écriture via service_role (bypass RLS).
 *
 * Idempotence anti double-post (TG-03, T-06-DUP) — RÉSERVER AVANT D'ENVOYER :
 * la clé est insérée AVANT le sendMessage (reservePost), pas après. L'inversion
 * de l'ancien ordre send→insert élimine le double-post public : si le process
 * meurt entre la réservation et l'envoi, la clé existe déjà → le run suivant
 * SKIP (post manqué, jamais un doublon visible sur le canal). releasePost annule
 * la réservation quand l'envoi échoue, pour autoriser un retry propre (D-10).
 *
 *  - reservePost : upsert onConflict 'dedupe_key' ignoreDuplicates + .select() —
 *    renvoie true si CET appel a gagné le créneau (ligne réellement créée),
 *    false si la clé existait déjà (course concurrente / re-run). Filet inviolable
 *    via l'UNIQUE GLOBAL de la migration 0015 (miroir UNIQUE tx_hash P4).
 *  - getPostedKeys : niveau 1 (sélection applicative) — évite un aller-retour DB
 *    quand la clé est déjà connue.
 *
 * Frontière producteur-unique (D-05) : seul le job Telegram (service_role) écrit
 * cette table. JAMAIS importé depuis apps/web (D-07).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, TelegramPostInsert } from '../database.types'

type ServiceClient = SupabaseClient<Database>

/**
 * Réserve atomiquement une clé de publication AVANT l'envoi (anti double-post).
 *
 * upsert ignoreDuplicates + `.select()` : les lignes RÉELLEMENT insérées sont
 * retournées ; une clé en conflit n'y figure pas. On n'autorise l'envoi que si
 * la réservation a été gagnée.
 *
 * @returns true si la ligne a été créée par cet appel (envoi autorisé), false si
 *   la clé existait déjà (déjà publiée ou réservée par un run concurrent).
 */
export async function reservePost(
  client: ServiceClient,
  row: TelegramPostInsert,
): Promise<boolean> {
  const { data, error } = await client
    .from('telegram_posts')
    .upsert([row], { onConflict: 'dedupe_key', ignoreDuplicates: true })
    .select('dedupe_key')

  if (error) {
    throw new Error(`reservePost failed: ${error.message}`)
  }

  return (data ?? []).length > 0
}

/**
 * Libère une réservation (rollback) lorsque l'envoi échoue après reservePost.
 *
 * Sans ce rollback, une clé réservée mais jamais envoyée resterait en base et
 * ferait SKIP le post au run suivant → skip silencieux interdit (D-10). Idempotent.
 */
export async function releasePost(
  client: ServiceClient,
  dedupeKey: string,
): Promise<void> {
  const { error } = await client
    .from('telegram_posts')
    .delete()
    .eq('dedupe_key', dedupeKey)

  if (error) {
    throw new Error(`releasePost failed: ${error.message}`)
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
