/**
 * Golden tests — readRunArtifacts (concern #2 HIGH, anti path traversal T-04-15).
 *
 * `node:fs` mocké (vi.mock top-level hoisted, D-27). Vérifie :
 *  - run_id valide → lit les *.json, extrait instrument/style.
 *  - path traversal (regex OU startsWith) → throw 'invalid_run_id'.
 *  - répertoire valide mais 0 *.json → throw 'no_artifacts' (jamais succès silencieux).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('node:fs', () => ({
  readdirSync: vi.fn(),
  readFileSync: vi.fn(),
}))

import { readdirSync, readFileSync } from 'node:fs'
import { readRunArtifacts, RUN_ID_RE } from '../src/jobs/runArtifacts'

const mockReaddir = vi.mocked(readdirSync)
const mockReadFile = vi.mocked(readFileSync)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('RUN_ID_RE — format strict', () => {
  it('accepte un run_id conforme <session>-<YYYYMMDD>T<HHmm>Z', () => {
    expect(RUN_ID_RE.test('london-20260614T0700Z')).toBe(true)
  })

  it('rejette des formes tordues / path traversal', () => {
    expect(RUN_ID_RE.test('../../etc/passwd')).toBe(false)
    expect(RUN_ID_RE.test('london-20260614T0700Z/../..')).toBe(false)
    expect(RUN_ID_RE.test('LONDON-20260614T0700Z')).toBe(false)
    expect(RUN_ID_RE.test('')).toBe(false)
  })
})

describe('readRunArtifacts — lecture nominale', () => {
  it('run_id valide → lit les *.json et extrait instrument/style', () => {
    mockReaddir.mockReturnValue(['EURUSD_day.json', 'BTCUSDT_swing.json'] as never)
    mockReadFile.mockReturnValue('{"k":1}' as never)

    const out = readRunArtifacts('london-20260614T0700Z')

    expect(out).toHaveLength(2)
    expect(out[0]).toEqual({ instrument: 'EURUSD', style: 'day', raw: '{"k":1}' })
    expect(out[1]).toEqual({ instrument: 'BTCUSDT', style: 'swing', raw: '{"k":1}' })
  })

  it('ignore les fichiers non-.json et les noms non conformes', () => {
    mockReaddir.mockReturnValue(['EURUSD_day.json', 'README.md', 'noseparator.json'] as never)
    mockReadFile.mockReturnValue('{}' as never)

    const out = readRunArtifacts('london-20260614T0700Z')
    expect(out).toHaveLength(1)
    expect(out[0]!.instrument).toBe('EURUSD')
  })
})

describe('readRunArtifacts — anti path traversal (T-04-15)', () => {
  it('run_id ../../etc/passwd → throw invalid_run_id (regex échoue)', () => {
    expect(() => readRunArtifacts('../../etc/passwd')).toThrow('invalid_run_id')
    expect(mockReaddir).not.toHaveBeenCalled()
  })

  it('run_id avec séquence de remontée → throw invalid_run_id', () => {
    expect(() => readRunArtifacts('london-20260614T0700Z/../..')).toThrow('invalid_run_id')
    expect(mockReaddir).not.toHaveBeenCalled()
  })
})

describe('readRunArtifacts — liste vide = échec explicite (security)', () => {
  it('répertoire valide mais 0 *.json → throw no_artifacts', () => {
    mockReaddir.mockReturnValue([] as never)
    expect(() => readRunArtifacts('london-20260614T0700Z')).toThrow('no_artifacts')
  })

  it('répertoire avec seulement des non-.json → throw no_artifacts', () => {
    mockReaddir.mockReturnValue(['README.md', 'notes.txt'] as never)
    expect(() => readRunArtifacts('london-20260614T0700Z')).toThrow('no_artifacts')
  })
})
