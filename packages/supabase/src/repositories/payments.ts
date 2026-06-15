/**
 * Repository payments — écriture via service_role (bypass RLS).
 *
 * Anti-replay (PAY-04 / T-04-REPLAY) : `UNIQUE(tx_hash)` GLOBAL (migration 0012) est
 * le SEUL garde-fou inviolable contre le double-crédit. Le check applicatif `getByHash`
 * a une TOCTOU → `insertPendingPayment` capte la violation 23505 et lève l'erreur
 * typée `'replay'`.
 *
 * Réservation d'offset (D-05) : `reserveOffset` pose un montant attendu UNIQUE
 * (nominal + offset déterministe) côté service_role, JAMAIS dérivé d'une entrée client.
 * S'appuie sur l'index unique partiel `payments_expected_amount_active_idx` (0012) ;
 * collision 23505 → tente l'offset suivant (boucle bornée, repli millièmes — Open Q1).
 *
 * JAMAIS importé depuis apps/web (D-07 — service_role réservé aux jobs/serveur).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../database.types'

type ServiceClient = SupabaseClient<Database>

type PaymentRow = Database['public']['Tables']['payments']['Row']

/**
 * D-05 — durée de réservation de l'offset, valeur canonique partagée avec le
 * commentaire SQL de la migration 0012 (`payments_expected_amount_active_idx`) et
 * consommée par Plan 05 pour calculer `reservation_expires_at` (= now() + N minutes).
 */
export const OFFSET_RESERVATION_MINUTES = 60

/** Nombre maximum d'offsets distincts tentés avant abandon (repli Open Q1). */
const MAX_OFFSET_ATTEMPTS = 999

/** Code Postgres d'une violation de contrainte d'unicité. */
const PG_UNIQUE_VIOLATION = '23505'

/** Erreur typée reconnaissable : tx_hash déjà présent → tentative de rejeu. */
export class ReplayError extends Error {
  readonly kind = 'replay' as const
  constructor(tx_hash: string) {
    super(`replay: tx_hash already submitted (${tx_hash})`)
    this.name = 'ReplayError'
  }
}

/** Erreur typée : impossible de réserver un offset (file saturée, Open Q1). */
export class OffsetExhaustedError extends Error {
  readonly kind = 'offset_exhausted' as const
  constructor() {
    super('offset_exhausted: no free expected_amount within attempt budget')
    this.name = 'OffsetExhaustedError'
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

export interface ReserveOffsetInput {
  user_id: string
  plan: 'discovery' | 'standard'
  /** Montant nominal atomique (BigInt USDT 6 décimales) du plan. */
  base_amount_atomic: bigint
  /** Calculé par l'appelant : now() + OFFSET_RESERVATION_MINUTES (ISO timestamptz). */
  reservation_expires_at: string
}

export interface ReserveOffsetResult {
  payment_id: string
  expected_amount_atomic: bigint
}

/**
 * D-05 (Open Q3) — pose un montant attendu UNIQUE (nominal + offset déterministe en
 * micro-unités) côté service_role et INSERT une ligne pending. S'appuie sur l'index
 * unique partiel `payments_expected_amount_active_idx` : une collision (23505) signifie
 * que cet offset est déjà réservé/actif → on tente l'offset suivant (boucle bornée).
 * `expected_amount_atomic` n'est JAMAIS dérivé d'une entrée client.
 *
 * IMPORTANT : aucun `tx_hash` à ce stade (réservation pré-paiement). La ligne pending
 * reçoit un tx_hash réel plus tard via la soumission utilisateur (Plan 05).
 */
export async function reserveOffset(
  client: ServiceClient,
  input: ReserveOffsetInput,
): Promise<ReserveOffsetResult> {
  for (let offset = 1; offset <= MAX_OFFSET_ATTEMPTS; offset++) {
    const expected = input.base_amount_atomic + BigInt(offset)

    const { data, error } = await client
      .from('payments')
      .insert({
        user_id: input.user_id,
        plan: input.plan,
        // placeholder déterministe : pas encore de tx réelle (réservation pré-paiement)
        tx_hash: `reservation:${input.user_id}:${expected.toString()}`,
        expected_amount_atomic: Number(expected),
        status: 'pending',
        reservation_expires_at: input.reservation_expires_at,
      })
      .select('id')
      .single()

    if (error) {
      if (isUniqueViolation(error)) {
        // offset (ou placeholder tx_hash) déjà réservé actif → tenter le suivant
        continue
      }
      throw new Error(`reserveOffset failed: ${error.message}`)
    }

    return {
      payment_id: data.id,
      expected_amount_atomic: expected,
    }
  }

  throw new OffsetExhaustedError()
}

export interface InsertPendingPaymentInput {
  user_id: string
  tx_hash: string
  plan: 'discovery' | 'standard'
  expected_amount_atomic: bigint
  screenshot_url?: string
}

/**
 * Insère une ligne pending avec un tx_hash réel. La violation 23505 sur
 * `payments_tx_hash_global_idx` (rejeu) est mappée vers `ReplayError` (Pitfall 2).
 */
export async function insertPendingPayment(
  client: ServiceClient,
  input: InsertPendingPaymentInput,
): Promise<{ id: string }> {
  const { data, error } = await client
    .from('payments')
    .insert({
      user_id: input.user_id,
      tx_hash: input.tx_hash,
      plan: input.plan,
      expected_amount_atomic: Number(input.expected_amount_atomic),
      status: 'pending',
      screenshot_url: input.screenshot_url ?? null,
    })
    .select('id')
    .single()

  if (error) {
    if (isUniqueViolation(error)) {
      throw new ReplayError(input.tx_hash)
    }
    throw new Error(`insertPendingPayment failed: ${error.message}`)
  }

  return { id: data.id }
}

/** Lecture par tx_hash (check applicatif — non inviolable, l'UNIQUE DB l'est). */
export async function getByHash(
  client: ServiceClient,
  tx_hash: string,
): Promise<PaymentRow | null> {
  const { data, error } = await client
    .from('payments')
    .select('*')
    .eq('tx_hash', tx_hash)
    .maybeSingle()

  if (error) {
    throw new Error(`getByHash failed: ${error.message}`)
  }

  return data
}

/**
 * Sweep applicatif des réservations d'offset expirées (Plan 06, job subscription-expiry).
 *
 * Pourquoi côté applicatif : l'index unique partiel `payments_expected_amount_active_idx`
 * (migration 0012) ne peut PAS porter `reservation_expires_at > now()` dans son prédicat —
 * Postgres exige un prédicat IMMUTABLE (`42P17`). Le prédicat a donc été réduit à
 * `where status='pending'`, et la libération des réservations expirées DOIT se faire ici.
 *
 * Sans ce sweep, chaque `payments(pending)` expiré garde son `expected_amount_atomic`
 * verrouillé pour toujours → `reserveOffset` (MAX_OFFSET_ATTEMPTS=999) finit par s'épuiser
 * (DoS auto-infligé sur l'allocation des montants uniques).
 *
 * status='pending' AND reservation_expires_at <= now() → 'rejected' avec
 * reject_reason='reservation_expired' (l'offset redevient réservable). Naturellement
 * idempotent : un re-run ne trouve plus de ligne pending expirée (re-run = 0 ligne).
 */
export const RESERVATION_EXPIRED_REASON = 'reservation_expired'

export async function releaseExpiredReservations(
  client: ServiceClient,
): Promise<{ released: number }> {
  const { data, error } = await client
    .from('payments')
    .update({ status: 'rejected', reject_reason: RESERVATION_EXPIRED_REASON })
    .eq('status', 'pending')
    .not('reservation_expires_at', 'is', null)
    .lte('reservation_expires_at', new Date().toISOString())
    .select('id')

  if (error) {
    throw new Error(`releaseExpiredReservations failed: ${error.message}`)
  }

  return { released: data?.length ?? 0 }
}

export interface TransitionPaymentExtra {
  reject_reason?: string
  amount_atomic?: bigint
}

/**
 * Transition status-only (jamais delete) vers 'rejected' ou 'ambiguous'. La transition
 * 'verified' passe exclusivement par la RPC atomique (`subscriptions.activateForPayment`).
 */
export async function transitionPayment(
  client: ServiceClient,
  id: string,
  status: 'rejected' | 'ambiguous',
  extra: TransitionPaymentExtra = {},
): Promise<void> {
  const patch: Database['public']['Tables']['payments']['Update'] = { status }
  if (extra.reject_reason !== undefined) {
    patch.reject_reason = extra.reject_reason
  }
  if (extra.amount_atomic !== undefined) {
    patch.amount_atomic = Number(extra.amount_atomic)
  }

  const { error } = await client.from('payments').update(patch).eq('id', id)

  if (error) {
    throw new Error(`transitionPayment failed: ${error.message}`)
  }
}
