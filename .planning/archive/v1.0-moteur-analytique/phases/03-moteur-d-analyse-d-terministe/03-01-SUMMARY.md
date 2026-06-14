---
phase: 03-moteur-d-analyse-d-terministe
plan: 01
subsystem: database
tags: [supabase, postgres, rls, snapshots, asset-drivers, repositories, idempotence]

requires:
  - phase: 01-fondations-securite
    provides: skeleton packages/supabase, service-client (D-07), conventions RLS
  - phase: 02-ingestion-fiable-des-donnees
    provides: table instruments seedée, pattern upsert idempotent (candles/macro_series), harness test loadEnvFile
provides:
  - "Table snapshots (RLS select-only) — frontière de persistance partagée des 3 moteurs P3"
  - "Table asset_drivers (data-not-code, seedée 13 lignes) — drivers macro par actif (D-38)"
  - "Repositories typés upsertSnapshot/getSnapshotByHash/getAssetDrivers"
  - "Clé d'idempotence snapshots_uniq = onConflict (instrument_id,style,kind,computed_for_ts)"
  - "Hash de contenu (content_hash = raw_indicators_ref, D-41) résoluble par la Phase 4"
affects: [03-02 technical-engine, 03-03 fundamental-engine, 03-04 news-engine, 04 moteur-ia]

tech-stack:
  added: []
  patterns:
    - "Repository pattern : ServiceClient = SupabaseClient<Database>, upsert onConflict miroir index unique SQL, error-wrap throw"
    - "Test golden DB d'idempotence : double upsert => count inchangé + cleanup WR-06 vérifié post-delete"

key-files:
  created:
    - packages/supabase/src/repositories/snapshots.ts
    - packages/supabase/src/repositories/assetDrivers.ts
    - packages/supabase/__tests__/snapshots-rls.test.ts
    - supabase/migrations/0005_snapshots.sql
  modified:
    - packages/supabase/src/index.ts
    - packages/supabase/src/database.types.ts

key-decisions:
  - "D-36 : timeframe_set text (ex 'H4/H1') porté par le snapshot, pas un enum — flexibilité multi-TF par style"
  - "D-38 : asset_drivers = data-not-code, extensible par UPDATE SQL (seed or/JPY/crypto), pas de code à recompiler"
  - "D-41 : content_hash = raw_indicators_ref, clé de référence inter-phase ; getSnapshotByHash exposé pour la Phase 4"

patterns-established:
  - "Snapshot persistence boundary : 3 moteurs verticaux écrivent dans une table horizontale partagée, référencée par hash en aval"
  - "RLS dès la création de table : enable RLS + UNE policy select authenticated, AUCUNE write policy (service_role bypass, D-05)"

requirements-completed: [TECH-04, FUND-01, FUND-02, FUND-03]

duration: 18min
completed: 2026-06-13
---

# Phase 3 Plan 01 : Frontière de persistance snapshots + asset_drivers Summary

**Fondation DB partagée des trois moteurs déterministes : table `snapshots` (RLS select-only, idempotente par hash) + table `asset_drivers` data-not-code seedée, exposées via repositories typés.**

## Performance

- **Duration:** ~18 min (continuation depuis checkpoint Task 2)
- **Completed:** 2026-06-13
- **Tasks:** 3/3
- **Files modified:** 6 (4 créés, 2 modifiés)

## Accomplishments
- Tables `snapshots` + `asset_drivers` appliquées en base cloud Supabase avec RLS active (Task 1+2).
- 13 lignes `asset_drivers` seedées (or↔DXY/REAL_YIELDS, JPY↔RATE_DIFF, crypto↔RISK_SENTIMENT/DXY).
- Repositories typés `upsertSnapshot`/`getSnapshotByHash`/`getAssetDrivers` exportés du barrel, sans fuite de service-client (D-07).
- Idempotence snapshots prouvée par test golden DB (double upsert => count inchangé) + résolution par content_hash vérifiée.

## Task Commits

1. **Task 1: Migration 0005_snapshots.sql (tables + RLS + index + seed)** - `23fd3a7` (feat)
2. **Task 2: [CHECKPOINT human-action] Migration appliquée en base + types régénérés + gate sécurité** - `96fbb89` (feat)
3. **Task 3: Repositories snapshots + assetDrivers + barrel + test RLS/idempotence** - `d0cf032` (feat)

## Files Created/Modified
- `supabase/migrations/0005_snapshots.sql` - Tables snapshots + asset_drivers, RLS, index uniques, seed drivers (Task 1)
- `packages/supabase/src/database.types.ts` - Types régénérés + exports SnapshotRow/Insert, AssetDriverRow/Insert, unions SnapshotStyle/Kind (Task 2)
- `packages/supabase/src/repositories/snapshots.ts` - upsertSnapshot (onConflict instrument_id,style,kind,computed_for_ts) + getSnapshotByHash (D-41)
- `packages/supabase/src/repositories/assetDrivers.ts` - getAssetDrivers read accessor (D-38)
- `packages/supabase/src/index.ts` - Barrel : +3 fonctions, +4 types, aucun export service-client (D-07)
- `packages/supabase/__tests__/snapshots-rls.test.ts` - Test idempotence + getSnapshotByHash + cleanup WR-06

## Decisions Made
None nouvelle — plan suivi tel qu'écrit. D-36/D-38/D-41 (déjà actées au plan) respectées dans l'implémentation.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. Task 1+2 résolus par l'orchestrateur (checkpoint human-action). Task 3 : vitest 11/11 vert, tsc exit 0 au premier passage.

## Verification

- `pnpm vitest run packages/supabase` : 3 fichiers, 11 tests passés (idempotence snapshots prouvée).
- `pnpm --filter @app/supabase tsc --noEmit` : exit 0.
- `get_advisors(security)` (Task 2) : 0 erreur.
- `list_tables` : snapshots + asset_drivers rls_enabled=true, asset_drivers 13 lignes seedées.

## Self-Check: PASSED

- Files created: snapshots.ts, assetDrivers.ts, snapshots-rls.test.ts, 0005_snapshots.sql — all FOUND.
- Commits: `23fd3a7`, `96fbb89`, `d0cf032` — all FOUND in git log.
