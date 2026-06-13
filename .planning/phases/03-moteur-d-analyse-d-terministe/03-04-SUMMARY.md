---
phase: 03-moteur-d-analyse-d-terministe
plan: 04
subsystem: api
tags: [fundamental, news, sentiment, fred, economic-calendar, luxon, zod, snapshots, deterministic]

# Dependency graph
requires:
  - phase: 03-01
    provides: snapshots + asset_drivers tables, upsertSnapshot, getAssetDrivers, SnapshotInsert/AssetDriverRow types
  - phase: 03-02
    provides: FundamentalContextSchema, NewsContextSchema, snapshotContentHash
  - phase: 03-03
    provides: technical-engine.ts harness pattern, dispatch.ts JOB_REGISTRY
  - phase: 02
    provides: news, economic_calendar, macro_series tables (Phase 2 ingestion)
provides:
  - fundamental-engine job (règles FRED déterministes → fundamental_context §3, zéro IA)
  - news-engine job (sentiment pondéré-décroissant + news_risk → news_context §3)
  - deriveFundamentalContext + deriveNewsContext (fonctions pures testables)
  - les trois moteurs (technical/fundamental/news) enregistrés dans JOB_REGISTRY
affects: [phase-04-moteur-veteran, scoring, trade-setups]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Moteur déterministe = fonction pure (derive*) séparée de l'IO (D-23) + harness macro-ingest"
    - "Drivers macro data-not-code via asset_drivers (D-38), jamais codés en dur"
    - "Décroissance temporelle EWMA-like (half-life nommée) pour le sentiment news (D-39)"
    - "Fenêtres/seuils temporels via luxon, jamais d'arithmétique Date maison (D-40, T-03-17)"

key-files:
  created:
    - apps/jobs/src/jobs/fundamental-engine.ts
    - apps/jobs/src/jobs/news-engine.ts
    - apps/jobs/__tests__/fundamental-engine.test.ts
    - apps/jobs/__tests__/news-engine.test.ts
  modified:
    - apps/jobs/src/dispatch.ts

key-decisions:
  - "macro_bias : DXY↗ + real_yields↗ → risk_off ; ↘+↘ → risk_on ; mixte → neutral (TREND_EPSILON 0.1%)"
  - "rate_environment : DFF en hausse récente → hawkish, baisse → dovish, plat → neutral"
  - "Sentiment news half-life = 12h ; fenêtre day≈24h / swing≈7j"
  - "news_risk : event High-impact <2h (day) / <24h (swing) ; impact comparé insensible à la casse"
  - "Sentiment null (free tier, D-24) = absence, exclu de la moyenne pondérée, jamais un 0 faux"
  - "fundamental_context partagé par instrument (macro global) ; seuls asset_specific_drivers varient"

patterns-established:
  - "Engine pur + IO : derive*() exporté hors-ligne, job wrappe lecture DB → derive → Zod → hash → upsert"
  - "computed_for_ts fundamental = dernière obs macro ; news = now (le hash porte sur payload, pas sur ts)"

requirements-completed: [FUND-01, FUND-02, FUND-03]

# Metrics
duration: 18min
completed: 2026-06-13
---

# Phase 3 Plan 04: Moteurs fondamental + news déterministes Summary

**Deux slices verticaux déterministes (zéro IA) : fundamental-engine dérive macro_bias/rate_environment par règles FRED nommées + drivers data-not-code (asset_drivers), news-engine dérive un net_sentiment pondéré-décroissant aligné au style + flag news_risk <2h/<24h via luxon — les trois contextes §3 (technique/fondamental/news) existent désormais en base par instrument.**

## Performance

- **Duration:** ~18 min
- **Completed:** 2026-06-13
- **Tasks:** 3 (2 en TDD)
- **Files modified:** 5 (4 créés, 1 modifié)

## Accomplishments
- `deriveFundamentalContext` : règles déterministes nommées (DXY/real_yields → macro_bias ; DFF → rate_environment), drivers par actif lus en table (D-38), aucun driver codé en dur.
- `deriveNewsContext` : moyenne pondérée à décroissance exponentielle (half-life 12h), fenêtre day≈24h / swing≈7j, recent_catalysts + upcoming_events, flag `news_risk` High-impact <2h/<24h calculé via luxon.
- Sentiment null (free tier) traité comme absence et non comme 0 faux ; net_sentiment borné [-1,1] ; instrument sans news → neutre sans crash.
- Les deux jobs assemblent §3, Zod-valident AVANT persist (T-03-14), hashent (D-41), upsertent idempotent (kind='fundamental' / 'news').
- Les trois moteurs (technical/fundamental/news) enregistrés dans `JOB_REGISTRY` → appelables par le scheduler, chaque run écrit `job_runs`.

## Task Commits

1. **Task 1: fundamental-engine** - `a28736d` (test RED) → `50d164e` (feat GREEN)
2. **Task 2: news-engine** - `87ef128` (test RED) → `9972a1b` (feat GREEN)
3. **Task 3: register engines in dispatcher** - `b1afecb` (feat)

_Tasks 1 et 2 en TDD : commit test (RED) puis commit implémentation (GREEN). Refactor non nécessaire._

## Files Created/Modified
- `apps/jobs/src/jobs/fundamental-engine.ts` - règles FRED déterministes + asset_drivers → fundamental_context §3, upsert idempotent.
- `apps/jobs/src/jobs/news-engine.ts` - sentiment pondéré-décroissant + news_risk → news_context §3, upsert idempotent.
- `apps/jobs/__tests__/fundamental-engine.test.ts` - 10 golden tests (forme §3, macro_bias, rate_environment, drivers data-not-code, hash).
- `apps/jobs/__tests__/news-engine.test.ts` - 14 golden tests (décroissance, fenêtre style, bornes, news_risk, robustesse, hash).
- `apps/jobs/src/dispatch.ts` - import + enregistrement `fundamental-engine` / `news-engine` dans JOB_REGISTRY.

## Decisions Made
- **Seuils macro** : `TREND_EPSILON = 0.1%` pour distinguer mouvement vs plat (constante nommée, pinée par golden test). Comparaison première vs dernière obs de la fenêtre.
- **HALF_LIFE_HOURS = 12** : une news vieille de 12h pèse moitié moins (EWMA-like, D-39). Constante nommée.
- **news_risk impact** : seuls les events `High` comptent ; comparaison `.toLowerCase()` pour tolérer 'High'/'high'.
- **computed_for_ts** : fundamental = ts dernière obs macro pertinente ; news = `now`. Le hash de contenu porte sur le payload §3 dérivé (pas sur computed_for_ts), donc déterministe entre runs à entrées égales.
- **fundamental partagé par instrument** : le bloc macro (bias/rate/dxy/real_yields) est global ; seuls `asset_specific_drivers` varient par actif → un seul `deriveFundamentalContext` par instrument, deux upserts (day/swing).

## Deviations from Plan

None - plan executed exactly as written. Lecture inline de `macro_series`/`news`/`economic_calendar` via `client.from(...)` (mirroir exact de `readClosedCandles` dans technical-engine), aucun repo de lecture dédié n'existant pour ces tables — conforme au pattern analog.

## Issues Encountered
None.

## User Setup Required
None - aucune configuration de service externe. Les jobs lisent les tables déjà alimentées en Phase 2 ; en DB vide les tests utilisent des fixtures offline et les jobs skippent proprement (pas de crash).

## Next Phase Readiness
- Les trois snapshots §3 (technical/fundamental/news) sont produits par instrument × style et persistés idempotents → l'entrée complète du moteur vétéran (Phase 4) est prête.
- Les fonctions pures `derive*` sont exportées et golden-testées → réutilisables/auditables.
- Aucun blocker.

---
*Phase: 03-moteur-d-analyse-d-terministe*
*Completed: 2026-06-13*
