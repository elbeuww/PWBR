/**
 * Décision des invariants conjoints — vérification on-chain d'un paiement USDT.
 *
 * Cœur de correction financière (PAY-02/04) : un seul paiement crédité à tort =
 * perte directe. `verifyTransfer` évalue le ET logique des invariants on-chain
 * dans l'ordre du decision tree (RESEARCH §Verification Decision Tree) :
 *
 *   1. token (contrat) : sameAddress(token_info.address, ctx.contract) UNIQUEMENT.
 *      JAMAIS par symbol/decimals (T-04-FAKETOKEN) → un faux token homonyme nommé
 *      "USDT" decimals 6 est rejeté `wrong_token`.
 *   2. destinataire : sameAddress(to, ctx.receiver) (normalisation hex<->base58)
 *      sinon `wrong_recipient`.
 *   3. confirmation : `only_confirmed=true` filtre déjà côté client ; ici on rejette
 *      `not_confirmed` si le transfert est explicitement marqué non confirmé (A7,
 *      anti-réorg, Pitfall 3).
 *   4. montant : received = BigInt(transfer.value) — comparaison `===` STRICTE,
 *      ZÉRO float, jamais epsilon (Pitfall 4). === → exact ; > → over (D-07,
 *      ambiguous) ; < → under (D-06, ambiguous).
 *
 * Le 5e invariant (anti-replay tx_hash) n'est PAS ici → `UNIQUE(tx_hash)` DB
 * (Plan 02). over/under → file superadmin (jamais activation/rejet auto, T-04-AUTODECIDE).
 */
import { sameAddress } from './address.js'
import type { Trc20Transfer } from './schema.js'

/** Contexte de vérification : contrat officiel (.env), destinataire, montant attendu. */
export interface VerifyContext {
  /** Adresse du contrat USDT officiel (.env, jamais saisie user). */
  contract: string
  /** Adresse de réception attendue (USDT_RECEIVE_ADDRESS). */
  receiver: string
  /** Montant attendu en unités atomiques (BigInt, déjà ×10^decimals). */
  expected_amount_atomic: bigint
}

/** Résultat de vérification — discriminé sur `kind`. */
export type VerificationResult =
  | { kind: 'exact'; amount_atomic: bigint }
  | { kind: 'over'; amount_atomic: bigint } // D-07 → ambiguous (file superadmin)
  | { kind: 'under'; amount_atomic: bigint } // D-06 → ambiguous (file superadmin)
  | { kind: 'rejected'; reason: 'wrong_token' | 'wrong_recipient' | 'not_confirmed' }

/**
 * Évalue les invariants on-chain conjoints d'un transfert TRC-20.
 *
 * @param transfer - Transfert parsé (schema.ts).
 * @param ctx - Contexte de vérification (contrat, destinataire, montant attendu).
 * @returns VerificationResult discriminé.
 */
export function verifyTransfer(transfer: Trc20Transfer, ctx: VerifyContext): VerificationResult {
  // (1) Identité du token = adresse de contrat UNIQUEMENT (T-04-FAKETOKEN).
  if (!sameAddress(transfer.token_info.address, ctx.contract)) {
    return { kind: 'rejected', reason: 'wrong_token' }
  }

  // (2) Destinataire normalisé hex<->base58.
  if (!sameAddress(transfer.to, ctx.receiver)) {
    return { kind: 'rejected', reason: 'wrong_recipient' }
  }

  // (3) Confirmation (anti-réorg A7). `only_confirmed=true` filtre déjà côté client ;
  //     si le transfert porte un marqueur explicite non confirmé, on rejette.
  if (transfer.confirmed === false) {
    return { kind: 'rejected', reason: 'not_confirmed' }
  }

  // (4) Montant : BigInt strict, zéro float, jamais epsilon (Pitfall 4).
  const received = BigInt(transfer.value)
  const expected = ctx.expected_amount_atomic
  if (received === expected) {
    return { kind: 'exact', amount_atomic: received }
  }
  if (received > expected) {
    return { kind: 'over', amount_atomic: received } // D-07 ambiguous
  }
  return { kind: 'under', amount_atomic: received } // D-06 ambiguous
}
