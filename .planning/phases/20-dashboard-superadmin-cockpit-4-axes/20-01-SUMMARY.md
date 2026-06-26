---
phase: 20-dashboard-superadmin-cockpit-4-axes
plan: 01
subsystem: testing
tags: [zod, vitest, rls, static-analysis, search-params, keyset, supabase, security-guards]

# Dependency graph
requires:
  - phase: 17-fondation-db-scalable
    provides: matviews KPI + helpers security-definer is_superadmin()
  - phase: 19-dashboard-utilisateur
    provides: pattern searchParams safeParse champ-par-champ (lib/signals) + curseur keyset opaque
provides:
  - "Helper de filtres serveur AdminUsersParamsSchema (status/source/q/cursor) + parse/serialize anti-injection"
  - "Contrat RLS deux-rôles admin-rls.test.ts (8 RPC + admin_audit_log + 6 tables, RED until 0021)"
  - "Extension des 3 scans statiques (rls-unchanged + no-perf-claims + no-perf-seed-claims) au groupe (admin)"
affects: [20-02, 20-04, 20-05, 20-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "searchParams admin calqué sur signals : z.enum + safeParse champ-par-champ, hors-enum → undefined (T-20-02)"
    - "Scan rls-unchanged multi-base : groupe (admin) racine app/ + scan des actions.ts (pas seulement page/layout)"
    - "Volet de scan perf-UI réutilisable (FORBIDDEN_PERF_UI) appliqué au cockpit (admin)"

key-files:
  created:
    - apps/web/src/lib/admin/searchParams.ts
    - apps/web/src/lib/admin/__tests__/searchParams.test.ts
    - apps/web/test/admin-rls.test.ts
  modified:
    - apps/web/src/styles/__tests__/rls-unchanged.test.ts
    - apps/web/test/no-perf-claims.test.ts
    - apps/web/test/no-perf-seed-claims.test.ts

key-decisions:
  - "D-20-01-A : le groupe (admin) vit à la racine app/(admin)/ (PAS sous [locale]) → groupBaseDir() résout la base par groupe ; listPages étendu aux actions.ts pour couvrir les Server Actions admin (ADASH-07)."
  - "D-20-01-B : les 2 scans perf (no-perf-claims namespace admin, no-perf-seed-claims cockpit) sont GREEN dès maintenant — la surface admin héritée (Phase 8) est déjà honnête. Gardes ARMÉES pour le reskin 20-05, contrairement au RED prédit par le plan."

patterns-established:
  - "Pattern Nyquist Wave-0 : test RED = contrat exécutable figé (identifiants RPC/tables), éteint par un plan aval nommé."

requirements-completed: []  # ADASH-02/04/07 partiellement amorcés (guards) ; cochés à l'extinction des contrats (20-02/04/05/06)

# Metrics
duration: ~12min
completed: 2026-06-26
---

# Phase 20 Plan 01: Garde-fous Wave 0 du cockpit superadmin — Summary

**Helper de filtres serveur AdminUsersParamsSchema (anti-injection champ-par-champ) + contrat RLS deux-rôles figé (8 RPC nommées, RED until 0021) + 3 scans statiques étendus au groupe (admin) pour bloquer service_role et les chiffres de perf fabriqués.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-06-26T20:48:00Z
- **Completed:** 2026-06-26T20:55:00Z
- **Tasks:** 3
- **Files modified:** 6 (3 créés, 3 modifiés)

## Accomplishments
- `AdminUsersParamsSchema` + `parseAdminUsersParams`/`serializeAdminUsersParams` : whitelist Zod (status/source) + q/cursor opaque, safeParse champ-par-champ → hors-enum devient `undefined` sans throw, jamais propagé à la requête (T-20-02). Test unitaire 9/9 GREEN.
- `admin-rls.test.ts` (161 lignes) : contrat d'intégration anon-client deux-rôles qui fige les identifiants exacts — KPI `get_mrr`/`get_acquisition_funnel`/`get_churn`/`get_plan_mix` (→ 0 ligne sans throw), écriture `grant_subscription_time`/`suspend_account`/`unsuspend_account`/`admin_mark_commission_paid` (→ `forbidden`) + `admin_audit_log`, et 0 ligne cross-tenant sur 6 tables admin. RED par conception, éteint en 20-02 (migration 0021).
- 3 scans statiques étendus au groupe `(admin)` : `rls-unchanged` (RED, 13 fichiers service_role hérités à purger en 20-04/20-06), `no-perf-claims` (namespace `admin`) et `no-perf-seed-claims` (volet D cockpit) en gardes armées.

## Task Commits

1. **Task 1: Helper AdminUsersParamsSchema + test unitaire** - `e8e8349` (feat, TDD RED→GREEN dans un commit atomique)
2. **Task 2: Contrat RLS deux-rôles admin-rls.test.ts** - `08bad19` (test, RED until 0021)
3. **Task 3: Extension des 3 scans statiques au groupe (admin)** - `97498b6` (test)

**Plan metadata:** _(commit final ci-dessous)_

## Files Created/Modified
- `apps/web/src/lib/admin/searchParams.ts` — schéma Zod + parse/serialize des filtres table users admin (anti-injection champ-par-champ).
- `apps/web/src/lib/admin/__tests__/searchParams.test.ts` — round-trip + rejet hors-enum (9 tests GREEN).
- `apps/web/test/admin-rls.test.ts` — contrat RLS deux-rôles, 8 RPC + 6 tables figés (RED until 0021).
- `apps/web/src/styles/__tests__/rls-unchanged.test.ts` — `(admin)` ajouté à `SCANNED_GROUPS` (base racine + scan actions.ts).
- `apps/web/test/no-perf-claims.test.ts` — `'admin'` ajouté à `SCANNED_NAMESPACES`.
- `apps/web/test/no-perf-seed-claims.test.ts` — volet D `ADMIN_UI_FILES` + détecteur perf-UI sur `(admin)/page.tsx`.

## Decisions Made
- **D-20-01-A** : le groupe `(admin)` est un groupe de route RACINE (`app/(admin)/`, sans préfixe locale), contrairement aux groupes membre/account/marketing/auth sous `app/[locale]/`. Le scan `rls-unchanged` résout désormais la base par groupe (`groupBaseDir`) et son `listPages` couvre aussi les `actions.ts` — car le cockpit mute via Server Actions, que ADASH-07 veut scanner au même titre que les pages. L'invariant non-admin reste vert ((auth)/actions.ts allowlisté, aucun autre actions.ts dans les groupes scannés).
- **D-20-01-B** : voir Déviations.

## Deviations from Plan

### État GREEN-vs-RED-prédit des 2 scans perf (non un bug — observation honnête)

**1. [Observation] Les 2 scans perf étendus sont GREEN, pas RED comme prédit par le plan**
- **Found during:** Task 3 (extension des scans)
- **Issue:** Le plan annonçait `no-perf-claims` et `no-perf-seed-claims` « RED par conception » jusqu'au reskin honnête du cockpit (20-05). À la mesure, le namespace i18n `admin` (0 hit) et `(admin)/page.tsx` (0 hit) sont DÉJÀ honnêtes : la surface superadmin héritée de Phase 8 ne contient aucun `%` littéral ni signature de faux dashboard (equity/PnL/ROI/+N%).
- **Fix:** Aucune fabrication de RED artificiel (anti vacuous-test). Les deux scans sont étendus honnêtement et restent des GARDES ARMÉES : elles échoueront dès que le reskin 20-05 introduirait un chiffre de perf fabriqué. Le must_have truth (« scan échoue SI la copy admin contient un % ») est satisfait au plan comportemental (tests planted/non-trivial verts).
- **Files modified:** apps/web/test/no-perf-claims.test.ts, apps/web/test/no-perf-seed-claims.test.ts
- **Verification:** Les 2 fichiers passent (17 tests), `rls-unchanged` est le seul RED (13 offenders = uniquement `(admin)`).
- **Committed in:** `97498b6` (Task 3)

---

**Total deviations:** 1 observation documentée (aucun auto-fix de bug, aucune fonctionnalité critique manquante détectée).
**Impact on plan:** Nul sur le périmètre. Seul `rls-unchanged` est RED (attendu) ; les 2 gardes perf sont armées et précises. Aucune dépendance ajoutée (D-14 zéro nouvelle dépendance respecté).

## Issues Encountered
- Le script `pnpm --filter web typecheck` annoncé dans `<verification>` n'existe pas (web n'a pas de script typecheck). Contourné via le typecheck workspace racine `tsc -b --noEmit` → exit 0 (helper typé, aucune régression).

## TDD Gate Compliance
- Task 1 (tdd="true") : cycle RED→GREEN vérifié manuellement (run RED « Cannot find module ../searchParams » → impl → 9/9 GREEN), commité atomiquement en un seul `feat` (mode séquentiel : un commit par tâche). Pas de commit `test` séparé pour cette tâche — RED prouvé avant écriture de l'implémentation.

## States of Wave-0 contracts (pour le verifier / plans aval)
| Test | État | Éteint par |
|------|------|-----------|
| `lib/admin/__tests__/searchParams.test.ts` | GREEN (9/9) | — (livrable) |
| `test/admin-rls.test.ts` | RED (RPC/tables absents) | 20-02 (migration 0021) |
| `styles/__tests__/rls-unchanged.test.ts` | RED (13 fichiers service_role) | 20-04 (actions) + 20-06 (pages) |
| `test/no-perf-claims.test.ts` (ns admin) | GREEN (garde armée) | reste vert si copy honnête (20-05) |
| `test/no-perf-seed-claims.test.ts` (volet D) | GREEN (garde armée) | reste vert si cockpit honnête (20-05) |

## User Setup Required
None - aucune configuration de service externe requise.

## Next Phase Readiness
- Cibles exécutables posées pour toute la Wave 1+ : 20-02 (migration 0021) éteint `admin-rls.test.ts` ; 20-04/20-06 (retrait service_role) éteignent `rls-unchanged` ; 20-05 (cockpit honnête) garde vertes les 2 scans perf.
- `AdminUsersParamsSchema` prêt à être branché sur la requête keyset de la table users (plan d'implémentation aval) avec `sanitizeCursor` côté requête.

---
*Phase: 20-dashboard-superadmin-cockpit-4-axes*
*Completed: 2026-06-26*

## Self-Check: PASSED
- 4 fichiers vérifiés présents (3 livrables + SUMMARY)
- 3 commits de tâche vérifiés (e8e8349, 08bad19, 97498b6)
