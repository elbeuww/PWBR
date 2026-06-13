---
phase: 02
plan: 04
subsystem: apps/jobs
tags: [ingestion, news, macro, calendar, fault-isolation, DATA-04, DATA-07]
dependency_graph:
  requires: [02-01, 02-02, 02-03]
  provides: [jobs-news-macro-calendar, fault-isolation-proof, dispatcher-complete]
  affects: [Phase 3 news_risk, Phase 4 staleness monitoring]
tech_stack:
  added: []
  patterns:
    - "Client service_role lazy (getServiceClient) repliqué pour chaque job"
    - "Isolation par cible via try/catch par catégorie/série (DATA-07)"
    - "Fallback Marketaux dans le catch Finnhub (D-29)"
    - "Mock top-level vi.mock pour tests offline isolés des API externes"
key_files:
  created:
    - apps/jobs/src/jobs/news-ingest.ts
    - apps/jobs/src/jobs/macro-ingest.ts
    - apps/jobs/src/jobs/calendar-ingest.ts
    - apps/jobs/src/vendor.d.ts
    - packages/data-sources/src/finnhub/finnhub.d.ts
    - apps/jobs/__tests__/fault-isolation.test.ts
  modified:
    - apps/jobs/src/dispatch.ts
    - packages/data-sources/src/binance/client.ts
    - packages/data-sources/tsconfig.json
decisions:
  - "D-29 cadré : fallback Marketaux déclenché dans le catch Finnhub (pas sur 0 résultats) — assure que Finnhub tente toujours en premier"
  - "Mock top-level vi.mock (hoisted) requis pour isoler macroIngest sans réseau Supabase"
  - "finnhub.d.ts dans vendor.d.ts (apps/jobs/src/) : déclaration ambiante dans le scope du compilateur jobs"
metrics:
  duration: "~30 minutes"
  completed_date: "2026-06-13"
  tasks_completed: 2
  files_created: 6
  files_modified: 3
---

# Phase 2 Plan 04: Jobs news/macro/calendar-ingest + Isolation des pannes — Summary

3 jobs verticaux (news/macro/calendar) branchés sur les clients plan 03, enregistrés dans le dispatcher, avec isolation des pannes DATA-07 prouvée par test offline mocké.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Jobs news/macro/calendar-ingest + dispatcher | 5425e8c | news-ingest.ts, macro-ingest.ts, calendar-ingest.ts, dispatch.ts, vendor.d.ts, finnhub.d.ts |
| 2 | Test fault-isolation DATA-07 | 27674cf | fault-isolation.test.ts |

## What Was Built

### Task 1 — 3 jobs d'ingestion + dispatcher

**`newsIngest`** (`apps/jobs/src/jobs/news-ingest.ts`) :
- Catégories : `crypto`, `forex`, `general` (D-28)
- Finnhub primaire ; si Finnhub échoue → fallback Marketaux (D-29)
- Isolation par catégorie dans try/catch (DATA-07)
- `upsertNews` déduplication par `url_hash`

**`macroIngest`** (`apps/jobs/src/jobs/macro-ingest.ts`) :
- 4 séries FRED : `DFF`, `CPIAUCSL`, `DTWEXBGS`, `DFII10` sur 2 ans (D-23)
- Chaque série isolée dans son try/catch
- `upsertMacroSeries` idempotent par `(series_code, ts)`

**`calendarIngest`** (`apps/jobs/src/jobs/calendar-ingest.ts`) :
- `fetchFairEconomyCalendar` (cache in-process 24h plan 03)
- try/catch global (source unique — A3 : dégradé Phase 3 si indisponible)
- `upsertEconomicCalendar` idempotent par `event_key` (D-31)

**`dispatch.ts`** étendu :
```
JOB_REGISTRY: { heartbeat, market-ingest, news-ingest, macro-ingest, calendar-ingest }
```

### Task 2 — fault-isolation.test.ts (DATA-07)

- **Cas 1 (offline)** : `DFF` throw 403 simulé → `stats.errors[0].series === 'DFF'` ; `CPIAUCSL/DTWEXBGS/DFII10` insèrent 9 lignes ; `macroIngest` ne propage pas l'erreur
- **Cas 2 (staleness)** : `v_data_freshness` interrogeable, colonne `is_stale` présente — contrat Phase 4 ; skip propre si env absent

## Verification Results

- `pnpm --filter jobs exec tsc --noEmit` : **VERT**
- `pnpm vitest run apps/jobs/__tests__/fault-isolation.test.ts` : **VERT (2/2)**
- `pnpm vitest run` suite complète : **VERT (86/86)**
- Dispatcher contient 3 nouvelles clés `news-ingest`, `macro-ingest`, `calendar-ingest` : **OUI**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed onFailedAttempt async dans binance/client.ts (TS7030)**
- **Found during:** Task 1 — `pnpm --filter jobs exec tsc --noEmit`
- **Issue:** `onFailedAttempt` n'était pas `async`, TypeScript 7030 "not all code paths return a value"
- **Fix:** `async (error) =>` au lieu de `(error) =>` — aligne avec le pattern des autres clients
- **Files modified:** `packages/data-sources/src/binance/client.ts`
- **Commit:** 5425e8c

**2. [Rule 1 - Bug] Ajout déclaration ambiante module `finnhub` (TS7016)**
- **Found during:** Task 1 — `pnpm --filter jobs exec tsc --noEmit`
- **Issue:** `finnhub@2.0.14` n'a pas de types TypeScript ; TS7016 "implicitly has any type"
- **Fix:** `packages/data-sources/src/finnhub/finnhub.d.ts` + `apps/jobs/src/vendor.d.ts` (scope compilateur jobs) + `tsconfig.json` include `src/**/*.d.ts`
- **Files modified:** `packages/data-sources/src/finnhub/finnhub.d.ts` (créé), `apps/jobs/src/vendor.d.ts` (créé), `packages/data-sources/tsconfig.json`
- **Commit:** 5425e8c

**3. [Rule 1 - Bug] Refactoring test approach — vi.mock top-level pour macroIngest**
- **Found during:** Task 2 — test avec `vi.mock` inline dans la fonction de test
- **Issue:** `vi.mock` inline dans un test hoisted par Vitest mais non effectif sur l'import dynamique du job
- **Fix:** Déplacer `vi.mock('@app/supabase')` et `vi.mock('@app/data-sources')` en top-level du fichier test
- **Files modified:** `apps/jobs/__tests__/fault-isolation.test.ts`
- **Commit:** 27674cf

## Known Stubs

Aucun stub identifié : les 3 jobs utilisent les vrais clients plan 03, les vrais repositories plan 01, et le vrai dispatcher. Le fallback Marketaux de `newsIngest` est câblé avec `[]` comme liste de symboles (acceptable pour le fallback général — la logique catégorie→instruments sera enrichie en Phase 3 si besoin).

## Threat Surface Scan

Aucune nouvelle surface de sécurité non couverte par le threat model du plan :
- T-02-10 (rate limit) : couvert par cache 24h FairEconomy + pLimit dans les clients
- T-02-12 (isolation pannes) : prouvé par fault-isolation.test.ts (DATA-07)
- T-02-13 (clés dans logs) : stats.errors contient uniquement la cible + message normalisé, jamais la valeur de clé

## Self-Check: PASSED

- `apps/jobs/src/jobs/news-ingest.ts` : FOUND
- `apps/jobs/src/jobs/macro-ingest.ts` : FOUND
- `apps/jobs/src/jobs/calendar-ingest.ts` : FOUND
- `apps/jobs/__tests__/fault-isolation.test.ts` : FOUND
- Commit 5425e8c : FOUND
- Commit 27674cf : FOUND
