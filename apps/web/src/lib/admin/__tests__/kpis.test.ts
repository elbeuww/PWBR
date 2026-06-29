/**
 * kpis.test.ts — garde-fou des wrappers KPI gated du cockpit (Plan 20-03, Task 2 ;
 * threat T-20-12/14).
 *
 * Behavior testé :
 *  - chaque wrapper appelle le BON nom de RPC avec les BONS paramètres.
 *  - getMrr retourne le mois le plus récent ; formatMrr formate via formatAtomic
 *    et porte le libellé verrouillé « cash encaissé / mois » (D-13).
 *  - les wrappers dégradent gracieusement (0 ligne → [] / null), jamais throw.
 *  - assertion source : kpis.ts ne lit JAMAIS `mv_mrr` via `.from()` (Pitfall 3).
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock du client serveur anon : rpc() renvoie un payload contrôlé et est espionné.
const rpc = vi.fn()
vi.mock('../../supabase/server', () => ({
  createClient: vi.fn(async () => ({ rpc })),
}))

import {
  getMrr,
  formatMrr,
  getAcquisitionFunnel,
  getChurn,
  getPlanMix,
  MRR_LABEL,
} from '../kpis'

beforeEach(() => {
  rpc.mockReset()
})

describe('getMrr — RPC get_mrr, dernier mois', () => {
  it('appelle rpc("get_mrr") et retourne le mois le plus récent', async () => {
    rpc.mockResolvedValue({
      data: [
        { month: '2026-04-01', payments_count: 3, revenue_atomic: '3000000' },
        { month: '2026-06-01', payments_count: 5, revenue_atomic: '9020000' },
        { month: '2026-05-01', payments_count: 4, revenue_atomic: '4000000' },
      ],
      error: null,
    })
    const row = await getMrr()
    expect(rpc).toHaveBeenCalledWith('get_mrr')
    expect(row?.month).toBe('2026-06-01')
  })

  it('0 ligne (non-superadmin) → null, jamais throw', async () => {
    rpc.mockResolvedValue({ data: [], error: null })
    await expect(getMrr()).resolves.toBeNull()
  })
})

describe('formatMrr — MRR honnête (D-13)', () => {
  it('formate revenue_atomic via formatAtomic + libellé verrouillé', () => {
    const s = formatMrr({ month: '2026-06-01', payments_count: 5, revenue_atomic: '9020000' })
    expect(s.amount).toBe('9.020000')
    expect(s.label).toBe('cash encaissé / mois')
    expect(s.label).toBe(MRR_LABEL)
    expect(s.paymentsCount).toBe(5)
  })

  it('null → 0 cash encaissé', () => {
    expect(formatMrr(null).amount).toBe('0.000000')
  })
})

describe('getAcquisitionFunnel — RPC get_acquisition_funnel(p_from,p_to)', () => {
  it('passe p_from/p_to et retourne les lignes', async () => {
    rpc.mockResolvedValue({ data: [{ source: 'demo', stage: 'signup', n: 10 }], error: null })
    const rows = await getAcquisitionFunnel('2026-01-01', '2026-06-30')
    expect(rpc).toHaveBeenCalledWith('get_acquisition_funnel', {
      p_from: '2026-01-01',
      p_to: '2026-06-30',
    })
    expect(rows).toHaveLength(1)
  })

  it('0 ligne → [] ', async () => {
    rpc.mockResolvedValue({ data: [], error: null })
    await expect(getAcquisitionFunnel()).resolves.toEqual([])
  })
})

describe('getChurn — RPC get_churn(p_month)', () => {
  it('passe p_month et retourne la ligne agrégée', async () => {
    rpc.mockResolvedValue({ data: [{ active_start: 100, churn_count: 7 }], error: null })
    const row = await getChurn('2026-06-01')
    expect(rpc).toHaveBeenCalledWith('get_churn', { p_month: '2026-06-01' })
    expect(row?.churn_count).toBe(7)
  })

  it('0 ligne → null', async () => {
    rpc.mockResolvedValue({ data: [], error: null })
    await expect(getChurn()).resolves.toBeNull()
  })
})

describe('getPlanMix — RPC get_plan_mix', () => {
  it('appelle rpc("get_plan_mix") et retourne la répartition', async () => {
    rpc.mockResolvedValue({ data: [{ plan: 'pro', n: 12 }], error: null })
    const rows = await getPlanMix()
    expect(rpc).toHaveBeenCalledWith('get_plan_mix')
    expect(rows[0]?.plan).toBe('pro')
  })
})

describe('assertion source — aucune lecture matview directe (T-20-14)', () => {
  it('kpis.ts ne contient aucun .from("mv_mrr")', () => {
    const here = path.dirname(fileURLToPath(import.meta.url))
    const src = readFileSync(path.resolve(here, '../kpis.ts'), 'utf8')
    expect(src).not.toMatch(/\.from\(\s*['"`]mv_mrr['"`]/)
  })

  it('kpis.ts n’importe pas admin-service (service_role)', () => {
    const here = path.dirname(fileURLToPath(import.meta.url))
    const src = readFileSync(path.resolve(here, '../kpis.ts'), 'utf8')
    expect(src).not.toMatch(/admin-service/)
  })
})
