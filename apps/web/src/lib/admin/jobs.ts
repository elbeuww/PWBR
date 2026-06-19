/**
 * lib/admin/jobs.ts — réducteur job_runs : dernier run par job + durée (ADMIN-04, D-07).
 *
 * Aucun I/O : pas d'import Supabase/next/fetch. La page RSC charge les job_runs
 * triés started_at desc et appelle ces fonctions pour afficher le dernier run par job.
 */

/** Ligne job_runs minimale consommée par le réducteur. */
export interface JobRunInput {
  job_name: string
  status: string
  started_at: string
  finished_at: string | null
}

/** Ligne enrichie : dernier run d'un job + durée calculée (null si en cours/inanalysable). */
export interface LatestJobRun extends JobRunInput {
  durationMs: number | null
}

/**
 * Durée d'un run en ms. null si finished_at est null (run en cours) ou si une des
 * deux dates est inanalysable (NaN). Zéro si started == finished.
 */
export function runDurationMs(startedAt: string, finishedAt: string | null): number | null {
  if (finishedAt === null) return null
  const start = Date.parse(startedAt)
  const end = Date.parse(finishedAt)
  if (Number.isNaN(start) || Number.isNaN(end)) return null
  return end - start
}

/**
 * Réduit une liste plate de job_runs (supposée triée started_at desc par la page)
 * au dernier run par job_name : garde la PREMIÈRE occurrence rencontrée (= la plus
 * récente), attache durationMs. Ordre de sortie = first-seen (stable).
 */
export function latestPerJob(rows: JobRunInput[]): LatestJobRun[] {
  const seen = new Set<string>()
  const result: LatestJobRun[] = []
  for (const row of rows ?? []) {
    if (seen.has(row.job_name)) continue
    seen.add(row.job_name)
    result.push({ ...row, durationMs: runDurationMs(row.started_at, row.finished_at) })
  }
  return result
}
