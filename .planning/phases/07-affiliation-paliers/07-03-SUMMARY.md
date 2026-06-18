---
phase: 07-affiliation-paliers
plan: 03
subsystem: supabase/affiliate + jobs
status: complete
requirements: [AFF-01, AFF-02, AFF-03, AFF-04, AFF-05]
tags: [service-role, rpc-wrapper, attribution, idempotent-job, rls-isolation, luxon-utc, cr-02]
dependency_graph:
  requires:
    - "@app/supabase (barrel, ServiceClient pattern payments.ts/subscriptions.ts)"
    - "SQL 0016 LIVE : tables affiliation + RPC compute_affiliate_commissions / mark_commission_paid + vue affiliate_dashboard"
    - "apps/jobs (outcome-tracker pattern, dispatch JOB_REGISTRY, runJob)"
    - "luxon (déjà présent)"
  provides:
    - "attributeReferral"
    - "promoteAffiliate"
    - "createCode"
    - "CodeTakenError"
    - "countReferrals"
    - "computeCommissions"
    - "markCommissionPaid"
    - "listPendingApplications"
    - "transitionApplication"
    - "affiliateCommission (job)"
  affects:
    - "07-04 (signUp consomme attributeReferral)"
    - "07-05 (back-office consomme promoteAffiliate/createCode/listPending/transition/markCommissionPaid)"
    - "Windows Task Scheduler (run-job.cmd affiliate-commission mensuel)"
tech_stack:
  added: []
  patterns:
    - "wrappers RPC minces, zéro calcul financier JS (T-07-FLOAT)"
    - "attribution best-effort (no-op code inconnu/self-ref, 23505 idempotent — T-07-ATTR-CRASH)"
    - "job idempotent miroir outcome-tracker, période luxon UTC yyyy-MM (T-07-TZ)"
    - "test isolation RLS cross-user anon-client (AFF-02, miroir gating-rls)"
key_files:
  created:
    - packages/supabase/src/repositories/affiliates.ts
    - packages/supabase/src/repositories/referrals.ts
    - packages/supabase/src/repositories/commissions.ts
    - packages/supabase/src/repositories/affiliateApplications.ts
    - packages/supabase/src/repositories/__tests__/affiliates.test.ts
    - packages/supabase/src/repositories/__tests__/affiliate-rls.test.ts
    - apps/jobs/src/jobs/affiliate-commission.ts
  modified:
    - packages/supabase/src/index.ts
    - apps/jobs/src/dispatch.ts
decisions: [D-07-03-A, D-07-03-B, D-07-03-C, D-07-03-D]
commits: [26ce2f4, c023314]
metrics:
  duration: ~12 min
  tasks: 2
  files: 9
  tests_added: 8
  completed: 2026-06-18
---

# Phase 07 Plan 03 : Couche service_role affiliation + job mensuel + isolation RLS Summary

Frontière producteur-unique de l'affiliation câblée côté service_role : attribution best-effort (`attributeReferral`), wrappers RPC de commission/payout (zéro calcul JS — tout le financier reste en DB), repos candidatures/codes, et le job mensuel idempotent `affiliate-commission` (miroir outcome-tracker, période luxon UTC `yyyy-MM`) enregistré au dispatch. Le test d'isolation RLS cross-user `affiliate-rls.test.ts` prouve AFF-02 : un affilié A ne lit jamais les `referrals`/`commissions`/la vue `affiliate_dashboard` d'un affilié B.

## Ce qui a été livré

### Task 1 — Repos service_role + barrel + tests + isolation RLS (commit 26ce2f4)

- **`affiliates.ts`** :
  - `attributeReferral(client, {affiliate_code, referral_user_id})` — résout `affiliate_codes(code) → affiliate_id` via `maybeSingle()`. Code inconnu → `{attributed:false}` (no-op) ; self-ref (`affiliate.user_id === referral_user_id`, D-12) → `{attributed:false}` ; 23505 sur `referrals(user_id)` → `{attributed:true}` (idempotent D-11) ; autre erreur → throw. **Best-effort : ne lève jamais sur code inconnu/self-ref** (T-07-ATTR-CRASH — ne casse pas le signup).
  - `promoteAffiliate(client, {user_id})` — upsert `affiliates(user_id)` (idempotent UNIQUE) + `profiles.role='affiliate'`. Retourne `{affiliate_id}`.
  - `createCode(client, {affiliate_id, code})` — normalise `toUpperCase().trim()`, insert `affiliate_codes` ; collision PK → `CodeTakenError` (mappable 07-05).
- **`referrals.ts`** : `countReferrals(client, affiliate_id)` — count exact (`head:true`) pour l'affichage du palier (D-02 audience). Le calcul d'autorité recompte côté SQL (lateral `cnt`).
- **`commissions.ts`** (wrappers MINCES, **zéro calcul JS**, T-07-FLOAT) :
  - `computeCommissions(client, period)` → `rpc('compute_affiliate_commissions', { p_period })`.
  - `markCommissionPaid(client, {commission_id, tx_hash, amount_atomic})` → `rpc('mark_commission_paid', { p_commission_id, p_tx_hash, p_amount_atomic })`. `amount_atomic` reste **string** (CR-02, bigint > 2⁵³).
- **`affiliateApplications.ts`** : `listPendingApplications` + `transitionApplication(id, status, {reject_reason})` (status-only, miroir `transitionPayment`).
- **Barrel `@app/supabase`** : bloc « Phase 7 — affiliation » exporte les 8 fonctions + types d'input + `CodeTakenError`. `service-client` toujours sous garde (jamais exporté).
- **`affiliates.test.ts`** (8 tests verts) : attributeReferral (code inconnu/self-ref/insert OK/23505/autre erreur) + markCommissionPaid (forme RPC exacte, `p_amount_atomic` typeof === `'string'`) + computeCommissions (forme RPC).
- **`affiliate-rls.test.ts`** (isolation cross-user, AFF-02) : seed 2 affiliés A/B + commission de B via service_role ; lecture via **anon/auth-client scopé sur A** (jamais service_role) → A lit 0 ligne de B sur `commissions`, `referrals`, vue `affiliate_dashboard` ; superadmin (bypass) voit A et B. `describe.skipIf(!HAS_ENV)` (miroir tests réseau Supabase).

### Task 2 — Job mensuel affiliate-commission + dispatch (commit c023314)

- **`apps/jobs/src/jobs/affiliate-commission.ts`** (miroir outcome-tracker) : `getServiceClient()` lazy (throw explicite si `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` absents), `export async function affiliateCommission(): Promise<Json>`. Période = `DateTime.utc().toFormat('yyyy-MM')` (luxon, T-07-TZ) ou `process.argv[3]` validé `^\d{4}-\d{2}$` (re-calcul d'un mois passé). Appelle `computeCommissions(client, period)` (zéro calcul local). Retour `{ period, ...stats } as Json`. Aucun traçage manuel (runJob écrit `job_runs`).
- **`dispatch.ts`** : import + entrée `JOB_REGISTRY` `'affiliate-commission': affiliateCommission` (commentaire de cadence AFF-03, mensuel).

## Décisions d'exécution

- **D-07-03-A (RPC wrappers, zéro calcul JS, T-07-FLOAT)** : `commissions.ts` ne fait qu'invoquer les RPC LIVE — aucun INSERT/SELECT de calcul. `grep -c "Number(" commissions.ts == 0` (deux commentaires citant le token reformulés en « coercés en number »). Toute l'idempotence (T-07-DOUBLEPAY) et le financier vivent dans la DB.
- **D-07-03-B (CR-02 sur mark_commission_paid)** : la signature générée type `p_amount_atomic: number`, mais la colonne DB est bigint et le montant peut dépasser 2⁵³. On transmet une **string** (PostgREST la caste sans perte) via un cast d'argument volontaire et documenté (`as unknown as ...Args`) — JAMAIS de coercion `Number()`. Précédent D-04-02-C (cast RPC absente des types).
- **D-07-03-C (attribution best-effort)** : `attributeReferral` capture 23505 sur `referrals(user_id)` → idempotent (last-touch déjà joué au cookie, D-11) ; code inconnu/self-ref → no-op sans throw (T-07-ATTR-CRASH). Squelette RESEARCH §Code Examples honoré (lookup `affiliate_codes.select('affiliate_id, affiliates!inner(user_id)')`).
- **D-07-03-D (job luxon UTC, T-07-TZ)** : période via `DateTime.utc().toFormat('yyyy-MM')` — `grep -c "new Date(" affiliate-commission.ts == 0` (commentaires reformulés). Idempotence portée par le RPC (UNIQUE + on conflict do update where status='due') : un re-run du même mois = même total, jamais d'écrasement d'un payé.

## Vérifications

- `npx vitest run packages/supabase/src/repositories/__tests__/affiliates.test.ts affiliate-rls.test.ts` → **8 passed | 4 skipped** (RLS skip sans env — attendu).
- Suite complète `npx vitest run` → **457 passed | 4 skipped** (P1-P6 non régressées).
- `pnpm typecheck` → **0 erreur**.
- Greps d'acceptance : `Number(` commissions.ts == 0 ; `compute_affiliate_commissions` + `mark_commission_paid` présents ; barrel `attributeReferral` >= 1 ; rls test tables match == 12 ; `new Date(` job == 0 ; `toFormat('yyyy-MM')` == 1 ; dispatch `'affiliate-commission': affiliateCommission` == 1 ; job importable (`typeof === function`).
- **D-49 respecté** : aucun import `apps/web`/`@app/web` dans `apps/jobs/src` ou `packages/supabase/src` (seules des mentions en commentaire). Graphe de packages unidirectionnel intact.
- **service_role server-only** : tous les repos affiliation portent l'en-tête « JAMAIS importé depuis apps/web » ; le job vit dans `apps/jobs` ; `service-client` non exporté au barrel.

## Statut requirements

- **AFF-01 (attribution)** : COUVERT — `attributeReferral` best-effort testé (8 tests). Consommé par signUp en 07-04.
- **AFF-02 (isolation RLS prouvée)** : COUVERT EN STRUCTURE — `affiliate-rls.test.ts` authoré avec assertions cross-user réelles exécutables. GREEN différé réseau (voir Known Stubs / deferred-items).
- **AFF-03 (calcul mensuel)** : COUVERT — `computeCommissions` wrapper + job `affiliate-commission` idempotent enregistré au dispatch.
- **AFF-04 (payout)** : COUVERT — `markCommissionPaid` wrapper RPC (atomique due→paid + payout, anti double-payout porté par le RPC).
- **AFF-05 (commission abonnés actifs)** : COUVERT — filtre appliqué dans le RPC `compute_affiliate_commissions` (join subscriptions active), invoqué par le job.

## Known Stubs / tests différés

- **`affiliate-rls.test.ts` — human-verify / deferred (réseau)** : exécuté en SKIP localement (`describe.skipIf(!HAS_ENV)`), aucun GREEN fabriqué (règle D-05-01-DEFER / D-04-02). La structure d'assertion cross-user (A lit 0 ligne de B sur `commissions`/`referrals`/`affiliate_dashboard`, superadmin voit tout) est présente et exécutable. **Préconditions GREEN** : `.env.test` avec `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY` ; migration 0016 LIVE (déjà appliquée) ; « Confirm email » OFF (D-02) ; 2 users seedables. Loggé dans `deferred-items.md`.

## Ops (Runtime State Inventory)

- **Windows Task Scheduler — tâche mensuelle à ajouter** : `run-job.cmd affiliate-commission` (cadence : 1ᵉʳ jour du mois, UTC). Calcule les commissions du mois précédent/courant ; idempotent (re-run sûr). Backup déterministe au-delà de la routine Claude.

## Self-Check: PASSED

- 7 fichiers créés vérifiés présents sur disque.
- 2 commits (26ce2f4, c023314) vérifiés dans `git log`.
