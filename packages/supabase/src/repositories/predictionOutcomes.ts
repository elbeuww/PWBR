/**
 * Repository prediction_outcomes — écriture via service_role (bypass RLS).
 *
 * Idempotence : upsert onConflict 'setup_id' ignoreDuplicates (PK setup_id de la
 * migration 0014). Un re-run du même lot n'insère aucun doublon (filet DB,
 * niveau 2 de l'idempotence ; le job borne déjà la sélection — niveau 1).
 *
 * Frontière producteur-unique (D-05) : seul le job outcome-tracker (service_role)
 * écrit cette table. JAMAIS importé depuis apps/web (D-07).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, PredictionOutcomeInsert } from '../database.types'

type ServiceClient = SupabaseClient<Database>

/**
 * Insère un lot d'issues rejouées. Idempotent : onConflict 'setup_id' ignoreDuplicates.
 */
export async function insertOutcomes(
  client: ServiceClient,
  rows: PredictionOutcomeInsert[],
): Promise<void> {
  if (rows.length === 0) return

  const { error } = await client
    .from('prediction_outcomes')
    .upsert(rows, { onConflict: 'setup_id', ignoreDuplicates: true })

  if (error) {
    throw new Error(`insertOutcomes failed: ${error.message}`)
  }
}

/**
 * Retourne l'ensemble des setup_id déjà résolus (sélection bornée, idempotence niveau 1).
 */
export async function getResolvedSetupIds(client: ServiceClient): Promise<Set<string>> {
  const { data, error } = await client.from('prediction_outcomes').select('setup_id')

  if (error) {
    throw new Error(`getResolvedSetupIds failed: ${error.message}`)
  }

  return new Set((data ?? []).map((r) => r.setup_id))
}
