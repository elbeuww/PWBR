@echo off
:: run-job.cmd — Wrapper Windows Task Scheduler pour le dispatcher de jobs (JOB-03)
::
:: Usage : run-job.cmd <nom-du-job>
::   ex : run-job.cmd heartbeat
::
:: Ce script est le déclencheur Windows Task Scheduler.
:: Il invoque le MÊME dispatcher tsx que les Routines Claude — pas de duplication.
:: Les secrets sont lus depuis apps/jobs/.env via dotenv/config dans dispatch.ts.
::
:: Pré-requis :
::   - pnpm installé et dans le PATH
::   - apps/jobs/.env rempli (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
::   - Node.js >= 20 dans le PATH
::
:: D-08 : runner agnostique — même entrypoint tx pour Routine Claude, croner, Task Scheduler.

:: Se placer à la racine du dépôt (ce fichier est dans apps/jobs/windows/)
cd /d "%~dp0\..\..\..\"

:: Exécuter le dispatcher avec le nom de job passé en argument
call pnpm --filter jobs exec tsx src/dispatch.ts %1
