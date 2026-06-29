---
phase: 18-seed-de-donn-es-r-alistes-l-chelle
plan: 01
subsystem: database
tags: [supabase, postgres, rls, migration, vitest, faker, seed, types]

# Dependency graph
requires:
  - phase: 17-fondation-db-scalable
    provides: "RLS wrappée (select …) + index policy + helpers has_active_subscription()/is_superadmin() — re-testés à l'échelle sur le seed"
provides:
  - "Colonne `source` (∈ live/demo/backtest, default 'live') LIVE sur les 8 tables seedées (profiles, subscriptions, payments, analyses, trade_setups, prediction_outcomes, affiliates, commissions)"
  - "3 index partiels CONCURRENTLY `WHERE source='demo'` (analyses, trade_setups, payments) pour la purge D-06"
  - "database.types.ts régénéré (source dans Row/Insert/Update des 8 tables, overrides *_atomic string + alias maison préservés)"
  - "config seed isolée (SEED_VERSION, FAKER_SEED, ratios D-03, PRICE_ATOMIC bigint, DEMO_VOLUMES, demo.nexa.invalid)"
  - "2 tests Wave 0 : no-perf-seed-claims (SEED-02 scan statique) + seed-rls (SEED-03 preuve RLS anon)"
  - "@faker-js/faker en devDep racine"
affects: [18-02-seed-core, 18-03-signaux-affiliation, 19-dashboard-utilisateur, 20-dashboard-superadmin, 21-audit-scalabilite]

# Tech tracking
tech-stack:
  added: ["@faker-js/faker 10.5.0 (devDep)"]
  patterns:
    - "Colonne `source` = LABEL de provenance, JAMAIS un gate de lecture (aucune policy using(source=…))"
    - "Scan statique no-perf-* : detectForbidden + whitelist + test de contrôle anti vacuous-green, lecture via node:fs (zéro DB)"
    - "Preuve RLS calquée affiliate-rls : skipIf(!HAS_ENV), lecture assertée TOUJOURS via client anon, seeding via service_role"

key-files:
  created:
    - "supabase/migrations/0018_seed_source_column.sql"
    - "apps/jobs/scripts/seed/config.ts"
    - "apps/web/test/no-perf-seed-claims.test.ts"
    - "packages/supabase/src/repositories/__tests__/seed-rls.test.ts"
  modified:
    - "packages/supabase/src/database.types.ts"
    - "package.json"
    - "pnpm-lock.yaml"

key-decisions:
  - "D-01 : colonne source bornée par CHECK(source in ('live','demo','backtest')) default 'live' (future-proof : lignes existantes = live)"
  - "Périmètre minimal 8 tables — tables volume (candles/snapshots/job_runs) et tables filles cascadées (affiliate_codes/referrals/payouts) NON colonnées en P18"
  - "T-18-01 : source n'est jamais un gate RLS — get_advisors(security) confirme 0 nouvelle alerte"
  - "T-18-02 : seed-rls lit via clientA anon uniquement ; service_role réservé au seeding des fixtures (jamais en assertion)"
  - "FORBIDDEN_SEED_FIELDS = /win_?rate|success_?rate|winRatePct|expectancy|hardcoded.*%/i ; whitelist realized_r/outcome/amount_atomic/rate_bps"

patterns-established:
  - "Migration appliquée LIVE via MCP apply_migration (Partie A transactionnelle) + execute_sql per-statement (Partie B CONCURRENTLY), jamais supabase db push"
  - "database.types.ts régénéré puis ré-édité À LA MAIN (override *_atomic string + alias maison)"

requirements-completed: [SEED-02, SEED-03]

# Metrics
duration: ~35min (3 tasks sur 2 sessions)
completed: 2026-06-25
---

# Phase 18 Plan 01: Fondation + Wave 0 (colonne source + tests RLS/no-perf) Summary

**Colonne `source` LIVE sur 8 tables (label de provenance borné, jamais un gate RLS), types régénérés, et les 2 tests Wave 0 (scan statique anti-chiffre-de-perf SEED-02 + preuve RLS anon SEED-03) qui gatent le seed avant sa première ligne.**

## Performance

- **Duration:** ~35 min (réparti : Task 1+2 session précédente, Task 3 cette session)
- **Completed:** 2026-06-25
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- Migration `0018` : colonne `source text not null default 'live' check (source in ('live','demo','backtest'))` sur les 8 tables seedées, appliquée LIVE via MCP `apply_migration`, AUCUNE policy l'utilisant (T-18-01).
- 3 index partiels CONCURRENTLY `WHERE source='demo'` créés LIVE (`indisvalid=true`) pour accélérer la purge D-06.
- `database.types.ts` régénéré (MCP `generate_typescript_types`) puis ré-édité à la main : `source` dans Row/Insert/Update des 8 tables, overrides `*_atomic` string et alias maison préservés ; `get_advisors(security)` confirme 0 nouvelle fuite RLS.
- `config.ts` seed isolé (données pures, zéro écriture DB) : SEED_VERSION, FAKER_SEED=42, ratios D-03, PRICE_ATOMIC bigint, DEMO_VOLUMES ~10k, domaine `demo.nexa.invalid` (RFC 2606).
- 2 tests Wave 0 : `no-perf-seed-claims` (4 passed, incluant le contrôle anti vacuous-green qui prouve qu'un `win_rate: 0.9` planté EST détecté) ; `seed-rls` (2 skipped propre sans `.env.test`, assertions anon-only complètes).

## Task Commits

1. **Task 1: faker devDep + migration 0018 + config seed** - `493acee` (feat)
2. **Task 2: [BLOCKING] apply 0018 LIVE via MCP + régen types + advisors** - `949111a` (feat) — checkpoint human-action complété par l'orchestrateur via MCP LIVE
3. **Task 3: tests Wave 0 — scan no-perf-seed-claims + preuve RLS anon** - `71533cf` (feat)

## Files Created/Modified
- `supabase/migrations/0018_seed_source_column.sql` - colonne source + CHECK borné sur 8 tables, Partie B index CONCURRENTLY commentés
- `apps/jobs/scripts/seed/config.ts` - config seed pure (volumes, ratios, PRICE_ATOMIC bigint, demoEmail)
- `apps/web/test/no-perf-seed-claims.test.ts` - scan statique SEED-02 (node:fs sur apps/jobs/scripts/seed/**, regex FORBIDDEN + whitelist + test de contrôle)
- `packages/supabase/src/repositories/__tests__/seed-rls.test.ts` - preuve RLS anon SEED-03 (non-abonné lit 0 trade_setups ; A ne lit aucun payment de B)
- `packages/supabase/src/database.types.ts` - source ajouté aux 8 tables, overrides string préservés
- `package.json` / `pnpm-lock.yaml` - @faker-js/faker en devDependencies

## Decisions Made
- **source = LABEL, jamais gate** (T-18-01) : aucune policy `using(source=…)`, vérifié par `get_advisors(security)` post-apply (0 nouvelle alerte ; les 2 WARN security-definer pré-existants restent EXPECTED BY DESIGN).
- **Périmètre minimal 8 tables** : volume (candles/snapshots/job_runs) et tables filles cascadées non colonnées en P18 — réduit la surface de 0018.
- **Lecture RLS anon uniquement** (T-18-02) : `seed-rls.test.ts` lit via `clientA` anon ; service_role réservé au seeding du payment de B. Lire via service_role serait un faux vert (bypass RLS).
- **Test de contrôle non-trivial** dans no-perf-seed-claims : un `win_rate: 0.9` planté DOIT être attrapé par le détecteur — interdit le vacuous-green.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. Le seed/ ne contenant que `config.ts` (aucun champ de perf), le scan no-perf-seed-claims renvoie 0 offender (vert toléré, garde armée pour les Waves ≥ 1).

## User Setup Required
None - aucune configuration de service externe requise. Les tests RLS live (`seed-rls`) nécessitent un `.env.test` (NEXT_PUBLIC_SUPABASE_URL + ANON_KEY + SUPABASE_SERVICE_ROLE_KEY) pour s'exécuter ; sans lui ils SKIP proprement.

## Next Phase Readiness
- Fondation gatée en place : `source` LIVE + types à jour + 2 tests Wave 0 armés → Plan 18-02 (seed core : orchestrateur + purge idempotente `WHERE source='demo'` + users/subscriptions/payments) peut démarrer.
- Le scan no-perf-seed-claims se déclenchera dès qu'un fichier de seed (18-02/18-03) insérerait un champ de % de perf.
- La preuve RLS anon devient exécutable GREEN dès qu'un `.env.test` est présent.

---
*Phase: 18-seed-de-donn-es-r-alistes-l-chelle*
*Completed: 2026-06-25*

## Self-Check: PASSED
- FOUND: supabase/migrations/0018_seed_source_column.sql
- FOUND: apps/jobs/scripts/seed/config.ts
- FOUND: apps/web/test/no-perf-seed-claims.test.ts
- FOUND: packages/supabase/src/repositories/__tests__/seed-rls.test.ts
- FOUND commit 493acee (Task 1), 949111a (Task 2), 71533cf (Task 3)
