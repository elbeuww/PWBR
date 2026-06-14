/**
 * Repository analyses — écriture via service_role (bypass RLS).
 *
 * Une analyse IA = snapshot consommé + traçabilité de version
 * (model / prompt_version / schema_version / run_id, D-51). Insérée par la
 * frontière de confiance unique `apps/jobs/persist.ts` (D-43) ; un trade_setup
 * y est rattaché par FK (analysis_id).
 *
 * JAMAIS importé depuis apps/web (D-07 — service_role réservé aux jobs).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { AnalysisInsert, Database } from '../database.types'

type ServiceClient = SupabaseClient<Database>

/**
 * Insère une analyse et retourne son id (pour rattacher les trade_setups).
 */
export async function insertAnalysis(
  client: ServiceClient,
  row: AnalysisInsert,
): Promise<{ id: string }> {
  const { data, error } = await client
    .from('analyses')
    .insert([row])
    .select('id')
    .single()

  if (error) {
    throw new Error(`insertAnalysis failed: ${error.message}`)
  }

  return { id: data.id }
}
