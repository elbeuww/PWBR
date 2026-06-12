/**
 * runJob — wrapper d'exécution de job avec écriture job_runs (JOB-04)
 *
 * Chaque appel :
 *  1. Insère une ligne job_runs status='running' via service_role
 *  2. Exécute la fonction fn fournie
 *  3a. Si succès : met à jour status='success' + finished_at + stats
 *  3b. Si erreur : met à jour status='error' + finished_at + error, puis re-throw
 *
 * Pas de clé Supabase en dur — client créé depuis les variables d'env.
 * Pas de MCP — Pitfall 5 (RESEARCH) : jobs utilisent le SDK supabase-js directement.
 *
 * Le client est créé lazily à l'exécution (pas à l'import) pour que dotenv/config
 * soit chargé avant la validation des env vars (SUPABASE_URL requis).
 *
 * Source : 01-RESEARCH.md §Code Examples §Wrapper runJob + §Pattern 6
 */

import { createClient } from '@supabase/supabase-js'
import { startRun, finishRun } from '@app/supabase'
import type { Json, Database } from '@app/supabase'
import pino from 'pino'

const logger = pino({ level: 'info' })

/**
 * Crée un client service_role lazily (à l'exécution, pas à l'import).
 * Les variables d'env doivent être chargées (dotenv/config) avant l'appel.
 */
function getServiceClient() {
  const url = process.env['SUPABASE_URL']
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!url || !key) {
    throw new Error(
      'runJob: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in apps/jobs/.env',
    )
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Exécute un job et trace son exécution dans job_runs.
 *
 * @param jobName - Nom du job (clé dans dispatch.ts)
 * @param fn - Fonction asynchrone à exécuter. Peut retourner des stats (Json).
 * @throws Re-throw l'erreur de fn si elle lève (pour exit code non-zéro dans dispatch)
 */
export async function runJob(
  jobName: string,
  fn: () => Promise<Json | undefined>,
): Promise<void> {
  logger.info({ job: jobName }, 'job starting')

  const client = getServiceClient()
  const runId = await startRun(client, jobName)
  logger.info({ job: jobName, runId }, 'job_runs running inserted')

  try {
    const stats = await fn()
    await finishRun(client, runId, 'success', { stats: stats ?? null })
    logger.info({ job: jobName, runId }, 'job finished success')
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    logger.error({ job: jobName, runId, err: errorMessage }, 'job finished error')
    await finishRun(client, runId, 'error', { error: errorMessage })
    throw err
  }
}
