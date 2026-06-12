---
phase: 01-fondations-s-curit
plan: 03
subsystem: jobs
tags: [jobs, runner, job_runs, monitoring, task-scheduler, routines-claude]
dependency_graph:
  requires: ["01-01", "01-02"]
  provides: [JOB-03, JOB-04]
  affects: [packages/supabase, apps/jobs]
tech_stack:
  added: [dotenv, pino, luxon]
  patterns: [lazy-client, runner-agnostique, vitest-server-only-mock]
key_files:
  created:
    - apps/jobs/src/runJob.ts
    - apps/jobs/src/dispatch.ts
    - apps/jobs/src/jobs/heartbeat.ts
    - apps/jobs/tsconfig.json
    - apps/jobs/windows/run-job.cmd
    - apps/jobs/__tests__/runJob.test.ts
    - docs/routines-claude.md
    - __mocks__/server-only.ts
  modified:
    - apps/jobs/package.json
    - vitest.config.ts
decisions:
  - "D-08 implémenté : dispatcher tsx ESM unique appelable par Routine Claude, Windows Task Scheduler (.cmd), ou croner"
  - "Client service_role lazy (créé à l'exécution, pas à l'import) pour compatibilité Vitest/dotenv"
  - "server-only mocké dans __mocks__/ + vitest.config.ts alias — guard Next.js préservé en dehors des tests"
  - "Aucune Routine Claude planifiée en Phase 1 — Phase 4 configurera Environments + network access"
metrics:
  duration: "~20 min"
  completed: "2026-06-12"
  tasks_completed: 2
  files_created: 10
---

# Phase 01 Plan 03: Runner Jobs + Monitoring Summary

**One-liner :** Dispatcher tsx ESM agnostique + wrapper .cmd Windows Task Scheduler + runJob écrivant job_runs via service_role (JOB-03/JOB-04) + doc Routines Claude vérifiée.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | runner jobs + test intégration (JOB-04) | aa7115d | runJob.ts, dispatch.ts, heartbeat.ts, tsconfig.json, package.json, vitest.config.ts, __mocks__/server-only.ts |
| 2 | wrapper .cmd Task Scheduler + doc Routines Claude (JOB-03) | aeded1f | run-job.cmd, docs/routines-claude.md |

## Verification Results

- `pnpm vitest run apps/jobs` : **2/2 tests GREEN** — `job_runs` écrit avec `status='success'` (stats incluses) et `status='error'` (message d'erreur + re-throw), vérifié en DB cloud.
- `pnpm --filter jobs exec tsx src/dispatch.ts heartbeat` : exit 0, ligne `job_runs` success écrite.
- `dispatch.ts` avec job inconnu : exit 1 (ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL confirme le code 1).
- `apps/jobs/.env` non commité (gitignore plan 01 actif).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Client service_role lazy pour compatibilité Vitest/dotenv**
- **Trouvé lors :** Task 1 — tests failing
- **Problème :** `service-client.ts` crée le client Supabase au niveau module (import-time). À l'import dans Vitest, `SUPABASE_URL` n'est pas encore chargé par dotenv → erreur `supabaseUrl is required`.
- **Fix :** `runJob.ts` crée son propre client lazy via `getServiceClient()` (appel `createClient` à l'exécution, pas à l'import). Ne change pas `packages/supabase/service-client.ts` (partagé).
- **Fichiers modifiés :** `apps/jobs/src/runJob.ts`
- **Commit :** aa7115d

**2. [Rule 3 - Blocking] Mock server-only pour Vitest Node**
- **Trouvé lors :** Task 1 — erreur `This module cannot be imported from a Client Component`
- **Problème :** `server-only` lève une erreur intentionnelle à l'import. Vitest tourne dans Node — l'erreur bloque même sans Next.js.
- **Fix :** `__mocks__/server-only.ts` (export {} no-op) + alias dans `vitest.config.ts`. La guard Next.js reste intacte (Next ne consulte pas `__mocks__/`).
- **Fichiers modifiés :** `vitest.config.ts`, `__mocks__/server-only.ts` (créé)
- **Commit :** aa7115d

**3. [Rule 3 - Blocking] dotenv explicite vers apps/jobs/.env**
- **Trouvé lors :** Task 1 — `SUPABASE_URL manquantes` malgré `import 'dotenv/config'`
- **Problème :** `dotenv/config` charge `.env` depuis le CWD = racine monorepo. Le `.env` de `apps/jobs` n'est pas trouvé.
- **Fix :** Test charge dotenv avec path explicite `path.resolve(__dirname, '../.env')`.
- **Fichiers modifiés :** `apps/jobs/__tests__/runJob.test.ts`
- **Commit :** aa7115d

**4. [Rule 2 - Missing] @supabase/supabase-js comme devDep jobs**
- **Trouvé lors :** Task 1 — `Cannot find package '@supabase/supabase-js'`
- **Problème :** Le test (client de vérification) et `runJob.ts` (client lazy) importent `@supabase/supabase-js` directement. Il n'était pas déclaré dans `apps/jobs`.
- **Fix :** Ajout en devDependencies (2.108.0) dans `apps/jobs/package.json`.
- **Commit :** aa7115d

## Key Decisions Made

1. **Client lazy dans runJob.ts** — Plutôt que modifier `packages/supabase/service-client.ts` (architectural), `runJob.ts` instancie son propre client service_role lazily. Cela garde le pattern de sécurité (server-only dans le package partagé) sans complexifier l'architecture.

2. **Pas d'import de service-client.ts depuis les jobs** — La dépendance sur `import 'server-only'` rendrait les tests jobs fragiles. Le client lazy dans `runJob.ts` est plus idiomatique pour des jobs Node ESM.

3. **Phase 1 = zéro Routine planifiée** — Documenté explicitement dans `docs/routines-claude.md`. L'ingestion déterministe (phases 2-3) tournera via Windows Task Scheduler. Les Routines Remote = Phase 4 (analyse IA uniquement).

## Known Stubs

Aucun stub. Le dispatcher et le job `heartbeat` sont fonctionnels et écrivent réellement `job_runs` en DB cloud.

## Threat Flags

Aucun nouveau vecteur d'attaque introduit. T-07/T-08/T-09/T-10 du plan mitigés :
- T-07 : `.env` non commité, client lazy ne hardcode aucune clé.
- T-08 : `runJob.ts` utilise SDK supabase-js (pas MCP), documenté dans `routines-claude.md`.
- T-10 : `runJob` écrit systématiquement `job_runs` (prouvé par 2 tests intégration).

## Self-Check: PASSED

- [x] `apps/jobs/src/runJob.ts` existe
- [x] `apps/jobs/src/dispatch.ts` existe
- [x] `apps/jobs/src/jobs/heartbeat.ts` existe
- [x] `apps/jobs/windows/run-job.cmd` existe
- [x] `docs/routines-claude.md` existe
- [x] `apps/jobs/__tests__/runJob.test.ts` existe
- [x] Commit aa7115d (Task 1 GREEN) vérifié dans git log
- [x] Commit aeded1f (Task 2) vérifié dans git log
