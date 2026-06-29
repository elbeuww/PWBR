---
phase: 20-dashboard-superadmin-cockpit-4-axes
plan: 05
subsystem: admin-cockpit-ui
tags: [admin, cockpit, anon-client, kpi, rsc, provenance, no-perf, conformite]

# Dependency graph
requires:
  - phase: 20-03
    provides: "lib/admin/kpis.ts (getMrr/getChurn/getPlanMix/getAcquisitionFunnel gated, formatMrr) + MvMrrRow/ChurnRow/PlanMixRow/AcquisitionFunnelRow"
  - phase: 20-02
    provides: "0021 LIVE : RPC KPI gated + policies superadmin (profiles/candles/telegram_posts)"
  - phase: 20-01
    provides: "scans no-perf-claims (namespace admin) + no-perf-seed-claims (ADMIN_UI_FILES) armés RED-par-conception"
  - phase: 8
    provides: "germe (admin)/page.tsx head-counts + AdminSidebar NAV_ITEMS + freshness/jobs/signals helpers"
provides:
  - "(admin)/page.tsx : cockpit anon-client 4 sections ordonnées (Revenus → Ops → Acquisition → Conformité), KPI via wrappers gated"
  - "_components/AxisSummary{Revenus,Ops,Acquisition,Conformite}.tsx : cartes d'axe KPI mesuré + provenance rendue + drill-down"
  - "AdminSidebar 4 axes (URLs détail inchangées, A5)"
  - "no-perf-seed-claims.ADMIN_UI_FILES étendu au cockpit livré (extinction scans 20-01)"
affects: [20-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Carte d'axe RSC présentationnelle : KPI MESURÉ en props + ligne de provenance « Mesuré · N = … » nombres RENDUS (jamais i18n littéral)"
    - "Taux (churn) via applyThreshold + Intl percent au runtime → zéro caractère pour-cent en dur (no-perf-claims)"
    - "Cockpit home anon-client only : agrégats Ops dégradent gracieusement sous RLS (0 ligne → feu rouge honnête, pas de zéro fabriqué)"
    - "Conformité = panneau read-only env-driven (isLegalReviewDone + version + date), feu rouge par défaut sûr"

key-files:
  created:
    - apps/web/src/app/(admin)/_components/AxisSummaryRevenus.tsx
    - apps/web/src/app/(admin)/_components/AxisSummaryOps.tsx
    - apps/web/src/app/(admin)/_components/AxisSummaryAcquisition.tsx
    - apps/web/src/app/(admin)/_components/AxisSummaryConformite.tsx
  modified:
    - apps/web/src/app/(admin)/page.tsx
    - apps/web/src/app/(admin)/_components/AdminSidebar.tsx
    - apps/web/test/no-perf-seed-claims.test.ts

key-decisions:
  - "D-20-05-A : churn rendu via applyThreshold (seuil N≥30, source @app/core) ; sous le seuil → « Échantillon insuffisant », sinon taux formaté par Intl style percent au runtime — aucun caractère pour-cent littéral dans la source (Task 1 verify ! grep %)."
  - "D-20-05-B : Conformité = panneau read-only sans drill-down (aucune route détail existante) ; version + date lues via env LEGAL_REVIEW_VERSION/LEGAL_REVIEW_DATE (« — » si absentes, jamais fabriquées)."
  - "D-20-05-C : loadOps tolère les erreurs RLS (pas de throw) ; un accès refusé renvoie 0 ligne → feu rouge honnête au lieu de casser tout le cockpit."

requirements-completed: [ADASH-01, ADASH-02, ADASH-03, ADASH-06]

# Metrics
duration: ~20min
completed: 2026-06-26
---

# Phase 20 Plan 05: Home cockpit superadmin 4 axes (anon-client) Summary

**La home `(admin)/page.tsx` devient un cockpit 4 sections ordonnées (Revenus → Ops → Acquisition → Conformité) sur anon-client, KPI lus via les wrappers gated `lib/admin/kpis.ts` ; 4 cartes d'axe honnêtes (KPI mesuré + ligne de provenance rendue + « Voir le détail »), sidebar regroupée en 4 axes (URLs inchangées), et extinction des scans no-perf — aucune lecture service_role, aucun chiffre fabriqué.**

## Performance
- **Duration:** ~20 min
- **Completed:** 2026-06-26
- **Tasks:** 3 (cartes d'axe / cockpit+sidebar / scans no-perf)
- **Files:** 4 créés, 3 modifiés

## Accomplishments
- **Task 1 — 4 cartes d'axe `AxisSummary*.tsx`** : RSC présentationnelles calquées sur le bloc Card-in-Link du germe. Chacune rend un titre d'axe (28px semibold), une valeur KPI headline en `--font-mono` tabulaire (20px), une ligne de provenance OBLIGATOIRE « Mesuré · N = {n} · {période} · source : {source} » (nombres rendus via `Intl.NumberFormat`, jamais des chaînes i18n), et un lien « Voir le détail » accent `--primary`. `Revenus` : MRR « Cash encaissé / mois » (formatAtomic), churn via `applyThreshold` (Intl percent au runtime), répartition par plan. `Ops` : feux fraîcheur/jobs tokenisés + file de validation, drill-down `/admin/sante` + `/admin/file`. `Acquisition` : agrégat funnel par étape (counts). `Conformité` : feu `isLegalReviewDone()` (green `--signal-bullish` / red `--destructive`) + version + date (D-18), read-only.
- **Task 2 — cockpit + sidebar** : `page.tsx` bascule `createAdminServiceClient` → `createClient()` anon (T-20-03) ; KPI chargés en parallèle via `getMrr/getChurn/getPlanMix/getAcquisitionFunnel` + agrégats Ops via `freshness/jobs` sur anon-client (dégradation gracieuse RLS) ; les 4 `AxisSummary` rendus dans l'ordre verrouillé D-07 (espacement « salle de contrôle » : `mt-12` header→1er bloc, `gap-8` entre axes). `AdminSidebar` regroupe les `NAV_ITEMS` existants sous 4 en-têtes d'axe (Acquisition / Revenus / Ops / Conformité), hrefs `/admin/...` INCHANGÉS (A5), `isActive` prefix-match et accent actif conservés.
- **Task 3 — extinction des scans** : `no-perf-seed-claims.ADMIN_UI_FILES` étendu aux 4 `AxisSummary*.tsx` (+ `page.tsx` déjà présent). `no-perf-claims` (namespace admin i18n) + `no-perf-seed-claims` (volet D cockpit) VERTS — la copy admin honnête (MRR « cash encaissé », churn via `applyThreshold`, 0 % littéral) éteint les gardes armées en 20-01.

## Task Commits
1. **Task 1: cartes d'axe AxisSummary** - `7ec9b44` (feat)
2. **Task 2: home cockpit anon-client + sidebar 4 axes** - `81bb835` (feat)
3. **Task 3: extension ADMIN_UI_FILES + scans verts** - `f37663e` (test)

## Files Created/Modified
- `apps/web/src/app/(admin)/_components/AxisSummaryRevenus.tsx` - MRR/churn/plan-mix + provenance + drill-down
- `apps/web/src/app/(admin)/_components/AxisSummaryOps.tsx` - feux fraîcheur/jobs + file de validation
- `apps/web/src/app/(admin)/_components/AxisSummaryAcquisition.tsx` - agrégat funnel par étape
- `apps/web/src/app/(admin)/_components/AxisSummaryConformite.tsx` - panneau read-only LEGAL_REVIEW_DONE + version + date
- `apps/web/src/app/(admin)/page.tsx` - cockpit anon-client 4 sections ordonnées
- `apps/web/src/app/(admin)/_components/AdminSidebar.tsx` - nav regroupée 4 axes (URLs inchangées)
- `apps/web/test/no-perf-seed-claims.test.ts` - ADMIN_UI_FILES étendu aux 4 cartes

## Threat Mitigations (threat_model du plan)
- **T-20-03 (Elevation, service_role résiduel)** : `page.tsx` ne référence plus `admin-service` (assertion grep ! admin-service) ; lecture 100% anon-client.
- **T-20-04 (Repudiation, chiffre fabriqué)** : KPI via wrappers mesurés + `applyThreshold` ; `no-perf-claims` + `no-perf-seed-claims` VERTS (Task 3).
- **T-20-12 (Info Disclosure, KPI hors gate)** : lecture exclusive via `lib/admin/kpis.ts` (RPC gated, 0 ligne non-superadmin) — jamais la matview directement.
- **T-20-17 (Info Disclosure, conformité « OK » à tort)** : feu piloté par `isLegalReviewDone()` (comparaison stricte env) ; rouge par défaut si non validé.

## Decisions Made
- **D-20-05-A (churn sans % littéral)** : `applyThreshold` décide la suffisance (N≥30), `Intl.NumberFormat({ style: 'percent' })` produit le symbole au runtime → la source ne contient aucun caractère pour-cent (Task 1 verify `! grep %`).
- **D-20-05-B (Conformité read-only)** : pas de drill-down (aucune route détail) ; version/date via env, « — » si absentes — jamais inventées.
- **D-20-05-C (loadOps résilient)** : pas de throw sur lecture Ops ; RLS refusée → 0 ligne → feu rouge honnête plutôt que page cassée.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Commandes de vérification adaptées au monorepo**
- **Found during:** Task 1/2/3
- **Issue:** le plan référence `pnpm --filter web typecheck` / `pnpm --filter web test` ; ces scripts n'existent pas dans `apps/web/package.json` (scripts racine uniquement : `tsc -b --noEmit`, `vitest run`).
- **Fix:** vérification via `pnpm typecheck` (racine) et `pnpm vitest run <path>` (ciblage par chemin). Identique au contournement documenté en 20-03. Aucun impact contrat.
- **Files modified:** aucun (commande seulement)

### Scope Notes (non corrigées — hors plan 20-05)
- `rls-unchanged.test.ts` reste ROUGE par conception (commentaire L.36-39 : extinction prévue au plan 20-06 après bascule des pages détail `membres/sante/signaux/affiliation`). Mon changement de `page.tsx` a RETIRÉ un offender (plus aucune référence admin-service) ; les offenders restants appartiennent à des fichiers hors scope 20-05.

## Verification Results
- `pnpm typecheck` (`tsc -b --noEmit`) → exit 0 (Task 1 et Task 2)
- Task 1 greps : `Cash encaissé` / `Mesuré` / `Voir le détail` présents (Revenus), `isLegalReviewDone` présent (Conformité), aucun `%` dans Revenus → tous OK
- Task 2 greps : `AxisSummaryRevenus` + `AxisSummaryConformite` dans page.tsx, AUCUN `admin-service`, `Acquisition` + `Conformité` dans AdminSidebar → tous OK
- Task 3 : `pnpm vitest run no-perf-claims no-perf-seed-claims` → 15/15 VERTS (extinction confirmée)

## Known Stubs
None — toutes les cartes sont câblées sur des sources réelles (RPC gated 20-03 LIVE, helpers freshness/jobs, env LEGAL_REVIEW_DONE). Pas de données mockées. Note : Conformité version/date affichent « — » si les env `LEGAL_REVIEW_VERSION/DATE` ne sont pas posées (comportement honnête voulu, pas un stub de données).

## Self-Check: PASSED
- FOUND: apps/web/src/app/(admin)/_components/AxisSummaryRevenus.tsx
- FOUND: apps/web/src/app/(admin)/_components/AxisSummaryOps.tsx
- FOUND: apps/web/src/app/(admin)/_components/AxisSummaryAcquisition.tsx
- FOUND: apps/web/src/app/(admin)/_components/AxisSummaryConformite.tsx
- FOUND commit: 7ec9b44 (Task 1)
- FOUND commit: 81bb835 (Task 2)
- FOUND commit: f37663e (Task 3)

---
*Phase: 20-dashboard-superadmin-cockpit-4-axes*
*Completed: 2026-06-26*
