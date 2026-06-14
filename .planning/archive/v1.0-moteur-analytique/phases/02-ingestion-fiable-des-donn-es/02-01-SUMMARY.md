---
phase: 02-ingestion-fiable-des-donn-es
plan: "01"
subsystem: database
tags: [supabase, postgres, rls, repositories, typescript, upsert, idempotency]

requires:
  - phase: 01-fondations-securite
    provides: packages/supabase setup, service_role, migrations 0001/0002, database.types.ts pattern

provides:
  - tables candles/news/macro_series/economic_calendar avec RLS (migration 0003 appliquée cloud)
  - extension instruments : canonical_symbol/source_symbol/price_decimals/quote_hours + seed 12 MVP
  - vue v_data_freshness (staleness 2x timeframe, logique marché fermé FX week-end)
  - 4 repositories typés upsert idempotents + getLastCandleTs
  - barrel @app/supabase étendu (6 fonctions + types Phase 2)
  - DATA-06 prouvée par test (double upsert => count stable)

affects: [02-ingestion-fiable-des-donn-es, 03-moteur-analyse-deterministe, 04-moteur-ia-veteran]

tech-stack:
  added: []
  patterns:
    - "Repository upsert idempotent : .upsert(rows, {onConflict: 'col1,col2', ignoreDuplicates: false}) + early-return si rows vide"
    - "Env loading dans les tests packages/ : process.loadEnvFile('../../../apps/jobs/.env') (natif Node >= 20.12)"
    - "Lazy env reads dans les tests : getter functions pour eviter le hoist ESM avant loadEnvFile"

key-files:
  created:
    - supabase/migrations/0003_data_ingestion_tables.sql
    - packages/supabase/src/repositories/candles.ts
    - packages/supabase/src/repositories/news.ts
    - packages/supabase/src/repositories/macroSeries.ts
    - packages/supabase/src/repositories/economicCalendar.ts
    - packages/supabase/__tests__/idempotency.test.ts
  modified:
    - packages/supabase/src/database.types.ts
    - packages/supabase/src/index.ts
    - .env.example

key-decisions:
  - "D-upsert : onConflict=instrument_id,timeframe,ts (candles), url_hash (news), series_code,ts (macro), event_key (calendar) — miroir exact des index uniques de la migration"
  - "D-lazy-env : lire process.env dans des fonctions getter (pas au niveau module) pour contourner le hoist ESM dans Vitest"
  - "D-path : packages/supabase/__tests__/ => ../../../apps/jobs/.env (3 niveaux) pour atteindre la racine monorepo"

patterns-established:
  - "Upsert idempotent pattern: early-return si rows vide, onConflict miroir de l index unique SQL"
  - "Test integration service_role : process.loadEnvFile + getters lazy + cleanup afterAll via .delete().in()"

requirements-completed: [DATA-06]

duration: 90min
completed: 2026-06-13
---

# Phase 2 Plan 01: Fondation tables d'ingestion + repositories upsert + DATA-06 Summary

**Migration 0003 appliquée cloud (4 tables RLS + vue freshness + seed 12 instruments), 4 repositories upsert idempotents exportés depuis @app/supabase, DATA-06 prouvée par test double-upsert contre le cloud Supabase.**

## Performance

- **Duration:** ~90 min (3 sessions dont checkpoint human-action)
- **Started:** 2026-06-12T14:00:00Z
- **Completed:** 2026-06-13T01:45:00Z
- **Tasks:** 3 (Task 1 migration + Task 2 checkpoint humain + Task 3 repositories)
- **Files modified:** 9

## Accomplishments

- Migration 0003 : tables candles/news/macro_series/economic_calendar avec RLS stricte (0 alerte get_advisors), index uniques nommés pour le onConflict, extension instruments (12 symboles MVP seedés via on conflict do update), vue v_data_freshness (staleness 2x timeframe, logique FX week-end)
- 4 repositories typés upsert idempotents calqués sur le pattern jobRuns.ts (throw explicite, ServiceClient, early-return si rows vide)
- Barrel @app/supabase étendu : 6 fonctions (upsertCandles, getLastCandleTs, upsertNews, upsertMacroSeries, upsertEconomicCalendar) + types Phase 2 (CandleRow/Insert, NewsRow/Insert, MacroSeriesRow/Insert, EconomicCalendarRow/Insert, DataFreshnessRow, Timeframe, QuoteHours, CalendarImpact)
- Test idempotence DATA-06 vert (26/26 tests suite complète) — double upsert des mêmes candles BTCUSDT synthétiques : count = 2 stable après les 2 passes

## Task Commits

1. **Task 1 : Migration 0003 DDL + RLS + seed 12 + vue freshness** - `388af03` (feat)
2. **Task 1b : .env.example étendu (contrat secrets jobs)** - `a2fd1a5` (chore)
3. **Task 2 résolu : migration cloud + types régénérés + vue security_invoker** - `a23bae9` (chore)
4. **Task 3 : repositories upsert + idempotency.test.ts** - `47a44ed` (feat)

**Plan metadata :** (ce commit)

## Files Created/Modified

- `supabase/migrations/0003_data_ingestion_tables.sql` — DDL 4 tables + RLS + index uniques + extension instruments + seed 12 + vue v_data_freshness
- `packages/supabase/src/repositories/candles.ts` — upsertCandles + getLastCandleTs
- `packages/supabase/src/repositories/news.ts` — upsertNews
- `packages/supabase/src/repositories/macroSeries.ts` — upsertMacroSeries
- `packages/supabase/src/repositories/economicCalendar.ts` — upsertEconomicCalendar
- `packages/supabase/__tests__/idempotency.test.ts` — test DATA-06 double upsert
- `packages/supabase/src/database.types.ts` — régénéré depuis schéma live + raccourcis Phase 2
- `packages/supabase/src/index.ts` — barrel étendu exports Phase 2
- `.env.example` — 7 nouvelles clés jobs (valeurs vides)

## Decisions Made

- `onConflict` de chaque repository = miroir exact du nom d'index unique SQL de la migration (candles_uniq, news_uniq, macro_series_uniq, economic_calendar_uniq) — seule manière de garantir l'idempotence au niveau DB.
- `process.loadEnvFile` (Node natif >= 20.12) préféré à dotenv dans les tests `packages/` pour ne pas ajouter de dépendance. Chemin résolu à 3 niveaux (`../../../apps/jobs/.env`) depuis `packages/supabase/__tests__/`.
- Lecture des variables `process.env` dans des getters lazy (fonctions) et non au niveau module : contournement du hoist ESM Vitest qui évaluerait les `const` avant que `loadEnvFile` s'exécute.
- Vue `v_data_freshness` avec `security_invoker = true` (pas `security_definer`) : conformité avec l'advisor Supabase "security_definer_view" = 0 alerte.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Vue v_data_freshness en security_invoker**
- **Found during :** Task 2 (checkpoint human-action résolu par l'orchestrateur)
- **Issue :** La vue était créée avec le défaut security_definer, déclenchant une alerte Supabase Advisor (T-02-01).
- **Fix :** Migration corrective `fix_freshness_view_security_invoker` appliquée cloud + fichier 0003 mis à jour localement.
- **Verification :** `get_advisors` = 0 alerte après correction.
- **Committed in :** a23bae9

**2. [Rule 1 - Bug] Chemin env incorrect (2 niveaux au lieu de 3)**
- **Found during :** Task 3 (test idempotency)
- **Issue :** `../../apps/jobs/.env` résolvait vers `packages/apps/jobs/.env` (inexistant) — env non chargé, test bloqué.
- **Fix :** Corrigé en `../../../apps/jobs/.env` (depuis `packages/supabase/__tests__/`).
- **Verification :** `pnpm vitest run packages/supabase/__tests__/idempotency.test.ts` vert.
- **Committed in :** 47a44ed

**3. [Rule 3 - Blocking] Import dotenv introuvable dans @app/supabase**
- **Found during :** Task 3 (tsc --noEmit)
- **Issue :** dotenv n'est pas une dépendance de packages/supabase. Erreur TS2307.
- **Fix :** Remplacement par `process.loadEnvFile` (natif Node >= 20.12, zéro dépendance).
- **Committed in :** 47a44ed

**4. [Rule 1 - Bug] Hoist ESM : const lus avant loadEnvFile**
- **Found during :** Task 3 (test toujours en échec après fix path)
- **Issue :** En ESM Vitest, les `const SUPABASE_URL = process.env[...]` au niveau module sont évalués avant le code top-level du même fichier (hoist des imports statiques). Les variables étaient vides.
- **Fix :** Conversion en getter functions `getSupabaseUrl()` / `getServiceRoleKey()` — lues au moment de l'appel (beforeAll).
- **Committed in :** 47a44ed

---

**Total deviations :** 4 auto-fixées (1 missing critical sécurité, 2 bugs, 1 blocking)
**Impact sur le plan :** Toutes les corrections nécessaires pour la compilation et l'exécution des tests. Aucun scope creep.

## Issues Encountered

- `process.loadEnvFile` hoist ESM non documenté dans le plan — pattern de getters lazy désormais établi comme convention pour les tests d'intégration du package.

## User Setup Required

None — les clés OANDA/Finnhub/Marketaux/FRED ont été renseignées dans `apps/jobs/.env` lors du checkpoint humain (Task 2). Ce fichier est gitignoré.

## Next Phase Readiness

- Fondation DB et repositories prêts. Les plans 02-02 et 02-03 peuvent brancher directement sur `upsertCandles`, `upsertNews`, `upsertMacroSeries`, `upsertEconomicCalendar` depuis `@app/supabase`.
- `getLastCandleTs` disponible pour les jobs d'ingestion incrémentale (éviter de re-puller les candles déjà en base).
- Aucun bloquant connu.

---
*Phase: 02-ingestion-fiable-des-donn-es*
*Completed: 2026-06-13*
