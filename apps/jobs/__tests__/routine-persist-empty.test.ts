/**
 * Garde Wave-0 — sémantique « marché calme » D-12-02 (ROUTINE-03/04).
 *
 * Verrouille la NUANCE exacte de la frontière persist.ts SANS la modifier :
 *
 *  - true-empty (marché calme) : l'ANALYZE n'écrit AUCUN fichier ET la routine
 *    (plan 02 runbook) N'APPELLE PAS persist. Si persist EST appelé sur un dir
 *    vide, readRunArtifacts throw 'no_artifacts' AVANT toute tentative d'écriture
 *    — signal « aucun setup produit », PAS une erreur de pipeline, PAS la garde
 *    WR-04. Aucune insertion n'est tentée.
 *  - all-rejected : 0 écrit + des rejets → la garde WR-04 (persist.ts ligne 369)
 *    throw `0 setup écrit`. Comportement VOULU (un run tout-rejeté reste visible
 *    dans job_runs.status=error), jamais affaibli.
 *  - succès non-vide : sanity que le pipeline réussit toujours sur un artefact sain.
 *
 * Mocks hoisted calqués sur persist.test.ts (D-27). AUCUNE édition de
 * persist.ts / runArtifacts.ts (frontière D-43 intacte).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Output } from '@app/core'
import { validLongOutput, makeSnapshotRow, toRaw } from './__fixtures__/run-artifacts'

// ── mocks hoisted ─────────────────────────────────────────────────────────────
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({})),
}))

const mockGetSnapshotByHash = vi.fn()
const mockInsertAnalysis = vi.fn()
const mockInsertTradeSetups = vi.fn()
const mockExpirePriorSetups = vi.fn()

vi.mock('@app/supabase', () => ({
  getSnapshotByHash: (...a: unknown[]) => mockGetSnapshotByHash(...a),
  insertAnalysis: (...a: unknown[]) => mockInsertAnalysis(...a),
  insertTradeSetups: (...a: unknown[]) => mockInsertTradeSetups(...a),
  expirePriorSetups: (...a: unknown[]) => mockExpirePriorSetups(...a),
}))

const mockReadRunArtifacts = vi.fn()
vi.mock('../src/jobs/runArtifacts', () => ({
  readRunArtifacts: (...a: unknown[]) => mockReadRunArtifacts(...a),
}))

import { persist } from '../src/jobs/persist'

// ── helpers ───────────────────────────────────────────────────────────────────

function setEnv(): void {
  process.env['SUPABASE_URL'] = 'http://localhost'
  process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'svc-key'
  process.env['RUN_ID'] = 'newyork-20260622T1730Z'
  process.env['MODEL_LABEL'] = 'claude-code-max'
  process.env['PROMPT_VERSION'] = 'veteran-v1'
}

/** Configure readRunArtifacts pour renvoyer un seul artefact (raw fourni). */
function withArtifact(raw: string): void {
  mockReadRunArtifacts.mockReturnValue([{ instrument: 'EURUSD', style: 'day', raw }])
}

beforeEach(() => {
  vi.clearAllMocks()
  setEnv()
  mockGetSnapshotByHash.mockResolvedValue(makeSnapshotRow())
  mockExpirePriorSetups.mockResolvedValue(undefined)
  mockInsertAnalysis.mockResolvedValue({ id: 'analysis-1' })
  mockInsertTradeSetups.mockResolvedValue(undefined)
})

// ════════════════════════════════════════════════════════════════════════════
// D-12-02 — true-empty (no_artifacts) vs all-rejected (throw WR-04)
// ════════════════════════════════════════════════════════════════════════════

describe('persist — marché calme (D-12-02) : no_artifacts ≠ erreur de pipeline', () => {
  it('Test A — true-empty : readRunArtifacts throw no_artifacts AVANT toute écriture', async () => {
    // Marché calme = l'ANALYZE n'a produit AUCUN fichier. readRunArtifacts throw
    // 'no_artifacts' (runArtifacts.ts ligne 80). Ce throw n'est PAS la garde WR-04 :
    // il survient AVANT la boucle de persistance → aucune insertion n'est tentée.
    // Le runbook (plan 02) évite ce cas en N'APPELANT PAS persist quand 0 artefact.
    mockReadRunArtifacts.mockImplementation(() => {
      throw new Error('no_artifacts')
    })

    await expect(persist()).rejects.toThrow('no_artifacts')

    // Source-assertion : 0 tentative d'écriture (ni expire, ni analysis, ni setups).
    expect(mockExpirePriorSetups).not.toHaveBeenCalled()
    expect(mockInsertAnalysis).not.toHaveBeenCalled()
    expect(mockInsertTradeSetups).not.toHaveBeenCalled()
  })

  it('Test B — all-rejected : written=0 && rejected>0 → throw WR-04 (intacte)', async () => {
    // 1 artefact dont le R:R recalculé sur le bord conservateur (1.081) < MIN_RR=1.2 :
    // SL 1.075 (risk 0.006) vs TP 1.086 (reward 0.005) ⇒ rr≈0.83 → rejet rr_below_min.
    // 0 écrit + 1 rejet ⇒ la garde WR-04 (persist.ts:369) throw. NE PAS l'affaiblir.
    const rrBad: Output = {
      ...validLongOutput,
      take_profits: [{ price: 1.086, alloc_pct: 100 }],
    }
    withArtifact(toRaw(rrBad))

    await expect(persist()).rejects.toThrow(/0 setup écrit/)
    // L'erreur vient de la garde WR-04, jamais d'une insertion réussie.
    expect(mockInsertTradeSetups).not.toHaveBeenCalled()
  })

  it('Test C — succès non-vide : 1 artefact valide → written=1, rejected=0', async () => {
    withArtifact(toRaw(validLongOutput))

    const stats = (await persist()) as { written: number; rejected: number }
    expect(stats.written).toBe(1)
    expect(stats.rejected).toBe(0)
    expect(mockInsertTradeSetups).toHaveBeenCalledTimes(1)
  })
})
