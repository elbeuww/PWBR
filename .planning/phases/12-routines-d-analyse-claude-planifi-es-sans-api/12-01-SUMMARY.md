---
phase: 12-routines-d-analyse-claude-planifi-es-sans-api
plan: 01
subsystem: testing
tags: [vitest, persist, idempotence, routine-claude, static-check, d-43, wave-0]

# Dependency graph
requires:
  - phase: 04 (moteur IA vétéran & scoring)
    provides: "frontière persist.ts (D-43), readRunArtifacts (no_artifacts), expirePriorSetups (D-45)"
provides:
  - "Garde D-12-02 testée : true-empty (no_artifacts) ≠ all-rejected (throw WR-04)"
  - "Contrat d'idempotence run-level testé : expire-avant-insert + session_day stable"
  - "Static-check ROUTINE-05 automatisé : 0 MCP / 0 clé Anthropic dans apps/jobs/src"
affects: [12-02 (runbook routine), 12-03/05 (1er run réel cloud), 12-VALIDATION]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Static-check de code par scan FS récursif + strip-commentaires (hygiène grep-gate)"
    - "Test de contrat d'idempotence via invocationCallOrder (ordre expire→insert)"

key-files:
  created:
    - apps/jobs/__tests__/routine-persist-empty.test.ts
    - apps/jobs/__tests__/routine-idempotence.test.ts
    - apps/jobs/__tests__/routine-no-mcp.test.ts
  modified: []

key-decisions:
  - "D-12-01-A : la commande du plan `pnpm --filter jobs exec vitest run` est inopérante (config vitest racine, globs root-relative) → exécution via `npx vitest run apps/jobs/...` depuis la racine (précédent D-02-02-B)."
  - "D-12-01-B : Task 3 utilise `new RegExp` + `.includes()` au lieu de regex-littéraux — oxc (vitest 4 / rolldown-vite) mal-parse certains regex-littéraux (`/['\"][^'\"]*mcp.../i`) comme une division, cassant le transform. String-matching évite l'ambiguïté de lexing."
  - "D-12-01-C : le scan ROUTINE-05 EXCLUT `*.test.ts` et `*.d.ts` (les tests référencent ces tokens légitimement) ; le token `mcp` est cherché en minuscules sur le code dépouillé de commentaires."

patterns-established:
  - "Wave-0 guard : verrouiller un invariant de phase par test local (<30s) AVANT le 1er run cloud, sans toucher la frontière source."
  - "Strip-commentaires (bloc /* */, ligne //, JSDoc *) avant tout grep de token interdit."

requirements-completed: [ROUTINE-03, ROUTINE-04, ROUTINE-05]

# Metrics
duration: ~12min
completed: 2026-06-21
---

# Phase 12 Plan 01: Tests de validation Wave-0 des routines Claude Summary

**3 gardes locales verrouillent les invariants des routines Claude (sémantique marché-calme D-12-02, idempotence run-level D-45, absence de MCP/clé Anthropic ROUTINE-05) AVANT le premier run cloud — sans modifier la frontière persist.ts.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-06-21T22:37Z
- **Completed:** 2026-06-21T22:42Z
- **Tasks:** 3 / 3
- **Files modified:** 3 créés (0 source touché)

## Accomplishments

- **Task 1 — D-12-02 (marché calme).** `routine-persist-empty.test.ts` (3 cas) :
  - true-empty : `readRunArtifacts` throw `no_artifacts` AVANT toute écriture → `expirePriorSetups`/`insertAnalysis`/`insertTradeSetups` jamais appelés (source-assertion). Signal « 0 setup produit », PAS la garde WR-04.
  - all-rejected : 1 artefact R:R<1.2 → `written=0 && rejected>0` → garde WR-04 (`persist.ts:369`) throw `0 setup écrit` (préservée, non affaiblie).
  - succès non-vide : sanity `written=1, rejected=0`.
- **Task 2 — idempotence run-level (D-45).** `routine-idempotence.test.ts` (2 cas) :
  - ordre : `expirePriorSetups` invoqué strictement avant `insertTradeSetups` (via `invocationCallOrder`) ; clé à 4 champs `{instrument_id, style, session, session_day}`.
  - re-run : deux `persist()` du même artefact → même `session_day` (dérivé via `sessionDayOf` réutilisé, jamais réimplémenté) ⇒ pas de doublon au contrat.
- **Task 3 — ROUTINE-05 static-check.** `routine-no-mcp.test.ts` (6 cas) : scan récursif `apps/jobs/src`, commentaires retirés avant grep ; 0 import MCP / `@anthropic-ai/sdk` / `ANTHROPIC_API_KEY` dans le code ; sanity positive `createClient`/`@supabase/supabase-js` présents (runJob.ts, persist.ts) ; filtre-commentaires prouvé non-trivial.

## Verification

- `npx vitest run apps/jobs` → **18 fichiers / 131 tests verts**, zéro régression (persist.test.ts, runArtifacts.test.ts, sessions-config.test.ts inclus).
- `git diff --stat apps/jobs/src` → **VIDE** (frontière D-43 intacte, aucun fichier source modifié).
- Nouveaux tests : 3+2+6 = 11 cas verts en < 1 s chacun.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Commande de test du plan inopérante**
- **Found during :** Task 1 (premier run de vérification).
- **Issue :** `pnpm --filter jobs exec vitest run <fichier>` → « No test files found » (la config vitest est à la racine, ses globs `include` sont root-relative ; le filtre pnpm change le cwd vers apps/jobs).
- **Fix :** exécution via `npx vitest run apps/jobs/__tests__/<fichier>` depuis la racine (même mécanisme que tous les tests existants ; précédent D-02-02-B).
- **Files modified :** aucun (changement de commande d'exécution uniquement).

**2. [Rule 3 - Blocking] Parse error oxc sur regex-littéraux (Task 3)**
- **Found during :** Task 3 (transform vitest 4 / rolldown-vite via oxc).
- **Issue :** un regex-littéral du type `/['"][^'"]*mcp[^'"]*['"]/i` est mal-lexé par oxc comme une division non terminée → `PARSE_ERROR` cassant tout le fichier.
- **Fix :** remplacement des regex-littéraux par `new RegExp(...)` (bloc-commentaire) + `String.prototype.includes()` (tokens interdits) → suppression de l'ambiguïté de lexing.
- **Files modified :** `apps/jobs/__tests__/routine-no-mcp.test.ts` (avant commit ; le fichier source committé est la version corrigée).

## Known Stubs

Aucun. Tests purs (aucun appel réseau/Supabase ; mocks hoisted ou scan FS offline).

## Threat Flags

Aucune nouvelle surface introduite. Les 3 tests verrouillent des mitigations EXISTANTES (T-12-01 WR-04, T-12-02 anti-MCP, T-12-03 idempotence) du threat register du plan.

## Self-Check: PASSED

- FOUND: apps/jobs/__tests__/routine-persist-empty.test.ts (commit cf507cd)
- FOUND: apps/jobs/__tests__/routine-idempotence.test.ts (commit 3d90dcf)
- FOUND: apps/jobs/__tests__/routine-no-mcp.test.ts (commit 4e9073f)
- FOUND: 3 commits dans git log
- VERIFIED: `git diff --stat apps/jobs/src` vide ; suite jobs 131/131 verte.
