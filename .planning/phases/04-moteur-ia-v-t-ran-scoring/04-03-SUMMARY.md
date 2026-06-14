---
phase: 04-moteur-ia-v-t-ran-scoring
plan: 03
subsystem: persist-trust-frontier
wave: 3
completed_at: 2026-06-14
status: complete
requirements: [SCORE-04, SCORE-05]
tags: [trust-frontier, anti-path-traversal, garde-fous, immuabilite, deterministe, golden]
requires:
  - "@app/core OutputSchema/Output + scoreSetup/computeRiskReward (04-01/04-02)"
  - "@app/supabase getSnapshotByHash/insertAnalysis/insertTradeSetups/expirePriorSetups (04-01)"
provides:
  - "persist() — frontiere de confiance unique (D-43, service_role, seul chemin d'ecriture)"
  - "readRunArtifacts(runId) + RUN_ID_RE + RUN_ARTIFACTS_DIR (anti path traversal)"
  - "runGuardrails/structureDirection/sessionDayOf/validUntilOf/raiseRisk/stripFence (purs, testables)"
affects:
  - "04-04 ANALYZE (ecrit les fichiers run-artifacts/<run_id>/<instrument>_<style>.json, exporte RUN_ID/MODEL_LABEL/PROMPT_VERSION, cable persist dans dispatch)"
tech-stack:
  added: []
  patterns:
    - "frontiere unique calquee technical-engine.ts (boucle isolee, Zod avant upsert, stats normalisees, throw si 0 produit)"
    - "anti path traversal 3 couches (regex allow-list + path.resolve+startsWith + re-validation basename)"
    - "garde-fous purs separes de l'IO (runGuardrails testable hors-ligne)"
    - "luxon pour session_day (toISODate UTC) et valid_until (plus hours), jamais Date maison (T-03-17)"
    - "vi.mock top-level hoisted (D-27) pour @app/supabase + ./runArtifacts + @supabase/supabase-js"
key-files:
  created:
    - apps/jobs/src/jobs/runArtifacts.ts
    - apps/jobs/src/jobs/persist.ts
    - apps/jobs/__tests__/runArtifacts.test.ts
    - apps/jobs/__tests__/persist.test.ts
    - apps/jobs/__tests__/__fixtures__/run-artifacts.ts
  modified: []
decisions:
  - "D-04-03-A : structure_against derive deterministe — bos_choch (bos|choch|null) ne porte pas la direction ; direction structurelle effective = BOS continue trend_ltf, CHoCH le retourne ; si elle contredit output.direction → reject('structure_against'). Reconcilie le brief (qui supposait 'bearish_bos') avec le modele §3 reel."
  - "D-04-03-B : CombinedSnapshot resolu via snapshot.payload (raw_indicators_ref → getSnapshotByHash) caste en CombinedSnapshot (aligne RESEARCH ligne 206). L'ANALYZE 04-04 fournit le payload combine (technical+fundamental+news)."
  - "D-04-03-C : erreur IO inattendue par artefact → reject('insert_error') isole (Pitfall 5), code normalise, ne crash pas le run."
metrics:
  duration: ~40min
  tasks: 2
  files: 5
  tests: 34
commits: [0885696, 841dbb4]
---

# Phase 4 Plan 03 : Frontiere de confiance unique (persist.ts) Summary

`persist()` — LE point unique ou la sortie qualitative non fiable de l'agent devient
une donnee verifiee et immuable. run_id sanitise (anti path traversal) → JSON agent
→ Zod §3 → resolution snapshot exact → garde-fous deterministes (R:R bord
conservateur, coherence SL/TP, structure_against, alloc) → scoring deterministe →
immuabilite par expiry (cle session_day) + upsert service_role, ou rejet+log
normalise. Aucun autre chemin d'ecriture (D-43). 34/34 golden tests verts.

## Taches

| Task | Statut | Commits |
| ---- | ------ | ------- |
| 1 — readRunArtifacts (anti path traversal) + garde-fous + rejets normalises | ✅ | `0885696` (runArtifacts), `841dbb4` (persist+guardrails) |
| 2 — Scoring + snapshot.partial + immuabilite (expiry cle session_day) + valid_until + upsert | ✅ | `841dbb4` |

## Ce qui a ete construit

- **`apps/jobs/src/jobs/runArtifacts.ts`** — `readRunArtifacts(runId)` sécurisé.
  Defense 3 couches : `RUN_ID_RE = /^[a-z]+-\d{8}T\d{4}Z$/` (allow-list) +
  `path.resolve` + `startsWith(RUN_ARTIFACTS_DIR + path.sep)` (confinement) +
  re-validation de chaque basename (pas de separateur). Liste vide → `throw
  'no_artifacts'` (jamais succes silencieux). Parse `<instrument>_<style>.json`.
- **`apps/jobs/src/jobs/persist.ts`** — frontiere unique calquee `technical-engine.ts`.
  - Helpers purs exportes : `stripFence`, `conservativeEntry`, `structureDirection`,
    `runGuardrails`, `raiseRisk`, `sessionDayOf`, `validUntilOf`.
  - Pipeline par artefact : stripFence+JSON.parse (`json_parse`) → `OutputSchema.parse`
    (`zod_shape`) → `getSnapshotByHash` (`snapshot_not_found`) → `runGuardrails`
    (`rr_below_min`/`sl_coherence`/`tp_bounds`/`structure_against`) → `scoreSetup` →
    `expirePriorSetups` AVANT insert → `insertAnalysis` → `insertTradeSetups`.
  - Constantes nommees : `DAY_VALID_HOURS=24`, `SWING_VALID_HOURS=72`, `MIN_RR=1.2`.
  - `stats.reasons` = CODES normalises uniquement (T-02-13). `throw` si 0 ecrit +
    rejets (WR-04 / Pitfall 6). `getServiceClient` lazy local (D-07).
- **`apps/jobs/__tests__/__fixtures__/run-artifacts.ts`** — Output long valide,
  CombinedSnapshot aligne, `makeSnapshotRow(payload, partial)`, `toRaw(output, fenced)`.
- **`runArtifacts.test.ts`** (8 tests) + **`persist.test.ts`** (26 tests).

## Verification

- `pnpm vitest run apps/jobs/__tests__/runArtifacts.test.ts apps/jobs/__tests__/persist.test.ts`
  → **34/34 verts**.
- `pnpm vitest run` (suite complete) → **244/244 verts** (aucune regression).
- `pnpm --filter jobs exec tsc --noEmit` → **exit 0**.

## Exigences securite/correctness (cross-review) — toutes presentes ET testees

- ✅ run_id : `RUN_ID_RE` + `path.resolve` + `startsWith(BASE+sep)` ; liste vide → throw.
  Tests : traversal `../../etc/passwd`, `.../../..`, vide x2.
- ✅ Garde-fous : recalcul R:R bord conservateur ; `reject('structure_against')`
  quand structure contredit la direction ; `reject('tp_bounds')` quand alloc≠100 ;
  regles dures (R:R<1.2 → `rr_below_min`, coherence SL/TP → `sl_coherence`).
- ✅ `session_day = DateTime.fromISO(generated_at,{zone:'utc'}).toISODate()` (test 23:30Z
  → meme jour, pas de glissement).
- ✅ `snapshot.partial===true` → scored + risk_level releve d'un cran (jamais 'low').
- ✅ JSON non conforme → reject + raison normalisee, pas de retry P1.
- ✅ Aucune UPDATE des champs d'analyse (seul `status` transitionne via expirePriorSetups).

## Deviations du plan

### Rule 1 — reconciliation modele structure_against

**1. [Rule 1 - Correctness] `bos_choch` ne porte pas la direction (brief supposait 'bearish_bos')**
- **Trouve pendant :** Task 1 (lecture `packages/indicators/src/snapshots/schema.ts`).
- **Probleme :** le brief security_critical et l'objectif citaient `bos_choch='bearish_bos'`,
  mais le modele §3 reel type `bos_choch` en `'bos' | 'choch' | null` (aucune direction).
- **Fix :** derivation deterministe honnete via `structureDirection()` — BOS continue
  `trend_ltf`, CHoCH le retourne ; la direction structurelle effective est comparee a
  `output.direction`. La garde `structure_against` reste pleinement implementee et testee
  (3 tests `structureDirection` + 1 test integration). Decision **D-04-03-A**.
- **Fichiers :** `persist.ts` (`structureDirection`, `runGuardrails`).
- **Commit :** `841dbb4`.

### Rule 3 — resolution CombinedSnapshot + erreur IO isolee

**2. [Rule 3 - Blocking] scoreSetup attend CombinedSnapshot, getSnapshotByHash retourne SnapshotRow**
- **Fix :** `snapshot.payload` caste en `CombinedSnapshot` (aligne RESEARCH ligne 206) ;
  l'ANALYZE 04-04 ecrit le payload combine. Decision **D-04-03-B**.

**3. [Rule 3 - Robustesse] erreur IO inattendue par artefact**
- **Fix :** `reject('insert_error')` isole (code normalise, Pitfall 5) plutot que de crasher
  le run. Decision **D-04-03-C**.

## Notes pour la suite (04-04 ANALYZE)

- L'ANALYZE doit ecrire `run-artifacts/<run_id>/<instrument>_<style>.json` avec un
  payload Output §3, et resoudre/exporter `RUN_ID` (format `RUN_ID_RE`), `MODEL_LABEL`,
  `PROMPT_VERSION`.
- Le snapshot reference par `raw_indicators_ref` doit etre un payload **combine**
  (`{technical, fundamental, news}`) pour que `scoreSetup` recoive les 3 kinds.
- Cabler `persist` dans `apps/jobs/src/dispatch.ts` (JOB_REGISTRY) via `runJob`.

## Self-Check: PASSED
