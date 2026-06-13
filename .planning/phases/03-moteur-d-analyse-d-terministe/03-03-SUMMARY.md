---
phase: 03-moteur-d-analyse-d-terministe
plan: 03
subsystem: api
tags: [technicalindicators, zod, supabase, snapshots, jobs, deterministic-engine]

# Dependency graph
requires:
  - phase: 03-01
    provides: "migration 0005 snapshots/asset_drivers + upsertSnapshot/getSnapshotByHash + types SnapshotInsert"
  - phase: 03-02
    provides: "@app/indicators (wrappers rsi/macd/ema/atr/bollinger, structure detectSwings/detectBosChoch/clusterLevels/computePoc, snapshotContentHash, TechnicalSnapshotSchema)"
  - phase: 02
    provides: "candles crypto réelles en base + harness job macro-ingest + dispatch/runJob + @app/core closed-candle"
provides:
  - "Job technical-engine : candles → indicators+structure → §3 technical_snapshot → Zod → hash → upsert snapshots"
  - "Fonction pure buildTechnicalSnapshot (testable, séparation logique/IO D-23)"
  - "Premier slice vertical complet : snapshots technique déterministes en base, consultables"
affects: [03-04, fundamental-engine, news-engine, analyse-IA, dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Engine job = harness macro-ingest (dotenv first, getServiceClient lazy, stats, per-item try/catch, WR-04 throw)"
    - "Pure-fn + IO split (D-23) : buildTechnicalSnapshot testable offline, technicalEngine fait l'IO"
    - "Zod-validate la forme §3 AVANT persist (T-03-10)"

key-files:
  created:
    - apps/jobs/src/jobs/technical-engine.ts
    - apps/jobs/__tests__/technical-engine.test.ts
  modified:
    - apps/jobs/src/dispatch.ts
    - apps/jobs/package.json
    - apps/jobs/tsconfig.json

key-decisions:
  - "trend_htf/ltf = close vs EMA200 (repli EMA50) avec bande neutre 0.1% pour absorber le bruit"
  - "slope momentum = écart MACD↔signal ; volume_state = volume récent (1/4 final) vs antérieur"
  - "POC ajouté en key_levels avec volume_source (real Binance / proxy OANDA, D-35)"
  - "computed_for_ts = ts de la dernière bougie LTF clôturée ; lecture bornée par lastClosedCandleStart (D-10)"

patterns-established:
  - "Engine vertical slice : read closed candles → @app/indicators → assemble §3 → Zod → hash → upsertSnapshot"
  - "Style→TF map (D-36) : day=H4/H1, swing=D/H4, isolé par instrument×style"

requirements-completed: [TECH-01, TECH-02, TECH-03, TECH-04]

# Metrics
duration: 3min
completed: 2026-06-13
---

# Phase 3 Plan 03: Moteur technique (technical-engine) Summary

**Job technical-engine déterministe : lit les bougies crypto réelles, assemble un technical_snapshot §3 (trend HTF/LTF, momentum, volatilité, key_levels+POC, structure BOS/CHoCH, volume_state) par instrument×style, Zod-valide, hashe (D-41) et upserte dans snapshots — premier slice vertical complet de bout en bout.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-06-13T14:31:13Z
- **Completed:** 2026-06-13T14:34:35Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Fonction pure `buildTechnicalSnapshot(candlesByTf, style, volumeSource)` produisant un snapshot conforme §3 LOCKED, golden-testée offline (forme, hash déterministe, gap EMA200, volume_source).
- Harness `technicalEngine()` : lecture bougies clôturées (D-10), assemblage, Zod-validation pré-persist (T-03-10), upsert idempotent, isolation per-instrument (Pitfall 5), WR-04 throw sur échec total.
- Enregistré dans `JOB_REGISTRY` sous `'technical-engine'` → `runJob` écrit `job_runs` automatiquement.
- Gap EMA200 → `partial:true` + `missing:['ema200']` (jamais de zéro silencieux).

## Task Commits

1. **Task 1: Golden tests RED + stub** - `592eca1` (test)
2. **Task 2: Implémentation technical-engine** - `7b710b2` (feat)
3. **Task 3: Enregistrement dispatcher** - `18c96c5` (feat)

_TDD : Task 1 = RED (stub NotImplemented + 7 tests échouant sur assertion, import résolu), Task 2 = GREEN (7/7 verts)._

## Files Created/Modified
- `apps/jobs/src/jobs/technical-engine.ts` - Job + fonction pure d'assemblage §3
- `apps/jobs/__tests__/technical-engine.test.ts` - 7 golden tests (forme §3, hash, gap EMA200, volume_source)
- `apps/jobs/src/dispatch.ts` - Import + clé `'technical-engine'` dans JOB_REGISTRY
- `apps/jobs/package.json` - Dépendance workspace `@app/indicators`
- `apps/jobs/tsconfig.json` - Path mapping `@app/indicators`

## Decisions Made
- `trend` dérivé de close vs EMA200 (repli EMA50 si < 200 bougies) avec bande neutre 0.1%.
- `slope` momentum = MACD − signal ; `volume_state` = comparaison volume récent vs antérieur.
- POC inséré comme key_level dédié portant `volume_source` (D-35), distinct des niveaux S/R.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] @app/indicators non résolu dans apps/jobs**
- **Found during:** Task 2 (typecheck apps/jobs)
- **Issue:** apps/jobs ne déclarait pas `@app/indicators` en dépendance → TS2307 + implicit-any en cascade. Le module n'était pas linké dans node_modules ni mappé en tsconfig.
- **Fix:** Ajout de `"@app/indicators": "workspace:*"` dans apps/jobs/package.json, path mapping miroir de `@app/supabase` dans tsconfig.json, `pnpm install --filter jobs` pour créer le symlink.
- **Files modified:** apps/jobs/package.json, apps/jobs/tsconfig.json, pnpm-lock.yaml
- **Verification:** `pnpm tsc -p apps/jobs/tsconfig.json --noEmit` clean ; suite verte.
- **Committed in:** `7b710b2` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Correction nécessaire pour consommer @app/indicators (cœur du plan). Pas de scope creep — mirroring exact du pattern @app/supabase existant.

## Issues Encountered
None.

## User Setup Required
None - aucune configuration de service externe requise (réutilise apps/jobs/.env existant).

## Next Phase Readiness
- Slice vertical complet : snapshots technique réels déterministes en base, idempotents (re-run → même hash).
- Pattern engine prêt à être dupliqué pour fundamental-engine / news-engine (plan 03-04).
- Aucun blocker.

## Self-Check: PASSED

---
*Phase: 03-moteur-d-analyse-d-terministe*
*Completed: 2026-06-13*
