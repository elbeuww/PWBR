@echo off
REM run-job.cmd - Wrapper Windows Task Scheduler pour le dispatcher de jobs (JOB-03)
REM
REM Usage : run-job.cmd <nom-du-job>
REM   ex : run-job.cmd heartbeat
REM
REM Ce script est le declencheur Windows Task Scheduler.
REM Il invoque le MEME dispatcher tsx que les Routines Claude - pas de duplication.
REM Les secrets sont lus depuis apps/jobs/.env via dotenv/config dans dispatch.ts.
REM
REM Pre-requis :
REM   - pnpm installe et dans le PATH
REM   - apps/jobs/.env rempli (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
REM   - Node.js >= 20 dans le PATH
REM
REM D-08 : runner agnostique - meme entrypoint tsx pour Routine Claude, croner, Task Scheduler.
REM ASCII pur + fins de ligne CRLF obligatoires : cmd.exe ne parse pas l'UTF-8
REM multi-octets ni les fichiers batch en LF seul.

REM Se placer a la racine du depot (ce fichier est dans apps\jobs\windows\)
cd /d "%~dp0..\..\.."

REM Executer le dispatcher avec le nom de job passe en argument
call pnpm --filter jobs exec tsx src/dispatch.ts %1
exit /b %ERRORLEVEL%
