/**
 * Repository instruments — lecture uniquement (RLS : to authenticated).
 *
 * Le client anon est passé en argument pour rester testable
 * et ne pas forcer l'instanciation côté serveur.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, InstrumentRow } from '../database.types.js'

type Client = SupabaseClient<Database>

/**
 * Retourne tous les instruments actifs (active = true).
 * Utiliser depuis un RSC via createServerSupabaseClient.
 */
export async function listActiveInstruments(client: Client): Promise<InstrumentRow[]> {
  const { data, error } = await client
    .from('instruments')
    .select('*')
    .eq('active', true)
    .order('symbol')

  if (error) {
    throw new Error(`listActiveInstruments failed: ${error.message}`)
  }

  return data ?? []
}
