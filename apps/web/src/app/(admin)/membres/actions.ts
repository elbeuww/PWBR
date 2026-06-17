'use server'

/**
 * Server Actions — back-office membres (ADMIN-01, D-13).
 *
 * SÉCURITÉ (Rule 2 / T-04-ADMIN-WRITE) : une Server Action est un endpoint POST appelable
 * directement, NON protégé par le layout (admin). On RE-VALIDE donc requireRole('superadmin')
 * en tête de CHAQUE action — sinon n'importe quel authenticated pourrait muter via service_role.
 *
 * Toute mutation passe par le client service_role LOCAL (D-13 : aucune écriture front sur
 * subscriptions ; la RLS n'autorise d'ailleurs aucun update/delete client). Les helpers repo
 * du barrel (activateForPayment/changePlan) sont autorisés ; seul service-client.ts est lint-interdit.
 */
import 'server-only'
import { revalidatePath } from 'next/cache'
import { activateForPayment, changePlan } from '@app/supabase'
import { requireRole } from '../../../lib/auth/gate'
import { createAdminServiceClient } from '../../../lib/supabase/admin-service'

export type AdminActionResult = { ok: true } | { ok: false; error: string }

type Plan = 'discovery' | 'standard'

function parsePlan(raw: FormDataEntryValue | null): Plan {
  const v = String(raw ?? '')
  if (v === 'discovery' || v === 'standard') return v
  throw new Error('plan invalide')
}

/** Durées autorisées (interval Postgres) — bornées côté serveur (anti-injection valeur). */
const PERIODS: Record<string, string> = {
  '7 days': '7 days',
  '1 month': '1 month',
  '3 months': '3 months',
}

function parsePeriod(raw: FormDataEntryValue | null): string {
  const v = String(raw ?? '')
  const period = PERIODS[v]
  if (!period) throw new Error('durée invalide')
  return period
}

async function guard() {
  await requireRole('superadmin') // notFound() si non-superadmin (jamais 200 silencieux)
  return createAdminServiceClient()
}

function fail(err: unknown): AdminActionResult {
  return { ok: false, error: err instanceof Error ? err.message : 'unknown' }
}

/**
 * Active / prolonge l'abonnement d'un membre via la RPC atomique (D-11).
 * Requiert un payment_id (le membre doit avoir une ligne payments à activer).
 */
export async function activateMember(formData: FormData): Promise<AdminActionResult> {
  try {
    const client = await guard()
    const payment_id = String(formData.get('payment_id') ?? '')
    const user_id = String(formData.get('user_id') ?? '')
    if (!payment_id || !user_id) throw new Error('payment_id et user_id requis')
    const plan = parsePlan(formData.get('plan'))
    const period = parsePeriod(formData.get('period'))

    await activateForPayment(client, { payment_id, user_id, plan, period })
    revalidatePath('/membres')
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

/** Change le plan d'un membre (et prolonge si une durée est fournie, D-11). */
export async function changeMemberPlan(formData: FormData): Promise<AdminActionResult> {
  try {
    const client = await guard()
    const user_id = String(formData.get('user_id') ?? '')
    if (!user_id) throw new Error('user_id requis')
    const plan = parsePlan(formData.get('plan'))
    const rawPeriod = formData.get('period')
    const period = rawPeriod ? parsePeriod(rawPeriod) : undefined

    // exactOptionalPropertyTypes : ne passer `period` que s'il est défini
    // (spread conditionnel), cohérent avec (admin)/file/actions.ts (70b84ee).
    await changePlan(client, { user_id, plan, ...(period !== undefined ? { period } : {}) })
    revalidatePath('/membres')
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

/**
 * Révoque / suspend l'accès d'un membre (D-13). Coupe nette : status='canceled'
 * via service_role (aucune policy update front ne l'autorise). La RLS de gating
 * (has_active_subscription) refuse alors l'accès au membre.
 */
export async function revokeMember(formData: FormData): Promise<AdminActionResult> {
  try {
    const client = await guard()
    const user_id = String(formData.get('user_id') ?? '')
    if (!user_id) throw new Error('user_id requis')

    const { error } = await client
      .from('subscriptions')
      .update({ status: 'canceled' })
      .eq('user_id', user_id)
    if (error) throw new Error(error.message)

    revalidatePath('/membres')
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}
