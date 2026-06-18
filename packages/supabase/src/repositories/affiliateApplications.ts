/**
 * Repository affiliate_applications — file de revue back-office (D-08).
 *
 * Frontière producteur-unique : l'insert de candidature ET les transitions de statut
 * passent par service_role (aucune policy write front, migration 0016). Le SELECT est
 * réservé au superadmin côté RLS ; ce repo le sert via service_role pour le back-office.
 *
 * Miroir de payments.transitionPayment : transition status-only (jamais delete).
 *
 * JAMAIS importé depuis apps/web (D-07/D-49 — service_role réservé aux jobs/serveur).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../database.types'

type ServiceClient = SupabaseClient<Database>

type AffiliateApplicationRow = Database['public']['Tables']['affiliate_applications']['Row']

/** Liste les candidatures en attente de revue (status='pending'), plus anciennes d'abord. */
export async function listPendingApplications(
  client: ServiceClient,
): Promise<AffiliateApplicationRow[]> {
  const { data, error } = await client
    .from('affiliate_applications')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`listPendingApplications failed: ${error.message}`)
  }

  return data ?? []
}

export interface TransitionApplicationExtra {
  reject_reason?: string
}

/**
 * Transition de statut d'une candidature (pending → approved | rejected). Status-only,
 * jamais delete (miroir transitionPayment). reject_reason posé sur un rejet.
 */
export async function transitionApplication(
  client: ServiceClient,
  id: string,
  status: 'approved' | 'rejected',
  extra: TransitionApplicationExtra = {},
): Promise<void> {
  const patch: Database['public']['Tables']['affiliate_applications']['Update'] = { status }
  if (extra.reject_reason !== undefined) {
    patch.reject_reason = extra.reject_reason
  }

  const { error } = await client
    .from('affiliate_applications')
    .update(patch)
    .eq('id', id)

  if (error) {
    throw new Error(`transitionApplication failed: ${error.message}`)
  }
}
