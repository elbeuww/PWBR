'use server'

/**
 * Server Actions — back-office membres (ADASH-04, D-03/D-13/D-16/D-17).
 *
 * SÉCURITÉ (T-20-15) : une Server Action est un endpoint POST appelable DIRECTEMENT, non
 * protégé par le layout (admin). On RE-VALIDE donc requireRole('superadmin') en tête de CHAQUE
 * action (défense en profondeur, double porte). La barrière RÉELLE reste la garde
 * is_superadmin() À L'INTÉRIEUR du RPC SECURITY DEFINER (0021), atomique avec l'audit.
 *
 * AUCUN service_role ici (D-01/D-03, T-20-03) : chaque écriture passe par un RPC gated appelé
 * sur l'anon-client @supabase/ssr (createClient). La RLS / la garde RPC sont la frontière —
 * jamais la page. Les erreurs sont OPAQUES (T-20-16) : jamais d'err.message DB brut renvoyé.
 */
import 'server-only'
import { revalidatePath } from 'next/cache'
import { requireRole } from '../../../lib/auth/gate'
import { createClient } from '../../../lib/supabase/server'

export type AdminActionResult = { ok: true } | { ok: false; error: string }

/**
 * Durées autorisées (interval Postgres) — whitelist STRICTE côté serveur (T-20-10,
 * anti-injection de la valeur p_interval). Toute entrée hors liste est rejetée AVANT le RPC.
 */
const PERIODS: Record<string, string> = {
  '7 days': '7 days',
  '1 month': '1 month',
  '3 months': '3 months',
}

function parsePeriod(raw: FormDataEntryValue | null): string {
  const period = PERIODS[String(raw ?? '')]
  if (!period) throw new Error('period_invalid')
  return period
}

function requireUserId(formData: FormData): string {
  const user_id = String(formData.get('user_id') ?? '')
  if (!user_id) throw new Error('user_required')
  return user_id
}

/** Re-garde superadmin (POST direct, T-20-15) puis rend l'anon-client (jamais service_role). */
async function guard() {
  await requireRole('superadmin')
  return createClient()
}

/**
 * Mappe une erreur vers une clé OPAQUE (T-20-16). Ne JAMAIS propager err.message DB brut
 * (fuite d'implémentation). Sentinelles de validation connues renvoyées telles quelles ;
 * tout le reste loggé côté serveur + clé générique opaque.
 */
function fail(err: unknown): AdminActionResult {
  if (
    err instanceof Error &&
    (err.message === 'user_required' ||
      err.message === 'period_invalid' ||
      err.message === 'reason_required')
  ) {
    return { ok: false, error: err.message }
  }
  console.error('[membres/actions] échec action back-office :', err)
  return { ok: false, error: 'action_failed' }
}

/**
 * Offrir du temps gratuit (D-16) : prolonge l'abonnement via le RPC atomique gated+audit
 * grant_subscription_time. p_interval borné par la whitelist PERIODS (T-20-10).
 */
export async function grantSubscriptionTime(formData: FormData): Promise<AdminActionResult> {
  try {
    const supabase = await guard()
    const p_user_id = requireUserId(formData)
    const p_interval = parsePeriod(formData.get('period'))

    const { error } = await supabase.rpc('grant_subscription_time', { p_user_id, p_interval })
    if (error) throw error
    revalidatePath('/membres')
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

/**
 * Suspendre un compte (D-17, destructive) : barrière RLS réelle et RÉVERSIBLE via
 * suspend_account. Le motif est REQUIS (tracé dans admin_audit_log par le RPC).
 */
export async function suspendAccount(formData: FormData): Promise<AdminActionResult> {
  try {
    const supabase = await guard()
    const p_user_id = requireUserId(formData)
    const p_reason = String(formData.get('reason') ?? '').trim()
    if (!p_reason) throw new Error('reason_required')

    const { error } = await supabase.rpc('suspend_account', { p_user_id, p_reason })
    if (error) throw error
    revalidatePath('/membres')
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

/** Réactiver un compte (D-17) : lève la suspension via unsuspend_account (gated+audit). */
export async function unsuspendAccount(formData: FormData): Promise<AdminActionResult> {
  try {
    const supabase = await guard()
    const p_user_id = requireUserId(formData)

    const { error } = await supabase.rpc('unsuspend_account', { p_user_id })
    if (error) throw error
    revalidatePath('/membres')
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}
