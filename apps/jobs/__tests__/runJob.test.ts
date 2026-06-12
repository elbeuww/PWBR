/**
 * Test d'intégration runJob — JOB-04
 *
 * Vérifie que runJob écrit une ligne job_runs avec :
 *  - status='success' + finished_at non nul + stats quand fn réussit
 *  - status='error' + finished_at non nul + error quand fn lève
 *
 * Pré-requis : SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY dans apps/jobs/.env
 * (chargés par dotenv/config dans les helpers — pas besoin de les charger ici,
 *  runJob les charge via son import interne)
 *
 * Cleanup : supprime les lignes test via service_role après chaque cas.
 */

import { config as dotenvConfig } from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

// Charger apps/jobs/.env explicitement (CWD = racine monorepo lors de vitest run)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenvConfig({ path: path.resolve(__dirname, '../.env') })

import { createClient } from '@supabase/supabase-js'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { Database } from '@app/supabase'
import { runJob } from '../src/runJob'

// ─── client de vérification ─────────────────────────────────────────────────

const SUPABASE_URL = process.env['SUPABASE_URL'] ?? ''
const SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? ''

function getVerifyClient() {
  return createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// IDs créés pendant les tests → cleanup
const createdIds: string[] = []

afterEach(async () => {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return
  if (createdIds.length === 0) return
  const client = getVerifyClient()
  await client.from('job_runs').delete().in('id', createdIds)
  createdIds.length = 0
})

// ─── helpers ────────────────────────────────────────────────────────────────

async function getLastRun(jobName: string) {
  const client = getVerifyClient()
  const { data, error } = await client
    .from('job_runs')
    .select('*')
    .eq('job_name', jobName)
    .order('started_at', { ascending: false })
    .limit(1)
    .single()
  if (error) throw new Error(`getLastRun: ${error.message}`)
  if (data) createdIds.push(data.id)
  return data
}

// ─── tests ──────────────────────────────────────────────────────────────────

describe('runJob — intégration job_runs (JOB-04)', () => {
  beforeAll(() => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      throw new Error(
        '[runJob.test] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquantes dans apps/jobs/.env',
      )
    }
  })

  it('écrit job_runs status=success avec stats quand fn réussit', async () => {
    const testJobName = `test-success-${Date.now()}`
    const expectedStats = { ok: true, count: 42 }

    await runJob(testJobName, async () => expectedStats)

    const row = await getLastRun(testJobName)
    expect(row).not.toBeNull()
    expect(row.status).toBe('success')
    expect(row.finished_at).not.toBeNull()
    expect(row.error).toBeNull()
    expect(row.stats).toEqual(expectedStats)
    expect(row.job_name).toBe(testJobName)
  })

  it('écrit job_runs status=error avec message quand fn lève, et re-throw', async () => {
    const testJobName = `test-error-${Date.now()}`
    const errorMessage = 'test error intentionnel'

    await expect(
      runJob(testJobName, async () => {
        throw new Error(errorMessage)
      }),
    ).rejects.toThrow(errorMessage)

    const row = await getLastRun(testJobName)
    expect(row).not.toBeNull()
    expect(row.status).toBe('error')
    expect(row.finished_at).not.toBeNull()
    expect(row.error).toBe(errorMessage)
    expect(row.stats).toBeNull()
    expect(row.job_name).toBe(testJobName)
  })
})
