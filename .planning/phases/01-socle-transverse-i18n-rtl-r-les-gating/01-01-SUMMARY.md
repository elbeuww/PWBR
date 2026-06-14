---
phase: 01-socle-transverse-i18n-rtl-r-les-gating
plan: 01
subsystem: database
tags: [supabase, postgres, rls, security-definer, gating, subscriptions, roles]

# Dependency graph
requires:
  - phase: v1.0 (cœur analytique P1-4)
    provides: migrations 0001-0006 (profiles, trade_setups, analyses, RLS authenticated)
provides:
  - "profiles.role (member/affiliate/superadmin, défaut member) — source de vérité du rôle hors JWT"
  - "is_superadmin() security definer search_path figé"
  - "table subscriptions RÉELLE (RLS on, aucune policy write authenticated)"
  - "has_active_subscription() security definer interrogeant subscriptions"
  - "RLS gating sur trade_setups/analyses : lecture conditionnée à un abonnement actif"
  - "database.types.ts régénéré (role + subscriptions)"
affects: [02-vitrine-publique, 03-espace-membre-signaux, 04-paiement-usdt, 07-affiliation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Helper RLS security definer language sql stable set search_path = public (miroir handle_new_user 0001)"
    - "revoke execute from public,anon + grant to authenticated sur fonctions helper"
    - "drop/recreate policies par nom EXACT pour migrer une RLS authenticated → gated"
    - "Test anon-client deny-silencieux : expect(error).toBeNull() + toHaveLength(0)"

key-files:
  created:
    - supabase/migrations/0008_profiles_role.sql
    - supabase/migrations/0009_subscriptions_gating.sql
    - packages/supabase/__tests__/gating-rls.test.ts
  modified:
    - packages/supabase/src/database.types.ts

key-decisions:
  - "D-01-01-B : colonne d'expiry = current_period_end (PAS expires_at d'ARCHITECTURE) ; helper RLS référence ce même nom"
  - "Push appliqué LIVE via MCP apply_migration (canal 0006), aucun supabase link local existant"
  - "2 WARN security-definer advisors (has_active_subscription/is_superadmin callable par authenticated) EXPECTED BY DESIGN (D-V2-05 / Pitfall 6)"

patterns-established:
  - "Pattern gating RLS : has_active_subscription() en using() sur tables de signaux ; aucune écriture front (invariant producteur-unique préservé)"
  - "Pattern test gating anon-client : non-abonné → 0 ligne, isolation cross-user via seed service_role"

requirements-completed: [ACCESS-02, ACCESS-03, ACCESS-04]

# Metrics
duration: ~10min (finalisation continuation ; Tasks 1-2 antérieures)
completed: 2026-06-14
---

# Phase 01 Plan 01: Socle gating RLS & rôles Summary

**Barrière de données RLS non contournable : profiles.role hors JWT + table subscriptions réelle + has_active_subscription() security definer conditionnant la lecture de trade_setups/analyses à un abonnement actif (prouvé par test anon-client).**

## Performance

- **Duration:** ~10 min (finalisation continuation ; Tasks 1-2 réalisées en session antérieure)
- **Completed:** 2026-06-14
- **Tasks:** 3
- **Files modified:** 4 (3 créés, 1 modifié)

## Accomplishments
- `profiles.role` (text+check member/affiliate/superadmin, défaut member) = source de vérité du rôle, jamais déduit du JWT (anti-EoP par token périmé).
- Table `subscriptions` RÉELLE (D-04, pas de stub) avec RLS active, 2 policies SELECT (les siennes + superadmin voit tout), AUCUNE policy write authenticated (activation = service_role en P4).
- Helpers `is_superadmin()` et `has_active_subscription()` security definer `search_path = public`, revoke from public,anon + grant to authenticated.
- Policies de lecture `trade_setups`/`analyses` migrées de « authentifiés » → « abonnés actifs » via drop/recreate par nom exact.
- Test d'intégration anon-client `gating-rls.test.ts` : non-abonné → 0 trade_setup, 0 analyses, isolation subscriptions cross-user (ACCESS-02/03/04).

## Task Commits

1. **Task 1: Migrations 0008 (role + is_superadmin) + 0009 (subscriptions + has_active_subscription + recreate RLS)** - `01176a0` (feat)
2. **Task 2: Test anon-client gating-rls (ACCESS-02/03/04)** - `e2aeb1f` (test)
3. **Task 3: Push live + regen database.types** - `dcb07c8` (feat)

**Checkpoint state:** `5d03946` (docs)

## Files Created/Modified
- `supabase/migrations/0008_profiles_role.sql` - Colonne profiles.role + is_superadmin() security definer
- `supabase/migrations/0009_subscriptions_gating.sql` - Table subscriptions + has_active_subscription() + drop/recreate RLS trade_setups/analyses
- `packages/supabase/__tests__/gating-rls.test.ts` - Test anon-client deny-silencieux (3 assertions toHaveLength(0))
- `packages/supabase/src/database.types.ts` - Types régénérés incluant role + subscriptions

## Decisions Made
- **Canal de push :** push appliqué sur la base LIVE via le MCP Supabase `apply_migration` (même canal que 0006), car aucun `supabase link` local n'existe. `supabase db push` non utilisable (pas de lien non-interactif). `list_migrations` confirme 0008 + 0009.
- **D-01-01-B (A6 tranché) :** colonne d'expiry = `current_period_end` (PAS `expires_at` d'ARCHITECTURE) ; `has_active_subscription()` référence ce même nom.
- **Advisors security :** 2 WARN (SECURITY DEFINER `has_active_subscription`/`is_superadmin` appelables par authenticated) EXPECTED BY DESIGN — les policies RLS les invoquent dans le contexte authenticated ; grant execute to authenticated est intentionnel (D-V2-05 / Pitfall 6). Non bloquants.

## Deviations from Plan

None - plan executed exactly as written. Le checkpoint human-action (Task 3) a été résolu par l'orchestrateur (push live via MCP), la continuation a finalisé : tests GREEN + commit types + summary.

## Issues Encountered
None. gating-rls GREEN au premier run après schéma live ; rls.test.ts non régressé par le drop/recreate.

## Test Results (evidence)
- `npx vitest run packages/supabase/__tests__/gating-rls.test.ts` → **4 passed / 4** (Duration 1.50s). GREEN.
- `npx vitest run packages/supabase/__tests__/rls.test.ts` → **6 passed / 6** (Duration 1.01s). Non régressé (drop/recreate par nom exact validé).

## User Setup Required
`.env.test` (NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY + SUPABASE_SERVICE_ROLE_KEY) déjà rempli pour exécuter les tests RLS. Push schéma déjà appliqué live (0008 + 0009). Aucune autre action.

## Next Phase Readiness
- Barrière RLS en place : Phase 03 (espace membre signaux gated) peut s'appuyer sur `has_active_subscription()` sans réimplémenter le gate au niveau données.
- `profiles.role` disponible pour le gating UX / superadmin (Phase 08).
- `subscriptions` prête à recevoir les transitions service_role en Phase 04 (paiement USDT) — aucune policy write authenticated à ajouter (invariant préservé).

## Self-Check: PASSED
- Files: supabase/migrations/0008_profiles_role.sql, 0009_subscriptions_gating.sql, packages/supabase/__tests__/gating-rls.test.ts, packages/supabase/src/database.types.ts — all FOUND.
- Commits: 01176a0, e2aeb1f, dcb07c8 — all FOUND in git log.

---
*Phase: 01-socle-transverse-i18n-rtl-r-les-gating*
*Completed: 2026-06-14*
