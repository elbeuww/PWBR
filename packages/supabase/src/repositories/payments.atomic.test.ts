/**
 * Test CR-02 — sérialisation des montants atomiques en string (jamais Number()).
 *
 * Invariant monétaire (atomic.ts, Pitfall 4) : montants BigInt bout-en-bout, AUCUN
 * Number()/parseFloat(). Les colonnes `bigint` Postgres sont sérialisées en string
 * par PostgREST. Ce test verrouille qu'une valeur > 2^53 (au-delà de
 * Number.MAX_SAFE_INTEGER) est écrite EXACTEMENT comme string, sans arrondi, et
 * round-trip via BigInt sans perte de précision. Mocke le client supabase et
 * inspecte le payload passé à `.insert` / `.update`.
 */
import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../database.types'
import { reserveOffset, insertPendingPayment, transitionPayment } from './payments'

/** 2^53 + 1 : la plus petite valeur entière non représentable exactement en JS number. */
const UNSAFE_ATOMIC = 9_007_199_254_740_993n
const UNSAFE_STRING = '9007199254740993'

type ServiceClient = SupabaseClient<Database>

/** Capture le payload passé à insert/update et résout un succès PostgREST minimal. */
function makeInsertSpy() {
  const captured: { payload?: Record<string, unknown> } = {}
  const single = vi.fn().mockResolvedValue({ data: { id: 'pay-1' }, error: null })
  const select = vi.fn().mockReturnValue({ single })
  const insert = vi.fn().mockImplementation((payload: Record<string, unknown>) => {
    captured.payload = payload
    return { select }
  })
  const client = { from: vi.fn().mockReturnValue({ insert }) } as unknown as ServiceClient
  return { client, captured }
}

function makeUpdateSpy() {
  const captured: { payload?: Record<string, unknown> } = {}
  const eq = vi.fn().mockResolvedValue({ error: null })
  const update = vi.fn().mockImplementation((payload: Record<string, unknown>) => {
    captured.payload = payload
    return { eq }
  })
  const client = { from: vi.fn().mockReturnValue({ update }) } as unknown as ServiceClient
  return { client, captured }
}

describe('CR-02 — montants atomiques sérialisés en string (jamais Number)', () => {
  it('reserveOffset écrit expected_amount_atomic comme string exacte (pas un number arrondi)', async () => {
    const { client, captured } = makeInsertSpy()
    await reserveOffset(client, {
      user_id: 'u-1',
      plan: 'standard',
      // base + offset 1 = UNSAFE_ATOMIC ; vérifie qu'aucun Number() n'arrondit.
      base_amount_atomic: UNSAFE_ATOMIC - 1n,
      reservation_expires_at: '2026-06-15T00:00:00Z',
    })

    const value = captured.payload?.['expected_amount_atomic']
    expect(typeof value).toBe('string')
    expect(value).toBe(UNSAFE_STRING)
    // round-trip sans perte
    expect(BigInt(value as string)).toBe(UNSAFE_ATOMIC)
  })

  it('insertPendingPayment écrit expected_amount_atomic comme string exacte', async () => {
    const { client, captured } = makeInsertSpy()
    await insertPendingPayment(client, {
      user_id: 'u-1',
      tx_hash: 'a'.repeat(64),
      plan: 'standard',
      expected_amount_atomic: UNSAFE_ATOMIC,
    })

    const value = captured.payload?.['expected_amount_atomic']
    expect(typeof value).toBe('string')
    expect(value).toBe(UNSAFE_STRING)
    expect(BigInt(value as string)).toBe(UNSAFE_ATOMIC)
  })

  it('transitionPayment écrit amount_atomic (reçu, attaquant-contrôlé) comme string exacte', async () => {
    const { client, captured } = makeUpdateSpy()
    await transitionPayment(client, 'pay-1', 'ambiguous', {
      reject_reason: 'over',
      amount_atomic: UNSAFE_ATOMIC,
    })

    const value = captured.payload?.['amount_atomic']
    expect(typeof value).toBe('string')
    expect(value).toBe(UNSAFE_STRING)
    expect(BigInt(value as string)).toBe(UNSAFE_ATOMIC)
  })
})
