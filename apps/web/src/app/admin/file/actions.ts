'use server'

/**
 * Server Actions — file de validation des paiements ambigus (ADMIN-02, D-06/D-07/D-08).
 *
 * SÉCURITÉ (Rule 2 / T-04-ADMIN-WRITE) : endpoint POST appelable directement → on RE-VALIDE
 * requireRole('superadmin') en tête de CHAQUE action. Toute transition passe par service_role
 * LOCAL (D-08 : l'user écrit payments(pending) ; seul le service_role transitionne).
 *
 * - activer : RPC atomique activateForPayment (D-07 = activer la période normale, surplus ignoré).
 * - rejeter : transitionPayment('rejected', { reject_reason }) — MOTIF requis (D-08, T-04-DESTRUCT).
 * - ajuster : changePlan (durée/plan, D-08).
 */
import 'server-only'
import { revalidatePath } from 'next/cache'
import { activateForPayment, changePlan, transitionPayment } from '@app/supabase'
import { requireRole } from '../../../lib/auth/gate'
import { createAdminServiceClient } from '../../../lib/supabase/admin-service'

export type QueueActionResult = { ok: true } | { ok: false; error: string }

type Plan = 'discovery' | 'standard'

function parsePlan(raw: FormDataEntryValue | null): Plan {
  const v = String(raw ?? '')
  if (v === 'discovery' || v === 'standard') return v
  throw new Error('plan invalide')
}

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
  await requireRole('superadmin')
  return createAdminServiceClient()
}

function fail(err: unknown): QueueActionResult {
  return { ok: false, error: err instanceof Error ? err.message : 'unknown' }
}

/** Active un paiement ambigu (D-07 : période normale, surplus ignoré). */
export async function activatePayment(formData: FormData): Promise<QueueActionResult> {
  try {
    const client = await guard()
    const payment_id = String(formData.get('payment_id') ?? '')
    const user_id = String(formData.get('user_id') ?? '')
    if (!payment_id || !user_id) throw new Error('payment_id et user_id requis')
    const plan = parsePlan(formData.get('plan'))
    const period = parsePeriod(formData.get('period'))

    await activateForPayment(client, { payment_id, user_id, plan, period })
    revalidatePath('/file')
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

/** Rejette un paiement ambigu — MOTIF obligatoire (D-08). */
export async function rejectPayment(formData: FormData): Promise<QueueActionResult> {
  try {
    const client = await guard()
    const payment_id = String(formData.get('payment_id') ?? '')
    const reject_reason = String(formData.get('reject_reason') ?? '').trim()
    if (!payment_id) throw new Error('payment_id requis')
    if (!reject_reason) throw new Error('motif requis')

    await transitionPayment(client, payment_id, 'rejected', { reject_reason })
    revalidatePath('/file')
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

/** Ajuste durée/plan d'un membre lié à un paiement ambigu (D-08). */
export async function adjustPayment(formData: FormData): Promise<QueueActionResult> {
  try {
    const client = await guard()
    const user_id = String(formData.get('user_id') ?? '')
    if (!user_id) throw new Error('user_id requis')
    const plan = parsePlan(formData.get('plan'))
    const rawPeriod = formData.get('period')
    // `period` est optionnel (ChangePlanInput.period?: string). Sous
    // exactOptionalPropertyTypes, passer `period: undefined` n'est pas assignable
    // à une prop optionnelle → on ne l'inclut QUE si fournie (runtime identique :
    // sans period, changePlan ne touche que `plan`).
    const period = rawPeriod ? parsePeriod(rawPeriod) : undefined

    await changePlan(client, period ? { user_id, plan, period } : { user_id, plan })
    revalidatePath('/file')
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}
