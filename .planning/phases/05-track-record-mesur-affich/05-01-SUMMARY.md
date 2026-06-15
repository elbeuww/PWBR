---
phase: 05-track-record-mesur-affich
plan: 01
subsystem: testing
tags: [replay, first-touch, track-record, threshold, vitest, golden-tests, pure-logic]

# Dependency graph
requires:
  - phase: 03-moteur-analyse (v1.0)
    provides: "contrat §3 (schemas/output.ts) take_profits {price,alloc_pct}, constantes temps anti look-ahead"
provides:
  - "replayOutcome : fonction pure first-touch déterministe (hit_tp/hit_sl/flat + realized_r) golden-testée 11 cas"
  - "types Outcome / ReplaySetup / ReplayCandle exportés depuis @app/core"
  - "applyThreshold : helper d'affichage seuil N≥30 (% ou « insuffisant », N toujours exposé)"
affects: ["05-02 (job outcome-tracker consomme replayOutcome)", "05-03 (affichage vitrine consomme applyThreshold)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Logique de replay PURE dans packages/core (Pattern 2 RESEARCH) — golden-testée, zéro I/O"
    - "Seuil d'affichage en couche applicative TS (jamais en DB) — N brut côté vue, décision en TS (D-12)"

key-files:
  created:
    - packages/core/src/replay/outcome.ts
    - packages/core/src/replay/outcome.test.ts
    - apps/web/src/lib/track-record/threshold.ts
    - apps/web/src/lib/track-record/threshold.test.ts
  modified:
    - packages/core/src/index.ts
    - vitest.config.ts

key-decisions:
  - "D-05-01-A : realized_r calculé EXCLUSIVEMENT sur les prix des candles (winR = |tp1-entry|/denom ; perdant = -1 ; flat = (close-entry)/denom long, (entry-close)/denom short). Jamais via packages/core/scoring (anti-pattern RESEARCH)."
  - "D-05-01-B : tie-break ambigu D-04 = distTp <= distSl → hit_tp (égalité incluse), porté tel quel depuis l'algo figé RESEARCH §Code Examples."
  - "D-05-01-C : aucune candle dans la fenêtre (gap de données, A3) → flat realized_r 0 (R neutre)."
  - "D-05-01-D : vitest.config include étendu de apps/web/src/lib/**/*.test.ts pour couvrir le chemin de test figé par le frontmatter (précédent D-02-03-C)."

patterns-established:
  - "Pattern : helper de seuil retourne une union discriminée { sufficient:true, winRatePct, n } | { sufficient:false, n } — N présent dans les deux branches"
  - "Pattern : fixtures candles H1 synthétiques inline (OHLC contrôlés, ts croissants) pour golden tests de replay"

requirements-completed: [TRACK-01, TRACK-03]

# Metrics
duration: ~15min
completed: 2026-06-16
---

# Phase 05 Plan 01: Cœur déterministe replay + seuil d'affichage Summary

**Livré la brique pure first-touch `replayOutcome` (hit_tp/hit_sl/flat + R, golden-testée 11 cas) et le helper d'affichage du seuil N≥30 (`applyThreshold`), zéro I/O, sur lesquels s'appuieront le job 05-02 et l'affichage 05-03.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-06-16T00:42Z
- **Completed:** 2026-06-16T00:48Z
- **Tasks:** 3/3
- **Files created:** 4 / **modified:** 2

## Accomplishments

- **TRACK-01 — replayOutcome (pure)** : simulation binaire « TP1 avant SL » sur bougies H1 (D-01/D-03). First-touch séquentiel ; bougie ambiguë → règle de distance D-04 (le niveau le plus proche de l'entrée touché en premier, tie ≤ = hit_tp) ; flat D-02 valorisé au close de la dernière bougie ≤ valid_until (long ET short). `realized_r` mesuré sur les prix candles uniquement.
- **TRACK-01 — golden tests** : 11 `it` (hit_tp/hit_sl long, ambigu D-04 × 3 sous-branches incl. tie, flat long ×2, flat short ×2, short hit_tp, déterminisme). RED prouvé (module manquant), GREEN 11/11.
- **TRACK-03 — applyThreshold** : seuil `MIN_SAMPLE=30` (D-09). N≥30 → `{ sufficient:true, winRatePct, n, expectancy, avgR }` ; N<30 → `{ sufficient:false, n }`. N exposé dans les deux branches (D-12). `win_rate` null → winRatePct 0 (jamais NaN). 6/6 tests verts.
- **Barrel core** étendu : `replayOutcome` + types `Outcome`/`ReplaySetup`/`ReplayCandle`.

## TDD Gate Compliance

- Task 1/2 (replayOutcome) : RED commit `8498a2c` (test) → GREEN commit `084d75f` (feat). Séquence respectée.
- Task 3 (threshold) : helper + test livrés ensemble ; RED structurel prouvé (« No test files found » par gap de glob) avant extension de `vitest.config.ts` → GREEN. Commit `a2f5b19`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extension du glob vitest pour le chemin de test figé**
- **Found during:** Task 3
- **Issue:** Le chemin `apps/web/src/lib/track-record/threshold.test.ts` (figé par le frontmatter du plan) n'était couvert par aucun pattern de `vitest.config.ts` include → « No test files found » (RED structurel attendu, anticipé par le plan).
- **Fix:** Ajout de `apps/web/src/lib/**/*.test.ts` à `test.include` (précédent D-02-03-C pour `apps/web/test/**`).
- **Files modified:** vitest.config.ts
- **Commit:** a2f5b19

## Deferred Issues

- 2 tests d'**intégration Supabase** rouges au run de la full suite (`runJob.test.ts`, `idempotency.test.ts`, `snapshots-rls.test.ts` skipped) — frappent la base live (réseau + `.env.test`), échec par timeout/connexion, **hors scope** (aucun fichier du plan touché). Loggés dans `deferred-items.md`. Mes 17 tests neufs 100% verts ; `pnpm typecheck` propre.

## Verification

- `pnpm vitest run packages/core/src/replay` → 11/11 verts.
- `pnpm vitest run apps/web/src/lib/track-record` → 6/6 verts.
- `pnpm typecheck` → 0 erreur.
- `git diff package.json` → vide (aucun package npm ajouté, conforme threat model T-05).

## Threat Model Compliance

- T-05-01 (Tampering replayOutcome) : `realized_r` sur prix candles, jamais via scoring (grep `import.*scoring` = 0) ; tie-break D-04 testé ; logique pure déterministe golden-testée. MITIGÉ.
- T-05-02 (helper seuil) : décision d'affichage pure, ne masque jamais N (D-12). ACCEPTÉ, risque nul.

## Notes for Next Plan (05-02)

- `replayOutcome(setup, candlesH1)` attend des candles **ordonnées par ts croissant et bornées à la fenêtre** (`ts < valid_until`, anti look-ahead) — responsabilité de l'appelant (le job).
- Edge A3 (aucune candle) → flat R=0 ; A1 (`invalidated` rejoué comme expired) et A2 (R moyen vs expectancy) restent à confirmer fondateur côté job/vue.

## Self-Check: PASSED

- 4 fichiers créés vérifiés présents (outcome.ts/.test.ts, threshold.ts/.test.ts).
- 3 commits vérifiés dans git log (8498a2c, 084d75f, a2f5b19).
