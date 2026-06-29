---
phase: 18-seed-de-donn-es-r-alistes-l-chelle
plan: 02
subsystem: seed
tags: [seed, faker, supabase, service-role, luxon, idempotence, mrr, churn, rls]

# Dependency graph
requires:
  - phase: 18-seed-de-donn-es-r-alistes-l-chelle
    plan: 01
    provides: "colonne source LIVE sur 8 tables + database.types.ts (source dans Insert/Update) + config.ts (SEED_VERSION, FAKER_SEED, PRICE_ATOMIC bigint, DEMO_RATIOS, DEMO_VOLUMES, demoEmail, demo.nexa.invalid)"
provides:
  - "Orchestrateur seed.ts (tsx, dotenv apps/jobs/.env, fail-fast secrets, ordre topologique purge → users → subscriptions → payments)"
  - "purge.ts idempotente : delete WHERE source='demo' sur 8 tables en ordre FK inverse + deleteUser par pattern demo.nexa.invalid, sûre à vide, JAMAIS truncate (D-06)"
  - "users.ts : auth.admin.createUser borné (pLimit maison 5) + faker multi-locale ar/fr/en seedé + UPDATE profiles role/source='demo'/created_at étalé"
  - "subscriptions.ts : status active/expired/canceled (D-03) + plan standard/discovery (D-04) + current_period_end étalé luxon (J-3/J-1 actifs, churn expirés)"
  - "payments.ts : verified, amount_atomic bigint string (PRICE_ATOMIC, jamais float), tx_hash déterministe unique, verified_at étalé ~12 mois UTC, renouvellements 1-N (MRR/LTV)"
  - "script npm 'seed' dans apps/jobs/package.json"
affects: [18-03-signaux-affiliation, 19-dashboard-utilisateur, 20-dashboard-superadmin, 21-audit-scalabilite]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Seul chemin légal vers profiles = auth.admin.createUser (trigger handle_new_user) ; JAMAIS d'INSERT direct dans auth.users/profiles"
    - "pLimit maison (file de promesses bornée) — p-limit absent du workspace, bornage sans nouvelle dépendance (anti Pitfall 4)"
    - "Étalement déterministe des dates via luxon ancré 2026-06-25 (created_at/current_period_end/verified_at jamais identiques — keyset + churn mesurables)"
    - "Insert batché par chunks de 1000 (PostgREST) ; throw sur erreur (frontière producteur service_role)"
    - "Montants USDT en bigint atomique ×10^6 sérialisés en string (override repo *_atomic) — zéro float (T-18-08)"
    - "Purge ciblée source='demo' en ordre FK inverse, JAMAIS truncate (T-18-05) ; deleteUser par pattern .invalid pour auth.users (sans colonne source)"

key-files:
  created:
    - "apps/jobs/scripts/seed.ts"
    - "apps/jobs/scripts/seed/purge.ts"
    - "apps/jobs/scripts/seed/users.ts"
    - "apps/jobs/scripts/seed/subscriptions.ts"
    - "apps/jobs/scripts/seed/payments.ts"
  modified:
    - "apps/jobs/package.json"

key-decisions:
  - "D-18-02-A : pLimit maison (file de promesses, concurrence 5) au lieu d'ajouter p-limit — borne createUser sans nouvelle dépendance, conforme à la discipline p-limit du projet (anti Pitfall 4 / T-18-09)"
  - "D-18-02-B : seedUsers retourne SeededUser[] (id, role, locale, index, createdAt) ; subscriptions/payments consomment cette sortie en chaîne déterministe par index"
  - "D-18-02-C : payments démo verified → expected_amount_atomic = amount_atomic (= PRICE_ATOMIC[plan]) ; tx_hash déterministe `demo-{userIndex}-{n}` satisfait la contrainte UNIQUE globale 0012 et reste idempotent au re-seed (purge d'abord)"
  - "D-18-02-D : statut subscription déterministe par index conforme D-03 (active 37% en premier, puis expired 18%, puis canceled 5%, reste = leads 40% sans subscription) ; seules active/expired exposées à payments"
  - "D-18-02-E : verified_at = cohortStart + n mois (renouvellements mensuels) borné à l'ancre 2026-06-25 ; volume croissant vers les mois récents (cohortStart biaisé √) → courbe MRR non plate"

requirements-completed: [SEED-01]

# Metrics
duration: ~15min
completed: 2026-06-25
---

# Phase 18 Plan 02: Seed core (orchestrateur + purge + users + subscriptions + payments) Summary

**Cœur idempotent du seed démo : orchestrateur tsx fail-fast (purge → users → subscriptions → payments en ordre topologique), purge ciblée `WHERE source='demo'` en ordre FK inverse (jamais truncate), création déterministe des users via `auth.admin.createUser` borné + faker multi-locale, et dimensions monétaires (subscriptions/payments) étalées sur ~12 mois pour rendre MRR & churn mesurables — sans fabriquer aucun chiffre de performance.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-06-25
- **Tasks:** 3
- **Files modified:** 6 (5 créés, 1 modifié)

## Accomplishments
- **Orchestrateur `seed.ts`** : boot dotenv depuis `apps/jobs/.env` (miroir freeze-nile-fixture), fail-fast `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (la clé n'est jamais loggée), client service_role stateless, `main()` enchaîne `purge() → seedUsers() → seedSubscriptions() → seedPayments()` ; étapes signaux/affiliation/market + `refresh_mv_mrr` laissées en commentaires explicites (Plan 18-03, non inventées).
- **`purge.ts` (D-06)** : `delete().eq('source','demo')` sur 8 tables en ordre FK inverse (commissions → affiliates → prediction_outcomes → trade_setups → analyses → payments → subscriptions → profiles), AUCUN truncate (anti T-18-05), puis `auth.admin.listUsers` paginé + `deleteUser` filtré sur le domaine `demo.nexa.invalid` (auth.users n'a pas de colonne source). Sûre à vide (no-op si 0 ligne démo).
- **`users.ts` (SEED-01)** : `auth.admin.createUser` (emails `seed-{i}@demo.nexa.invalid`, `user_metadata.seed:true`) borné par un pLimit maison (concurrence 5, anti Pitfall 4) ; faker multi-locale `ar/fr/en` + `base` fallback, chaque instance `seed(FAKER_SEED)` ; UPDATE profiles `role`/`source='demo'`/`created_at` étalé (luxon, jamais identique — anti Pitfall 1 keyset). Aucun champ de % de perf.
- **`subscriptions.ts` (D-03/D-04)** : status déterministe (active 37 % / expired 18 % / canceled 5 % / leads 40 % sans subscription), plan standard ~75 % / discovery ~25 %, `current_period_end` étalé luxon (actifs futur dont une fraction J-3/J-1 pour l'ExpiryBanner P19, expirés 1-6 mois passés = churn visible), insert batché chunks 1000.
- **`payments.ts` (D-04)** : `status='verified'`, `amount_atomic = PRICE_ATOMIC[plan].toString()` (bigint USDT ×10^6, jamais float — T-18-08), `tx_hash` déterministe unique, `verified_at` étalé sur ~12 mois UTC (luxon), renouvellements 1-N par abonné (MRR récurrent + LTV mesurable). Aucun MRR/% stocké — émerge de `mv_mrr`.

## Task Commits

1. **Task 1: Orchestrateur seed.ts + purge.ts (idempotence D-06)** - `b7a9c1a` (feat)
2. **Task 2: users.ts (createUser borné, faker multi-locale, déterminisme)** - `4bbd018` (feat, tdd)
3. **Task 3: subscriptions.ts + payments.ts (MRR/churn étalés, source='demo')** - `3cfe072` (feat)

## Files Created/Modified
- `apps/jobs/scripts/seed.ts` - orchestrateur tsx fail-fast, ordre topologique purge → users → subscriptions → payments
- `apps/jobs/scripts/seed/purge.ts` - purge idempotente source='demo' ordre FK inverse + deleteUser pattern .invalid
- `apps/jobs/scripts/seed/users.ts` - createUser borné (pLimit maison 5) + faker multi-locale seedé + UPDATE profiles role/source/created_at
- `apps/jobs/scripts/seed/subscriptions.ts` - status/plan/period étalés (D-03/D-04), insert batché
- `apps/jobs/scripts/seed/payments.ts` - verified amount_atomic bigint string, verified_at étalé, renouvellements
- `apps/jobs/package.json` - script `"seed": "tsx scripts/seed.ts"`

## Decisions Made
- **D-18-02-A (pLimit maison)** : file de promesses bornée (concurrence 5) plutôt qu'ajouter `p-limit` (absent du workspace) — borne `createUser` sans nouvelle dépendance, conforme à la discipline `p-limit` du projet (anti Pitfall 4 / T-18-09).
- **D-18-02-B (chaîne déterministe)** : `seedUsers` retourne `SeededUser[]` (id, role, locale, index, createdAt) ; `subscriptions`/`payments` consomment cette sortie, l'ordre par `index` garantit la reproductibilité.
- **D-18-02-C (payments verified)** : `expected_amount_atomic = amount_atomic = PRICE_ATOMIC[plan]` ; `tx_hash = demo-{userIndex}-{n}` satisfait la contrainte `UNIQUE(tx_hash)` globale (0012) et reste idempotent au re-seed (la purge passe en tête).
- **D-18-02-D (distribution D-03)** : statut subscription par index (active en premier, puis expired, puis canceled, reste = leads sans subscription) ; seules active/expired portent des paiements.
- **D-18-02-E (étalement MRR)** : `verified_at = cohortStart + n mois` borné à l'ancre 2026-06-25 ; `cohortStart` biaisé `√` vers le récent → courbe MRR croissante non plate, churn (expirés) mesurable.

## Deviations from Plan

None - plan executed exactly as written. La verify de Task 1 (`pnpm typecheck`) et des Tasks 2-3 (`pnpm test -- no-perf-seed-claims && pnpm typecheck`) sont toutes vertes. Conformément aux contraintes d'exécution, AUCUN seed live n'a été lancé (le seeding à l'échelle reste un UAT Manual-Only).

## Issues Encountered
- Les scripts du dossier `apps/jobs/scripts/` ne sont PAS inclus dans `apps/jobs/tsconfig.json` (`include: ["src/**", "__tests__/**"]`), donc `pnpm typecheck` (`tsc -b`) ne les couvre pas directement — comme `freeze-nile-fixture.ts` déjà présent. Pour garantir la type-correction, un tsconfig temporaire `include: ["scripts/seed/**"]` a été exécuté : **0 erreur** sur les 5 fichiers seed. La seule erreur tsc du dossier `scripts/` est PRÉ-EXISTANTE dans `freeze-nile-fixture.ts:103` (hors scope, loggée ci-dessous).

## Deferred Issues
- **Pré-existant, hors scope** : `apps/jobs/scripts/freeze-nile-fixture.ts:103` — TS2769 (overload `String.replace` avec `string | undefined`). Présent avant ce plan, non couvert par `tsc -b` (scripts exclus du tsconfig). À corriger hors de ce plan.
- **À venir Plan 18-03** : câblage des étapes signaux (analyses/trade_setups/prediction_outcomes), affiliation (affiliates/referrals/commissions/payouts), market (candles/snapshots/job_runs/telegram), et `refresh_mv_mrr()` post-seed (laissées en commentaires explicites dans `seed.ts`).

## User Setup Required
None pour le code. L'exécution réelle du seed à l'échelle (`pnpm --filter jobs seed`) exige un `apps/jobs/.env` rempli (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`) et reste un **UAT Manual-Only** (non lancé pendant cette exécution, conforme aux contraintes).

## Next Phase Readiness
- Seed core idempotent en place : `pnpm --filter jobs seed` est exécutable (purge + users + subscriptions + payments). Plan 18-03 peut câbler signaux/affiliation/market + `refresh_mv_mrr` aux emplacements commentés de `seed.ts`.
- Le scan `no-perf-seed-claims` reste vert sur les 5 fichiers seed (aucun champ de % de perf) ; il se redéclenchera si un module 18-03 insérait un champ de perf.
- La suite complète est verte (621 passed / 6 skipped) — aucune régression introduite.

---
*Phase: 18-seed-de-donn-es-r-alistes-l-chelle*
*Completed: 2026-06-25*

## Self-Check: PASSED
- FOUND: apps/jobs/scripts/seed.ts
- FOUND: apps/jobs/scripts/seed/purge.ts
- FOUND: apps/jobs/scripts/seed/users.ts
- FOUND: apps/jobs/scripts/seed/subscriptions.ts
- FOUND: apps/jobs/scripts/seed/payments.ts
- FOUND: apps/jobs/package.json (script "seed")
- FOUND commit b7a9c1a (Task 1), 4bbd018 (Task 2), 3cfe072 (Task 3)
