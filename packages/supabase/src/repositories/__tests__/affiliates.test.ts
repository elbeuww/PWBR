/**
 * Test unitaire repos affiliation (AFF-01 / AFF-04) — client mocké, sans DB réelle.
 *
 * attributeReferral (best-effort, T-07-ATTR-CRASH / D-11 / D-12) :
 *  - code inconnu → {attributed:false} SANS throw (no-op)
 *  - self-ref (affilié.user_id === referral_user_id) → {attributed:false} (D-12)
 *  - insert OK → {attributed:true}
 *  - 23505 sur referrals(user_id) → {attributed:true} (idempotent, last-touch au cookie)
 *  - autre erreur DB → throw
 *
 * markCommissionPaid (AFF-04) : forme d'appel RPC EXACTE (mark_commission_paid +
 * p_amount_atomic en STRING, jamais Number — CR-02).
 *
 * computeCommissions (AFF-03) : appel RPC compute_affiliate_commissions(p_period).
 */
import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../database.types'
import { attributeReferral } from '../affiliates'
import { markCommissionPaid, computeCommissions } from '../commissions'

type ServiceClient = SupabaseClient<Database>

// ─── Mock du lookup affiliate_codes + insert referrals ────────────────────────

interface CodeLookup {
  affiliate_id: string
  affiliates: { user_id: string }
}

/**
 * Construit un client mocké : `.from('affiliate_codes').select(...).eq(...).maybeSingle()`
 * renvoie `codeRow` ; `.from('referrals').insert(...)` renvoie `insertResult`.
 */
function makeReferralClient(opts: {
  codeRow: CodeLookup | null
  insertError?: { code?: string; message?: string } | null
}): ServiceClient {
  const insertResult = { error: opts.insertError ?? null }
  return {
    from(table: string) {
      if (table === 'affiliate_codes') {
        return {
          select() {
            return this
          },
          eq() {
            return this
          },
          maybeSingle() {
            return Promise.resolve({ data: opts.codeRow, error: null })
          },
        }
      }
      // referrals
      return {
        insert() {
          return Promise.resolve(insertResult)
        },
      }
    },
  } as unknown as ServiceClient
}

describe('attributeReferral — best-effort (AFF-01)', () => {
  it('code inconnu → {attributed:false} sans throw (no-op, T-07-ATTR-CRASH)', async () => {
    const client = makeReferralClient({ codeRow: null })
    await expect(
      attributeReferral(client, { affiliate_code: 'NOPE', referral_user_id: 'u1' }),
    ).resolves.toEqual({ attributed: false })
  })

  it('self-ref → skip {attributed:false} (D-12)', async () => {
    const client = makeReferralClient({
      codeRow: { affiliate_id: 'aff1', affiliates: { user_id: 'u1' } },
    })
    await expect(
      attributeReferral(client, { affiliate_code: 'CODE', referral_user_id: 'u1' }),
    ).resolves.toEqual({ attributed: false })
  })

  it('insert OK → {attributed:true}', async () => {
    const client = makeReferralClient({
      codeRow: { affiliate_id: 'aff1', affiliates: { user_id: 'owner' } },
      insertError: null,
    })
    await expect(
      attributeReferral(client, { affiliate_code: 'CODE', referral_user_id: 'u2' }),
    ).resolves.toEqual({ attributed: true })
  })

  it('23505 → {attributed:true} (idempotent, D-11)', async () => {
    const client = makeReferralClient({
      codeRow: { affiliate_id: 'aff1', affiliates: { user_id: 'owner' } },
      insertError: { code: '23505', message: 'duplicate key' },
    })
    await expect(
      attributeReferral(client, { affiliate_code: 'CODE', referral_user_id: 'u2' }),
    ).resolves.toEqual({ attributed: true })
  })

  it('autre erreur DB → throw (best-effort ne masque pas une panne)', async () => {
    const client = makeReferralClient({
      codeRow: { affiliate_id: 'aff1', affiliates: { user_id: 'owner' } },
      insertError: { code: '42501', message: 'permission denied' },
    })
    await expect(
      attributeReferral(client, { affiliate_code: 'CODE', referral_user_id: 'u2' }),
    ).rejects.toThrow(/attributeReferral/)
  })
})

describe('commissions RPC wrappers (AFF-03/AFF-04) — zéro calcul JS', () => {
  it('markCommissionPaid appelle mark_commission_paid avec p_amount_atomic STRING (CR-02)', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null })
    const client = { rpc } as unknown as ServiceClient

    await markCommissionPaid(client, {
      commission_id: 'c1',
      tx_hash: '0xabc',
      // montant > 2^53 : doit rester string, jamais Number.
      amount_atomic: '9007199254740993',
    })

    expect(rpc).toHaveBeenCalledWith('mark_commission_paid', {
      p_commission_id: 'c1',
      p_tx_hash: '0xabc',
      p_amount_atomic: '9007199254740993',
    })
    // garde anti-float : l'argument transmis est bien une string, jamais un number.
    const call = rpc.mock.calls[0] as [string, { p_amount_atomic: unknown }]
    expect(typeof call[1].p_amount_atomic).toBe('string')
  })

  it('markCommissionPaid propage l\'erreur RPC (anti double-payout porté par le RPC)', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ error: { message: 'commission déjà payée' } })
    const client = { rpc } as unknown as ServiceClient

    await expect(
      markCommissionPaid(client, { commission_id: 'c1', tx_hash: '0x', amount_atomic: '1' }),
    ).rejects.toThrow(/markCommissionPaid failed/)
  })

  it('computeCommissions appelle compute_affiliate_commissions(p_period)', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { period: '2026-06', rows: 3 }, error: null })
    const client = { rpc } as unknown as ServiceClient

    const result = await computeCommissions(client, '2026-06')

    expect(rpc).toHaveBeenCalledWith('compute_affiliate_commissions', { p_period: '2026-06' })
    expect(result).toEqual({ period: '2026-06', rows: 3 })
  })
})
