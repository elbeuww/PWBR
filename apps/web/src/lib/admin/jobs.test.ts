/**
 * Tests du réducteur dernier-run-par-job + durée (ADMIN-04, D-07).
 *
 * runDurationMs : ms entre started_at et finished_at ; null si running (finished null)
 *   ou si une date est inanalysable.
 * latestPerJob : entrée supposée triée started_at desc (la page passe l'ordre DB) →
 *   garde la PREMIÈRE occurrence par job_name (= la plus récente), ordre first-seen stable.
 */
import { describe, expect, it } from 'vitest'
import { latestPerJob, runDurationMs } from './jobs.js'

describe('runDurationMs — durée d\'un run', () => {
  it('durée ms entre started et finished', () => {
    expect(runDurationMs('2026-06-19T00:00:00Z', '2026-06-19T00:00:05Z')).toBe(5000)
  })

  it('finished null (running) → null', () => {
    expect(runDurationMs('2026-06-19T00:00:00Z', null)).toBeNull()
  })

  it('date inanalysable → null', () => {
    expect(runDurationMs('pas-une-date', '2026-06-19T00:00:05Z')).toBeNull()
    expect(runDurationMs('2026-06-19T00:00:00Z', 'pas-une-date')).toBeNull()
  })

  it('durée 0 si started == finished', () => {
    expect(runDurationMs('2026-06-19T00:00:00Z', '2026-06-19T00:00:00Z')).toBe(0)
  })
})

describe('latestPerJob — dernier run par job (D-07)', () => {
  const rows = [
    { job_name: 'ingest', status: 'success', started_at: '2026-06-19T03:00:00Z', finished_at: '2026-06-19T03:00:10Z' },
    { job_name: 'telegram', status: 'error', started_at: '2026-06-19T02:00:00Z', finished_at: '2026-06-19T02:00:02Z' },
    { job_name: 'ingest', status: 'error', started_at: '2026-06-19T01:00:00Z', finished_at: '2026-06-19T01:00:30Z' },
  ]

  it('garde la première occurrence par job_name (la plus récente)', () => {
    const result = latestPerJob(rows)
    expect(result).toHaveLength(2)
    const ingest = result.find((r) => r.job_name === 'ingest')
    expect(ingest?.status).toBe('success') // run de 03:00, pas 01:00
  })

  it('attache durationMs calculée', () => {
    const result = latestPerJob(rows)
    const ingest = result.find((r) => r.job_name === 'ingest')
    expect(ingest?.durationMs).toBe(10000)
  })

  it('ordre first-seen stable', () => {
    const result = latestPerJob(rows)
    expect(result.map((r) => r.job_name)).toEqual(['ingest', 'telegram'])
  })

  it('run en cours (finished null) → durationMs null', () => {
    const running = [
      { job_name: 'ingest', status: 'running', started_at: '2026-06-19T03:00:00Z', finished_at: null },
    ]
    expect(latestPerJob(running)[0]!.durationMs).toBeNull()
  })

  it('entrée vide → tableau vide', () => {
    expect(latestPerJob([])).toEqual([])
  })
})
