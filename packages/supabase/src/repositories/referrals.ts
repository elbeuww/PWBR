/**
 * Repository referrals — lecture/comptage via service_role (bypass RLS).
 *
 * D-02 : le palier de taux dérive du NOMBRE D'INSCRITS via le code (audience),
 * exposé ici par `countReferrals` pour usage serveur (dashboard agrégé, affichage
 * de palier). Le calcul d'autorité reste en DB (RPC compute_affiliate_commissions
 * recompte côté SQL via le lateral cnt) — ce compteur sert l'affichage, pas le calcul.
 *
 * JAMAIS importé depuis apps/web (D-07/D-49 — service_role réservé aux jobs/serveur).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../database.types'

type ServiceClient = SupabaseClient<Database>

/**
 * Compte les filleuls (inscrits via le code) d'un affilié — D-02 (audience).
 * Utilise un count exact côté DB (head:true) sans rapatrier les lignes.
 */
export async function countReferrals(
  client: ServiceClient,
  affiliate_id: string,
): Promise<number> {
  const { count, error } = await client
    .from('referrals')
    .select('id', { count: 'exact', head: true })
    .eq('affiliate_id', affiliate_id)

  if (error) {
    throw new Error(`countReferrals: ${error.message}`)
  }

  return count ?? 0
}
