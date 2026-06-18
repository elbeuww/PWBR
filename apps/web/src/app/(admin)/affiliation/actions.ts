'use server'

/**
 * Server Actions — file de revue des candidatures affiliées (AFF-01, D-06/D-07/D-08).
 *
 * SÉCURITÉ (Rule 2 / T-07-ADMIN-WRITE) : endpoint POST appelable directement → on RE-VALIDE
 * requireRole('superadmin') en tête de CHAQUE action (helper guard()). Toute transition passe
 * par service_role LOCAL (D-08 : aucune policy write front sur affiliate_applications/affiliates/
 * affiliate_codes ; seul le service_role écrit).
 *
 * - approuver : résout l'email → profiles.id (compte requis), promoteAffiliate (rôle affiliate +
 *   affiliates) + createCode (code vanity borné A-Z0-9, D-06 ; CODE_TAKEN → i18n) + transition
 *   status='approved'. D-07 : c'est le superadmin qui pose le code, jamais l'affilié en self-serve.
 * - rejeter : transitionApplication('rejected', { reject_reason }) — MOTIF requis (D-08, T-07-DESTRUCT).
 */
import 'server-only'
import { revalidatePath } from 'next/cache'
import {
  CodeTakenError,
  promoteAffiliate,
  createCode,
  transitionApplication,
} from '@app/supabase'
import { requireRole } from '../../../lib/auth/gate'
import { createAdminServiceClient } from '../../../lib/supabase/admin-service'

export type QueueActionResult = { ok: true } | { ok: false; error: string }

/** Erreur sentinelle : code vanity déjà pris → mappée au message i18n côté UI. */
const CODE_TAKEN = 'code_taken'

/** Erreur sentinelle : aucun compte ne correspond à l'email de candidature. */
const NO_ACCOUNT = 'no_account'

/** Borne D-06 (miroir check DB ^[A-Z0-9]{3,20}$) : valide AVANT toute écriture. */
const CODE_PATTERN = /^[A-Z0-9]{3,20}$/

async function guard() {
  await requireRole('superadmin')
  return createAdminServiceClient()
}

function fail(err: unknown): QueueActionResult {
  if (err instanceof CodeTakenError) return { ok: false, error: CODE_TAKEN }
  return { ok: false, error: err instanceof Error ? err.message : 'unknown' }
}

/** Normalise + valide le code vanity (D-06). Lève si hors borne A-Z0-9 {3,20}. */
function parseVanityCode(raw: FormDataEntryValue | null): string {
  const code = String(raw ?? '')
    .toUpperCase()
    .trim()
  if (!CODE_PATTERN.test(code)) throw new Error('code vanity invalide (A-Z, 0-9, 3 à 20)')
  return code
}

/**
 * Approuve une candidature (D-07) : promotion affiliate + code vanity posé par le superadmin.
 * L'email de candidature doit correspondre à un compte existant (profiles.id) — sinon NO_ACCOUNT.
 */
export async function approveApplication(formData: FormData): Promise<QueueActionResult> {
  try {
    const client = await guard()
    const application_id = String(formData.get('application_id') ?? '')
    const applicant_email = String(formData.get('applicant_email') ?? '')
      .trim()
      .toLowerCase()
    if (!application_id || !applicant_email) {
      throw new Error('application_id et applicant_email requis')
    }
    const code = parseVanityCode(formData.get('code'))

    // Résout l'email de candidature → user_id existant (le compte doit exister, D-07).
    const { data: profile, error: lookupError } = await client
      .from('profiles')
      .select('id')
      .ilike('email', applicant_email)
      .maybeSingle()
    if (lookupError) throw new Error(`lookup profil: ${lookupError.message}`)
    if (!profile) throw new Error(NO_ACCOUNT)

    // 1) Promotion (idempotente) → affiliate_id. 2) Code vanity (CODE_TAKEN si pris).
    const { affiliate_id } = await promoteAffiliate(client, { user_id: profile.id })
    await createCode(client, { affiliate_id, code })

    // 3) Candidature → approved (status-only, jamais delete).
    await transitionApplication(client, application_id, 'approved')
    revalidatePath('/affiliation')
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}

/** Rejette une candidature — MOTIF obligatoire (D-08, T-07-DESTRUCT). */
export async function rejectApplication(formData: FormData): Promise<QueueActionResult> {
  try {
    const client = await guard()
    const application_id = String(formData.get('application_id') ?? '')
    const reject_reason = String(formData.get('reject_reason') ?? '').trim()
    if (!application_id) throw new Error('application_id requis')
    if (!reject_reason) throw new Error('motif requis')

    await transitionApplication(client, application_id, 'rejected', { reject_reason })
    revalidatePath('/affiliation')
    return { ok: true }
  } catch (err) {
    return fail(err)
  }
}
