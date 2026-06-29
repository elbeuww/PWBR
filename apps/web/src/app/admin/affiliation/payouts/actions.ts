'use server'

/**
 * Server Action — payout des commissions affiliées (ADASH-05, D-03/D-15).
 *
 * SÉCURITÉ (T-20-15) : endpoint POST appelable DIRECTEMENT → on RE-VALIDE requireRole('superadmin')
 * EN TÊTE (défense en profondeur). La barrière RÉELLE est la garde is_superadmin() À L'INTÉRIEUR
 * du RPC SECURITY DEFINER admin_mark_commission_paid (0021). Plus AUCUN service_role (D-01/T-20-03) :
 * appel sur l'anon-client @supabase/ssr.
 *
 * admin_mark_commission_paid (RPC atomique gated+audit) : transition commission due→paid ET
 * insert payouts dans UNE transaction. Anti double-payout (T-20-09) porté DB-side (update
 * where status='due' + raise si déjà payée, calque 0016). Montant atomique validé en string
 * (CR-02) puis passé en number (le RPC cast en bigint côté SQL) avec garde MAX_SAFE_INTEGER.
 */
import 'server-only'
import { revalidatePath } from 'next/cache'
import { requireRole } from '../../../../lib/auth/gate'
import { createClient } from '../../../../lib/supabase/server'

export type PayoutActionResult = { ok: true } | { ok: false; error: string }

/** Borne stricte : entier de chiffres seulement (montant atomique bigint, CR-02). */
const ATOMIC_PATTERN = /^[0-9]+$/

/** Borne TRON (M-03) : hash de transaction = 64 caractères hexadécimaux (SHA-256). */
const TX_HASH_PATTERN = /^[A-Fa-f0-9]{64}$/

export async function payCommission(formData: FormData): Promise<PayoutActionResult> {
  try {
    await requireRole('superadmin') // re-valide (endpoint POST direct, T-20-15)
    const supabase = await createClient() // anon-client gated par le RPC (D-01)

    const p_commission_id = String(formData.get('commission_id') ?? '')
    const p_tx_hash = String(formData.get('tx_hash') ?? '').trim()
    const amount_atomic = String(formData.get('amount_atomic') ?? '').trim()

    if (!p_commission_id) throw new Error('commission_id requis')
    // M-03 — tx_hash borné : rejette tout ce qui n'est pas un hash TRON hex 64 caractères.
    if (!TX_HASH_PATTERN.test(p_tx_hash)) throw new Error('tx_hash_invalid')
    if (!ATOMIC_PATTERN.test(amount_atomic)) throw new Error('amount_invalid')
    // CR-02 — garde-fou précision : le RPC type p_amount_atomic en number (cast bigint SQL) ;
    // refuse au-delà de MAX_SAFE_INTEGER pour ne jamais perdre de précision silencieusement.
    const p_amount_atomic = Number(amount_atomic)
    if (!Number.isSafeInteger(p_amount_atomic)) throw new Error('amount_invalid')

    // RPC atomique gated : commission due→paid + insert payout + audit (anti double-payout DB).
    const { error } = await supabase.rpc('admin_mark_commission_paid', {
      p_commission_id,
      p_tx_hash,
      p_amount_atomic,
    })
    if (error) throw error
    revalidatePath('/affiliation/payouts')
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

/**
 * Mappe une erreur vers une clé i18n OPAQUE (T-20-16). Ne JAMAIS propager `err.message` brut
 * (fuite d'implémentation DB / anti double-payout). Détail loggé serveur ; clé générique sinon.
 */
function fail(err: unknown): PayoutActionResult {
  if (err instanceof Error && (err.message === 'tx_hash_invalid' || err.message === 'amount_invalid')) {
    return { ok: false, error: err.message }
  }
  console.error('[affiliation/payouts] échec payout :', err)
  return { ok: false, error: 'action_failed' }
}
