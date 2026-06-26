---
phase: 21-tests-e2e-audit-de-scalabilit
plan: 03
subsystem: testing
tags: [playwright, e2e, admin, cockpit, isolation, 404, storageState, superadmin]

# Dependency graph
requires:
  - phase: 21-tests-e2e-audit-de-scalabilit
    provides: "Infra E2E par rôle 21-01 (fixtures roles.ts, seed-fixtures, auth.setup, playwright.config projets anon/free/superadmin)"
  - phase: 20-dashboard-superadmin-cockpit-4-axes
    provides: "Cockpit (admin) 4 axes + actions gated (grant/suspend/payout) + pages santé/signaux read-only"
provides:
  - "Preuve E2E du cockpit superadmin Phase 20 (UAT manuel sauté → E2E = preuve, D-01)"
  - "Couverture happy-path 20-UAT items 2-11 (cockpit + 3 actions réversibles)"
  - "Isolation E2E-02 : 404 discret anon/non-superadmin sur (admin) + redirect tarifs non-abonné"
affects: [21-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Specs admin sous projet superadmin (storageState) — sélecteurs = landmarks RÉELS des composants (admin)/*"
    - "Mutations destructives ciblées fixture free + réactivation garantie (in-test + afterAll filet de sécurité)"
    - "Isolation 404 déroulée (1 route ↔ 1 test) réutilisant le pattern gating.spec.ts (response.status()===404)"

key-files:
  created:
    - apps/web/e2e/admin/cockpit.spec.ts
    - apps/web/e2e/admin/actions.spec.ts
    - apps/web/e2e/isolation/anon-admin.spec.ts
    - apps/web/e2e/isolation/free-admin.spec.ts
  modified: []

key-decisions:
  - "Assertions de RENDU/structure, jamais de volume seed (D-05) : item5/6 utilisent locator.or() (table|empty, loadMore|table) pour rester verts sans dépendre du volume ~10k"
  - "item9 payout en test.skip conditionnel si aucune commission « due » seedée — jamais de donnée fabriquée (D-05)"
  - "Détail signal (item11) exercé conditionnellement (si un signal est listé) — pas de signal seedé requis"
  - "Conformité (item10) scopée via [data-slot=card] filtré sur le H2 « Conformité » pour asserter feu rouge + read-only + 0 lien drill-down sans collision avec les autres cartes"

patterns-established:
  - "afterAll de réversibilité monté sur un contexte dédié (storageState superadmin + baseURL) — nettoyage best-effort jamais bloquant"

requirements-completed: [E2E-01, E2E-02]

# Metrics
duration: ~25min
completed: 2026-06-27
---

# Phase 21 Plan 03: Specs E2E cockpit superadmin + isolation Summary

**Conversion ~1:1 des 11 items de 20-UAT (UAT manuel sauté) en specs Playwright sous le rôle `superadmin` — cockpit 4 axes (items 2-6,10,11) + 3 actions gated réversibles (items 7,8,9) — plus l'isolation E2E-02 : 404 discret anon/non-superadmin sur toutes les routes (admin) et redirection /fr/tarifs pour le non-abonné.**

## Performance
- **Duration:** ~25 min
- **Completed:** 2026-06-27
- **Tasks:** 3
- **Files created:** 4 (0 modifiés)

## Accomplishments
- `e2e/admin/cockpit.spec.ts` (7 tests, projet superadmin) : item2 accès 200 + H1 « Cockpit superadmin » ; item3 4 axes H2 dans l'ordre verrouillé Revenus→Ops→Acquisition→Conformité (`toHaveText([...])`) + provenance « Mesuré · N = » ; item4 sidebar 4 en-têtes d'axe + liens /admin/* + item actif `aria-current="page"` ; item5 table membres + filtres statut/source/recherche + colonne « Source » présente + « Dernier paiement » absent + pagination keyset ; item6 file keyset (en-tête Membre|état vide) ; item10 Conformité feu rouge par défaut + version/date + read-only sans drill-down ; item11 santé/signaux lecture seule (0 bouton édition/création).
- `e2e/admin/actions.spec.ts` (3 tests, projet superadmin) : item7 dialog grant presets 7j/1mois/3mois + CTA « Confirmer la prolongation » → toast ; item8 suspend (motif requis, CTA désactivé tant que vide) **ciblé fixture free** puis réactivation in-test + `afterAll` de sécurité (T-21-09) ; item9 payout RPC gated → toast + anti double-paiement (bouton retiré après 1er clic), `test.skip` si aucune commission due.
- `e2e/isolation/anon-admin.spec.ts` (7 tests, projet anon) : 7 routes /admin → `toBe(404)`, jamais 403/200/redirect (T-21-07).
- `e2e/isolation/free-admin.spec.ts` (8 tests, projet free) : 7 routes /admin → 404 pour un authentifié-member + `/fr/signaux` → `toHaveURL(/\/fr\/tarifs/)` (requireActiveSub, non-abonné).

## Task Commits
1. **Task 1: Spec cockpit superadmin (UAT 2-6,10,11)** - `a771928` (test)
2. **Task 2: Spec actions superadmin réversibles (UAT 7,8,9)** - `f13b10f` (test)
3. **Task 3: Specs isolation E2E-02 (anon + non-superadmin)** - `f398920` (test)

**Plan metadata:** docs commit (this summary + STATE/ROADMAP/REQUIREMENTS)

## Decisions Made
- **Rendu, pas volume (D-05)** : item5/item6 utilisent `locator.or()` pour rester verts indépendamment du volume seed ~10k ; aucune assertion item-par-item sur des comptes de lignes.
- **Conditionnels honnêtes** : item9 (`test.skip` sans commission due) et détail signal item11 (exercé si un signal est listé) — jamais de donnée fabriquée pour faire passer un test.
- **Scoping Conformité** : `[data-slot="card"]` filtré sur le H2 « Conformité » isole la carte pour asserter feu rouge + read-only + 0 lien de drill-down sans collision avec les 3 autres cartes (qui ont « Voir le détail »).
- **Réversibilité défensive** : suspension ciblée `e2e-fixture-free` + réactivation in-test ET `afterAll` (contexte dédié storageState superadmin) — re-run idempotent (T-21-09).

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
- **Vérification live-DB / exécution Playwright différée (deferred runtime verification).** Les commandes `playwright test --project=superadmin|anon|free` exigent : (1) `webServer` build+start, (2) les storageState `playwright/.auth/<role>.json` générés par le setup-project après login réel contre le Supabase cloud PARTAGÉ + fixtures seedées (`pnpm --filter jobs seed:fixtures`). Ces préalables runtime sont explicitement différés en CI/manuel (héritage 21-01, contrainte de wave 2 hors auto-mode).
  - **Vérifications statiques PASSÉES en session :** `pnpm exec playwright test --list` pour chaque projet (superadmin = 7 tests cockpit + 3 actions ; anon = 7 ; free = 8) ; `pnpm typecheck` exit 0.
  - **Action requise (CI 21-04 ou manuel) :** lancer `seed:fixtures` + `playwright test --project=setup` puis exécuter les 3 projets pour confirmer le vert end-to-end et l'idempotence (re-run).

## Known Stubs
None - les specs ciblent des landmarks réels rendus par les composants (admin)/* (aucune donnée mock injectée, aucun placeholder).

## Self-Check: PASSED
- Fichiers vérifiés présents : cockpit.spec.ts, actions.spec.ts, anon-admin.spec.ts, free-admin.spec.ts.
- Commits vérifiés présents : a771928, f13b10f, f398920.

---
*Phase: 21-tests-e2e-audit-de-scalabilit*
*Completed: 2026-06-27*
