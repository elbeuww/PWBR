/**
 * Golden tests — persist (frontière de confiance unique, D-43 / SCORE-04/05).
 *
 * Mocks top-level hoisted (D-27) : @app/supabase (repos), ./runArtifacts (lecture
 * fichiers), @supabase/supabase-js (client). Couvre :
 *  Task 1 — garde-fous + rejets normalisés (json_parse, zod_shape,
 *           snapshot_not_found, rr_below_min, sl_coherence, tp_bounds,
 *           structure_against) + reasons = codes seuls (jamais de valeur).
 *  Task 2 — chemin succès : ordre expire→insert, clé session_day, valid_until
 *           24/72h, snapshot.partial → risk relevé, dualité entry_price, score
 *           déterministe (jamais le score agent).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import type { Output } from '@app/core'
import {
  validLongOutput,
  combinedSnapshot,
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

import {
  persist,
  runGuardrails,
  structureDirection,
  stripFence,
  sessionDayOf,
  validUntilOf,
  raiseRisk,
  computePromptVersion,
  VETERAN_PROMPT_PATH,
  DAY_VALID_HOURS,
  SWING_VALID_HOURS,
} from '../src/jobs/persist'

// ── helpers ───────────────────────────────────────────────────────────────────

function setEnv(): void {
  process.env['SUPABASE_URL'] = 'http://localhost'
  process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'svc-key'
  process.env['RUN_ID'] = 'london-20260614T0700Z'
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
// Task 1 — garde-fous + rejets normalisés
// ════════════════════════════════════════════════════════════════════════════

describe('stripFence', () => {
  it('retire un fence markdown ```json ... ```', () => {
    const fenced = '```json\n{"a":1}\n```'
    expect(stripFence(fenced)).toBe('{"a":1}')
  })
  it('laisse un JSON nu inchangé', () => {
    expect(stripFence('{"a":1}')).toBe('{"a":1}')
  })
})

describe('persist — rejets normalisés (SCORE-04)', () => {
  it('JSON malformé → reason json_parse, rien écrit', async () => {
    withArtifact('{ not json')
    const stats = (await persist().catch((e) => e)) as Error
    // 0 écrit + rejets → throw ; on inspecte via un wrapper qui ne throw pas :
    expect(stats).toBeInstanceOf(Error)
  })

  it('JSON parse-able mais fence + valide → strip défensif réussit (succès)', async () => {
    withArtifact(toRaw(validLongOutput, true))
    const stats = (await persist()) as { written: number; rejected: number }
    expect(stats.written).toBe(1)
    expect(stats.rejected).toBe(0)
  })

  it('JSON conforme JSON mais hors §3 (enum invalide) → reason zod_shape', async () => {
    const bad = { ...validLongOutput, session: 'INVALID' }
    withArtifact(JSON.stringify(bad))
    await expect(persist()).rejects.toThrow() // 0 écrit + 1 rejet
  })

  it('snapshot introuvable → reason snapshot_not_found', async () => {
    mockGetSnapshotByHash.mockResolvedValue(null)
    withArtifact(toRaw(validLongOutput))
    await expect(persist()).rejects.toThrow()
    expect(mockInsertAnalysis).not.toHaveBeenCalled()
  })

  it('reasons ne contient JAMAIS de valeur numérique de prix/clé (T-02-13)', async () => {
    // 2 artefacts rejetés pour pouvoir lire stats sans throw (1 succès + 1 rejet).
    const rrBad: Output = {
      ...validLongOutput,
      take_profits: [{ price: 1.086, alloc_pct: 100 }], // TP au-dessus de l'entrée mais R:R≈0.83 < 1.2
    }
    mockReadRunArtifacts.mockReturnValue([
      { instrument: 'EURUSD', style: 'day', raw: toRaw(validLongOutput) },
      { instrument: 'GBPUSD', style: 'day', raw: toRaw(rrBad) },
    ])
    const stats = (await persist()) as { written: number; rejected: number; reasons: string[] }
    expect(stats.written).toBe(1)
    expect(stats.rejected).toBe(1)
    expect(stats.reasons).toEqual(['rr_below_min'])
    // aucune chaîne contenant un chiffre (= pas de valeur de prix logguée)
    for (const r of stats.reasons) {
      expect(/\d/.test(r)).toBe(false)
    }
  })
})

describe('runGuardrails — règles dures §3 (pur)', () => {
  const snap = makeSnapshotRow()

  it('R:R global < 1.2 → reject rr_below_min', () => {
    const out: Output = { ...validLongOutput, take_profits: [{ price: 1.086, alloc_pct: 100 }] }
    const g = runGuardrails(out, snap)
    expect(g.rejected).toBe(true)
    expect(g.reason).toBe('rr_below_min')
  })

  it('long avec SL > entrée conservatrice → reject sl_coherence', () => {
    const out: Output = { ...validLongOutput, stop_loss: 1.085 }
    const g = runGuardrails(out, snap)
    expect(g.rejected).toBe(true)
    expect(g.reason).toBe('sl_coherence')
  })

  it('long avec un TP du mauvais côté → reject sl_coherence', () => {
    const out: Output = {
      ...validLongOutput,
      take_profits: [
        { price: 1.092, alloc_pct: 60 },
        { price: 1.07, alloc_pct: 40 }, // sous l'entrée
      ],
    }
    const g = runGuardrails(out, snap)
    expect(g.rejected).toBe(true)
    expect(g.reason).toBe('sl_coherence')
  })

  it('somme alloc_pct ≠ 100 → reject tp_bounds (pas de borne silencieuse)', () => {
    const out: Output = {
      ...validLongOutput,
      take_profits: [
        { price: 1.092, alloc_pct: 50 },
        { price: 1.1, alloc_pct: 40 }, // somme 90
      ],
    }
    const g = runGuardrails(out, snap)
    expect(g.rejected).toBe(true)
    expect(g.reason).toBe('tp_bounds')
  })

  it('structure cassée CONTRE la direction → reject structure_against', () => {
    // trade long, mais CHoCH sur LTF bullish ⇒ cassure baissière (retournement).
    const against = makeSnapshotRow({
      ...combinedSnapshot,
      technical: {
        ...combinedSnapshot.technical,
        trend_ltf: 'bullish',
        structure: { ...combinedSnapshot.technical.structure, bos_choch: 'choch' },
      },
    })
    const g = runGuardrails(validLongOutput, against)
    expect(g.rejected).toBe(true)
    expect(g.reason).toBe('structure_against')
  })

  it('setup valide (R:R≥1.2, cohérent, structure alignée) → non rejeté', () => {
    const g = runGuardrails(validLongOutput, snap)
    expect(g.rejected).toBe(false)
    expect(g.rrGlobal).toBeGreaterThanOrEqual(1.2)
    expect(g.entryCons).toBe(1.081) // bord conservateur long = zone[1]
  })
})

describe('structureDirection — BOS continue / CHoCH retourne', () => {
  it('bos sur LTF bullish → long (continuation)', () => {
    expect(
      structureDirection({
        ...combinedSnapshot.technical,
        trend_ltf: 'bullish',
        structure: { ...combinedSnapshot.technical.structure, bos_choch: 'bos' },
      }),
    ).toBe('long')
  })
  it('choch sur LTF bullish → short (retournement)', () => {
    expect(
      structureDirection({
        ...combinedSnapshot.technical,
        trend_ltf: 'bullish',
        structure: { ...combinedSnapshot.technical.structure, bos_choch: 'choch' },
      }),
    ).toBe('short')
  })
  it('null → pas de signal directionnel', () => {
    expect(
      structureDirection({
        ...combinedSnapshot.technical,
        structure: { ...combinedSnapshot.technical.structure, bos_choch: null },
      }),
    ).toBeNull()
  })
})

// ════════════════════════════════════════════════════════════════════════════
// Task 2 — chemin succès, immuabilité, valid_until, partial, dualité
// ════════════════════════════════════════════════════════════════════════════

describe('sessionDayOf — dérivation déterministe UTC (concern #1)', () => {
  it('07:05Z → 2026-06-14', () => {
    expect(sessionDayOf('2026-06-14T07:05:00Z')).toBe('2026-06-14')
  })
  it('23:30Z reste le jour UTC (pas de glissement de fuseau)', () => {
    expect(sessionDayOf('2026-06-14T23:30:00Z')).toBe('2026-06-14')
  })
})

describe('validUntilOf — fenêtres chiffrées (concern #3)', () => {
  it('day → now + 24h (DAY_VALID_HOURS)', () => {
    expect(DAY_VALID_HOURS).toBe(24)
    expect(validUntilOf('2026-06-14T07:00:00Z', 'day')).toBe('2026-06-15T07:00:00.000Z')
  })
  it('swing → now + 72h (SWING_VALID_HOURS)', () => {
    expect(SWING_VALID_HOURS).toBe(72)
    expect(validUntilOf('2026-06-14T07:00:00Z', 'swing')).toBe('2026-06-17T07:00:00.000Z')
  })
})

describe('raiseRisk — relève d\'un cran, jamais low', () => {
  it('low→medium, medium→high, high→extreme, extreme→extreme', () => {
    expect(raiseRisk('low')).toBe('medium')
    expect(raiseRisk('medium')).toBe('high')
    expect(raiseRisk('high')).toBe('extreme')
    expect(raiseRisk('extreme')).toBe('extreme')
  })
})

describe('persist — chemin succès + immuabilité (SCORE-05, D-45)', () => {
  it('expirePriorSetups appelé AVANT insertTradeSetups, clé avec session_day', async () => {
    withArtifact(toRaw(validLongOutput))
    const order: string[] = []
    mockExpirePriorSetups.mockImplementation(async () => {
      order.push('expire')
    })
    mockInsertTradeSetups.mockImplementation(async () => {
      order.push('insert')
    })

    const stats = (await persist()) as { written: number }
    expect(stats.written).toBe(1)
    expect(order).toEqual(['expire', 'insert'])

    const key = mockExpirePriorSetups.mock.calls[0]![1]
    expect(key).toEqual({
      instrument_id: INSTRUMENT_ID,
      style: 'day',
      session: 'london',
      session_day: '2026-06-14',
    })
  })

  it('analyse reçoit snapshot exact + traçabilité (SCORE-05), aucune UPDATE', async () => {
    withArtifact(toRaw(validLongOutput))
    await persist()
    const row = mockInsertAnalysis.mock.calls[0]![1]
    expect(row.run_id).toBe('london-20260614T0700Z')
    expect(row.model).toBe('claude-code-max')
    expect(row.prompt_version).toBe('veteran-v1')
    expect(row.schema_version).toBe('1.0.0')
    expect(row.instrument_id).toBe(INSTRUMENT_ID)
    expect(row.snapshot).toBeDefined()
  })

  it('dualité entry_price : colonne = bord conservateur, payload.entry.price = médian agent', async () => {
    withArtifact(toRaw(validLongOutput))
    await persist()
    const setups = mockInsertTradeSetups.mock.calls[0]![1] as Array<Record<string, unknown>>
    const setup = setups[0]!
    expect(setup['entry_price']).toBe(1.081) // bord conservateur long = zone[1]
    const payload = setup['payload'] as Output
    expect(payload.entry.price).toBe(1.0805) // médian agent inchangé
  })

  it('opportunity_score/risk_level/confidence proviennent de scoreSetup, status active', async () => {
    withArtifact(toRaw(validLongOutput))
    await persist()
    const setups = mockInsertTradeSetups.mock.calls[0]![1] as Array<Record<string, unknown>>
    const setup = setups[0]!
    expect(typeof setup['opportunity_score']).toBe('number')
    expect(['low', 'medium', 'high', 'extreme']).toContain(setup['risk_level'])
    expect(['low', 'medium', 'high']).toContain(setup['confidence'])
    expect(setup['status']).toBe('active')
    expect(setup['risk_reward']).toBeGreaterThanOrEqual(1.2)
  })

  it('snapshot.partial=true → setup persisté ET risk_level relevé (jamais low, D-44)', async () => {
    mockGetSnapshotByHash.mockResolvedValue(makeSnapshotRow(combinedSnapshot, true))
    withArtifact(toRaw(validLongOutput))
    const stats = (await persist()) as { written: number }
    expect(stats.written).toBe(1)
    const setups = mockInsertTradeSetups.mock.calls[0]![1] as Array<Record<string, unknown>>
    expect(setups[0]!['risk_level']).not.toBe('low')
  })
})

// ════════════════════════════════════════════════════════════════════════════
// Task 2 — prompt_version traçable (D-51, T-04-10)
// ════════════════════════════════════════════════════════════════════════════

describe('computePromptVersion (D-51)', () => {
  it('retourne semver + hash hex sha256 depuis veteran.md (défaut)', () => {
    const pv = computePromptVersion()
    // format `${semver}+${sha256hex}`
    const [semver, hash] = pv.split('+')
    expect(semver).toMatch(/^\d+\.\d+\.\d+$/) // semver front-matter
    expect(hash).toMatch(/^[a-f0-9]{64}$/) // sha256 hex 64 chars
  })

  it('VETERAN_PROMPT_PATH pointe sur veteran.md', () => {
    expect(VETERAN_PROMPT_PATH).toMatch(/veteran\.md$/)
  })

  it('lève si le front-matter version: est absent', () => {
    // un fichier sans front-matter version → throw (pas de version silencieuse)
    const tmp = path.join(os.tmpdir(), `noversion-${Date.now()}.md`)
    fs.writeFileSync(tmp, '# pas de front-matter\ncontenu')
    expect(() => computePromptVersion(tmp)).toThrow(/version:/)
    fs.unlinkSync(tmp)
  })
})
