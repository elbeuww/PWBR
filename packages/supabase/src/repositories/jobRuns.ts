/**
 * Repository job_runs — écriture via service_role (bypass RLS).
 *
 * Utilisé par apps/jobs (plan 03) pour tracer les exécutions.
 * JAMAIS importé depuis apps/web.
 *
 * Source : 01-RESEARCH.md §Code Examples §Wrapper runJob + §Pattern 5
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, JobRunRow, JobRunStatus, Json } from '../database.types'

type ServiceClient = SupabaseClient<Database>

/**
 * Crée une ligne job_runs en statut 'running'.
 * Retourne l'ID de la ligne créée.
 */
export async function startRun(client: ServiceClient, jobName: string): Promise<string> {
  const { data, error } = await client
    .from('job_runs')
    .insert({ job_name: jobName, status: 'running' as JobRunStatus })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(`startRun failed for job "${jobName}": ${error?.message ?? 'no data'}`)
  }

  return data.id
}

/**
 * Met à jour la ligne job_runs avec le statut final (success ou error).
 */
export async function finishRun(
  client: ServiceClient,
  id: string,
  status: 'success' | 'error',
  options?: { error?: string; stats?: Json },
): Promise<JobRunRow> {
  const update: Database['public']['Tables']['job_runs']['Update'] = {
    status,
    finished_at: new Date().toISOString(),
  }
  if (options?.error !== undefined) update.error = options.error
  if (options?.stats !== undefined) update.stats = options.stats

  const { data, error } = await client
    .from('job_runs')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error || !data) {
    throw new Error(`finishRun failed for id "${id}": ${error?.message ?? 'no data'}`)
  }

  return data
}
