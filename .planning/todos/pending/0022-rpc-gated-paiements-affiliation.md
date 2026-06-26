---
id: 0022-rpc-gated-paiements-affiliation
title: "Migration 0022 — RPC SECURITY DEFINER gated paiements + affiliation, puis bascule anon-client"
created: 2026-06-26
status: pending
resolves_phase: 20.1
origin: phase-20-04
priority: high
tags: [security, rls, migration, service_role, affiliation, paiements]
---

# Migration 0022 — RPC gated paiements + affiliation (dette Option B, phase 20-04)

## Contexte / décision

Plan 20-04 a basculé les écritures **membres** (`grant_subscription_time` / `suspend_account` /
`unsuspend_account`) et **payout** (`admin_mark_commission_paid`) sur des RPC `SECURITY DEFINER`
gated appelés sur l'anon-client, supprimant `createAdminServiceClient` de ces 2 fichiers.

Les 2 fichiers de Server Actions restants **conservent `createAdminServiceClient`** (décision
phase 20 **Option B — defer**) :

- `apps/web/src/app/(admin)/file/actions.ts` — file de validation des paiements ambigus
  (`activateForPayment` / `transitionPayment` / `changePlan`).
- `apps/web/src/app/(admin)/affiliation/actions.ts` — revue des candidatures affiliées
  (`promoteAffiliate` / `createCode` / `transitionApplication`).

**Raison de la frontière de confiance :** ces actions mutent des tables **sans aucune policy
d'écriture anon** (`payments`, `affiliate_applications`, `affiliates`, `affiliate_codes`). La
migration 0021 n'a livré des RPC gated `authenticated` QUE pour membres + payout. Basculer ces
2 fichiers en anon-client AUJOURD'HUI casserait les écritures au runtime (RLS = 0 droit), et les
supprimer casserait les pages `file/page.tsx` + approbation affiliés (workflows encore actifs,
ADASH-05 / AFF-01). Construire les RPC manquants = nouvelle migration LIVE (classe 20-02) →
hors scope d'un plan d'exécution autonome.

## Travail à faire

1. **Migration 0022** (via MCP `apply_migration`, jamais `db push` — D-02) : RPC `SECURITY DEFINER`
   gated `(select is_superadmin())` + audit `admin_audit_log` atomique, `set search_path = public` :
   - Paiements : `admin_activate_payment(p_payment_id, p_user_id, p_plan, p_interval)`,
     `admin_reject_payment(p_payment_id, p_reason)`, `admin_adjust_plan(p_user_id, p_plan, p_interval)`.
   - Affiliation : `admin_approve_application(p_application_id, p_code)` (résout email→profile,
     promote + create code + transition approved, anti double-traitement `where status='pending'`),
     `admin_reject_application(p_application_id, p_reason)`, `admin_create_code(p_affiliate_id, p_code)`.
   - `revoke ... from public, anon ; grant execute ... to authenticated` (miroir 0021).
2. `generate_typescript_types` → réédition manuelle `packages/supabase/src/database.types.ts`
   (alias maison + override `*_atomic` string, projet non `link`é) → `get_advisors(security)` 0
   nouvelle fuite, `get_advisors(performance)` 0 `auth_rls_initplan`.
3. Basculer `file/actions.ts` + `affiliation/actions.ts` en `createClient()` anon + `.rpc(...)`
   gated, re-gate `requireRole('superadmin')` conservé, erreurs OPAQUES (`fail()`), `revalidatePath`.
4. **Retirer ces 2 chemins de l'allowlist** `apps/web/src/styles/__tests__/rls-unchanged.test.ts`
   (bloc `DEFERRED-0022`) et confirmer le scan vert une fois 20-06 (pages admin) terminé.

## Acceptance

- `file/actions.ts` + `affiliation/actions.ts` n'importent plus `createAdminServiceClient`.
- Scan `rls-unchanged` ne référence plus les 2 fichiers dans l'allowlist.
- `get_advisors` propre, `pnpm typecheck` vert, contrat RLS deux-rôles toujours au vert.
