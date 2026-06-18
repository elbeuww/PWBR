# Phase 7 : Affiliation à paliers — Pattern Map

**Mapped:** 2026-06-18
**Files analyzed:** 18 (créés/modifiés)
**Analogs found:** 18 / 18 (100 % — zéro fichier sans analog ; phase = recombinaison)

> Phase 7 n'introduit **aucune techno nouvelle**. Chaque fichier copie un analog réel et golden-testé du dépôt. Le risque n'est pas technique mais de **fidélité au pattern** (noms de policy, `revoke execute`, `search_path = public` figé, override string `*_atomic`, ré-application des alias post `generate_typescript_types`). Toutes les lignes citées ci-dessous sont vérifiées sur disque.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|-------------------|------|-----------|----------------|-------|
| `supabase/migrations/0016_affiliation.sql` | migration | CRUD + transform | `supabase/migrations/0012_payments.sql` (+ 0009, 0008, 0015) | exact |
| `packages/supabase/src/database.types.ts` *(édité main)* | model/types | — | mêmes fichier, bloc override `*_atomic` L.313-349 + alias L.814-864 | exact |
| `packages/supabase/src/repositories/affiliates.ts` | repository | CRUD | `repositories/payments.ts` | exact |
| `packages/supabase/src/repositories/affiliateApplications.ts` | repository | CRUD | `repositories/payments.ts` (transition) + `(admin)/file` lecture | role-match |
| `packages/supabase/src/repositories/commissions.ts` | repository | CRUD + RPC | `repositories/subscriptions.ts` (`activateForPayment` RPC wrapper) | exact |
| `packages/supabase/src/repositories/referrals.ts` | repository | CRUD | `repositories/payments.ts` (`getByHash` lookup) | role-match |
| `packages/supabase/src/index.ts` *(barrel, modifié)* | config | — | mêmes fichier L.110-115 (exports payments/subscriptions) | exact |
| `apps/web/src/lib/affiliate/captureRef.ts` | utility (middleware helper) | request-response | `apps/web/src/lib/supabase/middleware.ts` (mute la même response) | role-match |
| `apps/web/src/middleware.ts` *(modifié)* | middleware | request-response | mêmes fichier L.24-31 (composition locale→session) | exact |
| `apps/web/src/app/[locale]/(auth)/actions.ts` *(modifié — signUp)* | route (server action) | event-driven | mêmes fichier `signUp` L.33-54 | exact |
| `apps/web/src/lib/supabase/admin-service.ts` *(réutilisé tel quel)* | config | — | mêmes fichier (service_role local web) | exact |
| `apps/jobs/src/jobs/affiliate-commission.ts` | job | batch (idempotent) | `apps/jobs/src/jobs/outcome-tracker.ts` | exact |
| `apps/jobs/src/dispatch.ts` *(modifié — registre)* | config | — | mêmes fichier L.38-61 | exact |
| `apps/web/src/app/[locale]/affiliation/page.tsx` + `actions.ts` | component + route | request-response | `(auth)/actions.ts` (form action) + signup form P2/P4 | role-match |
| `apps/web/src/app/(admin)/affiliation/page.tsx` + `actions.ts` | component + route | CRUD | `(admin)/file/page.tsx` + `(admin)/file/actions.ts` | exact |
| `apps/web/src/app/(admin)/affiliation/payouts/page.tsx` + `actions.ts` | component + route | CRUD | `(admin)/file/page.tsx` + `actions.ts` (`rejectPayment` → `payCommission`) | exact |
| `apps/web/src/app/[locale]/(affiliate)/dashboard/page.tsx` | component | request-response (read-only agg) | `(admin)/file/page.tsx` (RSC table, `<bdi>`/`formatAtomic`) + vue agrégat | role-match |
| `apps/web/src/messages/{fr,en,ar}.json` *(modifiés — namespace `affiliate`)* | config (i18n) | — | mêmes fichiers (namespace `admin`/`payment` existants) | exact |

---

## Pattern Assignments

### `supabase/migrations/0016_affiliation.sql` (migration, CRUD+transform)

**Analog principal :** `supabase/migrations/0012_payments.sql`. Analogs secondaires : 0009 (helper `security definer`), 0008 (`is_superadmin`/role), 0015 (RLS sans policy write).

**En-tête de migration à recopier** (`0012` L.1-26) — déclare convention `apply_migration` (PAS db push), édition manuelle `database.types.ts`, numéro, décisions, STRIDE.

**Table + RLS producteur-unique** — copier `payments` (`0012` L.37-107) :
```sql
create table public.commissions (
  id            uuid primary key default gen_random_uuid(),
  affiliate_id  uuid not null references public.affiliates(id) on delete cascade,
  referral_id   uuid not null references public.profiles(id) on delete cascade,
  period        text not null,                          -- 'YYYY-MM' (D-05)
  rate_bps      int  not null,                           -- basis points (grille D-01)
  base_atomic   bigint not null default 0,               -- Σ amount_atomic filleuls actifs (string en TS)
  amount_atomic bigint not null default 0,               -- taux × base / 10000 (string en TS)
  status        text not null default 'due' check (status in ('due','paid')),  -- A7/Q4 : 'paid' SQL, « payée » au front
  created_at    timestamptz not null default now()
);
alter table public.commissions enable row level security;
```

**UNIQUE idempotent** — miroir `payments_tx_hash_global_idx` (`0012` L.63-64) et `UNIQUE(dedupe_key)` (`0015` L.40) :
```sql
create unique index commissions_aff_ref_period_idx
  on public.commissions (affiliate_id, referral_id, period);   -- D-05 : 1 commission/filleul/mois
```

**Policies RLS « lis les tiens + superadmin »** — copier EXACTEMENT le triplet `payments` (`0012` L.92-105). Pour `commissions`/`referrals`/`affiliates` : SELECT scopé sur l'affilié propriétaire + `is_superadmin()`. **AUCUNE policy insert/update/delete** → write = service_role bypass (commentaire `0012` L.107 / `0015` L.49). Pour le code vanity, check + UNIQUE (RESEARCH §Pattern 5).

**RPC `security definer` + `revoke execute`** — copier `activate_subscription_for_payment` (`0012` L.120-169) : `security definer set search_path = public`, `get diagnostics`, `on conflict … do update … where status='due'` (jamais écraser une payée), puis ligne finale `revoke execute on function … from public, anon, authenticated;`. Structure SQL complète déjà fournie RESEARCH §Pattern 4 (`affiliate_rate_bps` + `compute_affiliate_commissions`).

**Helper « filleul actif »** — répliquer la logique de `has_active_subscription()` (`0009` L.63-80 : `status='active' AND current_period_end > now()`) DANS le RPC (le job tourne en service_role, pas `auth.uid()`).

**Vue dashboard `security_invoker=true`** — RESEARCH §Code Examples L.531-549 (agrégats seuls, `::text` sur les bigint sommés, `where a.user_id = auth.uid()`). ⚠️ INVERSE de `pattern_stats` (0014 était `security_invoker=false`).

---

### `packages/supabase/src/database.types.ts` (model, édité à la main — NE PAS regénérer sans ré-appliquer)

**Analog :** mêmes fichier, bloc payments.

**Override `*_atomic` string** (L.313-349) — après `generate_typescript_types`, ré-appliquer manuellement (Pitfall 5) :
```typescript
// CR-02 / T-04-PREC: colonnes Postgres `bigint`. PostgREST sérialise bigint en
// string (>2^53). Override manuel en `string`. NE PAS regénérer sans ré-appliquer.
base_atomic: string
amount_atomic: string
```
Appliquer aux nouvelles colonnes `commissions.base_atomic`, `commissions.amount_atomic`, `payouts.amount_atomic` (Row + Insert + Update).

**Alias maison** (L.814-864) — ajouter en fin de fichier, miroir exact :
```typescript
export type AffiliateRow = Database['public']['Tables']['affiliates']['Row']
export type AffiliateInsert = Database['public']['Tables']['affiliates']['Insert']
export type ReferralRow = Database['public']['Tables']['referrals']['Row']
export type ReferralInsert = Database['public']['Tables']['referrals']['Insert']
export type CommissionRow = Database['public']['Tables']['commissions']['Row']
export type CommissionInsert = Database['public']['Tables']['commissions']['Insert']
export type PayoutRow = Database['public']['Tables']['payouts']['Row']
export type PayoutInsert = Database['public']['Tables']['payouts']['Insert']
export type AffiliateApplicationRow = Database['public']['Tables']['affiliate_applications']['Row']
export type AffiliateApplicationInsert = Database['public']['Tables']['affiliate_applications']['Insert']
```

---

### `packages/supabase/src/repositories/affiliates.ts` (repository, CRUD)

**Analog :** `repositories/payments.ts`.

**Conventions à copier** : `type ServiceClient = SupabaseClient<Database>` (payments L.20) ; commentaire d'en-tête « JAMAIS importé depuis apps/web » (payments L.15) ; `isUniqueViolation` + const `PG_UNIQUE_VIOLATION = '23505'` (payments L.34-65) ; toujours `.toString()` à l'écriture bigint, JAMAIS `Number()` (payments L.106, 153).

**`attributeReferral`** — squelette complet fourni RESEARCH §Code Examples L.491-528 : résout `affiliate_code → affiliate_id` (`.maybeSingle()`), no-op si inconnu, skip self-ref (D-12), insert `referrals` avec capture 23505 (idempotent, last-touch joué au cookie). **Best-effort : ne lève jamais** (un échec ne casse pas le signup).

---

### `packages/supabase/src/repositories/commissions.ts` (repository, RPC wrapper)

**Analog :** `repositories/subscriptions.ts` (`activateForPayment` L.29 enveloppe l'RPC `activate_subscription_for_payment`).

**Pattern** : wrapper mince autour de `client.rpc('compute_affiliate_commissions', { p_period })` et `client.rpc('mark_commission_paid', …)`. Input/Output interfaces explicites (miroir `ActivateForPaymentInput` subscriptions L.17). `markCommissionPaid` = insert `payouts` + transition commission `due→paid` via RPC mono-transaction (miroir `activate_subscription_for_payment`, RESEARCH §Don't Hand-Roll).

---

### `apps/web/src/lib/affiliate/captureRef.ts` (utility middleware, request-response)

**Analog :** `apps/web/src/lib/supabase/middleware.ts` — invariant « MUTER la response transmise, ne PAS recréer `NextResponse.next()` » (L.30-39, sinon le rewrite locale next-intl est perdu, Pitfall 2).

**Implémentation** fournie RESEARCH §Pattern 1 L.220-244 : lit `?ref`, valide `^[A-Z0-9]{3,20}$` AVANT pose (anti-injection), `response.cookies.set({ httpOnly:true, sameSite:'lax', secure:true, maxAge:30j })`, last-touch (écrase toujours).

---

### `apps/web/src/middleware.ts` (middleware, modifié — request-response)

**Analog :** mêmes fichier L.24-31. Insérer `captureRef(request, response)` ENTRE `handleI18n` et `updateSession` (ordre verrouillé locale → ref → session, D-09) :
```typescript
const response = handleI18n(request)                 // 1. locale
response.headers.set('x-pathname', request.nextUrl.pathname)
captureRef(request, response)                        // 2. ref (mute la même response)
return await updateSession(request, response)        // 3. session
```

---

### `apps/web/src/app/[locale]/(auth)/actions.ts` (route/server action, modifié — event-driven)

**Analog :** mêmes fichier, `signUp` L.33-54.

**Insertion** (RESEARCH §Pattern 2 L.259-281) — APRÈS `auth.signUp` réussi, AVANT le `redirect` final : lire le cookie `aff_ref` via `(await cookies()).get('aff_ref')?.value`, appeler `attributeReferral(createAdminServiceClient(), …)` (service_role local — la RLS interdit l'écriture front sur `referrals`), puis `(await cookies()).delete('aff_ref')`. **Best-effort** : un code invalide / self-ref ne bloque JAMAIS le signup. Ne pas toucher au mapping `toSafeErrorKey` ni au redirect existant `/paiement-bientot`.

---

### `apps/jobs/src/jobs/affiliate-commission.ts` (job, batch idempotent)

**Analog :** `apps/jobs/src/jobs/outcome-tracker.ts`.

**Conventions à copier ligne pour ligne** : `'dotenv/config'` en tête (outcome-tracker L.20) ; `getServiceClient()` lazy lisant `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` avec throw explicite (L.33-44) ; signature `export async function affiliateCommission(): Promise<Json>` ; retour stats `as Json`. Tout le calcul + l'upsert idempotent vivent dans le RPC (RESEARCH §Pattern 3 L.288-307) — le job ne fait qu'appeler `client.rpc('compute_affiliate_commissions', { p_period })`. **Aucun traçage manuel** : `runJob` écrit `job_runs` automatiquement (runJob.ts L.50-70).

**Bornes du mois** : `DateTime.utc().toFormat('yyyy-MM')` (luxon, RESEARCH §Pitfall 4) — JAMAIS `new Date()`.

---

### `apps/jobs/src/dispatch.ts` (config, modifié)

**Analog :** mêmes fichier L.38-61. Ajouter au `JOB_REGISTRY` avec commentaire de cadence (miroir L.56-58 `outcome-tracker`) :
```typescript
// AFF-03 — calcul mensuel des commissions (idempotent). run-job.cmd affiliate-commission.
'affiliate-commission': affiliateCommission,
```
+ l'import en tête (miroir L.30).

---

### `apps/web/src/app/(admin)/affiliation/page.tsx` + `actions.ts` (file de revue, CRUD)

**Analog :** `(admin)/file/page.tsx` + `(admin)/file/actions.ts`.

**Page (RSC, mono-FR, hors `[locale]`)** — copier `file/page.tsx` : `loadQueue()` via `createAdminServiceClient()` (L.41-49), `getTranslations('admin')`, conteneur `mx-auto max-w-6xl px-4 py-8`, `<h1 className="text-2xl font-semibold">`, `Table`, badge ambre pending `border-amber-600/30 bg-amber-500/10 text-amber-700 dark:text-amber-400` (L.121), empty state (L.77-81). Lecture des candidatures `status='pending'`.

**Actions** — copier `file/actions.ts` : `'use server'` + `'server-only'` (L.1,14) ; helper `guard()` qui re-valide `requireRole('superadmin')` PUIS retourne `createAdminServiceClient()` (L.43-46, T-04-ADMIN-WRITE) ; pattern `QueueActionResult` + `fail()` (L.20,48-50) ; parse strict des `FormData` avec allowlist (`parsePlan`/`parsePeriod` L.24-41) ; `revalidatePath` après écriture. Approuver → promotion `profiles.role='affiliate'` + création du code vanity (capture 23505 → `affiliate.errors.codeTaken`). Rejeter → motif requis (miroir `rejectPayment` L.71-85).

---

### `apps/web/src/app/(admin)/affiliation/payouts/page.tsx` + `actions.ts` (payout, CRUD)

**Analog :** `(admin)/file/{page,actions}.tsx`.

**`payCommission` action** — squelette fourni RESEARCH §Pattern 7 L.396-414 : `requireRole('superadmin')` en tête, `createAdminServiceClient()`, lire `commission_id` + `tx_hash` + `amount_atomic` (string bigint), `markCommissionPaid` (RPC insert payouts + commission→paid), `revalidatePath`. Lien tx_hash → TronScan `target="_blank" rel="noopener noreferrer"` (miroir `file/page.tsx` L.111-118, anti reverse-tabnabbing T-04-EXTLINK). Confirmation via `alert-dialog` (UI-SPEC §Interaction).

---

### `apps/web/src/app/[locale]/(affiliate)/dashboard/page.tsx` (dashboard no-PII, read-only agg)

**Analog :** `(admin)/file/page.tsx` (RSC table + `<bdi>` + `formatAtomic`) ; gating `requireRole('affiliate')` (gate.ts L.99-118).

**No-PII strict (D-13)** : lire UNIQUEMENT la vue agrégat `affiliate_dashboard` en **anon/auth-client** (PAS service_role) — RESEARCH §Code Examples L.531-549. Zéro ligne par filleul, zéro `user_id`. Montants via `<bdi>{formatAtomic(BigInt(x))}` (file/page.tsx L.101). `@tanstack/react-query` pour le fetch (déjà installé). Composants : `card` (tuiles), `progress` (palier suivant), `table` (grille 8 paliers lecture seule), `badge` (palier actuel `bg-primary/10 text-primary`), `tabs` (cumul/mois), `skeleton` (loading). Vert/rouge INTERDITS (D-04), statuts en ambre/neutre.

---

### `apps/web/src/app/[locale]/affiliation/page.tsx` + `actions.ts` (candidature, request-response)

**Analog :** `(auth)/actions.ts` (server action form) + form react-hook-form + zod (pattern signup P2/P4).

**Insertion candidature** : §Open Q1 (RESEARCH L.576-579) recommande une **server action service_role** (pas de policy insert front) capturant les champs D-08 (réseaux sociaux, Telegram, Facebook, nb abonnés, interactions). Validation zod client + serveur. Toast `sonner` succès. Réutilise `<Disclaimer>` RSC P2 (aucune promesse de revenu — LEGAL-01).

---

## Shared Patterns

### Idempotence (UNIQUE + ON CONFLICT)
**Source :** `0012` L.63-64 (`payments_tx_hash_global_idx`) + `0015` L.40 (`UNIQUE(dedupe_key)`) + repo capture 23505 (`payments.ts` L.59-65).
**Apply to :** `0016` (`UNIQUE(affiliate_id, referral_id, period)`), `commissions.ts`, `affiliates.ts`.
Filet DB inviolable (le check applicatif a une TOCTOU). Code Postgres `'23505'` mappé côté repo.

### RPC atomique `security definer`
**Source :** `0012` L.120-169 (`activate_subscription_for_payment`) — `security definer set search_path = public`, `get diagnostics`, `revoke execute … from public, anon, authenticated`.
**Apply to :** `compute_affiliate_commissions`, `mark_commission_paid` (0016). Toute logique de taux/idempotence vit DANS la transaction DB, pas en JS.

### RLS « lis les tiens + superadmin », zéro write front
**Source :** triplet de policies `payments` (`0012` L.92-105) + commentaire « AUCUNE policy insert/update/delete → service_role bypass » (L.107) ; `is_superadmin()` (`0008` L.29-47).
**Apply to :** toutes les tables 0016. La RLS est la SEULE barrière d'isolation (Pitfall #5). `get_advisors security` au gate de phase.

### service_role local côté web
**Source :** `apps/web/src/lib/supabase/admin-service.ts` (`createAdminServiceClient()`, `import 'server-only'`, `persistSession:false`).
**Apply to :** toutes les actions `(admin)/affiliation/**` + l'attribution dans `signUp`. JAMAIS `@app/supabase/service-client` (lint-interdit côté web).

### Re-validation du rôle en tête d'action
**Source :** `(admin)/file/actions.ts` helper `guard()` L.43-46 (`requireRole('superadmin')` puis client) ; `gate.ts` `requireRole` L.99-118.
**Apply to :** chaque server action `(admin)` (T-04-ADMIN-WRITE) ; dashboard affilié = `requireRole('affiliate')`.

### BigInt atomique string (zéro float)
**Source :** override `database.types.ts` L.313-349 + `payments.ts` (`.toString()` écriture, `BigInt()` lecture) + `file/page.tsx` L.101 (`formatAtomic(BigInt(x))` + `<bdi>`).
**Apply to :** `base_atomic`/`amount_atomic` partout. JAMAIS `Number()` (CR-02). `× rate_bps / 10000` reste entier (troncature Postgres déterministe, §Open Q3).

### Job idempotent tracé
**Source :** `outcome-tracker.ts` (getServiceClient lazy, retour `Json`) + `runJob.ts` (trace `job_runs` auto) + `dispatch.ts` (registre).
**Apply to :** `affiliate-commission.ts`. Cadence mensuelle via Windows Task Scheduler (`run-job.cmd affiliate-commission`).

### i18n namespace + parité stricte
**Source :** namespaces `admin`/`payment` dans `messages/{fr,en,ar}.json` ; `getTranslations('admin')` (file/page.tsx L.67) ; `<bdi>` pour montants/codes/%.
**Apply to :** nouveau namespace `affiliate` (trilingue, parité stricte, check CI `lint:i18n`). Back-office (surfaces 2,4) mono-FR sous `admin` (layout `(admin)` fournit `locale="fr"`, layout.tsx L.20).

---

## No Analog Found

**Aucun.** Les 3 « zones neuves » (captureRef, attribution server-action, RPC commission) n'ont pas d'implémentation identique au dépôt mais dérivent directement d'analogs existants (middleware mute-response, `signUp` + admin-service, `activate_subscription_for_payment`). Le planner s'appuie sur les squelettes fournis dans RESEARCH §Patterns 1-4 + §Code Examples — pas sur RESEARCH.md générique.

---

## Metadata

**Analog search scope :** `supabase/migrations/`, `apps/web/src/{middleware,lib,app}`, `apps/jobs/src/`, `packages/supabase/src/`.
**Files scanned :** 14 analogs lus intégralement (5 migrations, middleware ×2, gate, admin-service, (admin)/file ×2, (auth)/actions, 3 jobs, payments repo) + 3 grep ciblés (database.types, subscriptions repo, index barrel).
**Pattern extraction date :** 2026-06-18
