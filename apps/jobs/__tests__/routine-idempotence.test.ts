/**
 * Garde Wave-0 — idempotence run-level (D-45, ROUTINE-04).
 *
 * Prouve le contrat d'immuabilité de la frontière persist.ts SANS la modifier :
 *
 *  - Test A (ordre) : expirePriorSetups est invoqué STRICTEMENT avant
 *    insertTradeSetups (expire-avant-insert), et la clé d'expiration porte les
 *    4 champs { instrument_id, style, session, session_day }. session_day est
 *    dérivé de generated_at via sessionDayOf (jamais réimplémenté ici).
 *  - Test B (re-run sûr) : deux persist() du MÊME artefact (même generated_at)
 *    produisent la MÊME session_day → un re-run efface l'ancien setup avant de
 *    réinsérer ⇒ pas de doublon au niveau contrat.
 *
 * Mocks hoisted calqués sur persist.test.ts (D-27). AUCUNE édition de persist.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  validLongOutput,
  makeSnapshotRow,
  toRaw,
  INSTRUMENT_ID,
} from './__fixtures__/run-artifacts'

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

import { persist, sessionDayOf } from '../src/jobs/persist'

// ── helpers ───────────────────────────────────────────────────────────────────

function setEnv(): void {
  process.env['SUPABASE_URL'] = 'http://localhost'
  process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'svc-key'
  process.env['RUN_ID'] = 'london-20260614T0700Z'
  process.env['MODEL_LABEL'] = 'claude-code-max'
  process.env['PROMPT_VERSION'] = 'veteran-v1'
}

/** Configure readRunArtifacts pour renvoyer un seul artefact valide. */
function withValidArtifact(): void {
  mockReadRunArtifacts.mockReturnValue([
    { instrument: 'EURUSD', style: 'day', raw: toRaw(validLongOutput) },
  ])
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
// D-45 — expire-avant-insert + session_day stable au re-run
// ════════════════════════════════════════════════════════════════════════════

describe('persist — idempotence run-level (D-45)', () => {
  it('Test A — expirePriorSetups AVANT insertTradeSetups, clé 4 champs', async () => {
    withValidArtifact()

    const stats = (await persist()) as { written: number }
    expect(stats.written).toBe(1)

    // Ordre strict via les compteurs d'invocation globaux de vitest.
    const expireOrder = mockExpirePriorSetups.mock.invocationCallOrder[0]!
    const insertOrder = mockInsertTradeSetups.mock.invocationCallOrder[0]!
    expect(expireOrder).toBeLessThan(insertOrder)

    // La clé d'expiration porte exactement les 4 champs (session_day dérivé).
    const key = mockExpirePriorSetups.mock.calls[0]![1]
    expect(key).toEqual({
      instrument_id: INSTRUMENT_ID,
      style: 'day',
      session: 'london',
      session_day: sessionDayOf(validLongOutput.generated_at),
    })
  })

  it('Test B — re-run du même artefact → même session_day (pas de doublon)', async () => {
    // 1er run.
    withValidArtifact()
    await persist()
    const sessionDay1 = (mockExpirePriorSetups.mock.calls[0]![1] as { session_day: string })
      .session_day

    // Reset des mocks d'appel, on REJOUE le MÊME artefact (même generated_at).
    vi.clearAllMocks()
    mockGetSnapshotByHash.mockResolvedValue(makeSnapshotRow())
    mockExpirePriorSetups.mockResolvedValue(undefined)
    mockInsertAnalysis.mockResolvedValue({ id: 'analysis-2' })
    mockInsertTradeSetups.mockResolvedValue(undefined)
    withValidArtifact()
    await persist()
    const sessionDay2 = (mockExpirePriorSetups.mock.calls[0]![1] as { session_day: string })
      .session_day

    // Même clé d'expiration aux deux runs ⇒ le 2e efface le 1er avant de réinsérer.
    expect(sessionDay2).toBe(sessionDay1)
    expect(sessionDay1).toBe(sessionDayOf(validLongOutput.generated_at))
  })
})
