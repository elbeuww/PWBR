# Phase 20: Dashboard superadmin (cockpit 4 axes) - Context

**Gathered:** 2026-06-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Refondre le groupe de routes `(admin)` existant (6-9 pages **germe** de Phase 8) en **cockpit superadmin complet sur 4 axes — Acquisition / Revenus / Ops / Conformité** — avec KPIs **mesurés** sur données seedées (~10k) et tables paginées filtrables, sous gating `is_superadmin()` strict (404 discret pour un non-superadmin) et **zéro fuite cross-tenant**. On **enrichit + reskine** l'existant, on ne recrée pas.

**Bascule architecturale majeure de la phase :** retirer `service_role` des pages admin (pattern germe P8) et passer **tout en anon-client + RLS superadmin + matviews/wrappers gated** (pattern P17). C'est la frontière sécurité centrale.

**Gestion superadmin incluse (lecture + écritures ciblées) :** voir les utilisateurs (table keyset filtrable, état d'abonnement), **offrir des jours/mois gratuits**, **suspendre des comptes**, voir les affiliés + payouts manuels (existants). Toutes les écritures admin passent par des RPC `SECURITY DEFINER` gated + audit.

**Anti-features (frontières inviolables) :** pas d'édition manuelle des % ni de création/édition de signaux côté admin (casserait `persist.ts`, frontière producteur-unique) ; aucun chiffre de performance fabriqué (tests `no-perf-claims`).

</domain>

<decisions>
## Implementation Decisions

### Accès données & sécurité (Axe 1)
- **D-01:** **Tout en anon-client + RLS superadmin.** Supprimer `createAdminServiceClient` des pages `(admin)`. Lectures de tables via policies « superadmin lit tout » (`using (select public.is_superadmin())`, wrap InitPlan P17 D-01) ; KPIs/matviews via wrappers gated `SECURITY DEFINER` (calque `get_mrr()`). **Jamais service_role côté page** (adresse Pitfall #3 : route sans gate / matview sans wrapper).
- **D-02:** Pour les tables lues par l'admin **sans policy superadmin encore posée** (P17 n'a pas tout couvert) → **migration `0021`** ajoutant une policy « superadmin lit tout » par table manquante. RLS = source de vérité (calque P17). Migration via MCP `apply_migration` (jamais `db push`), puis `generate_typescript_types` → édition `database.types.ts` → `get_advisors`.
- **D-03:** Les **écritures admin** (prolonger abo, suspendre compte, payouts manuels) passent par des **RPC `SECURITY DEFINER` gated `(select is_superadmin())`** (calque payout atomique 0016) : audit centralisé, atomicité, `set search_path = public` figé. Pas de policies write éparpillées, pas de service_role.
- **D-04:** **Table `admin_audit_log` dédiée** : chaque écriture admin sensible (offrir gratuit, suspendre, payout) logge acteur + cible + action + horodatage, écrit **dans le RPC `SECURITY DEFINER`** (atomique avec l'action). La traçabilité est une valeur cœur du projet.

### Structure du cockpit (Axe 2)
- **D-05:** Architecture = **home cockpit unique** : enrichir `(admin)/page` en vue d'ensemble = **4 sections résumées** (KPIs par axe) ; clic = **drill-down** vers les pages détail existantes (membres, file, santé, signaux, affiliation…). Pas de pages d'axe pleines séparées.
- **D-06:** **AdminSidebar regroupée par les 4 axes** (Acquisition / Revenus / Ops / Conformité), pages rangées sous leur axe. Cohérence mentale cockpit (vs liste plate actuelle).
- **D-07:** **Ordre de lecture en proue de la home** = **Revenus → Ops → Acquisition → Conformité**. Revenus (MRR/churn/mix) en tête car le business = rétention/revenus (aligne sur l'overview user P19 D-08).
- **D-08:** **Reskin DS v3 Tier App sobre** : pas de néon (lisibilité d'abord, calque P16 D-04/D-05), tables denses, **feux sémantiques green/amber/red déjà tokenisés** du germe pour les statuts (swap law : green→signal-bullish, amber→risk-moderate, red→destructive).
- **D-09:** Les pages germe (`membres`, `file`, `sante`, `signaux`, `affiliation/*`) sont **enrichies + reskinées en place**, pas recréées. **Signaux admin = lecture seule** (anti-feature : pas d'édition/création de signaux).

### KPIs mesurés & matviews (Axe 3)
- **D-10:** Pattern KPIs **hybride** : réutiliser `mv_mrr` ; nouveaux KPIs (funnel, churn, mix plans) via **RPC gated à la volée** (COUNT/GROUP BY sur colonnes indexées, peu coûteux à ~10k) ; créer une **matview + wrapper gated** seulement si `EXPLAIN ANALYZE` le justifie (ex. funnel temporel coûteux). Évite la complexité de refresh inutile (PC potentiellement éteint).
- **D-11:** **Funnel d'acquisition** (puisqu'il n'y a **pas de compte gratuit**, P19) = **Inscription (profiles créés) → 1er paiement vérifié (activation) → abonnement renouvelé (rétention)**, segmentable par `source` / affilié. Étapes mesurables sur tables existantes.
- **D-12:** **Churn** = **taux mensuel** : abonnés dont la période a expiré sans renouvellement ÷ abonnés actifs en début de mois. Calculable sur `subscriptions.current_period_end`.
- **D-13:** **Labellisation honnête de chaque KPI** : valeur **mesurée + N + période + source**. MRR libellé **« cash encaissé/mois »** (Σ paiements `verified`, PAS « MRR récurrent dédupliqué », calque P17) ; % via `applyThreshold`. **Test `no-perf-claims` étendu aux pages admin.** Aucun chiffre fabriqué (VITR-03).

### Actions superadmin & gestion (Axe 4)
- **D-14:** **Tables admin à ~10k lignes (users, affiliés, file) = pagination serveur keyset** via le helper `cursor.ts` (livré P19), la page borne le DOM (~50 lignes). **Décision libs tranchée : PAS de `@tanstack/react-virtual` ni `react-table`** — on tranche le conflit (note roadmap « react-virtual » vs décision **zéro nouvelle dépendance** P19) **en faveur de P19**.
- **D-15:** **Filtres table utilisateurs (ADASH-04)** = serveur, combinables sur colonnes indexées : **état d'abonnement** (actif/expiré/aucun) + **`source`** (demo/backtest/live) + **recherche email ou id**.
- **D-16:** **« Offrir des jours/mois gratuits »** = bouton sur la ligne user → **dialog presets (7j / 1 mois / 3 mois / custom)** → RPC gated qui **prolonge (ou crée) la période d'abonnement** + écrit `admin_audit_log`.
- **D-17:** **Suspension de compte** = **nouvelle colonne `profiles.suspended` (+ raison)** ; un suspendu est **bloqué réellement** (gate `requireUser` + RLS → 0 ligne, **jamais l'UI seule** — « RLS = vraie barrière ») ; **réversible** ; via RPC gated + audit.

### Conformité (Axe 5 / ADASH-06)
- **D-18:** **Panneau Conformité read-only** : feu `LEGAL_REVIEW_DONE` (vert/rouge via `lib/legal-gate.ts`) + **version de l'artefact légal en vigueur + date de revue**. Traçabilité conformité (pas seulement un booléen).

### Claude's Discretion
- Découpage exact migration `0021` (quelles tables ont déjà une policy superadmin P17 vs lesquelles manquent) — à mapper en recherche/plan en lisant `0017` + les policies existantes par table.
- Quels KPIs basculent en matview vs restent à la volée — à trancher via `EXPLAIN ANALYZE` sur le seed ~10k (D-10).
- Signature/nommage exacts des RPC `SECURITY DEFINER` (`grant_subscription_time`, `suspend_account`, etc.) et schéma de `admin_audit_log` — laissés au planner (respecter le calque `get_mrr`/payout 0016 : revoke public/anon, grant authenticated, `set search_path = public`).
- Redirection éventuelle des anciennes URLs admin si la sidebar est réorganisée — au planner.
- Branchement Realtime sur le cockpit (rafraîchir les KPIs/file en live via topic Broadcast P17 D-04) — non décidé, optionnel, au planner si peu coûteux.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & exigences
- `.planning/ROADMAP.md` §"Phase 20: Dashboard superadmin (cockpit 4 axes)" — goal, success criteria, notes (enrichir le germe sans recréer, Pitfall #3 fuite cross-tenant, anti-feature édition %/signaux).
- `.planning/REQUIREMENTS.md` — ADASH-01 à ADASH-07 (texte complet : acquisition, revenus mesurés, ops, gestion users, gestion paiements/affiliés, conformité, gating is_superadmin sans fuite).
- `.planning/PROJECT.md` — VITR-03 (% toujours mesuré + provenance), `<Disclaimer />`, RLS stricte, service_role réservé aux jobs, pricing 9$/3$ (`discovery`/`standard`), affiliation 20% max.

### Décisions de phases antérieures à respecter
- `.planning/phases/16-reskin-transversal-de-toutes-les-pages/16-CONTEXT.md` — DS v3 green-only dark (D-01/D-03), **Tier App lisibilité d'abord** (D-04/D-05), **fetch anon-client RLS jamais service_role** (D-12), % via `applyThreshold` (D-13), score=anneau / couleur=risque (D-11).
- `.planning/phases/17-fondation-db-scalable-perf-avant-charge/17-CONTEXT.md` — **RLS InitPlan wrap `(select fn())`** (D-01), **matview `mv_mrr` + wrapper gated `get_mrr()` SECURITY DEFINER** (D-02, infra réutilisable de référence), index keyset `(created_at desc, id desc)` (D-03), Realtime Broadcast topic `new-signals` (D-04). **Seule matview livrée à ce jour.**
- `.planning/phases/18-seed-de-donn-es-r-alistes-l-chelle/18-CONTEXT.md` — colonne `source` (`demo`/`backtest`/`live`), seed idempotent ~10k, **pattern test anti-IDOR / no-perf client anon** (D-07).
- `.planning/phases/19-dashboard-utilisateur/19-CONTEXT.md` — **zéro nouvelle dépendance + keyset maison `cursor.ts`** (D-05 + Claude's Discretion), **pas de compte gratuit / 3 dashboards séparés** (D-03), interdit equity/P&L/ROI (D-09), gates `requireUser`/`requireRole`.

### Surfaces SQL de référence (calques exacts pour migration 0021 + RPC)
- `supabase/migrations/0008_profiles_role.sql` (L.29-47) — forme canonique `is_superadmin()` (revoke public/anon, grant authenticated).
- `supabase/migrations/0017_scalable_foundation.sql` (Section 2, L.230-290) — `mv_mrr` + `get_mrr()` gated + `refresh_mv_mrr()` : **calque exact** des nouveaux wrappers KPI ; toutes les policies superadmin P17 (`using (select public.is_superadmin())`).
- `supabase/migrations/0016_affiliation.sql` — RPC payout **atomique** (calque écritures admin), tables `affiliates`/`affiliate_codes`/`payouts`, RLS « lis les tiens + superadmin sans write ».
- `supabase/migrations/0009_subscriptions_gating.sql` — table `subscriptions` (plan `discovery`/`standard`, `current_period_end`), `has_active_subscription()`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (enrichir + reskin, NE PAS recréer)
- `apps/web/src/app/(admin)/layout.tsx` — gate **`requireRole('superadmin')` → notFound() (404 discret)** déjà en place ; mono-FR hors `[locale]` (NextIntlClientProvider FR fixe) ; `<Toaster />` sonner monté. **Aucun guard inline à dupliquer.**
- `apps/web/src/app/(admin)/page.tsx` — landing germe (≥3 KPI head-counts) → **devient la home cockpit 4 sections** (D-05). **Utilise `createAdminServiceClient` → à retirer** (D-01).
- `apps/web/src/app/(admin)/_components/AdminSidebar.tsx` — nav (à regrouper par 4 axes, D-06).
- Pages germe à enrichir : `(admin)/membres`, `(admin)/file`, `(admin)/sante`, `(admin)/signaux(/[id])`, `(admin)/affiliation(/affilies/payouts)`.
- Composants admin existants : `components/admin/MemberRowActions.tsx`, `PayoutRowAction.tsx`, `QueueRowActions.tsx`, `ApplicationRowActions.tsx` (row-actions = base pour offrir-gratuit/suspendre).
- `apps/web/src/lib/admin/freshness.ts` — `candleColor`/`ageColor`/seuils + feux tokenisés (Ops/santé).
- `apps/web/src/lib/legal-gate.ts` — état `LEGAL_REVIEW_DONE` (panneau Conformité, D-18).
- `apps/web/src/lib/signals/searchParams.ts` + helper `cursor.ts` (P19) — URL-state custom + keyset (tables admin, D-14).
- `@app/core` : `applyThreshold`, `formatAtomic`, `TIERS`, `affiliateRateBps`. `@app/supabase` : repos typés + `get_mrr` wrapper.

### Established Patterns (contraignent cette phase)
- **Gate** `apps/web/src/lib/auth/gate.ts` : `requireRole('superadmin')` (layout admin), `requireUser`/`requireActiveSub`. La suspension (D-17) doit s'intégrer ici comme barrière réelle.
- **SQL gating** : `is_superadmin()` (0008), wrap InitPlan `(select is_superadmin())` (P17), wrappers gated `SECURITY DEFINER` + revoke public/anon + grant authenticated (calque `get_mrr` 0017).
- **Migrations** : MCP `apply_migration` (jamais `db push`) ; `CONCURRENTLY` hors tx via `execute_sql` ; puis `generate_typescript_types` → `database.types.ts` → `get_advisors`. **Prochaine migration = `0021`** (`0020` = `user_followed_setups` P19, déjà sur disque).
- **RLS = vraie barrière** : fetch anon auth-client, jamais service_role côté page ; gate UX seul jamais suffisant.
- **Montants** : atomiques BigInt → `formatAtomic` / champs `*_atomic` string (jamais float).
- **Tests garde-fous** : `apps/web/test/no-perf-claims.test.ts` + `no-perf-seed-claims.test.ts` (à étendre aux pages admin, D-13).

### Integration Points / À construire (gaps)
- **Retrait `createAdminServiceClient`** des pages `(admin)` + bascule anon+RLS (D-01) — refonte du chemin d'accès données.
- **Migration `0021`** : policies superadmin manquantes par table (D-02) + RPC `SECURITY DEFINER` (offrir-gratuit, suspendre, audit) (D-03) + table `admin_audit_log` (D-04) + colonne `profiles.suspended` (D-17) + éventuelles matviews KPI (D-10).
- **Wrappers KPI gated** (funnel/churn/mix) calqués sur `get_mrr` — n'existent pas (D-10/D-11/D-12).
- **Home cockpit 4 sections** + sidebar regroupée — refonte UI du germe (D-05/D-06/D-07).
- **Dialog « offrir gratuit »** + action « suspendre » (row-actions à étendre) — neuf (D-16/D-17).
- **Branche suspension dans le gate** `requireUser` + RLS — neuf (D-17).

</code_context>

<specifics>
## Specific Ideas

- Le cockpit doit se vivre comme une **salle de contrôle sobre** : Revenus en proue (la rétention = le business), santé Ops juste après, acquisition et conformité ensuite — chiffres mesurés, jamais fabriqués.
- Les actions sensibles (offrir gratuit, suspendre, payout) sont des **gestes tracés** : chacune écrit `admin_audit_log` atomiquement dans son RPC — la traçabilité prime sur la rapidité d'implémentation.
- La frontière producteur-unique est sacrée : l'admin **observe et gère les comptes/paiements**, il ne **fabrique jamais** de signaux ni n'édite les % (casserait `persist.ts`).

</specifics>

<deferred>
## Deferred Ideas

- **Créer des promotions** (codes promo / coupons / discounts) — **aucun système n'existe** (moteur complet : codes, validité, application au checkout, anti-abus, conformité promo MENA). → **sa propre phase** (backlog roadmap, post-v3.0 ou phase dédiée). Ne pas amorcer en P20.
- **Gérer les prix & les offres dynamiquement** — les prix sont des **constantes code** (`discovery` 3$ / `standard` 9$ dans `@app/core`). Les rendre éditables = moteur de pricing dynamique (table plans, versioning, impact RLS gating). → **sa propre phase** (backlog roadmap).
- **Création de liens/codes affiliés par l'admin** — `affiliate_codes` existe mais en **auto-création par l'affilié** (RLS « sans write » pour l'admin) ; un admin qui crée des codes = nouveau chemin d'écriture au-delà d'ADASH-05 (« files / payouts manuels »). → **différé** (micro-extension à requalifier en backlog).

### Reviewed Todos (not folded)
None — aucun todo en attente ne correspondait à la phase 20 (`todo.match-phase 20` = 0).

</deferred>

---

*Phase: 20-dashboard-superadmin-cockpit-4-axes*
*Context gathered: 2026-06-26*
