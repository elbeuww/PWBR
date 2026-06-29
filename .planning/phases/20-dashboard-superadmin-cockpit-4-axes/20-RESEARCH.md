# Phase 20: Dashboard superadmin (cockpit 4 axes) - Research

**Researched:** 2026-06-26
**Domain:** Next.js 15 App Router (RSC) + Supabase RLS/RPC superadmin cockpit, keyset pagination, mesured KPIs
**Confidence:** HIGH (all findings grounded in repo migrations + admin source code, cross-checked with STATE.md LIVE notes)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01 .. D-18 — research THESE, no alternatives)
- **D-01:** Tout en anon-client + RLS superadmin. Supprimer `createAdminServiceClient` des pages `(admin)`. Lectures via policies « superadmin lit tout » (`using (select public.is_superadmin())`) ; KPIs/matviews via wrappers gated `SECURITY DEFINER` (calque `get_mrr()`). Jamais service_role côté page.
- **D-02:** Tables lues par l'admin sans policy superadmin → migration `0021` ajoutant une policy « superadmin lit tout » par table manquante. RLS = source de vérité. Migration via MCP `apply_migration` (jamais `db push`), puis `generate_typescript_types` → édition `database.types.ts` → `get_advisors`.
- **D-03:** Écritures admin (prolonger abo, suspendre, payouts manuels) via RPC `SECURITY DEFINER` gated `(select is_superadmin())` (calque payout atomique 0016) : audit centralisé, atomicité, `set search_path = public` figé. Pas de policies write éparpillées, pas de service_role.
- **D-04:** Table `admin_audit_log` dédiée : acteur + cible + action + horodatage + payload, écrit DANS le RPC `SECURITY DEFINER` (atomique avec l'action).
- **D-05:** Home cockpit unique : `(admin)/page` = 4 sections résumées (KPIs par axe) ; clic = drill-down vers pages détail existantes. Pas de pages d'axe pleines séparées.
- **D-06:** AdminSidebar regroupée par les 4 axes (Acquisition / Revenus / Ops / Conformité).
- **D-07:** Ordre de lecture en proue = Revenus → Ops → Acquisition → Conformité.
- **D-08:** Reskin DS v3 Tier App sobre : pas de néon, tables denses, feux sémantiques green/amber/red tokenisés (green→signal-bullish, amber→risk-moderate, red→destructive).
- **D-09:** Pages germe enrichies + reskinées EN PLACE, pas recréées. Signaux admin = lecture seule.
- **D-10:** Pattern KPIs hybride : réutiliser `mv_mrr` ; nouveaux KPIs (funnel, churn, mix) via RPC gated à la volée (COUNT/GROUP BY indexés ~10k) ; matview + wrapper seulement si `EXPLAIN ANALYZE` le justifie.
- **D-11:** Funnel = Inscription (profiles créés) → 1er paiement vérifié (activation) → abonnement renouvelé (rétention), segmentable par `source` / affilié.
- **D-12:** Churn = taux mensuel : abonnés dont la période a expiré sans renouvellement ÷ abonnés actifs en début de mois (sur `subscriptions.current_period_end`).
- **D-13:** Labellisation honnête : valeur mesurée + N + période + source. MRR libellé « cash encaissé/mois ». % via `applyThreshold`. Test `no-perf-claims` étendu aux pages admin. Aucun chiffre fabriqué (VITR-03).
- **D-14:** Tables admin ~10k = pagination serveur keyset via `cursor.ts` (P19), DOM borné ~50 lignes. **PAS de `@tanstack/react-virtual` ni `react-table`** — zéro nouvelle dépendance (en faveur de P19).
- **D-15:** Filtres table users (ADASH-04) = serveur, combinables sur colonnes indexées : état d'abonnement + `source` + recherche email/id.
- **D-16:** « Offrir des jours/mois gratuits » = bouton ligne user → dialog presets (7j / 1 mois / 3 mois / custom) → RPC gated qui prolonge (ou crée) la période + écrit `admin_audit_log`.
- **D-17:** Suspension = nouvelle colonne `profiles.suspended` (+ raison) ; suspendu bloqué réellement (gate `requireUser` + RLS → 0 ligne, jamais l'UI seule) ; réversible ; via RPC gated + audit.
- **D-18:** Panneau Conformité read-only : feu `LEGAL_REVIEW_DONE` (via `lib/legal-gate.ts`) + version de l'artefact légal + date de revue.

### Claude's Discretion (résolu ci-dessous par recherche)
- Découpage exact migration `0021` (tables avec policy P17 vs manquantes) → **§Migration 0021 Mapping**.
- Quels KPIs en matview vs à la volée → **§KPIs : à-la-volée vs matview**.
- Signature/nommage RPC + schéma `admin_audit_log` → **§RPC SECURITY DEFINER + admin_audit_log**.
- Redirection anciennes URLs admin si sidebar réorganisée → **§Sidebar 4 axes & routing**.
- Branchement Realtime sur le cockpit (optionnel) → **§Realtime cockpit (optionnel)**.

### Deferred Ideas (OUT OF SCOPE — ne pas amorcer)
- Créer des promotions / codes promo / coupons / discounts → phase dédiée.
- Gérer prix & offres dynamiquement (pricing dynamique) → phase dédiée.
- Création de liens/codes affiliés par l'admin → différé (au-delà d'ADASH-05).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ADASH-01 | Cockpit acquisition (funnel inscriptions, perf affiliés) | §Funnel d'acquisition (RPC gated), §Affiliés (tables base déjà gated P17) |
| ADASH-02 | Revenus (MRR, churn, mix) mesurés, jamais inventés | §KPIs : `mv_mrr`/`get_mrr` réutilisé + RPC churn/mix, §Labellisation D-13 |
| ADASH-03 | Santé ops (`job_runs`, `v_data_freshness`, file paiements) | §Migration 0021 Mapping (job_runs/news/macro déjà authenticated, candles à gater) |
| ADASH-04 | Gère users (table keyset filtrable, état abo) | §Keyset pagination admin, §Filtres serveur, §profiles policy manquante |
| ADASH-05 | Gère paiements & affiliés (files, payouts manuels) | §RPC payout gated, §file paiements (payments déjà gated) |
| ADASH-06 | État conformité (`LEGAL_REVIEW_DONE`) | §Panneau Conformité (lib/legal-gate.ts existant) |
| ADASH-07 | Pages gated `is_superadmin()` (404 discret), zéro fuite, jamais service_role | §Bascule anon+RLS, §Gating layout existant, §Test rls-unchanged étendu |
</phase_requirements>

## Summary

Phase 20 n'est pas un greenfield : 9 pages `(admin)` existent en germe (P8) et lisent **toutes via `createAdminServiceClient` (service_role)**. La bascule centrale de la phase (D-01) est de **retirer service_role** et de passer en **anon-client + RLS superadmin + wrappers `SECURITY DEFINER` gated**, en réutilisant exactement l'infra posée en P17 (`mv_mrr` / `get_mrr()` / wrap InitPlan `(select is_superadmin())`) et le calque RPC atomique de 0016.

La majorité des tables lues par l'admin **ont déjà** une policy « superadmin voit tout » posée et wrappée InitPlan en 0017 (`payments`, `subscriptions`, `affiliates`, `affiliate_codes`, `affiliate_applications`, `referrals`, `commissions`, `payouts`). Le périmètre **réel** de la migration `0021` est petit et précis : **`profiles`** (aucune policy superadmin — c'est la raison documentée du service_role dans `admin-service.ts`), **`telegram_posts`** (RLS active, aucune policy SELECT du tout), et **`candles`** (gated `has_active_subscription`, donc un superadmin non-abonné lit 0 via `v_data_freshness` security_invoker). Les tables Ops `job_runs` / `news` / `macro_series` / `instruments` / `prediction_outcomes` sont déjà `using (true) to authenticated` → lisibles par tout superadmin authentifié, aucune policy à ajouter.

Côté écritures, P20 ajoute une table `admin_audit_log` et 3-4 RPC `SECURITY DEFINER` gated (`grant_subscription_time`, `suspend_account`/`unsuspend_account`, `admin_mark_commission_paid`) calqués trait pour trait sur `mark_commission_paid` (0016) : update atomique + insert audit dans la même transaction, `set search_path = public`, `revoke execute from public, anon` + `grant execute to authenticated`, garde `if not (select is_superadmin()) then raise`. La pagination keyset réutilise `lib/keyset/cursor.ts` + le pattern `.or()` tuple-compare de `lib/watchlist/queries.ts` (P19), zéro nouvelle dépendance.

**Primary recommendation:** Migration `0021` minimale (3 policies SELECT superadmin + `admin_audit_log` + `profiles.suspended` + 3-4 RPC gated), appliquée via MCP `apply_migration` ; KPIs funnel/churn/mix en **RPC gated à la volée** (pas de matview, le seed ~10k tient en COUNT/GROUP BY indexés — confirmer par `EXPLAIN ANALYZE`) ; toutes les pages `(admin)` réécrites en anon-client `createClient()` (server.ts) ; test `rls-unchanged` étendu pour scanner `(admin)` une fois service_role retiré.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Gating accès cockpit (404 non-superadmin) | Frontend Server (RSC layout) | — | `requireRole('superadmin')` déjà dans `(admin)/layout.tsx` → `notFound()`. UX gate, PAS la barrière données. |
| Non-fuite cross-tenant des données | Database (RLS) | — | Source de vérité. Policies superadmin + wrappers gated ; jamais le gate UX (D-01, ADASH-07). |
| Lecture KPIs agrégés (MRR/funnel/churn/mix) | Database (RPC/matview gated) | API/Backend (RSC appelle `.rpc()`) | Matviews/agrégats sans RLS → wrapper `SECURITY DEFINER` gated `is_superadmin()` (calque `get_mrr`). |
| Lecture tables détail (users/affiliés/file) | Database (RLS superadmin) | Frontend Server (RSC anon-client) | Policies « superadmin voit tout » + keyset index ; RSC lit via anon `createClient()`. |
| Écritures admin (offrir gratuit/suspendre/payout) | Database (RPC SECURITY DEFINER gated) | Frontend Server (Server Action) | Atomicité + audit dans le RPC ; Server Action re-garde `requireRole` mais N'utilise PLUS service_role. |
| Pagination/filtres tables | Frontend Server (RSC + URL state) | Database (keyset index) | `searchParams` + `cursor.ts` côté serveur ; `.or()` tuple-compare paramétré. |
| Suspension = barrière réelle | Database (RLS + helper) ET Frontend Server (gate) | — | D-17 : gate `requireUser` + effet RLS (0 ligne) ; jamais l'UI seule. |

## Standard Stack

### Core (déjà au lock-file — AUCUNE nouvelle dépendance, D-14)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | 15.x | RSC App Router, route group `(admin)` | Verrouillé projet. [VERIFIED: CLAUDE.md + repo] |
| `@supabase/supabase-js` | 2.108.0 | `.rpc()` wrappers gated + `.select()` keyset | Verrouillé. [VERIFIED: CLAUDE.md] |
| `@supabase/ssr` | 0.12.0 | `createClient()` anon serveur (cookies) | Seul chemin RSC. [VERIFIED: CLAUDE.md] |
| `zod` | 4.4.x | Validation searchParams/filtres (calque `searchParams.ts`) | Verrouillé. [VERIFIED: repo `lib/signals/searchParams.ts`] |
| `@tanstack/react-query` | 5.101.0 | (Optionnel) mutations optimistes row-actions | Déjà utilisé P19. [VERIFIED: repo] |

### Supporting (existant, à réutiliser tel quel)
| Asset | Path | Purpose |
|-------|------|---------|
| Keyset cursor | `apps/web/src/lib/keyset/cursor.ts` | `encodeCursor`/`decodeCursor` base64url opaque, tuple `(createdAt,id)`. [VERIFIED: repo] |
| Pattern keyset query | `apps/web/src/lib/watchlist/queries.ts` | `.order(created_at desc).order(id desc).limit(N+1)` + `.or()` tuple-compare + `sanitizeCursor`. [VERIFIED: repo] |
| URL-state filtres | `apps/web/src/lib/signals/searchParams.ts` | `z.enum` safeParse champ par champ, anti-injection. [VERIFIED: repo] |
| Anon server client | `apps/web/src/lib/supabase/server.ts` | `createClient()` @supabase/ssr — remplace `admin-service`. [VERIFIED: repo, importé par gate.ts] |
| Gate | `apps/web/src/lib/auth/gate.ts` | `requireRole`/`requireUser`/`requireActiveSub`. [VERIFIED: repo] |
| Feux tokenisés | `apps/web/src/lib/admin/freshness.ts`, `jobs.ts`, `signals.ts` | `candleColor`/`ageColor`/`latestPerJob`/`telegramStatusFor`. [VERIFIED: repo] |
| Legal gate | `apps/web/src/lib/legal-gate.ts` | `isLegalReviewDone()` (env `LEGAL_REVIEW_DONE`). [VERIFIED: repo] |
| Montants | `@app/core` `formatAtomic` | BigInt atomique → string, jamais float. [VERIFIED: repo] |

### Alternatives Considered (toutes écartées par CONTEXT)
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `cursor.ts` keyset maison | `@tanstack/react-virtual` / `react-table` | **REJETÉ par D-14** (zéro nouvelle dépendance, faveur P19). |
| RPC gated à la volée (funnel/churn) | matview + wrapper + refresh | **D-10** : matview seulement si `EXPLAIN ANALYZE` le justifie (refresh coûteux, PC éteignable). |
| service_role côté page | anon + RLS superadmin | **REJETÉ par D-01/ADASH-07** (frontière sécurité centrale). |

**Installation:** Aucune. `pnpm install` inchangé (zéro nouvelle dépendance, D-14).

## Package Legitimacy Audit

> Non applicable : la phase n'installe **aucun** package externe (D-14 = zéro nouvelle dépendance). Tout le code réutilise des assets déjà présents au lock-file. Aucun `slopcheck`/registre à exécuter.

## Migration 0021 Mapping (Claude's Discretion → RÉSOLU)

> **Prochaine migration = `0021`.** `0020` = `user_followed_setups` (P19, sur disque + LIVE). `0013` ABSENTE (réservée P4). [VERIFIED: repo `ls migrations/` + STATE.md]

### Inventaire des tables lues par les pages `(admin)` et leur état RLS superadmin

| Table | Lue par (page admin) | Policy SELECT actuelle | Superadmin lit ? | Action 0021 |
|-------|----------------------|------------------------|------------------|-------------|
| `subscriptions` | membres, page (KPI), churn/mix | `lire les siennes` + **`superadmin voit tout`** (0009 L.47-50, wrap 0017 L.136-140) | ✅ OUI | **Aucune** |
| `payments` | file, membres, MRR, funnel | `insérer pending` + `lire les siennes` + **`superadmin voit tout`** (0012 L.110-127 via 0017 L.123-127) | ✅ OUI | **Aucune** |
| `affiliates` | affilies | `lire la sienne` + **`superadmin voit tout`** (0016 L.73-76, wrap 0017 L.159-163) | ✅ OUI | **Aucune** |
| `affiliate_codes` | (affiliés) | + **`superadmin voit tout`** (0016 L.98-101, wrap 0017 L.172-176) | ✅ OUI | **Aucune** |
| `affiliate_applications` | (candidatures) | **`superadmin voit tout`** uniquement (0016 L.127-130, wrap 0017 L.179-183) | ✅ OUI | **Aucune** |
| `referrals` | affilies (count), funnel par affilié | + **`superadmin voit tout`** (0016 L.153-156, wrap 0017 L.192-196) | ✅ OUI | **Aucune** |
| `commissions` | affilies, payouts | + **`superadmin voit tout`** (0016 L.192-195, wrap 0017 L.205-209) | ✅ OUI | **Aucune** |
| `payouts` | payouts | + **`superadmin voit tout`** (0016 L.224-227, wrap 0017 L.223-227) | ✅ OUI | **Aucune** |
| `job_runs` | sante | `lecture authentifiés` `using (true) to authenticated` (0001 L.72-76) | ✅ OUI (tout authentifié) | **Aucune** |
| `news` | sante, page (KPI) | `lecture authentifiés` `using (true)` (0003 L.125-129) | ✅ OUI | **Aucune** |
| `macro_series` | sante, page (KPI) | `lecture authentifiés` `using (true)` (0003 L.151-155) | ✅ OUI | **Aucune** |
| `instruments` | signaux, membres (join) | `lecture authentifiés` `using (true)` (0001 L.47-51) | ✅ OUI | **Aucune** |
| `prediction_outcomes` | (historique) | `lecture authentifiés` (0014 L.39-42, `using(true)`) | ✅ OUI | **Aucune** |
| `v_data_freshness` | sante, page (KPI) | VIEW `security_invoker = true` (0003 L.206-207 / 0004 L.21-22) → hérite RLS du lecteur, lit `candles` | ⚠️ dépend de `candles` | via `candles` ci-dessous |
| **`profiles`** | **membres/file/affilies (join email), users table** | `lire le sien` + `modifier le sien` (id=auth.uid()) — **AUCUNE superadmin** (0001 L.19-27, wrap 0017 L.77-87) | ❌ **NON** | **AJOUTER `profiles: superadmin voit tout` SELECT `using (select is_superadmin())`** |
| **`telegram_posts`** | **signaux (statut Telegram)** | RLS active, **AUCUNE policy SELECT** (0015 L.47-50 : "Aucun client … ne lit") | ❌ **NON (0 ligne)** | **AJOUTER `telegram_posts: superadmin voit tout` SELECT `using (select is_superadmin())`** |
| **`candles`** | **sante via `v_data_freshness`** | `candles: abonnés actifs` `has_active_subscription()` (0011, wrap 0017 L.104-108) | ⚠️ **NON si superadmin non-abonné** | **AJOUTER `candles: superadmin voit tout` SELECT `using (select is_superadmin())`** (sinon freshness vide → santé faussement rouge) |

**Conclusion 0021 — policies SELECT à ajouter : exactement 3** (`profiles`, `telegram_posts`, `candles`).

> Forme canonique (wrap InitPlan dès l'écriture, calque 0017) :
> ```sql
> create policy "profiles: superadmin voit tout"
>   on public.profiles for select to authenticated
>   using ((select public.is_superadmin()));
> -- idem telegram_posts, candles
> ```

**Preuve « profiles manque » (autoritative) :** `apps/web/src/lib/supabase/admin-service.ts` L.15-19 documente exactement : *« `profiles` n'a AUCUNE policy superadmin (0008) → toute jointure email échoue sous RLS anon »*. C'est la cause racine du service_role résiduel. [VERIFIED: repo]

> **Gate post-apply (D-02) :** `generate_typescript_types` → édition manuelle `database.types.ts` (alias maison + override `*_atomic` string, le projet n'est pas `link`é) → `get_advisors(security)` doit montrer 0 NOUVELLE fuite ; `get_advisors(performance)` doit rester 0 `auth_rls_initplan` (wrap dès l'écriture). [VERIFIED: pattern 0017/0018]

## KPIs : à-la-volée (RPC gated) vs matview (Claude's Discretion → RÉSOLU)

### Réutilisable tel quel (NE PAS recréer)
- **MRR = `mv_mrr` + `get_mrr()`** (0017 Section 2, L.250-294). Définition VERROUILLÉE (checkpoint A1) = **« cash encaissé/mois »** : `Σ payments.amount_atomic WHERE status='verified' GROUP BY date_trunc('month', verified_at)`. Pas de dédup, les deux plans. Lecture via `get_mrr()` gated, retour `month/payments_count/revenue_atomic` (revenue_atomic → string TS). Libellé front **obligatoire** « cash encaissé/mois », JAMAIS « MRR récurrent » (D-13). [VERIFIED: repo 0017]

### Recommandation : nouveaux KPIs en **RPC gated à la volée** (D-10), PAS de matview
Justification : à ~10k users les agrégats sont des COUNT/GROUP BY sur colonnes indexées, peu coûteux ; une matview impose un refresh (ordonnanceur hors scope, PC éteignable — Open Question 1 P17 non résolue). Décision par défaut = à la volée ; **basculer en matview UNIQUEMENT si `EXPLAIN ANALYZE` sur le seed montre un coût rédhibitoire** (ex. funnel temporel multi-join).

| KPI | Source | Forme | Index utilisé | Reco |
|-----|--------|-------|---------------|------|
| **Funnel acquisition** (D-11) | `profiles` (inscriptions) + `payments verified` (activation 1er paiement) + ≥2 verified ou renouvellement (rétention) ; segment `profiles.source` / `referrals.affiliate_id` | 3 COUNT(DISTINCT user_id) par étape, `LEFT JOIN` segment | `payments(status,...)`, `profiles(source)` | **RPC à la volée** |
| **Churn mensuel** (D-12) | `subscriptions.current_period_end`, `status` | (abonnés expirés sans renouvellement dans le mois) ÷ (actifs début de mois) | `subscriptions_active_idx (user_id,status,current_period_end)` (0009 L.55-56) | **RPC à la volée** |
| **Mix de plans** (D-13/ADASH-02) | `subscriptions.plan` actifs | COUNT GROUP BY plan WHERE status='active' AND current_period_end>now() | `subscriptions_active_idx` | **RPC à la volée** |
| **Perf affiliés** (ADASH-01) | `affiliates ⋈ referrals(count) ⋈ commissions(amount,status)` | déjà fait en JS dans `affilies/page.tsx` (lecture base, agrégat JS) — garder, juste basculer en anon-client | superadmin policies (déjà là) | lecture RLS existante |

**Calque exact d'un wrapper KPI gated (copier `get_mrr`) :**
```sql
-- Calque get_mrr() 0017 L.262-273. Un setof type, gated, search_path figé.
create function public.get_acquisition_funnel(p_from date, p_to date)
  returns table (stage text, n bigint, source text)
  language sql stable security definer set search_path = public
as $$
  select * from ( /* COUNT(DISTINCT ...) par étape + source */ ) q
  where (select public.is_superadmin());   -- 0 ligne pour non-superadmin (pas d'erreur)
$$;
revoke execute on function public.get_acquisition_funnel(date,date) from public, anon;  -- miroir 0008 L.46
grant execute on function public.get_acquisition_funnel(date,date) to authenticated;     -- miroir 0008 L.47
```
> Le pattern `where (select is_superadmin())` à la **fin** de la requête est le contrat gated de `get_mrr` (renvoie 0 ligne à un non-superadmin, jamais throw). Réutiliser pour churn/mix. [VERIFIED: repo 0017 L.269]

**Sur les colonnes lues directement par RLS superadmin (page/membres/churn) :** `subscriptions.user_id` / `payments.user_id` sont déjà couverts (0017 Partie B indexes appliqués LIVE — STATE.md « 5 index CONCURRENTLY, 0 INVALID »). Le `EXPLAIN ANALYZE` du gate P20 confirme Index Scan sur les nouveaux GROUP BY ; ajouter un index seulement si seq scan + sort apparaît.

## RPC SECURITY DEFINER + admin_audit_log (Claude's Discretion → RÉSOLU)

### Table `admin_audit_log` (D-04) — schéma recommandé
```sql
create table public.admin_audit_log (
  id          uuid        primary key default gen_random_uuid(),
  actor_id    uuid        not null references public.profiles(id),  -- = auth.uid() capturé DANS le RPC
  action      text        not null check (action in
                ('grant_subscription_time','suspend_account','unsuspend_account','mark_commission_paid')),
  target_type text        not null check (target_type in ('user','commission')),
  target_id   uuid        not null,                                  -- user_id ou commission_id
  payload     jsonb       not null default '{}'::jsonb,              -- {interval, reason, amount_atomic, tx_hash}
  created_at  timestamptz not null default now()
);
alter table public.admin_audit_log enable row level security;
-- Lecture : superadmin uniquement (panneau Conformité/traçabilité). Calque affiliate_applications.
create policy "admin_audit_log: superadmin voit tout"
  on public.admin_audit_log for select to authenticated
  using ((select public.is_superadmin()));
-- AUCUNE policy insert/update/delete → écriture UNIQUEMENT via RPC SECURITY DEFINER (bypass), miroir 0016.
```

### RPC écritures (calque `mark_commission_paid` 0016 L.331-362 — atomique, audit dans la même tx)
Pattern figé pour CHAQUE RPC (provenance 0016/0008) :
1. `security definer` + `language plpgsql` + `set search_path = public` (figé, Pitfall function_search_path_mutable).
2. **Garde en tête** : `if not (select public.is_superadmin()) then raise exception 'forbidden'; end if;` (D-03).
3. Action + `insert into admin_audit_log (...) values ((select auth.uid()), ...)` dans la même transaction (atomicité D-04).
4. `revoke execute on function ... from public, anon;` + `grant execute on function ... to authenticated;` (la garde interne fait le vrai gating ; le grant authenticated suit le calque `get_mrr`/`is_superadmin`).

| RPC | Signature recommandée | Action | Audit |
|-----|----------------------|--------|-------|
| `grant_subscription_time` (D-16) | `(p_user_id uuid, p_interval text)` — `p_interval` ∈ whitelist `{'7 days','1 month','3 months'}` + custom borné | upsert `subscriptions` : si actif → `current_period_end = greatest(current_period_end, now()) + p_interval`, sinon crée `status='active'` ; **réplique la définition canonique d'actif** (0009 L.63-77) | action `grant_subscription_time`, target user, payload `{interval}` |
| `suspend_account` (D-17) | `(p_user_id uuid, p_reason text)` | `update profiles set suspended=true, suspended_reason=p_reason, suspended_at=now()` | action `suspend_account`, payload `{reason}` |
| `unsuspend_account` (D-17) | `(p_user_id uuid)` | `update profiles set suspended=false, suspended_reason=null` (réversible) | action `unsuspend_account` |
| `admin_mark_commission_paid` (D-03/ADASH-05) | `(p_commission_id uuid, p_tx_hash text, p_amount_atomic bigint)` | **réplique** `mark_commission_paid` (0016) : update `due→paid` (anti double-payout `where status='due'` + raise si row_count=0) puis insert `payouts` + insert audit | action `mark_commission_paid`, target commission |

> **Note `admin_mark_commission_paid` :** le `mark_commission_paid` existant (0016 L.331) est `revoke execute from … authenticated` → **service_role uniquement**. La page payouts actuelle l'appelle via Server Action service_role (à retirer, D-01). Recommandation : nouveau RPC gated `is_superadmin()` (grant authenticated) qui fait le même travail atomique + audit. Alternative écartée : `grant execute` sur l'ancien (casserait son contrat service_role-only et son usage par le seed/jobs). [VERIFIED: repo 0016]

### `profiles.suspended` (D-17) — colonne + barrière réelle
```sql
alter table public.profiles
  add column suspended boolean not null default false;
alter table public.profiles add column suspended_reason text;
alter table public.profiles add column suspended_at timestamptz;
```
**Faire de la suspension une VRAIE barrière (pas l'UI seule), 2 niveaux :**
1. **Gate** (`requireUser`/`requireActiveSub`, `lib/auth/gate.ts`) : après `getUser()`, lire `profiles.suspended` ; si `true` → `signOut()` + redirect `/login?suspended=1` (ou `notFound`). Le `authedClient()` lit déjà profiles ailleurs → ajout d'un select `suspended`.
2. **RLS = barrière données** : recommandation **forte** = étendre `has_active_subscription()` (0009 L.63-77, drop/recreate dans 0021) pour renvoyer `false` si l'user est suspendu :
   ```sql
   -- ... and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.suspended)
   ```
   Effet : un suspendu lit 0 `trade_setups`/`analyses`/`candles` (toutes gated par ce helper) **sans toucher chaque policy** — source unique de vérité, exactement la philosophie « RLS = vraie barrière » (D-17). Tradeoff : modifie un helper P9 (drop/recreate, re-wrap InitPlan préservé). **Alternative** (si on ne veut pas toucher le helper) : `update subscriptions set status='canceled'` dans `suspend_account` — mais perte de réversibilité propre. → **Recommander l'extension du helper** (réversible, atomique, une ligne).

## Bascule anon+RLS (D-01) — recensement des `createAdminServiceClient` à retirer

`createAdminServiceClient` est importé dans **9 fichiers sous `(admin)/`** (à migrer en `createClient()` anon de `lib/supabase/server.ts`) : [VERIFIED: grep repo]
- `(admin)/page.tsx` — KPI head-counts (subscriptions/payments/v_data_freshness/news/macro). Toutes lisibles en RLS superadmin/authenticated après 0021 (candles via freshness).
- `(admin)/membres/page.tsx` — subscriptions + `profiles!inner(email)` + payments. **Débloqué par `profiles: superadmin voit tout` (0021)**.
- `(admin)/file/page.tsx` — payments `ambiguous` + `profiles!inner(email)`. Débloqué par 0021.
- `(admin)/sante/page.tsx` — v_data_freshness + news + macro + job_runs. Débloqué (candles via 0021).
- `(admin)/signaux/page.tsx` + `signaux/[id]/page.tsx` — trade_setups + `telegram_posts`. **Débloqué par `telegram_posts: superadmin voit tout` (0021)** ; trade_setups : voir note ci-dessous.
- `(admin)/affiliation/page.tsx`, `affiliation/affilies/page.tsx`, `affiliation/payouts/page.tsx` — affiliates/referrals/commissions/payouts (toutes déjà gated superadmin).
- `(admin)/membres/actions.ts`, `file/actions.ts`, `affiliation/actions.ts`, `affiliation/payouts/actions.ts` — **Server Actions** : mutations à basculer des helpers service_role (`activateForPayment`/`changePlan`/update direct) vers les **RPC gated** (D-03). Garder `requireRole('superadmin')` en tête (défense gate), mais retirer service_role.

> **⚠️ `trade_setups` lu par signaux admin :** policy = `abonnés actifs` `has_active_subscription()` (0009/0017). Un superadmin **non abonné** lit 0 signal. Deux options : (a) ajouter `trade_setups: superadmin voit tout` (cohérent, +1 policy 0021), ou (b) accepter que le superadmin de prod ait un abonnement. **Recommandation : ajouter la policy superadmin sur `trade_setups` ET `analyses`** (cohérence cockpit « voit tout », évite un couplage caché superadmin↔abonnement). Cela porte le total 0021 à **5 policies SELECT** (`profiles`, `telegram_posts`, `candles`, `trade_setups`, `analyses`). À confirmer au plan selon que le superadmin réel est garanti abonné. *(Marqué assumption A1.)*

## Sidebar 4 axes & routing (Claude's Discretion → RÉSOLU)

- **D-05/D-06** : `(admin)/page.tsx` devient home cockpit = 4 sections résumées (ordre D-07 Revenus→Ops→Acquisition→Conformité), chaque carte = `<Link>` vers la page détail existante. Pas de nouvelles routes d'axe.
- **AdminSidebar** (`_components/AdminSidebar.tsx`) : regrouper les liens existants sous 4 en-têtes d'axe. **Les URLs des pages détail restent inchangées** (`/admin/membres`, `/admin/file`, `/admin/sante`, `/admin/signaux`, `/admin/affiliation/*`) → **aucune redirection nécessaire** (on réorganise la nav, pas les routes). Recommandation : ne PAS renommer les segments de route (éviter dette de redirection ; CONTEXT « au planner » → trancher : **garder les URLs**).
- Layout `(admin)/layout.tsx` : `requireRole('superadmin') → notFound()` déjà en place, mono-FR (NextIntlClientProvider FR fixe), `<Toaster/>` monté. **Aucun guard inline à ajouter.** [VERIFIED: repo + CONTEXT]

## Keyset pagination & filtres serveur admin (D-14/D-15 → RÉSOLU)

### Réutiliser `cursor.ts` + pattern `watchlist/queries.ts`
- Tri keyset `(created_at desc, id desc)` ; index LIVE : `profiles_keyset_idx (created_at desc, id desc)` et `payments_keyset_idx` (0017 Partie B, appliqués — STATE.md). [VERIFIED: repo 0017 + STATE]
- Helper : `encodeCursor({createdAt,id})` / `decodeCursor(raw)` (tolérant → null = 1re page). Page = `PAGE_SIZE + 1` ligne sentinelle pour `hasNext`.
- Filtre `.or()` tuple-compare **paramétré-safe** via `sanitizeCursor` (regex ISO_TIMESTAMP + UUID) avant interpolation (PostgREST ne paramètre pas `.or()`). Copier `sanitizeCursor` (`watchlist/queries.ts` L.93-101). [VERIFIED: repo]
```ts
query = supabase.from('profiles')
  .select('id, email, created_at, source, role, suspended, subscriptions(status, plan, current_period_end)')
  .order('created_at', { ascending: false }).order('id', { ascending: false })
  .limit(PAGE_SIZE + 1)
if (cursor) query = query.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`)
```

### Filtres users combinables (D-15) — schéma Zod calque `searchParams.ts`
- **état d'abonnement** : `z.enum(['active','expired','none'])` → traduit en filtre sur la jointure `subscriptions` (ou calculé). Colonne indexée `subscriptions_active_idx`.
- **`source`** : `z.enum(['demo','backtest','live'])` → `.eq('source', …)` sur `profiles` (colonne 0018). [VERIFIED: repo 0018]
- **recherche email/id** : `z.string().min(1)` → `.ilike('email', '%'+needle+'%')` ou `.eq('id', uuid)`. Validation safeParse champ par champ (anti-injection T-03-05), valeur paramétrée `.ilike`. Nouveau schéma `AdminUsersParamsSchema` (frère de `WatchlistParamsSchema`) dans `searchParams.ts` ou un fichier `lib/admin/searchParams.ts` dédié.
> Recommandation : pousser le filtre `source`/`status`/`email` **côté requête** (`.eq/.ilike` paramétrés) plutôt que le filtrage en mémoire JS actuel de `membres/page.tsx` (qui charge tout) — nécessaire pour le keyset à 10k. [VERIFIED: `membres/page.tsx` filtre en JS L.101-107 = à remplacer]

## Test `no-perf-claims` étendu admin (D-13 → RÉSOLU)

Deux gardes existantes, deux extensions :
1. **`apps/web/test/no-perf-claims.test.ts`** (scan i18n) : ajouter le namespace `admin` à `SCANNED_NAMESPACES` (L.36-45). Le scan tolérant (`collectStrings(undefined)===[]`) gère un namespace partiel. Le détecteur `FORBIDDEN = /%|\d+\s*%|garanti|.../i` attrape tout `%` ou promesse dans la copy admin. ⚠️ Le libellé MRR « cash encaissé/mois » est OK (pas de `%`), mais les **labels de churn/funnel contenant `%`** doivent vivre comme **valeurs mesurées rendues via `applyThreshold`/`formatAtomic`**, PAS comme chaînes i18n littérales `"12%"`. [VERIFIED: repo test]
2. **`apps/web/test/no-perf-seed-claims.test.ts`** (scan source, volet C overview) : ajouter les fichiers source du cockpit `(admin)/page.tsx` (+ sections KPI) à un nouveau tableau `ADMIN_UI_FILES` avec le détecteur `FORBIDDEN_PERF_UI = /\bequity\b|P&L|PnL|\bROI\b|[+-]\s*\d+%/i` (L.130). Prouve qu'aucun chiffre de perf fabriqué (equity/ROI/% signé) n'est rendu sur le cockpit. [VERIFIED: repo test volet C pattern]

> Le KPI affiché DOIT porter (D-13) : valeur **mesurée** + N + période + source. Tout `%` chiffré passe par `applyThreshold` (source unique `@app/core`), jamais une string littérale. Le MRR rendu = `formatAtomic(BigInt(revenue_atomic))` libellé « cash encaissé ».

## Architecture Patterns

### System Architecture Diagram (flux de données cockpit)
```
Superadmin (browser)
   │  GET /admin/* (cookies session)
   ▼
(admin)/layout.tsx ── requireRole('superadmin') ──▶ notFound() si non-superadmin (404 discret, UX gate)
   │ (rôle OK)
   ▼
(admin)/page.tsx + pages détail  [RSC, mono-FR]
   │  createClient() ANON @supabase/ssr   (PLUS de createAdminServiceClient)
   ├──▶ .rpc('get_mrr')                 ─┐
   ├──▶ .rpc('get_acquisition_funnel')  ─┤ wrappers SECURITY DEFINER gated (select is_superadmin())
   ├──▶ .rpc('get_churn') / get_plan_mix ┘   → 0 ligne si non-superadmin (jamais throw)
   ├──▶ .from('profiles'|'payments'|...) ──▶ RLS « superadmin voit tout » (0017 + 0021)
   │        keyset: .order(created_at desc, id desc).limit(N+1) + .or() tuple-compare
   ▼
Server Actions ('use server')  ── requireRole('superadmin') (re-gate) ──▶
   └──▶ .rpc('grant_subscription_time' | 'suspend_account' | 'admin_mark_commission_paid')
            SECURITY DEFINER : garde is_superadmin() + action + INSERT admin_audit_log (atomique)
   ▼
Postgres : RLS = SEULE barrière non contournable (D-01) · matview mv_mrr (sans RLS, gated wrapper)
```

### Recommended structure (enrichir l'existant, NE PAS recréer)
```
apps/web/src/
├── app/(admin)/
│   ├── layout.tsx                 # inchangé (gate déjà là)
│   ├── page.tsx                   # → home cockpit 4 sections (D-05/07), anon-client
│   ├── _components/AdminSidebar.tsx  # → regroupé 4 axes (D-06)
│   ├── _components/AxisSummary*.tsx   # NOUVEAU : cartes résumé par axe
│   ├── membres/{page,actions}.tsx # anon + keyset + filtres serveur + RPC gated
│   ├── file/{page,actions}.tsx
│   ├── sante/page.tsx · signaux/{page,[id]}.tsx (lecture seule)
│   └── affiliation/**             # anon + admin_mark_commission_paid
├── lib/admin/searchParams.ts      # NOUVEAU : AdminUsersParamsSchema (calque signals)
├── lib/admin/kpis.ts              # NOUVEAU : wrappers typés .rpc(get_*)
├── lib/keyset/cursor.ts           # réutilisé
└── lib/auth/gate.ts               # + branche suspension (D-17)
supabase/migrations/0021_admin_cockpit.sql  # 3-5 policies + admin_audit_log + profiles.suspended + RPC
```

### Anti-Patterns to Avoid
- **Route/matview sans garde (Pitfall #3 roadmap)** : une page sans `is_superadmin()` en 1ʳᵉ ligne OU une matview lue en direct sans wrapper = fuite cross-tenant. Toujours wrapper (`get_*`), jamais `grant select` direct sur une matview (cf. `revoke all on mv_mrr` 0017 L.278).
- **service_role côté page** (D-01) : interdit. Le test `rls-unchanged` étendu doit l'attraper.
- **Chiffre de perf fabriqué** (VITR-03) : pas d'equity/ROI/% littéral ; tout via `applyThreshold`/mesure.
- **Édition/création de signaux ou % côté admin** : casserait `persist.ts` (frontière producteur-unique). Signaux admin = **lecture seule** (D-09).
- **Filtrage en mémoire JS à 10k** (`membres/page.tsx` actuel) : remplacer par filtres `.eq/.ilike` + keyset côté requête.
- **`source` comme gate de lecture** : `source` est un LABEL, jamais une policy (anti-pattern 0018 T-18-01). Filtre UI only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pagination grandes tables | OFFSET / virtualisation client / react-table | `lib/keyset/cursor.ts` + `.or()` tuple-compare | D-14 zéro dépendance ; index keyset LIVE ; Index Scan pas Sort |
| Lecture KPI agrégé sécurisée | `grant select` matview + filtre JS | wrapper `SECURITY DEFINER` gated calque `get_mrr` | matview = pas de RLS ; seule la garde wrapper empêche la fuite |
| Écriture admin tracée | UPDATE + INSERT audit séparés (non atomiques) | RPC `SECURITY DEFINER` calque `mark_commission_paid` | atomicité action+audit, anti double-effet, search_path figé |
| Gating page | guard inline par page | `requireRole('superadmin')` du layout | déjà en place, 404 discret, source unique |
| Validation filtres URL | parsing manuel | `z.enum` safeParse champ par champ (calque `searchParams.ts`) | anti-injection T-03-05, tolérant |
| MRR | recalcul JS | `get_mrr()` (mv_mrr) | définition A1 verrouillée « cash encaissé » |

**Key insight:** ~90 % de l'infra existe déjà (P17 policies superadmin + matview + index keyset ; P19 cursor + URL-state ; P8 pages germe + freshness/jobs helpers). Le neuf est petit et chirurgical : 0021 (3-5 policies + audit + suspended + RPC) et la réécriture du chemin d'accès données (service_role → anon).

## Runtime State Inventory (rename/refactor — bascule service_role→anon)

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `profiles` LIVE sans policy superadmin ; `mv_mrr` LIVE (refresh manuel, ordonnanceur hors scope) | 0021 ajoute policies ; refresh `mv_mrr` reste manuel/job (déjà le cas) |
| Live service config | `admin-service.ts` lit `SUPABASE_SERVICE_ROLE_KEY` (`apps/web/.env.local`) | Après bascule D-01, ce module n'est plus importé par les pages ; la clé reste utile aux jobs/seed. Ne pas supprimer la clé (jobs en dépendent). |
| OS-registered state | Aucun (cockpit = code/SQL only) | None — vérifié (pas de tâche planifiée touchée par P20) |
| Secrets/env vars | `LEGAL_REVIEW_DONE` (lu par `lib/legal-gate.ts`, panneau Conformité D-18) | None — code rename only, env inchangé |
| Build artifacts | `database.types.ts` (édité main après chaque migration) | Régénérer + ré-appliquer alias/`*_atomic` après 0021 (Pitfall 5) |

**Indexes keyset LIVE (vérifiés STATE.md « 0017 : Partie A + 5 index CONCURRENTLY, 0 INVALID ») :** `profiles_keyset_idx`, `payments_keyset_idx`, `trade_setups_keyset_idx`, `mv_mrr_month_idx`, + un user_id. `0020` keyset `user_followed_setups` aussi LIVE. → keyset users/file/affiliés prêt sans nouvel index (confirmer par EXPLAIN au gate).

## Common Pitfalls

### Pitfall 1: `profiles` jointure email échoue silencieusement sous RLS anon
**What goes wrong:** En basculant `membres`/`file`/`affilies` en anon-client AVANT d'avoir posé `profiles: superadmin voit tout`, le `profiles!inner(email)` renvoie 0 ligne (RLS), pages vides.
**How to avoid:** Appliquer 0021 (policy profiles) **avant** la bascule anon des pages, ou dans la même vague. `get_advisors` + test RLS anon-superadmin au gate.
**Warning signs:** Table membres vide alors que des subscriptions existent.

### Pitfall 2: `telegram_posts` / `candles` 0 ligne → statut/santé faussés
**What goes wrong:** `telegram_posts` n'a AUCUNE policy SELECT → signaux admin affiche tout « unpublished ». `candles` gated abonnés → `v_data_freshness` vide → santé faussement rouge pour un superadmin non-abonné.
**How to avoid:** Policies superadmin 0021 sur `telegram_posts` et `candles`.
**Warning signs:** Tous les signaux « non publiés » ; santé candles rouge sans raison.

### Pitfall 3: Matview lue en direct (fuite cross-tenant)
**What goes wrong:** Lire `mv_mrr`/une future matview via `.from()` au lieu du wrapper `get_*` → Supabase grant SELECT par défaut → PostgREST expose les données à tout authentifié (advisor `materialized_view_in_api`).
**How to avoid:** `revoke all on <matview> from anon, authenticated` (0017 L.278) ; lecture UNIQUEMENT via wrapper gated.

### Pitfall 4: Suspension contournable (UI seule)
**What goes wrong:** Cacher des boutons côté UI sans barrière données → l'user suspendu lit toujours via l'API.
**How to avoid:** D-17 deux niveaux : gate `requireUser` (suspended→signOut) ET RLS (helper `has_active_subscription` étendu `and not suspended` → 0 ligne). Tester depuis client anon suspendu.

### Pitfall 5: `database.types.ts` désaligné après 0021
**What goes wrong:** Projet non `link`é → `gen types --linked` échoue ; types des nouveaux RPC/`admin_audit_log` manquants, casse le typecheck.
**How to avoid:** `generate_typescript_types` MCP → édition manuelle (ré-appliquer alias + override `*_atomic` string) → typecheck vert (Pitfall connu 0016/0017/0018).

### Pitfall 6: `.or()` keyset non sanitizé (injection PostgREST)
**What goes wrong:** Le curseur décodé est interpolé dans `.or()` (non paramétré) ; un id/timestamp trafiqué portant `,`/`)` altère le filtre.
**How to avoid:** `sanitizeCursor` (regex ISO+UUID) avant interpolation (calque `watchlist/queries.ts` L.93-101). Curseur opaque, RLS scope toujours.

## Code Examples (sources vérifiées repo)

### Lecture KPI gated (RSC) — remplace service_role
```ts
// Source: calque lib/auth/gate.ts (createClient anon) + 0017 get_mrr
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient()           // ANON @supabase/ssr (cookies superadmin)
const { data: mrr } = await supabase.rpc('get_mrr')             // 0 ligne si non-superadmin
const { data: churn } = await supabase.rpc('get_churn', { p_month })
```

### RPC écriture gated atomique (0021) — calque mark_commission_paid (0016)
```sql
create function public.suspend_account(p_user_id uuid, p_reason text)
  returns void language plpgsql security definer set search_path = public as $$
begin
  if not (select public.is_superadmin()) then
    raise exception 'forbidden';                                 -- D-03 garde gated
  end if;
  update public.profiles set suspended = true, suspended_reason = p_reason, suspended_at = now()
   where id = p_user_id;
  insert into public.admin_audit_log (actor_id, action, target_type, target_id, payload)
  values ((select auth.uid()), 'suspend_account', 'user', p_user_id,
          jsonb_build_object('reason', p_reason));               -- D-04 audit atomique
end; $$;
revoke execute on function public.suspend_account(uuid, text) from public, anon;
grant  execute on function public.suspend_account(uuid, text) to authenticated;
```

### Keyset users (RSC) — calque watchlist/queries.ts
```ts
// Source: lib/watchlist/queries.ts L.110-154 (sanitizeCursor + tuple-compare)
const cursor = sanitizeCursor(decodeCursor(params.cursor))
let q = supabase.from('profiles')
  .select('id, email, created_at, source, role, suspended, subscriptions(status, plan, current_period_end)')
  .order('created_at', { ascending: false }).order('id', { ascending: false })
  .limit(PAGE_SIZE + 1)
if (params.source) q = q.eq('source', params.source)            // D-15 filtre indexé
if (params.email)  q = q.ilike('email', `%${params.email}%`)     // paramétré
if (cursor) q = q.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`)
```

## State of the Art

| Old Approach (germe P8) | Current Approach (P20) | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pages admin lisent via `createAdminServiceClient` (service_role) | anon-client + RLS superadmin + wrappers gated | P20 D-01 | frontière sécurité ; service_role hors des pages |
| Mutations via repos service_role (`activateForPayment`…) | RPC `SECURITY DEFINER` gated + audit | P20 D-03/D-04 | atomicité + traçabilité |
| Filtres en mémoire JS (charge tout) | filtres `.eq/.ilike` + keyset serveur | P20 D-14/D-15 | tenue à 10k |
| `mark_commission_paid` service_role-only | `admin_mark_commission_paid` gated authenticated | P20 | payout sans service_role côté page |

**Deprecated/outdated:** `@supabase/auth-helpers` (déjà remplacé par `@supabase/ssr` projet-wide).

## Validation Architecture

> `workflow.nyquist_validation` non désactivé (absent = activé). Section incluse.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.8 (rolldown-vite/oxc), env `node`, globals:false |
| Config file | `vitest.config.ts` (racine) — inclut `apps/web/test/**`, `apps/web/src/lib/**/*.test.ts`, `apps/**/__tests__/**` |
| Quick run | `pnpm vitest run <file>` |
| Full suite | `pnpm vitest run` (+ `pnpm typecheck`) |
| Tests RLS live | `.env.test` (anon key) chargé par vitest.config (intégration RLS anon) |
| E2E | Playwright 1.60.0 (gating admin → Phase 21) |

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Command | Exists? |
|-----|----------|-----------|---------|---------|
| ADASH-07 | Non-superadmin → 404 discret | E2E gating | Playwright (existant, étendre P21) | ✅ (gating.spec) |
| ADASH-07 | Pages admin n'importent PAS service_role | static scan | étendre `rls-unchanged.test.ts` à `(admin)` | ❌ Wave 0 |
| ADASH-07 | Superadmin RLS lit `profiles`/`telegram_posts`/`candles` ; non-superadmin 0 ligne via wrapper | integration RLS anon | nouveau `apps/web/test/admin-rls.test.ts` (anon-client 2 rôles) | ❌ Wave 0 |
| ADASH-02 | MRR = cash encaissé, libellé honnête, pas de `%` fabriqué | static i18n + source | étendre `no-perf-claims` (namespace `admin`) + `no-perf-seed-claims` (ADMIN_UI_FILES) | ❌ Wave 0 |
| ADASH-04 | Keyset users : Index Scan pas Sort | EXPLAIN (gate MCP) | `explain select … from profiles order by created_at desc,id desc limit 20` | ✅ index LIVE |
| ADASH-04 | Filtre cursor injection-safe | unit | étendre `lib/keyset/__tests__/cursor.test.ts` + sanitize | ✅ partiel |
| D-03/D-04 | RPC atomique : action+audit ou rien ; non-superadmin → forbidden | integration | `admin-rls.test.ts` (appel RPC en rôle member → 0/exception) | ❌ Wave 0 |
| D-17 | Suspendu → 0 ligne signaux (RLS), gate signOut | integration RLS | `admin-rls.test.ts` (helper suspended) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm vitest run apps/web/test/<touched>` + `pnpm typecheck`
- **Per wave merge:** `pnpm vitest run` (suite complète, actuellement ~621✓)
- **Phase gate:** suite verte + `get_advisors(security|performance)` 0 nouvelle alerte + EXPLAIN keyset Index Scan + RLS anon-superadmin/non-superadmin prouvée.

### Wave 0 Gaps
- [ ] `apps/web/test/admin-rls.test.ts` — RLS anon 2 rôles (superadmin voit / member 0 ligne) sur profiles/telegram_posts/candles/trade_setups + RPC forbidden + suspension 0-ligne (ADASH-07, D-03/D-17)
- [ ] Étendre `apps/web/src/styles/__tests__/rls-unchanged.test.ts` → scanner `(admin)` une fois service_role retiré (ADASH-07/D-01)
- [ ] Étendre `apps/web/test/no-perf-claims.test.ts` (namespace `admin`) + `no-perf-seed-claims.test.ts` (ADMIN_UI_FILES) (D-13)
- [ ] `lib/admin/searchParams.ts` + tests parse/serialize filtres users (calque `searchParams.ts`)
- [ ] Framework install : aucun (Vitest/Playwright présents)

## Security Domain

> `security_enforcement` non désactivé → inclus.

### Applicable ASVS Categories
| ASVS | Applies | Standard Control |
|------|---------|------------------|
| V2 Authentication | yes | `getUser()` token revalidé serveur (`authedClient`) |
| V3 Session | yes | `@supabase/ssr` cookies ; suspension → signOut (D-17) |
| V4 Access Control | **yes (cœur)** | RLS `is_superadmin()` (DB) + `requireRole` (gate) ; RPC gated ; 404 discret ; audit |
| V5 Input Validation | yes | `z.enum` safeParse filtres ; `sanitizeCursor` ; RPC params whitelistés (`p_interval`) |
| V6 Cryptography | no | aucune crypto custom |
| V7 Errors/Logging | yes | `admin_audit_log` (traçabilité D-04) ; pas de fuite d'erreur |

### Known Threat Patterns
| Pattern | STRIDE | Mitigation |
|---------|--------|-----------|
| Page/matview sans garde → fuite cross-tenant (Pitfall #3) | Info Disclosure | RLS superadmin + wrapper gated `get_*` ; `revoke all` matview |
| Server Action POST direct sans re-gate | Elevation | `requireRole('superadmin')` en tête CHAQUE action + garde `is_superadmin()` DANS le RPC |
| Injection via `.or()` keyset | Tampering | `sanitizeCursor` (ISO+UUID) avant interpolation |
| Injection valeur RPC (`p_interval`) | Tampering | whitelist `{'7 days','1 month','3 months'}` (calque `actions.ts` PERIODS) |
| Suspension contournée (UI seule) | Elevation | gate + RLS helper étendu (D-17) |
| service_role bundlé navigateur | Info Disclosure | bascule anon (D-01) + `server-only` + test `rls-unchanged` étendu |
| Double payout | Tampering | `where status='due'` + raise si row_count=0 (calque 0016) |

## Project Constraints (from CLAUDE.md)
- **Tech stack** : Next.js 15 (pas 16) + Supabase ; TS strict ; pnpm workspaces.
- **Migrations** : MCP `apply_migration` (jamais `db push`) ; `CONCURRENTLY` hors tx via `execute_sql` ; puis `generate_typescript_types` → `database.types.ts` édité main → `get_advisors`.
- **RLS = vraie barrière** : anon-client côté page, jamais service_role ; gate UX ≠ barrière.
- **Montants** : BigInt atomique `*_atomic` string, jamais float.
- **% TOUJOURS mesuré** (VITR-03) : via `applyThreshold`, jamais inventé ; no-perf-claims vert.
- **Sécurité** : pas de secret hardcodé ; service_role réservé aux jobs.
- **GSD Workflow** : passer par une commande GSD avant Edit/Write.
- **i18n** : admin mono-FR (hors `[locale]`, NextIntlClientProvider FR fixe) — pas de RTL admin.

## Assumptions Log
| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Ajouter policies superadmin sur `trade_setups` + `analyses` (5 policies 0021 total) car le superadmin réel n'est pas garanti abonné | §Bascule anon + Migration Mapping | Si superadmin TOUJOURS abonné → 2 policies superflues (inoffensives) ; sinon signaux admin vides → policies requises |
| A2 | Recommandation d'étendre `has_active_subscription()` pour inclure `and not suspended` (vs canceler la sub) | §profiles.suspended | Si refusé, suspension réelle nécessite une autre barrière RLS (par-table) — plus verbeux |
| A3 | Funnel/churn/mix restent à la volée (pas de matview) | §KPIs | Si `EXPLAIN ANALYZE` montre coût rédhibitoire à 10k → basculer en matview+wrapper (D-10 le permet) |
| A4 | Indexes 0017 Partie B bien LIVE et valides (profiles/payments keyset) | §Keyset | Source = STATE.md ; à reconfirmer par EXPLAIN au gate (si INVALID → recréer CONCURRENTLY) |
| A5 | Garder les URLs admin actuelles (sidebar réorganisée sans renommer les routes) | §Sidebar & routing | Si renommage voulu → ajouter redirections (dette) |

## Open Questions
1. **Le superadmin de prod a-t-il un abonnement actif ?** (tranche A1 : faut-il policies superadmin sur trade_setups/analyses ?). Reco : ajouter les policies (couplage caché évité).
2. **Ordonnanceur de `refresh_mv_mrr()`** : hors scope P17 (Open Question 1 jamais résolue, PC éteignable). Le MRR cockpit affiche le dernier refresh ; envisager un bouton refresh admin (RPC `refresh_mv_mrr` est service_role-only → nécessiterait un wrapper gated) OU afficher « dernier calcul le … ». À trancher au plan (low priority).
3. **Realtime cockpit (optionnel D-15 CONTEXT)** : topic Broadcast `topic:new-signals` existe (P17) mais filtré abonnés. Rafraîchir KPIs/file en live = nouveau topic admin gated `is_superadmin()` sur `realtime.messages`. Non décidé, optionnel, coût non trivial → recommander **différer** sauf si trivial.

## Environment Availability
| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase MCP (`apply_migration`/`execute_sql`/`generate_typescript_types`/`get_advisors`) | Migration 0021 LIVE | ✓ (MCP connecté, projet) | — | — |
| Seed ~10k LIVE (P18) | EXPLAIN ANALYZE KPIs, démo cockpit | ✓ | source='demo' | — |
| mv_mrr LIVE + index keyset | MRR + keyset | ✓ (P17 LIVE, STATE) | — | recréer si INVALID |
| Node ≥ 20.12 (`process.loadEnvFile`) | tests RLS `.env.test` | ✓ (vitest.config) | — | — |

**Missing with no fallback:** aucun. **Missing with fallback:** aucun (tout l'outillage présent).

## Sources

### Primary (HIGH confidence)
- Repo migrations : `0001` (profiles/instruments/job_runs RLS), `0003` (candles/news/macro/v_data_freshness), `0004` (freshness view), `0008` (is_superadmin), `0009` (subscriptions/has_active_subscription), `0012` (payments policies), `0014` (prediction_outcomes), `0015` (telegram_posts — no SELECT policy), `0016` (affiliation RPC atomique + payout calque), `0017` (wrap InitPlan + mv_mrr/get_mrr + index keyset Partie B), `0018` (source column), `0020` (user_followed_setups keyset).
- Repo code : `(admin)/{page,membres,file,sante,signaux,affiliation/*}.tsx` + `actions.ts`, `lib/supabase/admin-service.ts` (preuve profiles sans policy superadmin), `lib/auth/gate.ts`, `lib/keyset/cursor.ts`, `lib/watchlist/queries.ts`, `lib/signals/searchParams.ts`, `lib/legal-gate.ts`, `test/no-perf-claims.test.ts`, `test/no-perf-seed-claims.test.ts`, `styles/__tests__/rls-unchanged.test.ts`, `vitest.config.ts`.
- `.planning/` : CONTEXT.md (D-01..D-18), REQUIREMENTS.md (ADASH-01..07), ROADMAP.md (Phase 20), PROJECT.md (VITR-03, pricing 9$/3$, service_role jobs), STATE.md (0017/0020 LIVE, 5 index 0 INVALID).

### Secondary (MEDIUM)
- STATE.md notes de reprise P17 (gates advisors verts, REFRESH CONCURRENTLY OK) — non re-vérifié live cette session.

### Tertiary (LOW)
- Aucune (recherche 100 % codebase/migrations, pas de WebSearch nécessaire — domaine = patterns internes verrouillés).

## Metadata
**Confidence breakdown:**
- Migration 0021 mapping : HIGH — chaque table lue tracée à sa policy par fichier+lignes.
- KPIs à-la-volée vs matview : HIGH (décision D-10 + calque get_mrr) ; EXPLAIN à confirmer au gate (A3).
- RPC/audit schema : HIGH — calque direct 0016 `mark_commission_paid`.
- Keyset/filtres : HIGH — réutilisation directe P19 (cursor + watchlist pattern).
- Suspension barrière RLS : MEDIUM — recommandation (extension helper) vs alternative (A2).

**Research date:** 2026-06-26
**Valid until:** 2026-07-26 (stable — stack verrouillée, infra interne ; re-vérifier si nouvelles migrations 0021+).
