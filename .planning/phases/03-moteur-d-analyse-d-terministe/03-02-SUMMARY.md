---
phase: 03-moteur-d-analyse-d-terministe
plan: 02
subsystem: indicators
tags: [technicalindicators, zod, sha256, market-structure, golden-tests, ohlcv, vitest]

# Dependency graph
requires:
  - phase: 03-01
    provides: "table snapshots + content_hash (raw_indicators_ref), asset_drivers, types CandleRow regénérés"
  - phase: 01
    provides: "@app/core lastClosedCandleStart/TIMEFRAMES/UTC_ZONE (convention bougie clôturée D-10)"
provides:
  - "packages/indicators : wrappers RSI/MACD/EMA/ATR/Bollinger thin, valeur alignée bougie clôturée (TECH-01)"
  - "Structure de marché MAISON : detectSwings (D-32), detectBosChoch corps (D-33), clusterLevels (D-34), computePoc + flag volume_source (D-35)"
  - "Schéma Zod §3 LOCKED (TechnicalSnapshotSchema/FundamentalContextSchema/NewsContextSchema)"
  - "snapshotContentHash sha256 canonique déterministe (raw_indicators_ref, D-41)"
affects: [03-03, 03-04, 04-veteran-analyzer]

# Tech tracking
tech-stack:
  added: [technicalindicators@3.1.0]
  patterns:
    - "Wrapper thin : type lib jamais exposé, valeur at(-1) alignée bougie clôturée + série complète exposée"
    - "Golden test anti-warmup : pin VALEUR (toBeCloseTo) ET LONGUEUR (toHaveLength) par indicateur"
    - "Structure maison golden-testée sur micro-fixtures vérifiées à la main"
    - "Hash canonique : clés triées récursivement + précision décimale fixe avant sha256"

key-files:
  created:
    - packages/indicators/package.json
    - packages/indicators/tsconfig.json
    - packages/indicators/src/index.ts
    - packages/indicators/src/ohlcv.ts
    - packages/indicators/src/wrappers/{rsi,macd,ema,atr,bollinger}.ts
    - packages/indicators/src/wrappers/wrappers.test.ts
    - packages/indicators/src/structure/{swings,structure,levels,volume}.ts
    - packages/indicators/src/structure/structure.test.ts
    - packages/indicators/src/snapshots/{schema,hash}.ts
    - packages/indicators/src/snapshots/snapshots.test.ts
    - packages/indicators/src/__fixtures__/btcusdt-h4.json
  modified:
    - vitest.config.ts
    - tsconfig.base.json

key-decisions:
  - "D-42 : swings pinés N=2 (fenêtre 2N+1=5), k=1.0×ATR — valeurs candidates RESEARCH confirmées par golden tests sur cas vérifiés à la main"
  - "D-43 : trendDirection (HH/LL) déduit le sens AVANT cassure ; flat ⇒ la cassure définit BOS par défaut, CHoCH seulement si tendance opposée établie (raffine D-33)"
  - "D-44 : hash precision = 6 décimales (toFixed) avant sha256 — gèle le bruit flottant cross-plateforme (D-41/Pitfall 3)"
  - "D-45 : wrappers exposent valeur at(-1) (null si historique insuffisant) ET série complète — la série permet le pin de longueur anti-warmup et le calcul de percentile/slope en aval"

patterns-established:
  - "Source-consumed package profile reproduit (Preserve/Bundler/noEmit + alias vitest + paths tsconfig.base)"
  - "Golden-value harness via createRequire pour charger les fixtures JSON offline"

requirements-completed: [TECH-01, TECH-02, TECH-03]

# Metrics
duration: 9min
completed: 2026-06-13
---

# Phase 3 Plan 02 : packages/indicators — wrappers + structure maison + schéma §3 + hash Summary

**Moteur de calcul déterministe @app/indicators : wrappers thin RSI/MACD/EMA/ATR/Bollinger (valeur alignée bougie clôturée), structure de marché MAISON (swings fractals+ATR, BOS/CHoCH sur corps, S/R clusterisés, POC proportional-overlap avec flag volume_source), schéma Zod §3 LOCKED et hash sha256 canonique — 37 golden tests offline.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-06-13T14:17:17Z
- **Completed:** 2026-06-13T14:26:20Z
- **Tasks:** 5 étapes (chacune TDD RED→GREEN où applicable)
- **Files modified:** 19 créés + 2 modifiés

## Accomplishments
- Package `@app/indicators` from scratch : wrappers TECH-01 golden-testés (valeur + longueur, anti-warmup), valeur alignée sur la dernière bougie clôturée.
- Structure de marché MAISON (le différenciateur "vétéran", absent des libs) : `detectSwings` (pivot fractal 2N+1 + filtre k×ATR, D-32), `detectBosChoch` sur clôture du corps anti stop-hunt (D-33), `clusterLevels` S/R multi-facteurs (D-34), `computePoc` proportional-overlap avec flag `volume_source` real|proxy obligatoire (D-35).
- Schéma Zod §3 LOCKED (3 formes) validant les enums avant persist, + `snapshotContentHash` sha256 sur JSON canonique déterministe (D-41).
- Suite `pnpm vitest run packages/indicators` = 37/37 verte (<1s, offline). `pnpm tsc` racine clean. Suite complète 128/128.

## Task Commits

1. **Étape 1 : scaffold package** - `1bb6383` (chore)
2. **Étape 2 RED : golden tests wrappers** - `661cd12` (test)
3. **Étape 2 GREEN : wrappers thin** - `a8f30f6` (feat)
4. **Étape 3 RED : golden tests structure** - `ed59bf0` (test)
5. **Étape 3 GREEN : structure maison** - `a05f4e3` (feat)
6. **Étape 4 RED : golden tests schéma+hash** - `3723848` (test)
7. **Étape 4 GREEN : schéma Zod §3 + hash** - `0a03674` (feat)
8. **Étape 5 : barrel index.ts** - `ff97103` (feat)

_TDD : 3 cycles RED→GREEN (wrappers, structure, snapshots)._

## Files Created/Modified
- `packages/indicators/package.json` - @app/indicators, technicalindicators 3.1.0 + workspace deps
- `packages/indicators/tsconfig.json` - profil source-consumed (Preserve/Bundler/noEmit)
- `packages/indicators/src/ohlcv.ts` - CandleRow[] → {closes,highs,lows,vols}, volume null → 0
- `packages/indicators/src/wrappers/{rsi,macd,ema,atr,bollinger}.ts` - wrappers thin, valeur at(-1) + série
- `packages/indicators/src/structure/swings.ts` - pivot fractal + filtre ATR (D-32)
- `packages/indicators/src/structure/structure.ts` - BOS/CHoCH sur corps + trendDirection (D-33)
- `packages/indicators/src/structure/levels.ts` - clustering S/R + force multi-facteurs (D-34)
- `packages/indicators/src/structure/volume.ts` - POC proportional-overlap + flag source (D-35)
- `packages/indicators/src/snapshots/schema.ts` - 3 schémas Zod §3 LOCKED
- `packages/indicators/src/snapshots/hash.ts` - sha256 sur JSON canonique (D-41)
- `packages/indicators/src/index.ts` - barrel (.js re-exports groupés)
- `packages/indicators/src/__fixtures__/btcusdt-h4.json` - fixture déterministe 220 bougies (≥210 EMA200)
- `vitest.config.ts` - alias @app/indicators
- `tsconfig.base.json` - paths @app/indicators

## Decisions Made
- **D-42** N=2/k=1.0 swings, pinés par golden test (candidats RESEARCH validés).
- **D-43** `trendDirection` HH/LL avant cassure ; flat ⇒ BOS par défaut, CHoCH seulement si tendance opposée établie.
- **D-44** Hash à 6 décimales avant sha256.
- **D-45** Wrappers exposent valeur at(-1) (nullable) + série complète (pin longueur + slope/percentile aval).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] tsconfig.base.json paths @app/indicators ajoutés**
- **Found during:** Étape 1 (scaffold)
- **Issue:** Le plan mentionnait seulement l'alias vitest.config.ts ; sans le `paths` correspondant dans tsconfig.base.json, `pnpm tsc -b` racine n'aurait pas résolu `@app/indicators` (compilation cassée).
- **Fix:** Ajout de `@app/indicators` + `@app/indicators/*` dans tsconfig.base.json paths (miroir des autres packages workspace).
- **Files modified:** tsconfig.base.json
- **Verification:** `pnpm typecheck` (tsc -b --noEmit) EXIT=0.
- **Committed in:** 1bb6383

---

**Total deviations:** 1 auto-fixée (1 missing critical)
**Impact on plan:** Nécessaire à la cohérence du typecheck cross-package. Aucun scope creep.

## Issues Encountered
- **BOS/CHoCH classification initiale fausse** (test BOS attendait 'bos', obtenait 'choch') : la logique de tendance naïve (swing le plus récent) mal classifiait sur micro-fixture. Résolu en introduisant `trendDirection` (HH/LL avant cassure ; flat ⇒ BOS par défaut). Résolu pendant l'étape 3 GREEN, aucun commit supplémentaire (corrigé avant le commit GREEN).

## User Setup Required
None - aucune configuration de service externe requise (calcul pur offline).

## Next Phase Readiness
- `@app/indicators` prêt à être consommé par les engines (plans 03-03/03-04) : technical-engine assemblera le `technical_snapshot` via wrappers+structure, Zod-validera, hashera, upsertera.
- Le flag `volume_source` est en place pour distinguer crypto Binance (real) / OANDA tick (proxy).
- Hash déterministe = `raw_indicators_ref` référencé par hash en Phase 4.
- Note : les schémas fundamental/news sont définis mais leurs producteurs (engines) restent à câbler en 03-03/03-04.

## Self-Check: PASSED

---
*Phase: 03-moteur-d-analyse-d-terministe*
*Completed: 2026-06-13*
