'use server'

/**
 * Server Action — payout des commissions affiliées (AFF-04, D-15).
 *
 * SÉCURITÉ (Rule 2 / T-07-ADMIN-WRITE) : endpoint POST appelable directement → on RE-VALIDE
 * requireRole('superadmin') EN TÊTE. Écriture via service_role LOCAL (AUCUNE policy write front
 * sur commissions/payouts — RPC mark_commission_paid réservé service_role, migration 0016).
 *
 * markCommissionPaid (RPC atomique) : transition commission due→paid ET insert payouts dans
 * UNE transaction. Anti double-payout (T-07-DOUBLEPAY) porté par le RPC (raise si déjà payée).
 * Montant atomique = string (CR-02) : jamais Number (bigint > 2^53).
 */
import 'server-only'
import { revalidatePath } from 'next/cache'
import { markCommissionPaid } from '@app/supabase'
import { requireRole } from '../../../../lib/auth/gate'
import { createAdminServiceClient } from '../../../../lib/supabase/admin-service'

export type PayoutActionResult = { ok: true } | { ok: false; error: string }

/** Borne stricte : entier de chiffres seulement (montant atomique bigint, CR-02). */
const ATOMIC_PATTERN = /^[0-9]+$/

/** Borne TRON (M-03) : hash de transaction = 64 caractères hexadécimaux (SHA-256). */
const TX_HASH_PATTERN = /^[A-Fa-f0-9]{64}$/

export async function payCommission(formData: FormData): Promise<PayoutActionResult> {
  try {
    await requireRole('superadmin') // re-valide (endpoint POST direct, T-07-ADMIN-WRITE)
    const client = createAdminServiceClient()

    const commission_id = String(formData.get('commission_id') ?? '')
    const tx_hash = String(formData.get('tx_hash') ?? '').trim()
    const amount_atomic = String(formData.get('amount_atomic') ?? '').trim()

    if (!commission_id) throw new Error('commission_id requis')
    // M-03 — tx_hash borné : rejette tout ce qui n'est pas un hash TRON hex 64 caractères.
    if (!TX_HASH_PATTERN.test(tx_hash)) throw new Error('tx_hash_invalid')
    if (!ATOMIC_PATTERN.test(amount_atomic)) throw new Error('amount_invalid')

    // RPC atomique : insert payouts + commission due→paid (anti double-payout côté DB).
    await markCommissionPaid(client, { commission_id, tx_hash, amount_atomic })
    revalidatePath('/affiliation/payouts')
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

/**
 * Mappe une erreur vers une clé i18n OPAQUE (M-05). Ne JAMAIS propager `err.message` brut
 * (fuite d'implémentation DB / anti double-payout). Détail loggé serveur ; clé générique sinon.
 */
function fail(err: unknown): PayoutActionResult {
  if (err instanceof Error && (err.message === 'tx_hash_invalid' || err.message === 'amount_invalid')) {
    return { ok: false, error: err.message }
  }
  console.error('[affiliation/payouts] échec payout :', err)
  return { ok: false, error: 'action_failed' }
}
