/**
 * Golden values — verifyTransfer : décision des invariants conjoints (PAY-02/04).
 *
 * Cœur de correction financière : un seul paiement crédité à tort = perte directe.
 * Tests hors-ligne, déterministes, sur transferts fabriqués (pas d'appel réseau).
 *
 * Invariants couverts (ET logique) :
 *   1. token (contrat) = sameAddress(token_info.address, ctx.contract) UNIQUEMENT
 *      → JAMAIS symbol/decimals (T-04-FAKETOKEN : faux homonyme rejeté).
 *   2. destinataire = sameAddress(to, ctx.receiver) (normalisation hex<->base58).
 *   3. confirmation : confirmed === false → not_confirmed (anti-réorg A7).
 *   4. montant : BigInt(value) === expected (===, zéro float, Pitfall 4) ;
 *      > → over (D-07 ambiguous) ; < → under (D-06 ambiguous).
 * Le replay (5e invariant) n'est PAS ici → UNIQUE(tx_hash) DB (Plan 02).
 */
import { describe, it, expect } from 'vitest'
import { verifyTransfer, type VerifyContext } from './verify.js'
import type { Trc20Transfer } from './schema.js'

// Adresses golden (address.test.ts / GOLDEN.md) — base58 vs hex de la MÊME adresse
const CONTRACT_B58 = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
const CONTRACT_HEX = '41a614f803b6fd780986a42c78ec9c7f77e6ded13c'
const RECEIVER_B58 = 'TL1y3hnprGvKWAdAGRjZnoWJmEp5q8D9qR'
const RECEIVER_HEX = '416e36db7034c9c00f631e7c95e44529525a09a10f'
// Un autre contrat / destinataire (faux token homonyme et mauvais dest)
const FAKE_CONTRACT = 'TK5vKwGSazWAaJeXpPJLZ5V6jHuryeLzaK'
const WRONG_RECEIVER = 'TVF2Mp9QY7FEGTnr3DBpFLobA6jguHyMvi'

const EXPECTED = 1_000_000n // 1 USDT atomique

function makeTransfer(overrides: Partial<Trc20Transfer> = {}): Trc20Transfer {
  return {
    transaction_id: 'tx-1',
    token_info: {
      symbol: 'USDT',
      address: CONTRACT_B58,
      decimals: 6,
      name: 'Tether USD',
    },
    block_timestamp: 1781527728000,
    from: WRONG_RECEIVER,
    to: RECEIVER_B58,
    type: 'Transfer',
    value: EXPECTED.toString(),
    ...overrides,
  }
}

const ctx: VerifyContext = {
  contract: CONTRACT_B58,
  receiver: RECEIVER_B58,
  expected_amount_atomic: EXPECTED,
}

describe('verifyTransfer — invariants conjoints', () => {
  it('exact : contrat OK + dest OK + montant === + confirmé', () => {
    const r = verifyTransfer(makeTransfer(), ctx)
    expect(r).toEqual({ kind: 'exact', amount_atomic: EXPECTED })
  })

  it('exact : tolère contrat/dest en hex (normalisation hex<->base58)', () => {
    const r = verifyTransfer(
      makeTransfer({ token_info: { symbol: 'USDT', address: CONTRACT_HEX, decimals: 6 }, to: RECEIVER_HEX }),
      ctx,
    )
    expect(r).toEqual({ kind: 'exact', amount_atomic: EXPECTED })
  })

  it('wrong_token : faux token homonyme (symbol USDT, decimals 6) rejeté par contrat', () => {
    const r = verifyTransfer(
      makeTransfer({ token_info: { symbol: 'USDT', address: FAKE_CONTRACT, decimals: 6, name: 'Tether USD' } }),
      ctx,
    )
    expect(r).toEqual({ kind: 'rejected', reason: 'wrong_token' })
  })

  it('wrong_recipient : to != receiver après normalisation', () => {
    const r = verifyTransfer(makeTransfer({ to: WRONG_RECEIVER }), ctx)
    expect(r).toEqual({ kind: 'rejected', reason: 'wrong_recipient' })
  })

  it('not_confirmed : transfert marqué confirmed === false', () => {
    const r = verifyTransfer(makeTransfer({ confirmed: false }), ctx)
    expect(r).toEqual({ kind: 'rejected', reason: 'not_confirmed' })
  })

  it('over : value > expected → ambiguous (D-07), jamais activation auto', () => {
    const over = EXPECTED + 1n
    const r = verifyTransfer(makeTransfer({ value: over.toString() }), ctx)
    expect(r).toEqual({ kind: 'over', amount_atomic: over })
  })

  it('under : value < expected → ambiguous (D-06), jamais rejet auto', () => {
    const under = EXPECTED - 1n
    const r = verifyTransfer(makeTransfer({ value: under.toString() }), ctx)
    expect(r).toEqual({ kind: 'under', amount_atomic: under })
  })

  it('montant comparé en BigInt strict (===), jamais epsilon', () => {
    // 1 unité atomique d'écart = sous-paiement, jamais arrondi à exact
    const r = verifyTransfer(makeTransfer({ value: (EXPECTED - 1n).toString() }), ctx)
    expect(r.kind).toBe('under')
    // et l'exact strict est exact
    expect(verifyTransfer(makeTransfer(), ctx).kind).toBe('exact')
  })

  it('priorité contrat avant montant : faux token avec montant exact reste wrong_token', () => {
    const r = verifyTransfer(
      makeTransfer({ token_info: { symbol: 'USDT', address: FAKE_CONTRACT, decimals: 6 } }),
      ctx,
    )
    expect(r).toEqual({ kind: 'rejected', reason: 'wrong_token' })
  })
})
