/**
 * Tests garde-fous sécurité Phase 7 (revue MEDIUM) :
 *  - M-01 : transitionApplication filtre status='pending' + lève si 0 ligne touchée
 *           (anti-rejeu : impossible de re-traiter une candidature déjà approved/rejected).
 *  - M-04 : computeCommissions valide le format de période AVANT le RPC.
 *
 * Mocke le client supabase (spy) et inspecte les filtres / le payload, miroir du
 * pattern de payments.atomic.test.ts.
 */
import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../database.types'
import { transitionApplication } from './affiliateApplications'
import { computeCommissions } from './commissions'

type ServiceClient = SupabaseClient<Database>

/** Spy UPDATE chaîné `.update(patch,{count}).eq('id').eq('status')` → résout {count,error}. */
function makeTransitionSpy(result: { count: number | null; error: { message: string } | null }) {
  const captured: { filters: Array<[string, unknown]>; patch?: Record<string, unknown> } = {
    filters: [],
  }
  // 2e .eq() est le terminal (résout la promesse PostgREST).
  const eqStatus = vi.fn().mockImplementation((col: string, val: unknown) => {
    captured.filters.push([col, val])
    return Promise.resolve(result)
  })
  const eqId = vi.fn().mockImplementation((col: string, val: unknown) => {
    captured.filters.push([col, val])
    return { eq: eqStatus }
  })
  const update = vi.fn().mockImplementation((patch: Record<string, unknown>) => {
    captured.patch = patch
    return { eq: eqId }
  })
  const client = { from: vi.fn().mockReturnValue({ update }) } as unknown as ServiceClient
  return { client, captured }
}

describe('M-01 — transitionApplication : garde de statut anti-rejeu', () => {
  it('filtre id ET status=pending sur l’UPDATE', async () => {
    const { client, captured } = makeTransitionSpy({ count: 1, error: null })
    await transitionApplication(client, 'app-1', 'approved')

    expect(captured.filters).toContainEqual(['id', 'app-1'])
    expect(captured.filters).toContainEqual(['status', 'pending'])
  })

  it('lève si 0 ligne touchée (candidature inexistante ou déjà traitée)', async () => {
    const { client } = makeTransitionSpy({ count: 0, error: null })
    await expect(transitionApplication(client, 'app-2', 'rejected')).rejects.toThrow(
      /inexistante ou déjà traitée/,
    )
  })

  it('réussit silencieusement quand exactement une ligne pending est transitionnée', async () => {
    const { client } = makeTransitionSpy({ count: 1, error: null })
    await expect(transitionApplication(client, 'app-3', 'approved')).resolves.toBeUndefined()
  })
})

describe('M-04 — computeCommissions : validation de période avant RPC', () => {
  function makeRpcSpy() {
    const rpc = vi.fn().mockResolvedValue({ data: { period: 'x', rows: [] }, error: null })
    const client = { rpc } as unknown as ServiceClient
    return { client, rpc }
  }

  it('rejette un mois hors 01-12 SANS appeler le RPC', async () => {
    const { client, rpc } = makeRpcSpy()
    await expect(computeCommissions(client, '2026-13')).rejects.toThrow(/période invalide/)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('rejette un format non YYYY-MM SANS appeler le RPC', async () => {
    const { client, rpc } = makeRpcSpy()
    await expect(computeCommissions(client, '2026/06')).rejects.toThrow(/période invalide/)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('accepte un mois valide et invoque le RPC', async () => {
    const { client, rpc } = makeRpcSpy()
    await computeCommissions(client, '2026-06')
    expect(rpc).toHaveBeenCalledWith('compute_affiliate_commissions', { p_period: '2026-06' })
  })
})
