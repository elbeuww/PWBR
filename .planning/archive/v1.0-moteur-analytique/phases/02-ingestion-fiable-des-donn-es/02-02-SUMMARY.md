---
phase: 02-ingestion-fiable-des-donn-es
plan: "02"
subsystem: data-ingestion
tags: [binance, oanda, candles, ohlcv, gap-fill, zod, luxon, p-retry, p-limit, typescript, vitest]

requires:
  - phase: 02-01
    provides: upsertCandles/getLastCandleTs repositories, CandleInsert type, 12 instruments seedés
  - phase: 01-fondations-securite
    provides: packages/core (lastClosedCandleStart/dailyAnchorStart/TIMEFRAMES), apps/jobs dispatcher/runJob

provides:
  - package @app/data-sources (ESM) : fetchBinanceKlines + parseBinanceKlines + fetchOandaCandles + parseOandaCandles + OANDA_SYMBOLS
  - job market-ingest : gap-fill OHLCV H1/H4/D, backfill 2ans/6mois, isolation try/catch par instrument (D-20)
  - computeGapFillWindow() : utilitaire exporté pour tests unitaires (fenêtre since/until déterministe)
  - dispatch.ts enregistré : 'market-ingest' → tsx src/dispatch.ts market-ingest
  - golden tests 15/15 (parsers Binance + OANDA hors-ligne)
  - gap-fill tests 10/10 (fenêtre since/until, backfill 1er run, anti look-ahead)
  - DATA-01, DATA-02, DATA-05, DATA-06 couvertes

affects: [02-ingestion-fiable-des-donn-es, 03-moteur-analyse-deterministe, 04-moteur-ia-veteran]

tech-stack:
  added:
    - binance@3.5.9 (tiagosiebler, mainnet public klines sans clé)
    - p-retry@8.0.0 (ESM, backoff exponentiel + Retry-After)
    - p-limit@7.3.0 (ESM, concurrence OANDA=2, Binance=3)
  patterns:
    - "Client Binance : MainClient{} sans clé — klines mainnet public non signés (Pitfall 1 testnet no history)"
    - "Client OANDA : fetch+Zod maison api-fxpractice.oanda.com, from+to TOUJOURS (Pitfall 3 count XOR)"
    - "Parser schema.ts : CandleInsert[] via Zod frontière + luxon UTC — instrument_id/timeframe injectés"
    - "OANDA filter complete:true uniquement (T-02-07 anti bougie en cours)"
    - "Gap-fill : computeGapFillWindow exporté pour testabilité unitaire sans réseau"
    - "Isolation par instrument : chaque (inst × tf) dans try/catch isolé, erreurs dans stats.errors (D-20)"

key-files:
  created:
    - packages/data-sources/package.json
    - packages/data-sources/tsconfig.json
    - packages/data-sources/src/index.ts
    - packages/data-sources/src/binance/client.ts
    - packages/data-sources/src/binance/schema.ts
    - packages/data-sources/src/binance/schema.test.ts
    - packages/data-sources/src/oanda/client.ts
    - packages/data-sources/src/oanda/schema.ts
    - packages/data-sources/src/oanda/schema.test.ts
    - packages/data-sources/src/oanda/instruments.ts
    - packages/data-sources/src/__fixtures__/binance-klines.json
    - packages/data-sources/src/__fixtures__/oanda-candles.json
    - apps/jobs/src/jobs/market-ingest.ts
    - apps/jobs/__tests__/gap-fill.test.ts
  modified:
    - apps/jobs/src/dispatch.ts
    - apps/jobs/package.json
    - tsconfig.base.json
    - vitest.config.ts
    - pnpm-lock.yaml

key-decisions:
  - "D-vitest-alias : @app/core/@app/supabase/@app/data-sources ajoutés comme alias Vitest (tsconfig paths non résolus par défaut par Vite)"
  - "D-computeGapFillWindow-export : fonction extraite et exportée pour tests unitaires déterministes sans réseau"
  - "D-fixture-ms : timestamps ms fixtures alignés sur dates 2026 réelles (epoch calculé via node, non fictif)"
  - "D-backfill : 2 ans pour D, 6 mois pour H1/H4 — via DateTime.utc().minus({years:2}|{months:6}) luxon"

patterns-established:
  - "Alias Vitest workspace : toujours déclarer @app/* dans vitest.config.ts resolve.alias"
  - "computeGapFillWindow pur/exporté : séparer la logique de borne depuis le job pour testabilité"
  - "Fixture timestamp : calculer les epochs ms via node avant de les hardcoder dans les fixtures"

requirements-completed: [DATA-01, DATA-02, DATA-05, DATA-06]

duration: 6min
completed: 2026-06-13
---

# Phase 2 Plan 02: Package data-sources + job market-ingest gap-fill OHLCV Summary

**Package @app/data-sources créé (Binance SDK mainnet public + OANDA fetch+Zod démo), parsers normalisation UTC avec filtrage complete:true, job market-ingest gap-fill multi-instrument (H1/H4/D) avec backfill 2ans/6mois et isolation par instrument, enregistré dans le dispatcher — suite 51/51 verts.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-06-13T01:47:00Z
- **Completed:** 2026-06-13T01:53:00Z
- **Tasks:** 2 (Task 1 data-sources + Task 2 market-ingest)
- **Files modified:** 19

## Accomplishments

- Package @app/data-sources complet : clients Binance/OANDA + parsers Zod UTC + fixtures + golden tests 15/15 hors-ligne
- Job market-ingest gap-fill : backfill initial (2ans Daily / 6mois H4/H1), incrémental ensuite, pagination Binance (1000/page) et OANDA (5000/page), isolation try/catch par (instrument × tf) → stats.errors sans propagation
- Suite complète 51/51 verts (26 existants + 15 golden + 10 gap-fill)
- tsc --noEmit clean

## Task Commits

1. **Task 1 : package data-sources + clients + parsers + golden tests** - `00cab94` (feat)
2. **Task 2 : job market-ingest + dispatch + gap-fill tests** - `3cae3cb` (feat)

**Plan metadata :** (ce commit)

## Files Created/Modified

- `packages/data-sources/package.json` — @app/data-sources ESM, binance@3.5.9/p-retry@8/p-limit@7.3/luxon@3.7.2
- `packages/data-sources/src/binance/client.ts` — fetchBinanceKlines via MainClient{} mainnet public
- `packages/data-sources/src/binance/schema.ts` — parseBinanceKlines Zod+luxon UTC
- `packages/data-sources/src/oanda/client.ts` — fetchOandaCandles fetch+Zod démo, count XOR from/to
- `packages/data-sources/src/oanda/schema.ts` — parseOandaCandles, filtre complete:true
- `packages/data-sources/src/oanda/instruments.ts` — OANDA_SYMBOLS mapping D-18
- `packages/data-sources/src/__fixtures__/binance-klines.json` — 3 klines BTCUSDT 2026-06-09
- `packages/data-sources/src/__fixtures__/oanda-candles.json` — 2 complètes + 1 incomplete EUR_USD
- `packages/data-sources/src/binance/schema.test.ts` — 8 golden tests Binance
- `packages/data-sources/src/oanda/schema.test.ts` — 7 golden tests OANDA dont filtre incomplete
- `apps/jobs/src/jobs/market-ingest.ts` — job gap-fill + computeGapFillWindow exporté
- `apps/jobs/__tests__/gap-fill.test.ts` — 10 tests unitaires fenêtre since/until
- `apps/jobs/src/dispatch.ts` — 'market-ingest' ajouté au JOB_REGISTRY
- `apps/jobs/package.json` — @app/core + @app/data-sources ajoutés
- `tsconfig.base.json` — alias @app/data-sources ajouté
- `vitest.config.ts` — alias @app/core/@app/supabase/@app/data-sources

## Decisions Made

- `computeGapFillWindow` extrait et exporté depuis market-ingest.ts pour permettre les tests unitaires sans mock réseau — pattern réutilisable pour les autres jobs d'ingestion.
- Alias `@app/*` ajoutés dans vitest.config.ts resolve.alias : Vite ne lit pas automatiquement les `paths` TypeScript. Correction nécessaire pour tout package workspace testé via Vitest.
- Timestamps ms dans les fixtures calculés via `new Date('...').getTime()` avant hardcoding — garantit la cohérence epoch/date dans les assertions goldens.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Timestamps ms fixtures ne correspondaient pas aux dates 2026**
- **Found during :** Task 1 (GREEN phase — premiers tests échouent)
- **Issue :** Les timestamps ms initiaux (ex: 1749463200000) correspondaient à 2025-06-09 UTC, pas 2026-06-09 comme annoncé dans les commentaires de fixture. Les assertions golden échouaient.
- **Fix :** Recalcul des epochs via `new Date('2026-06-09T09:00:00.000Z').getTime()` = 1780995600000, mise à jour de la fixture.
- **Files modified :** packages/data-sources/src/__fixtures__/binance-klines.json
- **Verification :** 8/8 golden tests Binance verts après correction.
- **Committed in :** 00cab94

**2. [Rule 3 - Blocking] Alias @app/* manquants dans vitest.config.ts**
- **Found during :** Task 1 (import @app/supabase depuis schema.ts non résolu par Vitest)
- **Issue :** Vitest/Vite ne résout pas les `paths` TypeScript automatiquement. `@app/supabase` et `@app/core` n'étaient pas définis dans `resolve.alias` de vitest.config.ts.
- **Fix :** Ajout de 3 alias dans vitest.config.ts : `@app/core`, `@app/supabase`, `@app/data-sources`.
- **Files modified :** vitest.config.ts
- **Verification :** 15/15 golden tests verts.
- **Committed in :** 00cab94

---

**Total deviations :** 2 auto-fixées (1 bug fixtures, 1 blocking alias Vitest)
**Impact sur le plan :** Corrections nécessaires pour la compilation et l'exécution des tests. Aucun scope creep.

## Known Stubs

Aucun stub. Les parsers retournent des données calculées depuis les fixtures ou la réponse live. Le job market-ingest est opérationnel dès que OANDA_API_TOKEN est défini dans apps/jobs/.env.

## Threat Flags

Aucune surface non couverte par le plan : T-02-04 (Zod frontière), T-02-05 (token env throw), T-02-06 (p-limit), T-02-07 (complete:true + lastClosedCandleStart) — toutes mitigées.

## Issues Encountered

- Vitest ne propage pas les `compilerOptions.paths` du tsconfig — pattern documenté pour les prochains packages workspace testés.

## User Setup Required

OANDA_API_TOKEN doit être défini dans `apps/jobs/.env` pour que le job market-ingest effectue des appels live. Sans ce token, le job lève `Error: OANDA_API_TOKEN must be set` uniquement sur les instruments OANDA. Les instruments Binance (klines mainnet public) fonctionnent sans clé.

## Next Phase Readiness

- Slice OHLCV bout-en-bout opérationnelle : `tsx apps/jobs/src/dispatch.ts market-ingest` remplit la table candles.
- Plans 02-03 (Finnhub/Marketaux/FRED) peuvent utiliser le même pattern package data-sources + computeGapFillWindow.
- Aucun bloquant.

## Self-Check: PASSED

- `packages/data-sources/src/binance/client.ts` ✓
- `packages/data-sources/src/binance/schema.ts` ✓
- `packages/data-sources/src/oanda/client.ts` ✓
- `packages/data-sources/src/oanda/schema.ts` ✓
- `apps/jobs/src/jobs/market-ingest.ts` ✓
- `apps/jobs/__tests__/gap-fill.test.ts` ✓
- Commit 00cab94 ✓
- Commit 3cae3cb ✓

---
*Phase: 02-ingestion-fiable-des-donn-es*
*Completed: 2026-06-13*
