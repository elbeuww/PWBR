---
phase: 01-fondations-s-curit
verified: 2026-06-12T00:00:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
---

# Phase 01 : Fondations & Sécurité — Rapport de Vérification

**Objectif de phase :** Le socle technique est posé — un utilisateur peut s'authentifier, toutes les tables sont protégées par RLS, le service_role est isolé des jobs, et les conventions temporelles + le modèle d'exécution des Routines Claude sont verrouillés avant tout code d'analyse.
**Vérifié :** 2026-06-12
**Statut :** passed
**Re-vérification :** Non — vérification initiale

---

## Succès Criteria (Roadmap)

| # | Critère (ROADMAP.md) | Statut | Preuve |
|---|----------------------|--------|--------|
| SC1 | Un utilisateur peut créer un compte, se connecter via Supabase Auth, et sa session persiste entre rechargements. | VÉRIFIÉ | `apps/web/e2e/auth.spec.ts` — 5 scénarios : signup→dashboard, reload→session, visiteur→redirect /login, login credentials, seed instruments. Preuve orchestrateur : 5/5 E2E verts. `getUser()` utilisé exclusivement (0 occurrence `getSession` côté serveur). |
| SC2 | Toutes les tables ont RLS active ; données de marché en lecture pour les authentifiés ; clé service_role jamais dans le bundle frontend (lint anti-import). | VÉRIFIÉ | Migration `0001` : 3x `enable row level security`, policies correctes, `set search_path = ''` dans trigger. Migration `0002` : revoke execute sur trigger functions (patch sécurité). `service-client.ts` ligne 4 : `import 'server-only'`. Fixture `__lint_fixtures__/forbidden-service-import.ts` déclenche ESLint `no-restricted-imports` — `pnpm lint` exit ≠ 0 confirmé. Aucun `SERVICE_ROLE` dans `apps/web/`. Preuve orchestrateur : 6/6 tests RLS verts + `get_advisors` 0 lints sécurité. |
| SC3 | Convention de bougie clôturée (exclut la bougie en cours), UTC et convention daily cross-asset (OANDA 17:00 NY vs Binance 00:00 UTC) documentées et codées comme constantes partagées dans `core`. | VÉRIFIÉ | `packages/core/src/time/candle.ts` : `lastClosedCandleStart` — algorithme `floor(epoch/tf) - 1`, invariant `résultat < now`. `packages/core/src/time/sessions.ts` : `DAILY_ANCHOR.oanda = { zone: 'America/New_York', hour: 17 }`, `DAILY_ANCHOR.binance = { zone: 'UTC', hour: 0 }`. `constants.ts` : `TIMEFRAMES` H1/H4/D. Barrel `index.ts` re-exporte tout. 16/16 golden values verts (preuve orchestrateur). |
| SC4 | Modèle d'exécution réel des Routines Claude vérifié et documenté (cloud, quota ~15 runs/j Max, secrets via env Environments, MCP cloud-hosted) ; fallback Windows Task Scheduler posé ; chaque exécution écrit `job_runs`. | VÉRIFIÉ | `docs/routines-claude.md` : section 1 (Remote vs Local), section 2 (quota ~15/j Max, partagé), section 3 (Environments, secrets chiffrés), section 4 (MCP cloud-hosted, SDK supabase-js obligatoire), section 5 (fallback .cmd). `apps/jobs/src/runJob.ts` : pattern `startRun → fn → finishRun(success/error)`, re-throw sur erreur. `apps/jobs/windows/run-job.cmd` : `call pnpm --filter jobs exec tsx src/dispatch.ts %1`. Preuve orchestrateur : 2/2 tests intégration job_runs verts + `run-job.cmd heartbeat` exit 0 + ligne DB cloud vérifiée. |

**Score :** 4/4 critères vérifiés

---

## Artefacts Requis

| Artefact | Attendu | Statut | Détails |
|----------|---------|--------|---------|
| `pnpm-workspace.yaml` | Déclaration workspaces `apps/*` + `packages/*` | VÉRIFIÉ | Contient les deux patterns, 40 octets |
| `packages/core/src/time/candle.ts` | `lastClosedCandleStart` anti look-ahead | VÉRIFIÉ | Exporte la fonction, algorithme correct |
| `packages/core/src/time/sessions.ts` | `DAILY_ANCHOR` OANDA/Binance | VÉRIFIÉ | `oanda.hour=17`, `binance.zone='UTC'` |
| `packages/core/src/time/candle.test.ts` | Golden values DATA-05 | VÉRIFIÉ | 7 assertions, fixture fixe 2026-06-09T10:30Z |
| `packages/core/src/index.ts` | Barrel re-export de `time/*` | VÉRIFIÉ | Re-exporte TIMEFRAMES, lastClosedCandleStart, DAILY_ANCHOR |
| `vitest.config.ts` | Config Vitest racine | VÉRIFIÉ | Inclut `packages/**/*.test.ts` + `apps/**/__tests__/**` |
| `playwright.config.ts` | Config Playwright racine | VÉRIFIÉ | testDir `apps/web/e2e`, projet chromium |
| `eslint.config.mjs` | Règle `no-restricted-imports` service_role | VÉRIFIÉ | Patterns `**/supabase/**/service-*` + `@app/supabase/service-client`, fichiers `apps/web/**` |
| `supabase/migrations/0001_init_profiles_instruments_job_runs.sql` | 3 tables + RLS + policies + trigger | VÉRIFIÉ | 3x `enable row level security`, `set search_path = ''`, trigger `on_auth_user_created`, seed 3 instruments |
| `packages/supabase/src/service-client.ts` | `import 'server-only'` première ligne de code | VÉRIFIÉ | Ligne 4 : `import 'server-only'` (après commentaire JSDoc) |
| `packages/supabase/src/anon-client.ts` | Factories anon browser + server | VÉRIFIÉ | `getAll`/`setAll` (pas `get`/`set`/`remove`) |
| `apps/web/middleware.ts` | `getUser()`, pas `getSession()` | VÉRIFIÉ | Délègue à `updateSession` qui appelle `supabase.auth.getUser()`. Grep `getSession` sur `apps/web/` retourne 0 ligne. |
| `apps/web/src/app/dashboard/page.tsx` | Page protégée lisant `instruments` | VÉRIFIÉ | `getUser()` → redirect `/login` si null, `listActiveInstruments(supabase)`, affichage tableau |
| `packages/supabase/__tests__/rls.test.ts` | Tests RLS cross-user (AUTH-02) | VÉRIFIÉ | 5 assertions : profil propre, isolation cross-user, lecture instruments, lecture job_runs, échec INSERT anon |
| `apps/web/e2e/auth.spec.ts` | E2E signup→login→session (AUTH-01) | VÉRIFIÉ | 5 tests couvrant tous les scénarios AUTH-01 |
| `apps/web/src/lib/supabase/__lint_fixtures__/forbidden-service-import.ts` | Fixture import service_role interdit (AUTH-03) | VÉRIFIÉ | Import `@app/supabase/service-client` — déclenche ESLint `no-restricted-imports` |
| `apps/jobs/src/runJob.ts` | Wrapper job_runs (JOB-04) | VÉRIFIÉ | Pattern running→success/error, client lazy, pino logs |
| `apps/jobs/src/dispatch.ts` | Entrypoint tsx agnostique | VÉRIFIÉ | `process.argv[2]`, registre JOB_REGISTRY, exit 0/1 |
| `apps/jobs/windows/run-job.cmd` | Wrapper Windows Task Scheduler (JOB-03) | VÉRIFIÉ | `call pnpm --filter jobs exec tsx src/dispatch.ts %1`, ASCII pur CRLF |
| `apps/jobs/__tests__/runJob.test.ts` | Test intégration runJob (success + error) | VÉRIFIÉ | 2 tests : status=success+stats, status=error+re-throw |
| `docs/routines-claude.md` | Doc modèle Routines Claude | VÉRIFIÉ | Sections cloud/quota/Environments/MCP/fallback présentes, note "aucune Routine en Phase 1" |

---

## Vérification des Liens Clés

| De | Vers | Via | Statut | Détails |
|----|------|-----|--------|---------|
| `auth.users INSERT` | `public.profiles` | trigger `on_auth_user_created SECURITY DEFINER` | VÉRIFIÉ | Migration ligne 99-101, `set search_path = ''` présent |
| `apps/web/middleware.ts` | `supabase.auth.getUser` | `updateSession` → `createServerClient` + `getUser()` | VÉRIFIÉ | `src/lib/supabase/middleware.ts` ligne 41 |
| `apps/web/src/app/dashboard/page.tsx` | table `instruments` | `listActiveInstruments(supabase)` via client anon | VÉRIFIÉ | Ligne 33, données rendues dans tableau JSX |
| `apps/jobs/src/runJob.ts` | table `job_runs` | `startRun` / `finishRun` via `serviceClient` | VÉRIFIÉ | Import `@app/supabase`, client lazy créé dans `getServiceClient()` |
| `apps/jobs/src/dispatch.ts` | `apps/jobs/src/runJob.ts` | `import { runJob }` + appel par nom argv | VÉRIFIÉ | Ligne 18-19 imports, ligne 47 `runJob(jobName, jobFn)` |
| `packages/core/src/index.ts` | `packages/core/src/time/*` | re-export barrel | VÉRIFIÉ | 5 exports couvrant constants, candle, sessions |

---

## Traçage de Flux de Données (Niveau 4)

| Artefact | Variable | Source | Données réelles | Statut |
|----------|----------|--------|-----------------|--------|
| `dashboard/page.tsx` | `instruments` | `listActiveInstruments(supabase)` → `instruments.select().eq('active', true)` | Requête Supabase DB → seed 3 lignes | FLOWING |
| `runJob.ts` | `runId` / stats | `startRun` INSERT → `finishRun` UPDATE job_runs | SDK supabase-js service_role → DB cloud | FLOWING |

---

## Spot-Checks Comportementaux

| Comportement | Preuve | Statut |
|-------------|--------|--------|
| `pnpm vitest run` 24/24 | Preuve orchestrateur post-wave gate 2026-06-12 | PASS |
| `pnpm playwright test` 5/5 | Preuve orchestrateur post-wave gate 2026-06-12 | PASS |
| `run-job.cmd heartbeat` exit 0 + ligne DB | Preuve orchestrateur post-wave gate + commit ed0283c | PASS |
| `pnpm lint` exit ≠ 0 sur fixture seule | Preuve VALIDATION.md + fixture confirmée sur disque | PASS |
| `get_advisors` 0 lints sécurité | Preuve orchestrateur (migration 0002 revoke execute) | PASS |

---

## Couverture des Exigences

| Exigence | Plan source | Description | Statut | Preuve |
|----------|-------------|-------------|--------|--------|
| AUTH-01 | 01-02 | Compte créé + login + session persiste | SATISFAIT | E2E 5/5 verts |
| AUTH-02 | 01-02 | RLS active 3 tables + isolation cross-user + lecture instruments authentifiée | SATISFAIT | Migration 0001, tests RLS 6/6 verts, get_advisors 0 lints |
| AUTH-03 | 01-02 | service_role isolé (server-only + ESLint), bundle web sans clé admin | SATISFAIT | import 'server-only' ligne 4, fixture lint, aucun SERVICE_ROLE dans apps/web |
| DATA-05 | 01-01 | Bougies normalisées UTC, convention bougie clôturée, daily par source | SATISFAIT | candle.ts + sessions.ts + 16/16 golden values |
| JOB-03 | 01-03 | Étapes déterministes exécutables hors agent Claude (Task Scheduler) | SATISFAIT | run-job.cmd + dispatch.ts + exit 0 vérifié |
| JOB-04 | 01-03 | Chaque exécution écrit job_runs (statut/timing/erreur) | SATISFAIT | runJob.ts + 2/2 tests intégration verts + ligne DB cloud |

---

## Anti-Patterns Détectés

| Fichier | Ligne | Motif | Sévérité | Impact |
|---------|-------|-------|----------|--------|
| — | — | Aucun TBD/FIXME/XXX non référencé | — | — |
| `packages/supabase/src/repositories/profiles.ts` | 18, 28 | `return null` | Info | Pattern légitime : PGRST116 = row not found, non un stub |

Aucun bloquant. Le `return null` de profiles.ts est un retour d'absence de données explicitement géré, pas un stub.

---

## Vérifications Humaines Requises

Aucune. Tous les critères de la phase sont vérifiables programmatiquement et prouvés par les suites de tests automatisées.

---

## Résumé

La Phase 01 atteint son objectif. Les quatre critères de succès de la roadmap sont prouvés par des tests automatisés verts (24/24 Vitest, 5/5 Playwright, 2/2 job_runs, lint exit ≠ 0) et des artefacts substantiels sur disque. Aucun stub, aucune dette non référencée, aucun lien clé cassé.

Exigences couvertes : AUTH-01, AUTH-02, AUTH-03, DATA-05, JOB-03, JOB-04 — toutes satisfaites.

---

_Vérifié : 2026-06-12_
_Vérificateur : Claude (gsd-verifier)_
