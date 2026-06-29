---
phase: 21-tests-e2e-audit-de-scalabilit
plan: 04
subsystem: ci
tags: [ci, github-actions, e2e, playwright, vitest, secrets, d-09, d-11, checkpoint]

# Dependency graph
requires:
  - phase: 21-tests-e2e-audit-de-scalabilit
    provides: "infra E2E multi-rôles (21-01 webServer build&start + seed-fixtures), specs dash (21-02), specs admin+isolation (21-03)"
provides:
  - ".github/workflows/ci.yml : pipeline anti-régression durable (lint -> typecheck -> vitest -> playwright install -> seed:fixtures -> test:e2e BLOQUANT -> artefact)"
  - "Run CI vert observé sur PR #1 (elbeuww/PWBR) — preuve D-11 (définition de done : flux E2E verts à chaque PR)"
affects: [verification-phase-21, milestone-v3.0-cloture]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CI GitHub Actions : node 22 (WebSocket natif requis par @supabase/supabase-js realtime)"
    - "Secrets Supabase via secrets.* uniquement ; SUPABASE_URL (sans préfixe) mappé depuis NEXT_PUBLIC_SUPABASE_URL pour les steps serveur (vitest + webServer E2E)"
    - "seed:fixtures purge l'audit (admin_audit_log.actor_id NO ACTION) avant deleteUser — idempotence E2E contre DB cloud partagée"

key-files:
  created:
    - .github/workflows/ci.yml
  modified:
    - eslint.config.mjs
    - apps/jobs/scripts/seed-fixtures.ts
    - apps/web/src/lib/auth/gate.ts
    - apps/web/e2e/auth.spec.ts
    - apps/web/e2e/admin/cockpit.spec.ts
    - apps/web/tests/signals-rls.spec.ts

key-decisions:
  - "anon sur /admin/* -> 404 (discrétion D-09) et non redirect /login : requireRole('superadmin') fait getUser direct -> notFound() pour tout non-superadmin, anon inclus (aligné sur anon-admin.spec / gating.spec)"
  - "CI runner Node 20 -> 22 : Node 20 n'expose pas WebSocket global -> 'Node.js 20 detected without native WebSocket support' sur tout createClient (réplique le runtime local Node 24)"
  - "E2E contre DB cloud partagée : seed un affilié + code TESTCODE (precondition AFF-01) ; FK CASCADE -> nettoyage au purge du fixture"

patterns-established:
  - "Gap-closure CI : chaque rouge remonte le pipeline d'un cran (lint -> typecheck -> vitest -> build -> seed -> e2e) — diagnostiquer l'étape échouée, corriger, re-pousser"

requirements-completed: [E2E-01, E2E-02]

# Metrics
duration: ~session (checkpoint humain + 8 gap-closure)
completed: 2026-06-29
---

# Phase 21 Plan 04: Pipeline CI GitHub Actions (D-09) Summary

**Pipeline CI anti-régression durable opérationnel et VERT sur PR #1 : lint -> typecheck -> vitest -> playwright install -> seed:fixtures -> test:e2e (BLOQUANT, D-09) -> artefact playwright-report. Checkpoint humain satisfait (4 secrets posés par Borhane, run vert observé). 8 fixes de gap-closure ont été nécessaires pour passer du yml committé au run réellement vert.**

## Performance
- **Completed:** 2026-06-29
- **Tasks:** 2 (Task 1 auto : ci.yml ; Task 2 checkpoint human-action : secrets + run vert)
- **CI run vert:** 28343865126 (`quality` 3m25s, PR #1 `feat/landing-nexa-refonte → master`)

## Accomplishments
- **Task 1** — `.github/workflows/ci.yml` créé (`b3e9457`) : job `quality` ubuntu-latest, `on: { pull_request, push: [master] }`, steps checkout -> pnpm/action-setup -> setup-node -> install --frozen-lockfile -> lint -> typecheck -> vitest -> playwright install --with-deps chromium -> seed:fixtures -> test:e2e (bloquant) -> upload-artifact (if !cancelled). Secrets via `secrets.*` uniquement, aucun dump d'env.
- **Task 2** (checkpoint) — 4 secrets repo posés via `gh secret set` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `E2E_FIXTURE_PW`). Run CI complet **vert** observé ; e2e bloquant confirmé (un échec e2e marquait le check PR rouge tout au long de la gap-closure).

## Task Commits
1. **Task 1 : ci.yml** — `b3e9457` (feat 21-04)
2. **Gap-closure (8) pour run vert :**
   - `8260eca` fix(lint) : gate ESLint vert (config `^_`, globals scripts, ignore générés/fixtures, `.d.ts`)
   - `53d6777` ci : runner Node 20 -> 22 (WebSocket natif supabase-js)
   - `2048ad7` ci : `SUPABASE_URL` au step vitest (tests intégration jobs)
   - `f0c7391` ci : `SUPABASE_URL` au webServer E2E (serviceClientLocal)
   - `e448289` fix(e2e) : purge fixtures supprime l'audit avant deleteUser
   - `1dceb36` fix(admin+e2e) : anon /admin -> 404 (gate) + sélecteur membres `.first()`
   - `ff32535` fix(e2e) : assertions dashboard à jour + seed affilié TESTCODE

## Files Created/Modified
- `.github/workflows/ci.yml` — pipeline CI complet (D-09), e2e bloquant, secrets jamais en clair, artefact uploadé.
- `eslint.config.mjs` — config rendant `pnpm lint` vert (convention `^_`, globals Node scripts, ignores générés/fixtures, `.d.ts`).
- `apps/jobs/scripts/seed-fixtures.ts` — purge nettoie `admin_audit_log` du fixture avant `deleteUser` ; seed affilié + code `TESTCODE` (precondition AFF-01).
- `apps/web/src/lib/auth/gate.ts` — `requireRole('superadmin')` : anon -> `notFound()` (404 discrétion D-09) au lieu de redirect login.
- `apps/web/e2e/auth.spec.ts`, `apps/web/tests/signals-rls.spec.ts` — assertions dashboard à jour (H1 « Cockpit personnel »/H2 « Statut de l'abonnement », `/login` souple, cible signup `/paiement-bientot`).
- `apps/web/e2e/admin/cockpit.spec.ts` — sélecteur membres `loadMore.or(table).first()` (strict mode).

## Decisions Made
- **Node 22 en CI** : Node 20 (déprécié sur runners) n'a pas de `WebSocket` global -> `@supabase/supabase-js` (realtime) jette à tout `createClient`. Aligné sur le runtime local (Node 24).
- **`SUPABASE_URL` (sans préfixe) fourni aux steps serveur** : vitest (runJob/idempotency/snapshots-rls) et le webServer Playwright (serviceClientLocal : signup, server actions admin) le lisent ; mappé sur la même valeur que `NEXT_PUBLIC_SUPABASE_URL`.
- **anon /admin -> 404** : aligne le code sur le contrat de discrétion D-09 / T-04-ADMIN-ELEV documenté par les specs (ne pas révéler l'existence du back-office, même à un anon).
- **Seed TESTCODE** : l'E2E tourne contre le cloud partagé ; la precondition humaine « affiliate_codes pré-peuplé » est désormais automatisée dans seed:fixtures (FK CASCADE -> auto-nettoyage).

## Deviations from Plan
### Auto-fixed Issues
**1. [Gap-closure] yml committé ≠ run vert — 8 correctifs**
- **Found during:** Task 2 (observation du run CI).
- **Issue:** Le `ci.yml` initial passait lint/typecheck en local mais le run réel échouait successivement à chaque étage : lint (34 erreurs pré-existantes jamais enforced), vitest (Node 20 WebSocket, puis `SUPABASE_URL` manquant), seed:fixtures (purge bloquée par l'audit), test:e2e (`SUPABASE_URL` webServer, anon 404, assertions périmées, seed TESTCODE).
- **Fix:** 8 commits ciblés (voir Task Commits). Chaque rouge remontait le pipeline d'un cran jusqu'au vert complet.
- **Verification:** Run 28343865126 `quality` vert (3m25s) ; PR #1 checks tous verts.
- **Committed in:** 8260eca, 53d6777, 2048ad7, f0c7391, e448289, 1dceb36, ff32535

**Total deviations:** 1 (gap-closure CI — convergence vers run vert).
**Impact on plan:** Aucun sur le contrat. Le pipeline est opérationnel ET prouvé vert (D-11), pas seulement écrit.

## Issues Encountered
- Réseau GitHub instable par intermittence (timeouts `git push`/`gh secret set`) — contourné par retries/arrière-plan.
- Comptes signup de test (`e2e-auth-*`, `e2e-aff-*`) s'accumulent dans la DB partagée (seed ne purge que `e2e-fixture-*`) — nettoyage mineur à prévoir.

## Known Limitations / Stubs
> **PR #1 NON mergée.** Le run vert est obtenu sur la PR `feat/landing-nexa-refonte → master` (210 commits = milestone v3.0). La fusion dans `master` est une décision de clôture de milestone laissée à l'utilisateur.

## User Setup Required
4 secrets repo GitHub (posés) : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `E2E_FIXTURE_PW`.

## Next Phase Readiness
- Garde anti-régression durable (D-09) en place et verte. Milestone v3.0 entièrement construit côté plans (21/21).
- Suite : vérification de phase 21 + clôture ; puis dette planifiée (migration 0022, L-01→L-04, tech debt Phase 16).

## Self-Check: PASSED
- FOUND: .github/workflows/ci.yml
- FOUND: 21-04-SUMMARY.md
- FOUND commit: b3e9457 (ci.yml) + 8260eca..ff32535 (gap-closure)
- VERIFIED: CI run 28343865126 green (gh run view), PR #1 checks pass

---
*Phase: 21-tests-e2e-audit-de-scalabilit*
*Completed: 2026-06-29*
