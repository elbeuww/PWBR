---
phase: 01-fondations-s-curit
plan: "01"
subsystem: infra
tags: [pnpm, monorepo, typescript, vitest, playwright, eslint, luxon, zod, supabase]

# Dependency graph
requires: []
provides:
  - Monorepo pnpm workspaces (apps/web, apps/jobs, packages/core, packages/supabase)
  - ESLint flat config avec règle no-restricted-imports anti-service_role (apps/web)
  - Contrat .env.example (4 variables vides, aucun secret commité)
  - packages/core : constantes temps UTC, lastClosedCandleStart (anti look-ahead), DAILY_ANCHOR par source
  - Vitest (golden values DATA-05) + Playwright configurés et exécutables
affects: [auth-rls, jobs-ingestion, core-indicators, supabase-client]

# Tech tracking
tech-stack:
  added:
    - pnpm@9 workspaces
    - typescript@5.7 strict
    - eslint@9 flat config + typescript-eslint
    - vitest@4.1.8
    - "@playwright/test@1.60.0"
    - luxon@3.7.2
    - zod@4.4.3
    - tsx@4.22.4
    - prettier
  patterns:
    - Barrel index.ts par package (@app/core)
    - Golden values tests pour toute logique déterministe temps
    - ESLint no-restricted-imports comme barrière lint-time avant création du module cible

key-files:
  created:
    - pnpm-workspace.yaml
    - tsconfig.base.json
    - eslint.config.mjs
    - .env.example
    - vitest.config.ts
    - playwright.config.ts
    - packages/core/src/time/constants.ts
    - packages/core/src/time/candle.ts
    - packages/core/src/time/sessions.ts
    - packages/core/src/time/candle.test.ts
    - packages/core/src/time/sessions.test.ts
    - packages/core/src/index.ts
  modified:
    - package.json (scripts typecheck/lint/test/test:e2e)
    - .gitignore (.env/.env.local exclus)

key-decisions:
  - "D-07 : règle ESLint no-restricted-imports posée avant création du module service_role (plan 02) — barrière lint-time préventive"
  - "D-09 : DAILY_ANCHOR.oanda = { zone: America/New_York, hour: 17 } / binance = { zone: UTC, hour: 0 } — convention daily cross-asset verrouillée"
  - "D-10 : lastClosedCandleStart via floor(epoch/tf)-1 — borne haute exclusive, anti look-ahead garanti"
  - "D-11 : strict skeleton 4 packages — apps/web, apps/jobs, packages/core, packages/supabase déclarés ; data-sources/indicators en phases ultérieures"
  - "D-12 : .env.example commité sans secret (4 clés vides), .gitignore exclut .env/.env.local"
  - "D-13 : Vitest + Playwright configurés racine ; golden values DATA-05 vertes"

patterns-established:
  - "Golden values TDD : écrire les assertions sur valeurs exactes d'abord (RED), puis implémenter (GREEN) pour tout calcul déterministe"
  - "Barrel exports : packages/core/src/index.ts re-exporte tout depuis time/* pour isolation des imports"
  - "ESLint préventif : règle posée avant la création du module interdit — évite la régression future"

requirements-completed: [DATA-05]

# Metrics
duration: ~90min
completed: "2026-06-10"
---

# Phase 1 Plan 01: Scaffold monorepo + constantes temps UTC Summary

**Monorepo pnpm 4-packages avec ESLint anti-service_role, contrat .env.example, et packages/core/time livrant lastClosedCandleStart (anti look-ahead) + DAILY_ANCHOR par source, testés par golden values Vitest (DATA-05)**

## Performance

- **Duration:** ~90 min
- **Started:** 2026-06-10T00:50:00Z
- **Completed:** 2026-06-10T02:05:00Z
- **Tasks:** 3 auto + 1 checkpoint:human-verify
- **Files modified:** 18

## Accomplishments

- Monorepo pnpm workspaces installable (apps/web, apps/jobs, packages/core, packages/supabase), typecheck strict + lint passent
- Constantes temps déterministes (lastClosedCandleStart anti look-ahead, DAILY_ANCHOR OANDA 17:00 NY / Binance 00:00 UTC) testées par 16 golden values — DATA-05 satisfait
- Infra test complète (Vitest racine + Playwright chromium installé) prête pour les plans 02 et 03

## Task Commits

1. **Task 1: Scaffold monorepo pnpm + ESLint + .env.example** - `de9e0fa` (chore)
2. **Task 2 RED: golden tests DATA-05** - `ea8c2f5` (test)
3. **Task 2 GREEN: packages/core constantes temps** - `4bf3b3d` (feat)
4. **Task 3: playwright.config.ts + tsconfig racine + chromium** - `e0106c2` (chore)

**Plan metadata:** (ce commit — docs)

_Note : Task 2 = TDD cycle RED/GREEN avec deux commits distincts._

## Files Created/Modified

- `pnpm-workspace.yaml` — déclaration workspaces apps/* + packages/*
- `tsconfig.base.json` — strict:true, moduleResolution Bundler, paths @app/core/@app/supabase
- `eslint.config.mjs` — flat config ESLint + no-restricted-imports anti-service_role ciblé apps/web
- `.env.example` — contrat 4 variables vides (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
- `.gitignore` — .env/.env.local exclus
- `vitest.config.ts` — environnement node, include packages/**/*.test.ts
- `playwright.config.ts` — testDir apps/web/e2e, baseURL localhost:3000, chromium
- `packages/core/src/time/constants.ts` — TIMEFRAMES (H1=60, H4=240, D=1440), UTC_ZONE
- `packages/core/src/time/candle.ts` — lastClosedCandleStart(now, tfMinutes): DateTime
- `packages/core/src/time/sessions.ts` — DAILY_ANCHOR + dailyAnchorStart(source, now)
- `packages/core/src/time/candle.test.ts` — golden values bougie clôturée H1/H4 (anti look-ahead)
- `packages/core/src/time/sessions.test.ts` — golden values DAILY_ANCHOR OANDA/Binance + dailyAnchorStart
- `packages/core/src/index.ts` — barrel re-export tout depuis time/*
- `packages/core/package.json` — @app/core, type:module, luxon + zod
- `packages/core/tsconfig.json` — extends tsconfig.base.json

## Decisions Made

- **D-07** : ESLint no-restricted-imports posée maintenant (Task 1), avant que le module service_role existe (plan 02). La règle interdit `**/supabase/**/service-*` et `@app/supabase/service-client` dans `apps/web/**`. Décision : posture défensive ; une règle lint orpheline coûte presque rien, une régression coûte cher.
- **D-09** : Convention daily cross-asset verrouillée — OANDA suit la session NY (clôture 17:00 NY, gère DST via luxon), Binance suit UTC (crypto 24/7, clôture 00:00 UTC). Implémenté via `DAILY_ANCHOR` + `dailyAnchorStart` dans sessions.ts.
- **D-10** : Anti look-ahead garanti par `floor(epoch/tfSec) - 1` : on recule d'un pas complet avant de prendre le floor, donc la bougie retournée est toujours clôturée au moment de l'appel.
- **D-11** : Strict skeleton 4 packages seulement. packages/data-sources et packages/indicators ne sont pas déclarés en P1 (viendront en phase 2/3).
- **D-12** : `.env.example` commité avec 4 clés vides ; commentaire inline indique anon → apps/web/.env.local, service_role → apps/jobs/.env (isolation).
- **D-13** : Vitest + Playwright configurés et exécutables dès P1. Les plans aval (02 : rls.test.ts, 03 : runJob.test.ts) déposent leurs tests sans recréer d'infra.

## Deviations from Plan

None — plan exécuté exactement tel qu'écrit. Le checkpoint human-verify (Task 4) a été approuvé par l'orchestrateur.

## Checkpoint Human-Verify (Task 4)

**Résultat :** APPROVED

- `server-only@0.0.1` vérifié légitime : publisher officiel Vercel/React sur npmjs.com, version 0.0.1 attendue (paquet minimaliste intentionnel)
- `.env.example` confirmé sans secret (4 valeurs vides) — vérifié dans le commit `de9e0fa`
- Note : `server-only` n'est pas encore installé dans le workspace en P1 (arrive au plan 02, apps/web) — vérifié par l'orchestrateur

## Issues Encountered

None.

## User Setup Required

None — aucune configuration de service externe requise pour ce plan. Les variables `.env` restent à remplir manuellement lors de la connexion Supabase (plan 02).

## Known Stubs

None — aucun stub de rendu UI dans ce plan (infrastructure pure).

## Threat Flags

Aucun nouveau périmètre de sécurité non prévu dans le threat_model. Les trois menaces planifiées (T-01-SC, T-01-01, T-01-02) sont toutes mitigées :
- T-01-SC : checkpoint humain approuvé
- T-01-01 : .env.example sans secret confirmé en commit
- T-01-02 : règle no-restricted-imports posée dans eslint.config.mjs

## Next Phase Readiness

**Plan 02 (Auth + RLS)** peut démarrer immédiatement :
- Workspace installable, typecheck strict, lint passent
- Règle anti-service_role déjà en place pour apps/web
- Infra Vitest prête pour les tests RLS (rls.test.ts)
- Playwright prêt pour les E2E auth (apps/web/e2e/)
- packages/supabase déclaré et vide — à remplir au plan 02

**Aucun bloquant.**

## Self-Check

Vérification des commits :
- de9e0fa : présent (scaffold)
- ea8c2f5 : présent (RED tests)
- 4bf3b3d : présent (GREEN core)
- e0106c2 : présent (playwright)

Vérification des fichiers clés :
- pnpm-workspace.yaml : présent
- packages/core/src/time/candle.ts : présent
- packages/core/src/time/sessions.ts : présent
- vitest.config.ts : présent
- playwright.config.ts : présent

Vérification gates : vitest 16/16, typecheck clean, lint clean, playwright --list OK (0 tests attendu)

## Self-Check: PASSED

---
*Phase: 01-fondations-s-curit*
*Completed: 2026-06-10*
