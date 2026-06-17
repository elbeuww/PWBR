---
phase: quick-260617-j1a
plan: 01
subsystem: jobs / moteur déterministe
tags: [combine-engine, snapshots, pipeline, TROU-2-COMBINE]
requires:
  - "@app/supabase getLatestSnapshotsByKind / upsertSnapshot / listActiveInstruments"
  - "@app/indicators snapshotContentHash"
  - "@app/core CombinedSnapshot"
provides:
  - "Job combine-engine (assemble technical+fundamental+news -> kind='combined')"
  - "getLatestSnapshotsByKind repo (@app/supabase)"
affects:
  - "persist (lit désormais un snapshot combined via raw_indicators_ref)"
tech-stack:
  added: []
  patterns:
    - "Pure logic / IO split (D-23) — buildCombinedPayload + pickTriplet purs, testés golden"
    - "content_hash canonique via snapshotContentHash (D-44), jamais maison"
    - "latest-par-kind via computed_for_ts DESC + limit(1) (anti cap-1000 PostgREST)"
key-files:
  created:
    - apps/jobs/src/jobs/combine-engine.ts
    - apps/jobs/src/jobs/combine-engine.test.ts
  modified:
    - packages/supabase/src/repositories/snapshots.ts
    - packages/supabase/src/index.ts
    - apps/jobs/src/dispatch.ts
    - vitest.config.ts
decisions:
  - "Ancrage temporel du combined sur le snapshot TECHNICAL (computed_for_ts/timeframe_set) — bougie réelle anti look-ahead ; jamais now(), jamais latestMacroTs."
  - "Cohérence par (instrument_id, style) en prenant le dernier de CHAQUE kind ; exiger un computed_for_ts identique produirait 0 combined (fundamental jamais aligné sur l'heure)."
  - "Triplet incomplet -> skip + push errors (missing kinds:…), jamais combiné ni fabriqué."
  - "Vitest include étendu de apps/jobs/src/**/*.test.ts (précédent D-05-01-D / D-02-03-C)."
metrics:
  duration: ~10 min
  completed: 2026-06-17
---

# Phase quick-260617-j1a Plan 01: combine-engine Summary

Job `combine-engine` qui assemble par instrument×style les 3 derniers snapshots séparés (technical/fundamental/news) en un snapshot `kind='combined'` (payload `{technical, fundamental, news}`), comble le TROU #2 et débloque `persist`.

## What was built

- **getLatestSnapshotsByKind** (`packages/supabase/src/repositories/snapshots.ts`) : lit le snapshot le plus récent (`computed_for_ts DESC`, `limit(1).maybeSingle()`) de chaque kind séparé pour un (instrument, style). Kind absent → `null`, jamais un throw ni une ligne fabriquée. Exporté depuis `@app/supabase` (+ type `LatestSnapshotsByKind`).
- **combine-engine** (`apps/jobs/src/jobs/combine-engine.ts`) :
  - Logique PURE (D-23) : `buildCombinedPayload(technical, fundamental, news)` → `CombinedSnapshot` ; `pickTriplet(latest)` → `{ok:true}` ou `{ok:false, missing}`.
  - IO : boucle `listActiveInstruments × ['day','swing']` → `getLatestSnapshotsByKind` → `pickTriplet`. Triplet complet → `upsertSnapshot` (kind='combined', `content_hash = snapshotContentHash(payload)`, ancré sur `technical.computed_for_ts`/`timeframe_set`, `partial = OR` des 3). Incomplet → `stats.skipped++` + log `missing kinds: …`.
  - Miroir technical-engine/outcome-tracker : service_role lazy (`combine-engine:` prefix), per-instrument try/catch (Pitfall 5), WR-04 throw si `inserted===0 && errors>0`.
- **dispatch** : `'combine-engine': combineEngine` enregistré entre les 3 engines et persist (tracé via `runJob` → `job_runs`).

## Verification

- `npx vitest run combine-engine` : 5/5 verts (3 clés assemblées, hash invariant à l'ordre, pickTriplet skip).
- `npx vitest run` (suite complète) : **419/419 verts, 56 fichiers** — aucune régression.
- `pnpm typecheck` (`tsc -b --noEmit`) : 0 erreur.
- `grep -c combine-engine apps/jobs/src/dispatch.ts` = 2 (import + registry).
- 0 package npm ajouté. Aucune migration (0007 autorise déjà `kind='combined'`).

## Idempotence

Clé d'upsert `(instrument_id, style, kind='combined', computed_for_ts)` ancrée sur le technical → un re-run sur données inchangées laisse le count combined stable ; avance d'un cran quand une nouvelle bougie LTF technical arrive (D-41 préservé). Vérifiable hors gate via smoke run réseau (cf. `<verification>` du PLAN).

## Deviations from Plan

**1. [Surgical] Tasks 2 et 3 dans le même fichier `combine-engine.ts`**
- Le plan séparait Task 2 (pure) et Task 3 (IO) mais les deux vivent dans `combine-engine.ts` (un seul fichier, miroir technical-engine). Pure logic écrite d'abord (RED→GREEN sur le test), IO ajoutée ensuite dans le même fichier. Commits : `859a923` (test RED + glob), `499d3f5` (impl pure+IO + dispatch).

**2. [Rule 3 - Blocking] Vitest include étendu**
- `vitest.config.ts` n'incluait pas `apps/jobs/src/**/*.test.ts` → RED structurel « No test files found ». Ajout d'un glob (précédent D-05-01-D / D-02-03-C). Committé avec le test.

Sinon : plan exécuté tel qu'écrit.

## Known Stubs

Aucun.

## Commits

- `00b5891` — feat: getLatestSnapshotsByKind repo (latest per kind, limit 1)
- `859a923` — test: golden tests combine-engine pure logic + vitest glob
- `499d3f5` — feat: combine-engine assembles triplet -> combined snapshot + dispatch

## Self-Check: PASSED
- apps/jobs/src/jobs/combine-engine.ts — FOUND
- apps/jobs/src/jobs/combine-engine.test.ts — FOUND
- packages/supabase/src/repositories/snapshots.ts (getLatestSnapshotsByKind) — FOUND
- Commits 00b5891 / 859a923 / 499d3f5 — FOUND
