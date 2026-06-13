/**
 * dispatch.ts — entrypoint tsx ESM agnostique du scheduler (D-08)
 *
 * Appelable par :
 *  - Routine Claude : `tsx src/dispatch.ts heartbeat`
 *  - Windows Task Scheduler : via apps/jobs/windows/run-job.cmd heartbeat
 *  - croner (daemon in-process) : appel direct tsx
 *
 * Exit codes :
 *  - 0 : job exécuté avec succès
 *  - 1 : job inconnu ou échec d'exécution
 *
 * Source : 01-RESEARCH.md §Code Examples §Dispatcher + §Pattern 6
 */

import 'dotenv/config'
import pino from 'pino'
import { runJob } from './runJob'
import { heartbeat } from './jobs/heartbeat'
import { marketIngest } from './jobs/market-ingest'
import { newsIngest } from './jobs/news-ingest'
import { macroIngest } from './jobs/macro-ingest'
import { calendarIngest } from './jobs/calendar-ingest'
import type { Json } from '@app/supabase'

const logger = pino({ level: 'info' })

// ─── Registre des jobs connus ────────────────────────────────────────────────

const JOB_REGISTRY: Record<string, () => Promise<Json | undefined>> = {
  heartbeat,
  'market-ingest': marketIngest,
  'news-ingest': newsIngest,
  'macro-ingest': macroIngest,
  'calendar-ingest': calendarIngest,
}

// ─── Dispatch ────────────────────────────────────────────────────────────────

const jobName = process.argv[2]

if (!jobName) {
  logger.error('Usage: tsx src/dispatch.ts <job-name>')
  logger.error(`Available jobs: ${Object.keys(JOB_REGISTRY).join(', ')}`)
  process.exit(1)
}

const jobFn = JOB_REGISTRY[jobName]

if (!jobFn) {
  logger.error({ jobName }, `Unknown job. Available: ${Object.keys(JOB_REGISTRY).join(', ')}`)
  process.exit(1)
}

runJob(jobName, jobFn)
  .then(() => {
    logger.info({ jobName }, 'dispatch success')
    process.exit(0)
  })
  .catch((err: unknown) => {
    const errorMessage = err instanceof Error ? err.message : String(err)
    logger.error({ jobName, err: errorMessage }, 'dispatch failed')
    process.exit(1)
  })
