---
phase: 20-dashboard-superadmin-cockpit-4-axes
plan: 02
subsystem: database
tags: [supabase, postgres, rls, security-definer, audit-log, kpi, migration, types]

# Dependency graph
requires:
  - phase: 20-01
    provides: "contrat RLS deux-rôles admin-rls.test.ts (RED until 0021) + AdminUsersParamsSchema"
  - phase: 17
    provides: "0017 wrap InitPlan (select …), index keyset profiles, get_mrr/mv_mrr (calque wrapper KPI gated)"
  - phase: 16
    provides: "0016 mark_commission_paid (calque RPC atomique anti double-payout)"
provides:
  - "Migration 0021_admin_cockpit LIVE : 5 policies SELECT superadmin, admin_audit_log, profiles.suspended + has_active_subscription() étendu, 4 RPC écriture gated+audit, 3 wrappers KPI gated"
  - "database.types.ts aligné sur 0021 (admin_audit_log, profiles.suspended*, 7 nouveaux RPC) + alias maison"
  - "admin-rls.test.ts (20-01) au VERT contre la DB live"
affects: [20-03, 20-04, 20-05, 20-06, 21-audit-scalabilite]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RPC écriture SECURITY DEFINER : garde is_superadmin() en tête + insert admin_audit_log atomique + revoke public,anon / grant authenticated"
    - "Wrapper KPI gated SQL stable : where (select public.is_superadmin()) → 0 ligne (jamais throw) pour non-superadmin"
    - "Suspension = barrière RLS unique via has_active_subscription() étendu (and not suspended)"

key-files:
  created:
    - supabase/migrations/0021_admin_cockpit.sql
  modified:
    - packages/supabase/src/database.types.ts
    - apps/web/test/admin-rls.test.ts

key-decisions:
  - "D-10 confirmé : les 3 KPI (funnel/churn/mix) gardés à-la-volée — EXPLAIN sain sur seed, pas de bascule matview"
  - "Test RLS : clés d'args alignées target_* → p_user_id/p_commission_id (préfixe p_ autoritatif)"

patterns-established:
  - "admin_audit_log : écriture exclusivement via RPC SECURITY DEFINER, aucune policy insert/update/delete (miroir 0016)"
  - "Override types maison réappliqué après gen types (projet non link, hand-edit)"

requirements-completed: [ADASH-01, ADASH-02, ADASH-03, ADASH-04, ADASH-05, ADASH-07]

# Metrics
duration: ~25min
completed: 2026-06-26
---

# Phase 20 Plan 02: Migration 0021 Cockpit Superadmin Summary

**Migration 0021 LIVE (apply_migration) : RLS « superadmin voit tout », admin_audit_log, suspension comme barrière RLS, 4 RPC écriture gated+audit atomique et 3 wrappers KPI gated — types alignés et contrat RLS deux-rôles au vert.**

## Performance

- **Duration:** ~25 min (Task 2 file-level finalization ; Task 1 + LIVE apply faits en amont)
- **Completed:** 2026-06-26
- **Tasks:** 2 (Task 1 migration ; Task 2 apply LIVE + types + test + gates)
- **Files modified:** 3

## Accomplishments
- **0021 appliquée LIVE via `apply_migration`** (jamais `db push`, D-02) → `{"success":true}`, version 20260626…. Objets vérifiés en DB : `admin_audit_log` présent, `profiles.suspended` présent, 7 nouvelles fonctions, 14 policies « superadmin voit tout ».
- **5 couches** : (A) policies SELECT superadmin `using ((select public.is_superadmin()))` sur profiles/telegram_posts/candles/trade_setups/analyses ; (B) table `admin_audit_log` (SELECT gated, aucune policy d'écriture) ; (C) `profiles.suspended/suspended_at/suspended_reason` + `has_active_subscription()` drop/recreate étendu `and not suspended` ; (D) 4 RPC écriture gated+audit atomique ; (E) 3 wrappers KPI gated.
- **Types alignés** : `database.types.ts` reçoit `admin_audit_log` (Row/Insert/Update + FK→profiles), `profiles.suspended*` (Row/Insert/Update), 7 signatures RPC, plus alias maison (`AdminAuditLogRow/Insert`, `AdminAuditAction`, `AcquisitionFunnelRow`, `ChurnRow`, `PlanMixRow`). Conventions préservées : `Args: never` no-arg, override `*_atomic` string intacts.
- **Gates verts** : `admin-rls.test.ts` 5/5 GREEN contre la DB live ; `tsc -b --noEmit` exit 0.

## Task Commits

1. **Task 1: Écrire 0021_admin_cockpit.sql (5 couches)** - `aca2ff8` (feat) — fait en amont
2. **Task 2: types + test alignés sur 0021 live** - `0000813` (feat)

**Plan metadata:** `<docs-hash>` (docs: complete plan)

## Files Created/Modified
- `supabase/migrations/0021_admin_cockpit.sql` - 5 couches RLS/audit/suspension/RPC/KPI (Task 1, LIVE)
- `packages/supabase/src/database.types.ts` - admin_audit_log + profiles.suspended* + 7 RPC + alias maison
- `apps/web/test/admin-rls.test.ts` - clés d'args RPC alignées target_* → p_user_id/p_commission_id (+p_reason/p_interval/p_tx_hash/p_amount_atomic)

## Gate Results (LIVE, via orchestrateur MCP)

- **get_advisors(security)** : aucune NOUVELLE fuite réelle. L'ERROR `security_definer_view` porte sur `pattern_stats` (préexistant, 0014 — pas nous). Les WARN `authenticated_security_definer_function_executable` sur nos 4 RPC écriture + 3 wrappers KPI = MÊME pattern accepté que le `get_mrr` préexistant (0017) : grant EXECUTE à `authenticated` + garde interne `is_superadmin()`. `auth_leaked_password_protection` = config auth préexistante.
- **get_advisors(performance)** : **0 `auth_rls_initplan`** (check requis PASSÉ — le wrap `(select public.is_superadmin())` a tenu). Nouvelles advisories non bloquantes : `multiple_permissive_policies` (overlay superadmin, même pattern que 0017) et 1 INFO `unindexed_foreign_keys` sur `admin_audit_log.actor_id` (table write-only-via-RPC à faible volume — index différé, non requis par le plan).
- **EXPLAIN** : keyset `profiles order by created_at desc, id desc limit 20` = **Index Scan** (`profiles_keyset_idx`, 0.13 ms). `get_acquisition_funnel()` = 6.6 ms, aucun plan pathologique. Seed = 1028 profils / 1 subscription / 0 payment.
- **DÉCISION D-10** : les 3 KPI restent **à-la-volée** (agrégats triviaux à cette échelle) — aucune bascule matview nécessaire.

## Decisions Made
- **D-20-02-A (KPI à-la-volée)** : D-10 confirmé par EXPLAIN — funnel/churn/mix gardés en agrégat direct (wrappers SQL stable gated), pas de matview. Réévaluable à l'échelle réelle en Phase 21.
- **D-20-02-B (alias KPI)** : exposition des lignes KPI via `Functions[...]['Returns'][number]` plutôt que des interfaces dupliquées — source de vérité unique = types générés.

## Deviations from Plan

### Auto-fixed Issues (honnêteté Task 1 — migration)

**1. [Rule 1 - Bug] `has_active_subscription()` recréé en CREATE OR REPLACE**
- **Found during:** Task 1 (Layer C)
- **Issue:** un DROP du helper casse les policies dépendantes (trade_setups/analyses l'utilisent dans `using`).
- **Fix:** `create or replace function` (re-wrap InitPlan préservé) au lieu de drop/recreate, en ajoutant `and not exists (… p.suspended)`.
- **Files modified:** supabase/migrations/0021_admin_cockpit.sql
- **Committed in:** `aca2ff8`

**2. [Rule 3 - Blocking] Args DEFAULT sur les wrappers KPI**
- **Found during:** Task 1 (Layer E)
- **Issue:** PostgREST appelle `get_acquisition_funnel`/`get_churn` sans args en rôle member (test KPI) — sans valeurs par défaut, PGRST202.
- **Fix:** `p_from date default null`, `p_to date default null`, `p_month date default null` → l'appel sans arg matche et renvoie 0 ligne (gated). Reflété en types (`p_from?`, `p_month?`).
- **Files modified:** supabase/migrations/0021_admin_cockpit.sql, packages/supabase/src/database.types.ts
- **Committed in:** `aca2ff8`

**3. [Rule 1 - Bug] `get_churn` : garde is_superadmin() en sous-requête externe**
- **Found during:** Task 1 (Layer E)
- **Issue:** `get_churn` agrège deux comptes corrélés ; un `where (select is_superadmin())` interne sur une seule CTE laissait fuir l'autre agrégat.
- **Fix:** garde portée sur la sous-requête externe (le SELECT final) → 0 ligne globale pour non-superadmin, jamais throw (calque get_mrr).
- **Files modified:** supabase/migrations/0021_admin_cockpit.sql
- **Committed in:** `aca2ff8`

**4. [USER DECISION - Test alignment] Clés d'args RPC target_* → p_***
- **Found during:** Task 2
- **Issue:** le test figé 20-01 appelait les RPC écriture avec `{ target_user_id }` ; les signatures réelles (autoritatives) sont `p_user_id`/`p_commission_id` → PGRST202 (signature introuvable) avant d'atteindre la garde `forbidden`.
- **Fix:** map d'args par signature RPC (`p_user_id`+`p_interval`, `p_user_id`+`p_reason`, `p_user_id`, `p_commission_id`+`p_tx_hash`+`p_amount_atomic`) ; chaque appel atteint désormais la garde et lève `forbidden` (assert `toMatch(/forbidden/i)`). Logique du contrat inchangée.
- **Files modified:** apps/web/test/admin-rls.test.ts
- **Committed in:** `0000813`

---

**Total deviations:** 3 auto-fixed (Task 1, déjà committés) + 1 alignement test sur décision utilisateur.
**Impact on plan:** Toutes nécessaires à la correction/sécurité ; aucun scope creep. Contrat RLS deux-rôles désormais exécutable au vert.

## Issues Encountered
- `.env.test` (racine) n'a que URL + ANON_KEY (pas de SERVICE_ROLE_KEY) : le test ne promeut pas le superadmin et ne nettoie pas les comptes seedés, mais les 4 assertions de contrat (member 0 ligne, KPI 0 ligne, écriture forbidden, suspendu 0 ligne) passent sans service_role car elles ne dépendent que du rôle member. 5/5 GREEN.

## User Setup Required
None - aucune configuration de service externe requise.

## Next Phase Readiness
- Fondation données/sécurité du cockpit LIVE : 20-03+ (pages superadmin anon-client) peuvent lire en s'appuyant sur la RLS « superadmin voit tout » et appeler les RPC gated.
- KPI à-la-volée : surveiller à l'échelle réelle (Phase 21 audit) — bascule matview documentée si EXPLAIN dégrade.

## Self-Check: PASSED

- FOUND: 20-02-SUMMARY.md
- FOUND: supabase/migrations/0021_admin_cockpit.sql
- FOUND commit: `aca2ff8` (Task 1 migration)
- FOUND commit: `0000813` (Task 2 types + test)

---
*Phase: 20-dashboard-superadmin-cockpit-4-axes*
*Completed: 2026-06-26*
