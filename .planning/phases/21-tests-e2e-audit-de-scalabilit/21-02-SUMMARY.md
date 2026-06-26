---
phase: 21-tests-e2e-audit-de-scalabilit
plan: 02
subsystem: testing
tags: [playwright, e2e, dashboard, abonne, storageState, phase-19]

# Dependency graph
requires:
  - phase: 21-tests-e2e-audit-de-scalabilit
    provides: "Projet Playwright `abonne` (storageState playwright/.auth/abonne.json) + setup-project (21-01)"
  - phase: 19-dashboard-utilisateur
    provides: "Groupe (dash) : overview + 6 sous-routes (abonnement/affiliation/historique/suivis/watchlist/parametres)"
provides:
  - "Couverture E2E-01 de la home dashboard /fr/dashboard (rôle abonné)"
  - "Couverture E2E-01 des 6 sous-routes du groupe (dash), aliases inclus"
affects: [21-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Specs (dash) consommant le storageState `abonne` sans re-signUp (projet Playwright dédié)"
    - "Assertions web-first par en-tête i18n réel (getByRole heading + name), zéro waitForTimeout"

key-files:
  created:
    - apps/web/e2e/dash/overview.spec.ts
    - apps/web/e2e/dash/navigation.spec.ts
  modified: []

key-decisions:
  - "Sélecteurs = en-têtes i18n réellement rendus (messages/fr.json), jamais du texte inventé"
  - "Routes alias testées selon leur comportement RÉEL lu dans le code (watchlist→suivis, affiliation→gate affiliate→/fr)"
  - "Assertions bornées au rendu structurel/fixtures, jamais au volume seed 10k (D-05)"

patterns-established:
  - "1 sous-route ↔ 1 test déroulé (chemin littéral /fr/dashboard/<seg>), pas de boucle opaque"

requirements-completed: [E2E-01]

# Metrics
duration: ~12min
completed: 2026-06-27
---

# Phase 21 Plan 02: Couverture E2E du dashboard utilisateur (dash) Summary

**Deux specs Playwright sous le rôle `abonne` (storageState, zéro re-signUp) couvrant la home `/fr/dashboard` (overview Phase 19) et les 6 sous-routes du groupe `(dash)` — surfaces neuves jamais testées —, avec sélecteurs sur en-têtes i18n réels et comportement réel des deux routes alias.**

## Performance
- **Duration:** ~12 min
- **Completed:** 2026-06-27
- **Tasks:** 2
- **Files created:** 2

## Accomplishments
- `overview.spec.ts` : 2 tests. (1) l'abonné actif atteint `/fr/dashboard` sans redirection (`/tarifs`/`/login`) + H1 « Cockpit personnel » ; (2) les 3 sections figées D-08 (« Statut de l'abonnement », « Derniers signaux », « Raccourcis ») + état « Abonnement actif » (jamais le bloc renouvellement).
- `navigation.spec.ts` : 6 tests, un par sous-route, chemin littéral `/fr/dashboard/<seg>` présent. `abonnement`→H1 « Choisir une offre » ; `historique`→H1 « Historique » ; `suivis`→H1 « Suivis » ; `parametres`→H1 « Paramètres » + carte « Compte ».
- Routes alias couvertes selon leur comportement réel (lu dans le source) : `watchlist`→redirige vers `/fr/dashboard/suivis` (reste dans le dashboard) ; `affiliation`→alias vers `/affiliation/dashboard` gardé par `requireRole('affiliate')` → un `member` abonné est renvoyé sur `/fr`.
- Vérifications read-only PASSÉES en session : `playwright test --list --project=abonne` énumère 2 (overview) + 6 (navigation) tests sous le projet abonne ; `pnpm typecheck` exit 0.

## Task Commits
1. **Task 1: Spec vue d'ensemble /fr/dashboard (abonné)** - `f7d02ef` (test)
2. **Task 2: Spec navigation 6 sous-routes (dash)** - `1b6baec` (test)

**Plan metadata:** docs commit (this summary + STATE/ROADMAP)

## Files Created/Modified
- `apps/web/e2e/dash/overview.spec.ts` - Couverture E2E-01 de la home dashboard, rôle abonné.
- `apps/web/e2e/dash/navigation.spec.ts` - Couverture E2E-01 des 6 sous-routes (dash).

## Decisions Made
- **Comportement réel des alias plutôt que l'hypothèse du plan** : le plan supposait que `/fr/dashboard/affiliation` rendrait un en-tête « AffiliateSummaryCard ». Le code source montre que c'est un alias `redirect → /affiliation/dashboard`, lui-même gardé par `requireRole('affiliate')` ; l'abonné fixture est `member` (roles.ts) → renvoyé sur `/fr`. La spec asserte ce flux réel (redirection hors dashboard, ni 404 ni 200 silencieux). Idem `watchlist`→`suivis`.
- **Sélecteurs sur en-têtes i18n vérifiés** dans `messages/fr.json` (namespaces `dash`/`payment`) — aucun texte inventé.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Hypothèse de rendu erronée pour la route `affiliation`**
- **Found during:** Task 2
- **Issue:** Le plan (interfaces) décrivait `/fr/dashboard/affiliation` comme rendant une `AffiliateSummaryCard` conditionnelle assertable par un abonné. La page réelle est un alias `redirect({ href: '/affiliation/dashboard' })` gardé par `requireRole('affiliate')` ; un `member` (rôle de la fixture `abonne`) n'y accède pas et est renvoyé sur `/fr`. Asserter un en-tête affilié aurait produit un test rouge structurellement impossible à satisfaire.
- **Fix:** Le test asserte le comportement réel et désiré : l'abonné member est redirigé hors de `/fr/dashboard/affiliation` (alias + gate affiliate), URL finale `/fr`, jamais un 404. Le critère du plan « ni redirigée hors /fr/dashboard » est explicitement documenté comme inapplicable à cette route alias par conception.
- **Files modified:** apps/web/e2e/dash/navigation.spec.ts
- **Commit:** 1b6baec

**2. [Rule 1 - Bug] Route `watchlist` = alias de `suivis` (et non page autonome)**
- **Found during:** Task 2
- **Issue:** `WatchlistPage` est un `redirect → /dashboard/suivis` (D-19-07-B), pas une page distincte.
- **Fix:** Le test goto `/fr/dashboard/watchlist` puis asserte l'atterrissage sur `/fr/dashboard/suivis` (reste dans le dashboard) + H1 « Suivis ». Conforme au critère « ni 404 ni sortie du dashboard ».
- **Files modified:** apps/web/e2e/dash/navigation.spec.ts
- **Commit:** 1b6baec

## Issues Encountered
- **Exécution end-to-end non lancée en session (deferred runtime verification, cohérent 21-01).** Les commandes `playwright test --project=abonne <spec>` exigent les storageState `playwright/.auth/abonne.json` (gitignorés, générés par le setup-project après login réel contre le Supabase cloud partagé + fixtures seedées). Le préalable runtime de 21-01 (`pnpm --filter jobs seed:fixtures` puis `playwright test --project=setup`) n'a pas été exécuté en auto-mode (écriture sur ressource partagée). Vérification statique faite : `--list --project=abonne` (8 tests énumérés), `pnpm typecheck` exit 0.
- **Action requise (CI 21-04 ou hors auto-mode) :** après génération des `.auth/*.json`, lancer `pnpm exec playwright test --project=abonne` pour passer les 2 specs au vert end-to-end.

## Threat Flags
Aucun. Les specs lisent uniquement via la session abonné (RLS auth.uid()), n'ouvrent aucune surface réseau/auth/schéma nouvelle (T-21-05/06 conformes au threat_model du plan).

## Self-Check: PASSED
- Fichiers vérifiés présents : apps/web/e2e/dash/overview.spec.ts, apps/web/e2e/dash/navigation.spec.ts.
- Commits vérifiés présents : f7d02ef (Task 1), 1b6baec (Task 2).
- `--list --project=abonne` : 2 tests overview + 6 tests navigation ; `pnpm typecheck` exit 0.

---
*Phase: 21-tests-e2e-audit-de-scalabilit*
*Completed: 2026-06-27*
