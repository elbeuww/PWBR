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
import { technicalEngine } from './jobs/technical-engine'
import { fundamentalEngine } from './jobs/fundamental-engine'
import { newsEngine } from './jobs/news-engine'
import { combineEngine } from './jobs/combine-engine'
import { persist } from './jobs/persist'
import { subscriptionExpiry } from './jobs/subscription-expiry'
import { outcomeTracker } from './jobs/outcome-tracker'
import { telegramPublish } from './jobs/telegram-publish'
import type { Json } from '@app/supabase'

const logger = pino({ level: 'info' })

// ─── Registre des jobs connus ────────────────────────────────────────────────

const JOB_REGISTRY: Record<string, () => Promise<Json | undefined>> = {
  heartbeat,
  'market-ingest': marketIngest,
  'news-ingest': newsIngest,
  'macro-ingest': macroIngest,
  'calendar-ingest': calendarIngest,
  'technical-engine': technicalEngine,
  'fundamental-engine': fundamentalEngine,
  'news-engine': newsEngine,
  // COMBINE-ENGINE — maillon TROU #2 : assemble les 3 derniers snapshots séparés
  // (technical+fundamental+news) par instrument×style en un snapshot kind='combined'
  // que persist consomme via raw_indicators_ref. À lancer APRÈS les 3 engines, AVANT persist.
  'combine-engine': combineEngine,
  // PERSIST — frontière de confiance unique (D-43). Appelé après l'ANALYZE avec
  // RUN_ID exporté : `RUN_ID=<session>-<YYYYMMDD>T<HHmm>Z tsx src/dispatch.ts persist`.
  persist,
  // PAY-05 — cycle de vie abonnement (expire échus) + sweep réservations d'offset expirées
  // (Plan 06). Windows Task Scheduler : run-job.cmd subscription-expiry.
  'subscription-expiry': subscriptionExpiry,
  // TRACK-01 — replay déterministe des setups expirés. Windows Task Scheduler : run-job.cmd outcome-tracker.
  'outcome-tracker': outcomeTracker,
  // TG-01/02/03 — publication Telegram horaire (APRÈS outcome-tracker). run-job.cmd telegram-publish.
  'telegram-publish': telegramPublish,
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
