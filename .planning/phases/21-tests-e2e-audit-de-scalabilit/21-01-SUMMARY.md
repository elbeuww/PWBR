---
phase: 21-tests-e2e-audit-de-scalabilit
plan: 01
subsystem: testing
tags: [playwright, e2e, supabase, service_role, storageState, fixtures, ci]

# Dependency graph
requires:
  - phase: 18-seed-de-donnees-realistes
    provides: "Pattern seed.ts (boot dotenv, fail-fast secrets, client service_role stateless, purge idempotente)"
  - phase: 20-dashboard-superadmin-cockpit
    provides: "admin-rls.test.ts (provisioning service_role + promotion role='superadmin')"
provides:
  - "Comptes fixtures E2E déterministes (free/abonne/affilie/superadmin) domaine .invalid"
  - "Script seed-fixtures idempotent (pnpm --filter jobs seed:fixtures)"
  - "Setup-project Playwright : login par rôle → playwright/.auth/<role>.json"
  - "playwright.config.ts multi-projets par rôle (storageState + dependencies + webServer CI)"
affects: [21-02, 21-03, 21-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Playwright setup-project + storageState par rôle (auth une fois, réutilisée par dependencies)"
    - "Provisioning service_role idempotent borné au préfixe e2e-fixture- (jamais demo/live)"

key-files:
  created:
    - apps/web/e2e/fixtures/roles.ts
    - apps/jobs/scripts/seed-fixtures.ts
    - apps/web/e2e/auth.setup.ts
  modified:
    - playwright.config.ts
    - .gitignore
    - apps/jobs/package.json

key-decisions:
  - "Constantes fixtures redéfinies localement dans seed-fixtures.ts (copie EXACTE de roles.ts) pour éviter un import cross-app qui casserait le rootDir du tsconfig jobs (option autorisée par le plan)"
  - "Subscription abonne étiquetée source='demo' (compte de test, jamais 'live')"

patterns-established:
  - "Setup-project Playwright : boucle sur les rôles authentifiés → storageState gitignoré"
  - "Purge fixtures par préfixe email (cascade auth→profiles→subscriptions), jamais par source"

requirements-completed: [E2E-01, E2E-02]

# Metrics
duration: ~15min
completed: 2026-06-27
---

# Phase 21 Plan 01: Infrastructure E2E multi-rôles Summary

**Infra Playwright par rôle : fixtures déterministes idempotentes (service_role), setup-project générant un storageState par rôle, et playwright.config refondu en projets setup/smoke/anon/free/abonne/affilie/superadmin avec webServer CI.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-06-27
- **Tasks:** 2
- **Files modified:** 6 (3 créés, 3 modifiés)

## Accomplishments
- `roles.ts` : source de vérité des 4 fixtures authentifiées (domaine `.invalid`, préfixe `e2e-fixture-`, 0 occurrence `@gmail.com`).
- `seed-fixtures.ts` : provisioning service_role idempotent (purge préfixe → recreate), superadmin promu `role='superadmin'`, abonne doté d'une subscription active déterministe ; script `pnpm seed:fixtures`.
- `auth.setup.ts` : projet setup qui authentifie chaque rôle (sélecteurs login verbatim de `auth.spec.ts`) et persiste `playwright/.auth/<role>.json` — `playwright test --list --project=setup` énumère exactement 4 tests.
- `playwright.config.ts` : 7 projets (setup/smoke/anon/free/abonne/affilie/superadmin), storageState + `dependencies:['setup']` par rôle, `retries` CI, `webServer` build+start non commenté ; `smoke` préserve 42 specs existantes (D-02).
- `.gitignore` : `playwright/.auth/` ignoré (T-21-02, vérifié via `git check-ignore`).

## Task Commits

1. **Task 1: Fixtures déterministes + seed-fixtures idempotent** - `92a180a` (feat)
2. **Task 2: Refonte playwright.config + auth.setup + gitignore** - `3715fb9` (feat)

**Plan metadata:** docs commit (this summary + STATE/ROADMAP/REQUIREMENTS)

## Files Created/Modified
- `apps/web/e2e/fixtures/roles.ts` - Constantes FIXTURES (4 rôles) + FIXTURE_PASSWORD, source de vérité.
- `apps/jobs/scripts/seed-fixtures.ts` - Provisioning service_role idempotent + promotion superadmin + subscription active abonne.
- `apps/web/e2e/auth.setup.ts` - Setup-project : login par rôle → storageState.
- `playwright.config.ts` - Projets par rôle + dependencies + webServer + retries CI.
- `.gitignore` - Ajout `playwright/.auth/`.
- `apps/jobs/package.json` - Script `seed:fixtures`.

## Decisions Made
- **Constantes fixtures dupliquées (pas d'import cross-app)** : `seed-fixtures.ts` redéfinit `FIXTURES`/`FIXTURE_PASSWORD`/préfixe en copie identique de `roles.ts`. L'import `apps/web → apps/jobs` casserait le rootDir du tsconfig jobs. Option explicitement autorisée par le plan ; valeurs identiques, commentaire de traçabilité.
- **Subscription abonne `source='demo'`** : étiquette de provenance honnête pour un compte de test (jamais `'live'`).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **Vérification live-DB et Playwright setup non exécutées en session (deferred runtime verification).** Les deux commandes de vérification automatisée du plan écrivent sur le backend Supabase cloud PARTAGÉ et/ou exigent un serveur web buildé :
  1. `pnpm tsx scripts/seed-fixtures.ts` (×2 idempotence) — bloqué par l'auto-mode (modification de ressource partagée : delete/insert auth.users + subscriptions via service_role).
  2. `pnpm exec playwright test --project=setup` — exige `webServer` build+start + écrit les storageState après login réel contre le cloud.
  - **Vérifications read-only PASSÉES en session :** `pnpm typecheck` exit 0 ; `playwright test --list --project=setup` = 4 tests ; `--list --project=smoke` = 42 tests (D-02 préservé) ; `git check-ignore playwright/.auth/free.json` OK.
  - **Action requise (hors auto-mode, ou en CI 21-04) :** exécuter `pnpm --filter jobs seed:fixtures` deux fois de suite (prouver l'idempotence + provisionner les 4 comptes), puis `pnpm exec playwright test --project=setup` pour générer les 4 storageState et confirmer le login réel. Conforme au design : E2E_FIXTURE_PW + secrets passent en GitHub Secrets et le job CI tourne en 21-04.

## User Setup Required

Provisioning des 4 comptes fixtures sur le cloud Supabase partagé via `SUPABASE_SERVICE_ROLE_KEY` (déjà dans `apps/jobs/.env`). Optionnel : `E2E_FIXTURE_PW` (défaut `TestPassword123!`). À exécuter hors auto-mode : `pnpm --filter jobs seed:fixtures`.

## Next Phase Readiness
- Fondation E2E par rôle posée : 21-02 (dash/*) et 21-03 (admin/*) peuvent consommer `storageState` sans re-signUp.
- Préalable runtime avant les vagues 2-3 : lancer `seed:fixtures` + `playwright test --project=setup` une fois (génère les `.auth/*.json` requis par les projets dépendants).

## Self-Check: PASSED
- Fichiers vérifiés présents : roles.ts, seed-fixtures.ts, auth.setup.ts, playwright.config.ts.
- Commits vérifiés présents : 92a180a, 3715fb9.

---
*Phase: 21-tests-e2e-audit-de-scalabilit*
*Completed: 2026-06-27*
