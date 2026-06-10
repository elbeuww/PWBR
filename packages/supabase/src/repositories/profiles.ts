/**
 * Repository profiles — lecture/mise à jour de sa propre ligne (RLS : id = auth.uid()).
 *
 * Le client anon est passé en argument — il doit être authentifié (session valide).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, ProfileRow } from '../database.types.js'

type Client = SupabaseClient<Database>

/**
 * Retourne la ligne profiles de l'utilisateur authentifié.
 * Retourne null si la session n'est pas active (pas de ligne accessible par RLS).
 */
export async function getOwnProfile(client: Client): Promise<ProfileRow | null> {
  const { data: { user } } = await client.auth.getUser()
  if (!user) return null

  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error) {
    // PGRST116 = "0 rows returned" (RLS silencieux) — retourne null
    if (error.code === 'PGRST116') return null
    throw new Error(`getOwnProfile failed: ${error.message}`)
  }

  return data
}
