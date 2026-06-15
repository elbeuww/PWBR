/**
 * Repository subscriptions — écriture via service_role (bypass RLS).
 *
 * `activateForPayment` appelle la RPC atomique `activate_subscription_for_payment`
 * (migration 0012) : payment->verified ET subscription->active en UNE transaction
 * (T-04-INCONSIST — jamais de divergence). La RPC est `revoke execute` pour
 * public/anon/authenticated → seul le service_role peut l'invoquer (A8).
 *
 * JAMAIS importé depuis apps/web (D-07 — service_role réservé aux jobs/serveur).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../database.types'

type ServiceClient = SupabaseClient<Database>

export interface ActivateForPaymentInput {
  payment_id: string
  user_id: string
  plan: 'discovery' | 'standard'
  /** Durée d'abonnement en interval Postgres, ex '7 days' / '1 month'. */
  period: string
}

/**
 * Active l'abonnement lié à un paiement via la RPC atomique (D-11 prolongation).
 * Typé sur `database.types.ts` (migration 0012 appliquée live).
 */
export async function activateForPayment(
  client: ServiceClient,
  input: ActivateForPaymentInput,
): Promise<void> {
  const { error } = await client.rpc('activate_subscription_for_payment', {
    p_payment_id: input.payment_id,
    p_user_id: input.user_id,
    p_plan: input.plan,
    p_period: input.period,
  })

  if (error) {
    throw new Error(`activateForPayment failed: ${error.message}`)
  }
}

/**
 * Expire les abonnements actifs dont la période est échue (pour le job, Plan 06).
 * status='active' AND current_period_end <= now() → 'expired'. Retourne le nombre expiré.
 */
export async function expireDue(client: ServiceClient): Promise<{ expired: number }> {
  const { data, error } = await client
    .from('subscriptions')
    .update({ status: 'expired' })
    .eq('status', 'active')
    .lte('current_period_end', new Date().toISOString())
    .select('id')

  if (error) {
    throw new Error(`expireDue failed: ${error.message}`)
  }

  return { expired: data?.length ?? 0 }
}

export interface ChangePlanInput {
  user_id: string
  plan: 'discovery' | 'standard'
  /** Optionnel : prolonge la période de cet interval (ex '1 month') si fourni. */
  period?: string
}

/**
 * Change le plan d'un user (admin, Plan 06). Sans `period`, ne touche que `plan`.
 * Avec `period`, la prolongation atomique passe par la RPC d'activation (D-11).
 */
export async function changePlan(
  client: ServiceClient,
  input: ChangePlanInput,
): Promise<void> {
  const { error } = await client
    .from('subscriptions')
    .update({ plan: input.plan })
    .eq('user_id', input.user_id)

  if (error) {
    throw new Error(`changePlan failed: ${error.message}`)
  }
}
