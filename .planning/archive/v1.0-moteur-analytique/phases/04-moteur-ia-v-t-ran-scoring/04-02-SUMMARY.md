---
phase: 04-moteur-ia-v-t-ran-scoring
plan: 02
subsystem: scoring
wave: 2
completed_at: 2026-06-14
status: complete
requirements: [SCORE-02, SCORE-03]
tags: [scoring, deterministe, golden, pure, anti-hallucination]
requires:
  - "@app/core OutputSchema/Output (04-01)"
  - "forme §3 TechnicalSnapshot/FundamentalContext/NewsContext (P3, miroir structurel)"
provides:
  - "scoreSetup(snapshot, output, style, opts) → {opportunity_score, breakdown, risk_level, confidence}"
  - "computeRiskReward(output) → {perTp, global} (bord conservateur D-50)"
  - "deriveRiskLevel / deriveConfidence (règles code)"
  - "WEIGHTS/PENALTIES/INPUT_BOUNDS/hasStrongCatalyst exportés de @app/core"
affects:
  - "04-03 persist.ts (appellera scoreSetup avant insertion)"
tech-stack:
  added: []
  patterns:
    - "fonctions pures déterministes (aucun Date.now/Math.random), arrondi 6 déc (T-04-04)"
    - "types §3 miroir structurel local (anti-cycle ; @app/core ne dépend pas d'@app/indicators)"
    - "constantes as const data-not-magic (barème/seuils nommés)"
key-files:
  created:
    - packages/core/src/scoring/rr.ts
    - packages/core/src/scoring/risk.ts
    - packages/core/src/scoring/confidence.ts
    - packages/core/src/scoring/weights.ts
    - packages/core/src/scoring/score.ts
    - packages/core/src/scoring/snapshot-input.ts
    - packages/core/src/scoring/index.ts
    - packages/core/__tests__/scoring/rr.test.ts
    - packages/core/__tests__/scoring/risk.test.ts
    - packages/core/__tests__/scoring/confidence.test.ts
    - packages/core/__tests__/scoring/score.test.ts
    - packages/core/__tests__/scoring/__fixtures__/setups.ts
  modified:
    - packages/core/src/index.ts
decisions:
  - "D-49 : types §3 d'entrée du scoring = miroir structurel local dans @app/core/scoring/snapshot-input.ts (PAS import depuis @app/indicators). @app/core est le package le plus bas ; importer via paths tirait la source d'indicators hors rootDir composite (TS6059/6307) + sa dép @app/supabase. Graphe unidirectionnel préservé, anti-cycle."
metrics:
  duration: ~25min
  tasks: 3
  files: 13
  tests: 32
commits: [02fd522, 9da63ea, 2c9e826]
---

# Phase 4 Plan 02 : Cœur de scoring déterministe — Summary

Cœur déterministe /100 de la Phase 4 posé : `scoreSetup` produit
`opportunity_score` (décomposable via breakdown §3) + `risk_level` + `confidence`
+ R:R recalculé sur le bord conservateur, tout PUR et verrouillé par golden tests
(32/32). C'est le remplacement déterministe du jugement chiffré de l'agent
(anti-hallucination, reproductibilité, calibration §6).

## Tâches

| Task | Statut | Commits |
| ---- | ------ | ------- |
| 1 — rr.ts bord conservateur (D-50) + fixtures | ✅ | `02fd522` |
| 2 — risk.ts + confidence.ts (D-46/D-48) | ✅ | `9da63ea` |
| 3 — weights.ts + score.ts + cap 45 + clamp + barrel | ✅ | `2c9e826` |

## Ce qui a été construit

- **`rr.ts`** — `computeRiskReward(output)` pur : entrée conservatrice (long =
  `zone[1]`, short = `zone[0]`, D-50), `rr_tp = |tp - entryCons| / |entryCons - SL|`,
  `global` = somme pondérée par `alloc_pct`, arrondi 6 déc. `throw 'zero_sl_distance'`
  si distance de risque nulle. Golden long (TP1 1.0, TP2 2.133333, global 1.566667)
  + short (0.789474 / 1.684211, global 1.236842) + preuve anti-surestimation (Pitfall 1).
- **`risk.ts`** — `deriveRiskLevel({snapshot, output, rr})` : points additifs sur
  4 facteurs §3 (distance SL en ATR, atr_percentile, news_risk, contre-HTF) →
  low/medium/high/extreme. Seuils nommés (`RISK_THRESHOLDS`). Golden 4 niveaux.
- **`confidence.ts`** — `deriveConfidence({opportunity_score, alignedConfluences,
  news_risk})` : mapping score + confluences (high requiert score≥70 ET ≥4
  confluences) ; `news_risk` dégrade d'un cran. Golden 3 niveaux + dégradations.
- **`weights.ts`** — `WEIGHTS` day/swing §3 + `PENALTIES` (-15/-10) + `INPUT_BOUNDS`
  (rsi/atrPctile/sentiment) + `RR_TARGETS` (1.5/2.0) + `EXTREME_VOL_PERCENTILE` +
  `HTF_CONTRADICT_CAP` (45) + `hasStrongCatalyst(output)` (condition EXACTE :
  `news_catalysts.some(c => c.impact==='high' && c.direction == sens du setup)`).
- **`score.ts`** — `scoreSetup` pur, ordre FIGÉ ÉTAPE 0 bornes → 1 score → 2
  confidence → 3 risk. Clamp RSI/atr_pctile/sentiment à l'usage (score toujours
  [0,100]) ; `throw 'invalid_atr'` si ATR<0 (concern #4/T-04-14). 6 blocs scorés
  (trendAlign/keyLevel/momentum/fundamental/news/rr), pénalités, CAP 45 si HTF
  contredit ET pas de catalyseur fort. `breakdown` somme au score.
- **`snapshot-input.ts`** — types §3 d'entrée (miroir structurel local, D-49).
- **`index.ts` (scoring + core barrel)** — `scoreSetup` + helpers + types exportés
  de `@app/core`.

## Vérification

- `pnpm vitest run packages/core/__tests__/scoring` → **32/32 verts** (rr 6 +
  risk 7 + confidence 8 + score 11), dont cap 45 condition exacte (2 tests),
  bornes inputs (clamp RSI + throw invalid_atr), ordre figé score→confidence→risk.
- `pnpm vitest run packages/core` → **67/67 verts** (aucune régression 04-01).
- `pnpm --filter @app/core exec tsc --noEmit` → **0 erreur**.
- `pnpm --filter @app/indicators exec tsc --noEmit` → **0 erreur** (consommateur
  de `@app/core`, pas de régression barrel).
- Aucun import runtime NI type de `@app/indicators` dans `packages/core/src/scoring`
  (grep vérifié) → cycle évité, graphe unidirectionnel.

## Déviations du plan

### Rule 3 — Blocage résolu (architecture d'import des types §3)

**1. [Rule 3 - Blocking] `import type` depuis `@app/indicators` cassait tsc core**
- **Trouvé pendant :** Task 3 (vérification `tsc --noEmit`).
- **Problème :** le plan demandait `import type { TechnicalSnapshot, ... } from
  '@app/indicators'`. Mais `@app/core` est le package le plus BAS du graphe
  (`@app/indicators` dépend de `@app/core`, pas l'inverse). Résoudre le type via
  les `paths` tsconfig tire la SOURCE d'indicators (`packages/indicators/src/
  index.ts`) HORS du `rootDir` du projet composite `@app/core` → erreurs
  **TS6059 / TS6307** (rootDir), et traîne en plus la dépendance `@app/supabase`
  (erreurs Bundler-resolution préexistantes). `import type` n'élimine pas la
  résolution de fichier en projet composite.
- **Fix :** créé `packages/core/src/scoring/snapshot-input.ts` — miroir STRUCTUREL
  des formes §3 (`TechnicalSnapshotInput`/`FundamentalContextInput`/
  `NewsContextInput`/`CombinedSnapshot`). La validation Zod reste la source de
  vérité À LA PRODUCTION (P3, T-03-08) ; côté consommateur un contrat structurel
  suffit et préserve le graphe unidirectionnel + l'anti-cycle voulu par le plan.
  Compatibilité structurelle : un `TechnicalSnapshot` d'`@app/indicators` reste
  assignable à `TechnicalSnapshotInput` (mêmes champs §3 ; indicators tsc vert).
- **Fichiers modifiés :** `score.ts`, `risk.ts`, `__fixtures__/setups.ts` (imports
  basculés vers le type local), `snapshot-input.ts` (créé), `scoring/index.ts`
  (export des types).
- **Décision enregistrée :** D-49.
- **Commit :** `2c9e826`.

L'objectif du plan (anti-cycle, déterminisme, pas de double source de vérité Zod)
est MIEUX servi : aucun import (même type) d'`@app/indicators` dans core.

## Golden notes (valeurs figées)

- R:R long global = `1.566667` ; short global = `1.236842`.
- Score confluence forte day (bullishSnapshot + longOutput) = **98**
  (breakdown 25/18/15/15/10/15). Maximalement aligné → score élevé attendu (le
  "≈78" du plan est illustratif §3, non normatif).
- CAP : HTF contredit + sans catalyseur fort → **45** ; avec catalyseur fort
  (Fed dovish high/bullish == long) → **73** (cap levé).
- Pénalité news_risk → -15 vérifiée sur le breakdown.

## Self-Check: PASSED
