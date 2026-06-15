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
import type { Database } from '../database.types'

type ServiceClient = SupabaseClient<Database>

// TODO(05-02 Task4): remplacer par les types générés (Database['public']['Tables']['prediction_outcomes']['Insert'])
// après apply_migration + generate_typescript_types. Type local minimal en attendant la régénération.
export interface PredictionOutcomeInsert {
  setup_id: string
  outcome: 'hit_tp' | 'hit_sl' | 'flat'
  realized_r: number
  candle_count?: number | null
}

/**
 * Insère un lot d'issues rejouées. Idempotent : onConflict 'setup_id' ignoreDuplicates.
 */
export async function insertOutcomes(
  client: ServiceClient,
  rows: PredictionOutcomeInsert[],
): Promise<void> {
  if (rows.length === 0) return

  // TODO(05-02 Task4): retirer le cast `as never` une fois les types prediction_outcomes générés.
  const { error } = await (client.from('prediction_outcomes') as never)
    .upsert(rows, { onConflict: 'setup_id', ignoreDuplicates: true })

  if (error) {
    throw new Error(`insertOutcomes failed: ${(error as { message: string }).message}`)
  }
}

/**
 * Retourne l'ensemble des setup_id déjà résolus (sélection bornée, idempotence niveau 1).
 */
export async function getResolvedSetupIds(client: ServiceClient): Promise<Set<string>> {
  // TODO(05-02 Task4): retirer le cast `as never` une fois les types prediction_outcomes générés.
  const { data, error } = await (client.from('prediction_outcomes') as never).select('setup_id')

  if (error) {
    throw new Error(`getResolvedSetupIds failed: ${(error as { message: string }).message}`)
  }

  const rows = (data ?? []) as { setup_id: string }[]
  return new Set(rows.map((r) => r.setup_id))
}
