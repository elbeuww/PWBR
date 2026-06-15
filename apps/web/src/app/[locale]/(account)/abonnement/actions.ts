'use server'
import 'server-only'

/**
 * Server Actions du parcours de paiement USDT (Phase 4, Plan 05).
 *
 * C'EST LE CHEMIN PAR LEQUEL L'ARGENT ENTRE — correction maximale exigée.
 *
 * Frontière producteur-unique (T-04-SVCCLIENT, Pitfall 6) : toute la logique
 * financière (montant attendu, lecture TronGrid, activation) est 100% serveur.
 * Le client n'écrit JAMAIS qu'une ligne `payments(pending)` via `reservePayment`,
 * et le montant attendu est posé par `reserveOffset` (service_role), jamais choisi
 * par le client. Le client service_role est créé LOCALEMENT ici (jamais importé du
 * barrel — ESLint no-restricted-imports interdit `@app/supabase/service-client`).
 *
 * verifyPayment respecte un ORDRE D'OPÉRATIONS INVIOLABLE (anti-TOCTOU, Pitfall 2) :
 * le tx_hash arme la contrainte UNIQUE(tx_hash) AVANT toute lecture réseau. Un hash
 * déjà servi (23505) est rejeté en `replay` SANS aucun appel TronGrid.
 *
 * Le gate légal (LEGAL-02, Pitfall 7) bloque l'activation réelle en mainnet tant que
 * `isLegalReviewDone()` est faux. Testnet/Nile = libre.
 *
 * Tous les retours d'erreur = typed error codes opaques → clés i18n (jamais
 * error.message brut au client, T-04-ERRLEAK, pattern toSafeErrorKey de (auth)/actions).
 */
import { createClient as createServiceClient } from '@supabase/supabase-js'
import {
  OFFSET_RESERVATION_MINUTES,
  ReplayError,
  OffsetExhaustedError,
  reserveOffset,
  transitionPayment,
  activateForPayment,
  type Database,
} from '@app/supabase'
import { fetchTrc20TransfersForReceiver, verifyTransfer } from '@app/data-sources'
import { toAtomic } from '@app/core'
import { createClient } from '../../../../lib/supabase/server'
import { isLegalReviewDone } from '../../../../lib/legal-gate'
import { canConsumeDiscovery, type PriorPaymentPlan } from './discovery'

/** Plans disponibles. */
export type Plan = 'discovery' | 'standard'

/** Montants nominaux atomiques (USDT ×10⁶), source serveur — jamais le client. */
const NOMINAL_ATOMIC: Record<Plan, bigint> = {
  standard: toAtomic('9'), // 9 USDT / mois (D-11)
  discovery: toAtomic('3'), // 3 USDT / 7 jours (D-12)
}

/** Interval Postgres de la période d'abonnement par plan. */
const PERIOD_INTERVAL: Record<Plan, string> = {
  discovery: '7 days', // D-12
  standard: '1 month', // D-11
}

/**
 * Codes d'erreur typés → clés i18n (namespace `payment.errors` / `payment.reserve`).
 * Jamais d'error.message brut exposé (T-04-ERRLEAK).
 */
export type PaymentErrorCode =
  | 'not_authenticated'
  | 'discovery_consumed'
  | 'offset_exhausted'
  | 'legal_gate'
  | 'replay'
  | 'tx_not_found'
  | 'wrong_token'
  | 'wrong_recipient'
  | 'not_confirmed'
  | 'wrong_amount'
  | 'manual_review'
  | 'internal'

export type ReserveResult =
  | { ok: true; payment_id: string; expected_amount_atomic: string; plan: Plan }
  | { ok: false; code: PaymentErrorCode }

export type VerifyResult =
  | { ok: true; status: 'verified' }
  | { ok: false; status: 'rejected' | 'ambiguous'; code: PaymentErrorCode }

export type StatusResult =
  | { status: 'pending' | 'verified' | 'rejected' | 'ambiguous'; reject_reason: string | null }
  | { status: 'not_found' }

/**
 * Client service_role créé LOCALEMENT (Pitfall 6) — jamais le barrel. Lazy : lit
 * process.env à l'appel, throw si manquant. `persistSession:false` (job/serveur).
 */
function serviceClientLocal() {
  const url = process.env['SUPABASE_URL']
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!url || !key) {
    throw new Error('serviceClientLocal: SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis')
  }
  return createServiceClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

type ServiceClient = ReturnType<typeof serviceClientLocal>

/** Récupère les plans déjà consommés par l'user (paiements verified + abonnement courant). */
async function priorPlans(service: ServiceClient, userId: string): Promise<PriorPaymentPlan[]> {
  const result: PriorPaymentPlan[] = []

  const { data: payments } = await service
    .from('payments')
    .select('plan, status')
    .eq('user_id', userId)
    .in('status', ['verified', 'pending'])

  for (const p of payments ?? []) {
    result.push({ plan: p.plan as Plan, status: p.status as 'verified' | 'pending' })
  }

  const { data: subs } = await service
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', userId)

  for (const s of subs ?? []) {
    if (s.plan === 'discovery') {
      result.push({ plan: 'discovery', status: 'verified' })
    }
  }

  return result
}

/**
 * Server action `reservePayment(plan)` (Open Q3).
 *
 * 1. getUser() (anon SSR) ;
 * 2. enforcement discovery one-shot (D-12) via canConsumeDiscovery (testable) ;
 * 3. reservation_expires_at = now() + OFFSET_RESERVATION_MINUTES (constante barrel) ;
 * 4. reserveOffset(service_role) pose le montant unique attendu (D-05).
 *
 * Le client ne choisit JAMAIS expected_amount_atomic.
 */
export async function reservePayment(plan: Plan): Promise<ReserveResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, code: 'not_authenticated' }
  }

  const service = serviceClientLocal()

  try {
    if (plan === 'discovery') {
      const prior = await priorPlans(service, user.id)
      if (!canConsumeDiscovery(prior)) {
        return { ok: false, code: 'discovery_consumed' }
      }
    }

    const reservationExpiresAt = new Date(
      Date.now() + OFFSET_RESERVATION_MINUTES * 60_000,
    ).toISOString()

    const { payment_id, expected_amount_atomic } = await reserveOffset(service, {
      user_id: user.id,
      plan,
      base_amount_atomic: NOMINAL_ATOMIC[plan],
      reservation_expires_at: reservationExpiresAt,
    })

    return {
      ok: true,
      payment_id,
      // BigInt non sérialisable en RSC payload → string (reformaté côté client via formatAtomic).
      expected_amount_atomic: expected_amount_atomic.toString(),
      plan,
    }
  } catch (error: unknown) {
    if (error instanceof OffsetExhaustedError) {
      return { ok: false, code: 'offset_exhausted' }
    }
    // Jamais error.message brut au client (T-04-ERRLEAK).
    return { ok: false, code: 'internal' }
  }
}

/**
 * Server action `verifyPayment(payment_id, tx_hash)` — ORDRE INVIOLABLE (anti-TOCTOU).
 *
 * (1) getUser() anon SSR ;
 * (2) serviceClientLocal() ;
 * (3) GATE LÉGAL : mainnet && !isLegalReviewDone() -> 'legal_gate' (bloque l'activation réelle) ;
 * (4a) ARMER LE UNIQUE D'ABORD : écrire tx_hash sur le payment pending (service_role).
 *      23505 -> { rejected, replay } IMMÉDIATEMENT, SANS appel TronGrid ;
 * (4b) sinon -> lecture réseau ;
 * (5) fetchTrc20TransfersForReceiver + trouver le transfer du hash ;
 * (6) verifyTransfer : exact -> activateForPayment (RPC atomique) ; over/under -> ambiguous ;
 *     rejected -> transitionPayment 'rejected' + reject_reason.
 *
 * Règle d'or : l'écriture du tx_hash (4a) PRÉCÈDE toujours toute lecture réseau (5).
 */
export async function verifyPayment(paymentId: string, txHash: string): Promise<VerifyResult> {
  const trimmed = txHash.trim()
  if (!trimmed) {
    return { ok: false, status: 'rejected', code: 'tx_not_found' }
  }

  // (1) Payeur identifié via anon SSR.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, status: 'rejected', code: 'not_authenticated' }
  }

  // (2) service_role LOCAL.
  const service = serviceClientLocal()

  // (3) GATE LÉGAL — mainnet uniquement, AVANT toute écriture/lecture d'encaissement réel.
  if (process.env['TRON_NETWORK'] === 'mainnet' && !isLegalReviewDone()) {
    return { ok: false, status: 'rejected', code: 'legal_gate' }
  }

  // Récupère le payment pending de l'user (montant attendu, plan) AVANT d'armer le hash.
  const { data: payment, error: readErr } = await service
    .from('payments')
    .select('id, user_id, plan, expected_amount_atomic, status')
    .eq('id', paymentId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (readErr || !payment) {
    return { ok: false, status: 'rejected', code: 'internal' }
  }

  // (4a) ARMER LE UNIQUE D'ABORD — écrire le tx_hash réel sur la ligne pending.
  // La contrainte UNIQUE(tx_hash) globale (0012) lève 23505 si le hash a déjà servi
  // (sur n'importe quel compte) → replay IMMÉDIAT, SANS aucune lecture réseau.
  const { error: armErr } = await service
    .from('payments')
    .update({ tx_hash: trimmed })
    .eq('id', paymentId)
    .eq('user_id', user.id)
    .eq('status', 'pending')

  if (armErr) {
    if ((armErr as { code?: string }).code === '23505') {
      // anti-replay : le filet DB a parlé, on ne lit JAMAIS le réseau sur un replay.
      return { ok: false, status: 'rejected', code: 'replay' }
    }
    return { ok: false, status: 'rejected', code: 'internal' }
  }

  // (4b) Hash inédit, désormais réservé par ce payment → on peut lire le réseau.
  const contract = process.env['USDT_CONTRACT_ADDRESS']
  const receiver = process.env['USDT_RECEIVE_ADDRESS']
  if (!contract || !receiver) {
    return { ok: false, status: 'rejected', code: 'internal' }
  }

  const plan = payment.plan as Plan
  const expectedAtomic = BigInt(payment.expected_amount_atomic)

  try {
    // (5) Lecture réseau + sélection du transfer correspondant au hash.
    const transfers = await fetchTrc20TransfersForReceiver(receiver, contract)
    const transfer = transfers.find((t) => t.transaction_id === trimmed)

    if (!transfer) {
      // TX pas (encore) confirmée / introuvable — pas un rejet définitif (D-04, re-soumission).
      await transitionPayment(service, paymentId, 'rejected', { reject_reason: 'tx_not_found' })
      return { ok: false, status: 'rejected', code: 'tx_not_found' }
    }

    // (6) Invariants conjoints (contrat/destinataire/confirmation/montant strict BigInt).
    const result = verifyTransfer(transfer, {
      contract,
      receiver,
      expected_amount_atomic: expectedAtomic,
    })

    switch (result.kind) {
      case 'exact': {
        // Activation atomique : payment->verified ET subscription->active (RPC, T-04-INCONSIST).
        await activateForPayment(service, {
          payment_id: paymentId,
          user_id: user.id,
          plan,
          period: PERIOD_INTERVAL[plan],
        })
        return { ok: true, status: 'verified' }
      }
      case 'over':
      case 'under': {
        // D-06/D-07 : jamais d'activation/rejet auto → file de revue manuelle.
        await transitionPayment(service, paymentId, 'ambiguous', {
          reject_reason: result.kind === 'over' ? 'over' : 'under',
          amount_atomic: result.amount_atomic,
        })
        return { ok: false, status: 'ambiguous', code: 'manual_review' }
      }
      case 'rejected': {
        await transitionPayment(service, paymentId, 'rejected', { reject_reason: result.reason })
        return { ok: false, status: 'rejected', code: result.reason }
      }
    }
  } catch (error: unknown) {
    if (error instanceof ReplayError) {
      return { ok: false, status: 'rejected', code: 'replay' }
    }
    return { ok: false, status: 'rejected', code: 'internal' }
  }
}

/**
 * Server action `getPaymentStatus(payment_id)` — lecture du statut pour le polling (D-02).
 * Scopé à l'user courant. Le reject_reason (typed code) sert à localiser le message.
 */
export async function getPaymentStatus(paymentId: string): Promise<StatusResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { status: 'not_found' }
  }

  const service = serviceClientLocal()
  const { data, error } = await service
    .from('payments')
    .select('status, reject_reason')
    .eq('id', paymentId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error || !data) {
    return { status: 'not_found' }
  }

  return {
    status: data.status as 'pending' | 'verified' | 'rejected' | 'ambiguous',
    reject_reason: data.reject_reason,
  }
}
