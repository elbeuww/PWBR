/**
 * Repository affiliates — écriture via service_role (bypass RLS).
 *
 * Frontière producteur-unique (D-07/D-11) : promotion d'affilié, enregistrement de
 * code vanity et attribution de filleul passent EXCLUSIVEMENT par service_role —
 * aucune policy write front sur ces tables (migration 0016). Le calcul financier
 * reste en DB (RPC 07-01) ; ces repos sont des écritures simples + un lookup.
 *
 * attributeReferral est BEST-EFFORT (T-07-ATTR-CRASH) : un code inconnu ou un
 * self-ref (T-07-SELFREF, D-12) → no-op silencieux ; une 23505 sur referrals(user_id)
 * → idempotent (last-touch déjà figé au cookie, D-11). Ne casse JAMAIS le signup.
 *
 * JAMAIS importé depuis apps/web (D-07/D-49 — service_role réservé aux jobs/serveur).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../database.types'

type ServiceClient = SupabaseClient<Database>

/** Code Postgres d'une violation de contrainte d'unicité. */
const PG_UNIQUE_VIOLATION = '23505'

/** Erreur typée : le code vanity est déjà pris (collision PK affiliate_codes). */
export class CodeTakenError extends Error {
  readonly kind = 'code_taken' as const
  constructor(code: string) {
    super(`code_taken: affiliate code already registered (${code})`)
    this.name = 'CodeTakenError'
  }
}

interface PostgrestLikeError {
  code?: string
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as PostgrestLikeError).code === PG_UNIQUE_VIOLATION
  )
}

export interface AttributeReferralInput {
  /** Depuis le cookie aff_ref (déjà normalisé A-Z0-9 par la borne DB ^[A-Z0-9]{3,20}$). */
  affiliate_code: string
  referral_user_id: string
}

/**
 * D-11/D-12 — résout le code → affilié et insère le referral (sauf self-ref).
 *
 * Best-effort (T-07-ATTR-CRASH) : code inconnu → {attributed:false} ; self-ref → skip ;
 * 23505 sur referrals(user_id) → {attributed:true} (idempotent, last-touch joué au
 * cookie). Ne lève QUE sur une erreur DB inattendue (jamais sur code inconnu/self-ref).
 */
export async function attributeReferral(
  client: ServiceClient,
  input: AttributeReferralInput,
): Promise<{ attributed: boolean }> {
  const { data: codeRow } = await client
    .from('affiliate_codes')
    .select('affiliate_id, affiliates!inner(user_id)')
    .eq('code', input.affiliate_code)
    .maybeSingle()

  // Code inconnu (ou cookie forgé) → no-op silencieux (T-07-ATTR-CRASH).
  if (!codeRow) return { attributed: false }

  const affiliateUserId = (codeRow.affiliates as unknown as { user_id: string }).user_id

  // D-12 garde-fou à l'inscription (le calcul exclut déjà r.user_id <> a.user_id).
  if (affiliateUserId === input.referral_user_id) return { attributed: false }

  const { error } = await client
    .from('referrals')
    .insert({ affiliate_id: codeRow.affiliate_id, user_id: input.referral_user_id })

  if (error) {
    // 23505 sur UNIQUE(user_id) : déjà attribué → idempotent (D-11, last-touch au cookie).
    if (isUniqueViolation(error)) return { attributed: true }
    throw new Error(`attributeReferral: ${error.message}`)
  }

  return { attributed: true }
}

export interface PromoteAffiliateInput {
  user_id: string
}

/**
 * D-07 — promeut un user en affilié : upsert affiliates(user_id) (idempotent sur le
 * UNIQUE(user_id)) ET passe profiles.role='affiliate'. Retourne l'id de l'affilié.
 */
export async function promoteAffiliate(
  client: ServiceClient,
  input: PromoteAffiliateInput,
): Promise<{ affiliate_id: string }> {
  const { data, error } = await client
    .from('affiliates')
    .upsert({ user_id: input.user_id }, { onConflict: 'user_id' })
    .select('id')
    .single()

  if (error) {
    throw new Error(`promoteAffiliate: ${error.message}`)
  }

  const { error: roleError } = await client
    .from('profiles')
    .update({ role: 'affiliate' })
    .eq('id', input.user_id)

  if (roleError) {
    throw new Error(`promoteAffiliate (role): ${roleError.message}`)
  }

  return { affiliate_id: data.id }
}

export interface CreateCodeInput {
  affiliate_id: string
  code: string
}

/**
 * D-06 — enregistre un code vanity pour un affilié. Normalise (toUpperCase().trim())
 * avant insert ; la borne DB ^[A-Z0-9]{3,20}$ (PK) tranche en dernier ressort.
 * Collision (23505 sur la PK code) → CodeTakenError (mappable au front, 07-05).
 */
export async function createCode(
  client: ServiceClient,
  input: CreateCodeInput,
): Promise<{ code: string }> {
  const normalized = input.code.toUpperCase().trim()

  const { error } = await client
    .from('affiliate_codes')
    .insert({ affiliate_id: input.affiliate_id, code: normalized })

  if (error) {
    if (isUniqueViolation(error)) {
      throw new CodeTakenError(normalized)
    }
    throw new Error(`createCode: ${error.message}`)
  }

  return { code: normalized }
}
