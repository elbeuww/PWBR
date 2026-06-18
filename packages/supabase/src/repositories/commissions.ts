/**
 * Repository commissions — wrappers MINCES des RPC service_role (migration 0016).
 *
 * ⚠️ ZÉRO calcul financier en JS (T-07-FLOAT) : tout le calcul de commission vit
 * dans la DB (compute_affiliate_commissions — grille basis points, Σ revenu atomique,
 * exclusion self-ref D-12, filtre filleul actif AFF-05, upsert idempotent D-05). Ces
 * fonctions ne font qu'INVOQUER le RPC. Aucun INSERT/SELECT de calcul ici.
 *
 * Idempotence (T-07-DOUBLEPAY) : portée par le RPC (UNIQUE + on conflict do update
 * where status='due'). Un re-run du job = même total (jamais d'écrasement d'un payé).
 *
 * Montants atomiques = string (CR-02) : bigint Postgres > 2^53, jamais coercés en number.
 *
 * JAMAIS importé depuis apps/web (D-07/D-49 — service_role réservé aux jobs/serveur).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../database.types'

type ServiceClient = SupabaseClient<Database>

/**
 * AFF-03/AFF-05 — calcule (upsert idempotent) les commissions du mois calendaire
 * `period` ('YYYY-MM' UTC). Wrapper mince : tout le calcul est dans le RPC.
 * Retourne le jsonb du RPC (`{ period, rows }`).
 */
/** Format période = mois calendaire UTC strict 'YYYY-MM' (01-12). Validé AVANT le RPC (M-04). */
const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

export async function computeCommissions(
  client: ServiceClient,
  period: string,
): Promise<Database['public']['Functions']['compute_affiliate_commissions']['Returns']> {
  // Garde frontière (M-04) : rejette un mois hors 01-12 AVANT d'invoquer le RPC.
  if (!PERIOD_PATTERN.test(period)) {
    throw new Error(`computeCommissions: période invalide (attendu YYYY-MM, reçu "${period}")`)
  }

  const { data, error } = await client.rpc('compute_affiliate_commissions', {
    p_period: period,
  })

  if (error) {
    throw new Error(`computeCommissions failed: ${error.message}`)
  }

  return data
}

export interface MarkCommissionPaidInput {
  commission_id: string
  tx_hash: string
  /** Montant payé atomique (bigint ×10⁶). String — JAMAIS Number (CR-02). */
  amount_atomic: string
}

/**
 * AFF-04/D-15 — marque une commission payée (due→paid) ET trace le payout dans UNE
 * transaction (atomique côté RPC). Anti double-payout porté par le RPC (raise si
 * row_count=0). Wrapper mince : aucune logique ici.
 *
 * Note CR-02 : la signature générée type `p_amount_atomic: number`, mais la colonne
 * DB est bigint et le montant peut dépasser 2^53 → on transmet une STRING (PostgREST
 * la caste en bigint sans perte). Le cast d'argument est volontaire et documenté.
 */
export async function markCommissionPaid(
  client: ServiceClient,
  input: MarkCommissionPaidInput,
): Promise<void> {
  const { error } = await client.rpc('mark_commission_paid', {
    p_commission_id: input.commission_id,
    p_tx_hash: input.tx_hash,
    // bigint Postgres → string (PostgREST), jamais coercé en number (CR-02).
    p_amount_atomic: input.amount_atomic,
  } as unknown as Database['public']['Functions']['mark_commission_paid']['Args'])

  if (error) {
    throw new Error(`markCommissionPaid failed: ${error.message}`)
  }
}
