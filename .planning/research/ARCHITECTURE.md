# Architecture Research — v2.0 (intégration couche produit à l'existant)

**Domain:** Plateforme SaaS par abonnement (signaux trading) — gating multi-rôles, paiement crypto on-chain, affiliation, i18n RTL, CMS, Telegram — greffée sur Next.js 15 App Router + Supabase RLS + monorepo jobs DÉJÀ livré
**Researched:** 2026-06-14
**Confidence:** HIGH (architecture existante lue dans le repo : migrations 0001-0007, middleware, dispatch, RLS ; patterns d'intégration recoupés docs Next 15 / Supabase / next-intl)

> **Périmètre.** Ce document répond à « comment greffer proprement les briques produit v2.0 sur l'architecture livrée (P1-4) ». La stack est verrouillée (STACK.md), les features priorisées (FEATURES.md). Ici : points d'intégration précis, **nouveau vs modifié**, changements de flux de données, **modèle RLS multi-rôles sûr**, et **build order argumenté par les dépendances**. Consommateur : le roadmapper v2.0.

---

## 0. Invariants de l'existant à NE PAS casser

Tout l'ajout v2.0 doit respecter ces invariants livrés (lus dans le repo) :

| Invariant | Source | Conséquence pour v2.0 |
|-----------|--------|------------------------|
| **RLS active sur TOUTES les tables**, sans exception | 0001-0007, policy par défaut deny | Chaque nouvelle table = `enable row level security` + policies explicites dès sa migration. |
| **Frontière producteur unique** : jobs écrivent (service_role bypass), front lit (`select` `to authenticated`) | trade_setups/analyses/candles… aucune policy write | Les données **publiées** (signaux, outcomes, articles) restent écrites par les jobs. **Mais** v2.0 introduit des écritures *initiées par l'utilisateur* (soumettre un TX hash, choisir un code promo) → voir §3 « Frontière producteur étendue ». |
| **Double barrière service_role** : lint interdit l'import du service-client côté `apps/web` + `server-only` | `__lint_fixtures__`, service-client.ts | Aucune Route Handler web ne doit importer le service-client *sauf* points d'écriture serveur strictement contrôlés (webhook, vérif paiement) — voir §3. À documenter comme exception lintée. |
| **Migrations SQL = source de vérité unique** (dernière 0007), pas d'ORM | supabase/migrations | Toutes les tables produit = migrations 0008+. Types régénérés (`gen types`). Repositories typés dans `packages/supabase`. |
| **Session rafraîchie au seul middleware racine** via `getUser()` (jamais `getSession()` serveur) | middleware.ts | Le gating s'appuie sur `getUser()` ; le statut d'abonnement se lit en DB derrière, pas dans un cookie/JWT non revérifié. |
| **Jobs = dispatcher `JOB_REGISTRY` + runner `job_runs` + idempotence** | dispatch.ts, runJob.ts | Tout nouveau travail récurrent (commissions, expiration, Telegram, outcomes) = un job ajouté au registre, idempotent, tracé `job_runs`. Pas de logique planifiée hors de ce moule. |
| **`profiles` lié à `auth.users` par trigger `handle_new_user`** | 0001 | Le **rôle** (member/affiliate/superadmin) vit sur `profiles` (colonne ajoutée), source unique pour le gating. |

---

## Standard Architecture

### System Overview (existant + ajouts v2.0)

```
┌────────────────────────────────────────────────────────────────────────────┐
│  apps/web  (Next.js 15 App Router · RSC · middleware · next-intl)            │
│                                                                              │
│  PUBLIC  [locale]/(marketing)        MEMBER [locale]/(member)   ADMIN (admin)│
│  ┌───────────┐ ┌──────────┐ ┌──────┐ ┌─────────┐ ┌──────────┐  ┌──────────┐ │
│  │ vitrine   │ │ pricing  │ │ CMS  │ │ signaux │ │ paiement │  │ superadmin│ │
│  │ (SSG/ISR) │ │ funnel   │ │articl│ │ liste/  │ │ soumettre│  │ files/    │ │
│  │           │ │          │ │ RSC  │ │ détail  │ │ TX hash  │  │ membres/  │ │
│  └───────────┘ └──────────┘ └──────┘ └────┬────┘ └────┬─────┘  │ affiliés  │ │
│        ▲ lit (anon)              ▲ lit (authenticated)│         └────┬─────┘ │
│        │                         │  GATE: getUser()+  │ WRITE        │ GATE   │
│        │                         │  subscription RLS  │ (server)     │ role   │
│  ┌─────┴──────────────── middleware.ts (racine) ──────┴──────────────┴─────┐ │
│  │ next-intl locale resolve · refresh session getUser() · capture ?ref=   │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│   Route Handlers nodejs (server-only, controlled writes) :                   │
│   /api/payments/submit  · /api/webhooks/cryptomus  · server actions gated    │
└──────────────────────────────┬───────────────────────────────────────────────┘
                               │ anon-client (RLS)            ▲ service-client (bypass, server-only)
                               ▼                              │
┌────────────────────────────────────────────────────────────────────────────┐
│  Supabase Postgres  (RLS partout · migrations 0008+)                         │
│  EXISTANT: profiles instruments job_runs candles news macro …               │
│            snapshots analyses trade_setups                                   │
│  NOUVEAU : profiles.role · subscriptions · payments · affiliates ·          │
│            referrals · commissions · articles · prediction_outcomes ·       │
│            pattern_stats · telegram_posts                                    │
└──────────────────────────────┬───────────────────────────────────────────────┘
                               ▲ service_role bypass (écriture)
┌──────────────────────────────┴───────────────────────────────────────────────┐
│  apps/jobs  (tsx ESM · JOB_REGISTRY · runJob → job_runs · idempotent)        │
│  EXISTANT: ingest×4 · engines×3 · persist (frontière confiance)             │
│  NOUVEAU : payment-watcher · subscription-expiry · commission-calc ·        │
│            outcome-tracker · telegram-publish · (analyze via @anthropic sdk) │
│  Sortants: TronGrid (vérif TX) · Telegram Bot API (grammY) · Anthropic API  │
└────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities (nouveau vs modifié)

| Component | Statut | Responsabilité | Implémentation |
|-----------|--------|----------------|----------------|
| `middleware.ts` racine | **MODIFIÉ** | Résoudre locale (next-intl) + refresh session + capter `?ref=CODE` en cookie | Chaîner next-intl middleware puis `updateSession()` existant (ordre crucial — voir §4) |
| `[locale]/(marketing)` | **NOUVEAU** | Vitrine/pricing/CMS — public, anon-client, SSG/ISR | RSC + `setRequestLocale` pour rester statique |
| `[locale]/(member)` | **NOUVEAU** | Espace gated — liste/détail signaux | RSC layout-gate (vérif abonnement actif) + anon-client RLS |
| `(admin)` | **NOUVEAU** | Superadmin — files paiement, membres, affiliés, santé jobs | RSC layout-gate `role='superadmin'` |
| Route Handler `/api/payments/submit` | **NOUVEAU** | Réception TX hash user → vérif TronGrid synchrone → insert `payments(pending/verified)` | `runtime='nodejs'`, service-client server-only, idempotent sur `tx_hash` |
| Route Handler `/api/webhooks/cryptomus` | **NOUVEAU (étage 2)** | Webhook processeur, vérif signature, activation | `runtime='nodejs'`, corps brut, idempotent `order_id` |
| `payment-watcher` (job) | **NOUVEAU** | Re-vérif périodique des `payments(pending)` confirmations insuffisantes | Job idempotent, complète le check synchrone |
| `subscription-expiry` (job) | **NOUVEAU** | Expirer abonnements échus, marquer relances J-3/J-0 | Job idempotent par `(subscription_id, day)` |
| `commission-calc` (job) | **NOUVEAU** | Créditer commissions récurrentes des abonnés actifs ramenés | Idempotent par `(affiliate_id, period)` |
| `outcome-tracker` (job) | **NOUVEAU** | Comparer setups expirés au prix réel → `prediction_outcomes` + `pattern_stats` | Idempotent par `setup_id` |
| `telegram-publish` (job) | **NOUVEAU** | Poster clôtures + win rate cumulé au canal | grammY `sendMessage`, idempotent par `outcome_id` (`telegram_posts`) |
| `persist.ts` | **INCHANGÉ** | Frontière de confiance des setups | Source du raisonnement migre agent Max → @anthropic SDK (§3.6 STACK), contrat JSON §3 inchangé |
| `packages/supabase` repositories | **MODIFIÉ** | Ajouter repos typés : subscriptions, payments, affiliates, commissions, articles, outcomes | Au-dessus du client typé, RLS appliquée |

---

## Recommended Project Structure (greffe sur l'existant)

```
apps/web/src/
├── middleware.ts                    # MODIFIÉ : next-intl + updateSession + ?ref capture
├── i18n/
│   ├── routing.ts                   # NOUVEAU : locales ['ar','en','fr'], defaultLocale
│   ├── request.ts                   # NOUVEAU : getRequestConfig (charge messages par locale)
│   └── navigation.ts                # NOUVEAU : Link/redirect localisés
├── messages/                        # NOUVEAU : ar.json en.json fr.json (namespaces UI)
├── app/
│   ├── [locale]/                    # NOUVEAU segment racine localisé
│   │   ├── layout.tsx               # <html lang dir=rtl|ltr> + NextIntlClientProvider
│   │   ├── (marketing)/             # public anon — vitrine/pricing/articles
│   │   │   ├── page.tsx             #   vitrine (SSG, setRequestLocale)
│   │   │   ├── pricing/page.tsx
│   │   │   └── articles/[slug]/page.tsx   # CMS RSC (next-mdx-remote/rsc)
│   │   ├── (member)/                # GATED par abonnement
│   │   │   ├── layout.tsx           #   RSC gate : getUser() + subscription active sinon redirect /pricing
│   │   │   ├── signaux/page.tsx     #   liste triée score (react-query + realtime)
│   │   │   ├── signaux/[id]/page.tsx#   détail trade (lightweight-charts)
│   │   │   ├── billing/page.tsx     #   statut abo + expiration
│   │   │   └── pay/page.tsx         #   soumettre TX hash (form → /api/payments/submit)
│   │   └── (affiliate)/             # GATED role=affiliate
│   │       └── dashboard/page.tsx   #   SES referrals/commissions (RLS scoped)
│   ├── (admin)/                     # hors [locale] (back-office mono-langue OK)
│   │   ├── layout.tsx               #   RSC gate role=superadmin
│   │   └── superadmin/{payments,members,affiliates,jobs}/page.tsx
│   └── api/
│       ├── payments/submit/route.ts # runtime nodejs, service-client server-only
│       └── webhooks/cryptomus/route.ts  # étage 2
└── lib/
    └── auth/gate.ts                 # NOUVEAU : requireUser / requireActiveSub / requireRole (RSC helpers)

apps/jobs/src/
├── dispatch.ts                      # MODIFIÉ : enregistrer 5 nouveaux jobs au JOB_REGISTRY
└── jobs/
    ├── payment-watcher.ts           # NOUVEAU
    ├── subscription-expiry.ts       # NOUVEAU
    ├── commission-calc.ts           # NOUVEAU
    ├── outcome-tracker.ts           # NOUVEAU
    └── telegram-publish.ts          # NOUVEAU

packages/
├── supabase/                        # MODIFIÉ : database.types régénérés + nouveaux repos
├── data-sources/                    # MODIFIÉ : + trongrid/ (+ cryptomus/ étage 2) fetch+Zod
└── core/                            # MODIFIÉ (option) : pricing/commission rules déterministes partagées web↔jobs

supabase/migrations/
├── 0008_profiles_role.sql           # role enum + policy admin
├── 0009_subscriptions_payments.sql
├── 0010_affiliates_referrals_commissions.sql
├── 0011_articles_cms.sql
└── 0012_prediction_outcomes_pattern_stats_telegram.sql
```

### Structure Rationale

- **`[locale]` enveloppe tout le front public/membre** : next-intl exige le segment pour le routing localisé et le RTL au layout. Le **back-office `(admin)` reste hors `[locale]`** (mono-langue assumé — l'opérateur n'a pas besoin de RTL/EN/FR ; réduit la surface de traduction).
- **Trois route groups gated séparés** (`(member)`, `(affiliate)`, `(admin)`) : chaque layout porte sa propre **porte serveur** (gate). Isolation claire des règles d'accès, pas de gating éparpillé page par page.
- **`lib/auth/gate.ts`** centralise `requireUser/requireActiveSub/requireRole` → une seule implémentation testable, pas de copie de logique de sécurité.
- **Jobs neufs dans le moule existant** : aucun nouveau mécanisme de scheduling — ils entrent dans `JOB_REGISTRY`, héritent de `job_runs` et de l'idempotence. Cohérent avec « PC éteint → backup Task Scheduler ».

---

## Modèle de gating & RLS multi-rôles (cœur sécurité)

### Rôles

`profiles.role` (NOUVEAU, migration 0008) — enum `('member','affiliate','superadmin')`, défaut `'member'`.
Source unique de vérité du rôle. **Pas** dans le JWT app_metadata (évite la désync token/DB). Lecture serveur via `getUser()` puis jointure `profiles`.

> Note : un affiliate est aussi un membre potentiel. Le rôle gère l'accès au **dashboard affilié** ; l'accès aux signaux dépend de l'**abonnement actif**, pas du rôle. Les deux dimensions sont orthogonales.

### Deux dimensions de contrôle — ne pas les confondre

| Dimension | Porte | Mécanisme |
|-----------|-------|-----------|
| **Authentifié ?** | accès à tout `(member)`/`(affiliate)`/`(admin)` | `getUser()` au layout/middleware |
| **Abonnement actif ?** | lecture des **signaux** (table `trade_setups`/`analyses`) | **RLS** + RSC gate |
| **Rôle ?** | dashboard affilié / superadmin | RSC gate `requireRole` + RLS scoping |

### Où vit la vérification — défense en profondeur (3 couches)

1. **Middleware racine** — résout locale + rafraîchit session. **Ne décide pas** l'accès fin (il ne fait pas de requête DB lourde par requête). Il peut rediriger un non-authentifié hors des segments gated (cheap), mais la vérité d'accès est plus bas.
2. **RSC layout gate** (`(member)/layout.tsx` etc.) — `getUser()` + requête `subscriptions`/`profiles.role`. **C'est la porte UX** : redirige `/pricing` ou 403 avant tout rendu. Empêche la fuite *visuelle*.
3. **RLS Postgres** — **la vraie barrière anti-fuite de données**. Même si une couche UI est contournée (appel direct au client, bug de route), la DB refuse les lignes. **Indispensable** car le front lit avec l'anon-client.

> Principe : **le gating UI peut être contourné ; la RLS, non.** La lecture des signaux DOIT être protégée par RLS liée à l'abonnement, pas seulement par le layout. C'est le point critique de non-fuite du revenu.

### Policies RLS (modèle, à matérialiser en migrations)

**Signaux gated par abonnement actif** (remplace la policy actuelle `select to authenticated using(true)` sur trade_setups/analyses) :

```sql
-- helper SECURITY DEFINER : un abonnement actif existe-t-il pour l'appelant ?
create function public.has_active_subscription() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.subscriptions s
    where s.user_id = auth.uid()
      and s.status = 'active'
      and s.expires_at > now()
  );
$$;

-- trade_setups : lecture réservée aux abonnés actifs (MODIFIE 0006)
drop policy "trade_setups: lecture authentifiés" on public.trade_setups;
create policy "trade_setups: abonnés actifs"
  on public.trade_setups for select to authenticated
  using ( public.has_active_subscription() );
-- idem analyses
```

**Données par-utilisateur (subscriptions, payments)** — l'utilisateur lit/insère les SIENNES :

```sql
create policy "subscriptions: lire les siennes"
  on public.subscriptions for select to authenticated
  using ( user_id = auth.uid() );
-- PAS de policy update/insert pour authenticated → activation = service_role (job/route serveur)

create policy "payments: lire les siens"
  on public.payments for select to authenticated
  using ( user_id = auth.uid() );
create policy "payments: soumettre le sien (pending)"
  on public.payments for insert to authenticated
  with check ( user_id = auth.uid() and status = 'pending' );
-- la transition pending→verified/rejected = service_role uniquement (jamais l'utilisateur)
```

**Affiliation — un affilié ne voit QUE ses données** :

```sql
create policy "referrals: l'affilié voit les siens"
  on public.referrals for select to authenticated
  using ( affiliate_id in (select id from public.affiliates where user_id = auth.uid()) );
create policy "commissions: l'affilié voit les siennes"
  on public.commissions for select to authenticated
  using ( affiliate_id in (select id from public.affiliates where user_id = auth.uid()) );
-- ⚠️ un referral ne doit PAS exposer l'identité/email du filleul à l'affilié
--    (RGPD-like + confiance) : la policy donne accès à la LIGNE referrals, mais les
--    colonnes sensibles (email filleul) ne doivent pas y figurer — stocker un alias/anonyme.
```

**Superadmin voit tout** (policy additive par rôle) :

```sql
create function public.is_superadmin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p
                 where p.id = auth.uid() and p.role = 'superadmin');
$$;

create policy "payments: superadmin voit tout"
  on public.payments for select to authenticated
  using ( public.is_superadmin() );
-- idem subscriptions/affiliates/commissions : ajouter une policy is_superadmin() (OR additif)
```

**Articles CMS** — public lit publié, superadmin gère :

```sql
create policy "articles: public lit publié"
  on public.articles for select to anon, authenticated
  using ( status = 'published' );
create policy "articles: superadmin gère"
  on public.articles for all to authenticated
  using ( public.is_superadmin() ) with check ( public.is_superadmin() );
```

### Pièges RLS à tester (Playwright + tests RLS existants)

- **Fuite cross-user** : user A ne voit pas payments/subscriptions/referrals de B (déjà testé pour le journal — répliquer le pattern).
- **Fuite cross-role** : un `member` n'accède pas au dashboard affilié ni au superadmin ; un `affiliate` ne voit pas les referrals d'un autre affilié.
- **Fuite par abonnement expiré** : un user sans abonnement actif ne lit AUCUN `trade_setups` (tester `expires_at` passé → 0 ligne).
- **Récursion RLS** : les helpers `has_active_subscription`/`is_superadmin` sont `security definer` → évitent la récursion de policy (une policy qui lit une table elle-même protégée). Vérifier `search_path` figé (anti-injection de schéma).

---

## Frontière producteur étendue (résolution de la tension clé)

L'existant = **jobs seuls écrivent**. v2.0 introduit des **écritures initiées par l'utilisateur**. Résolution propre, sans casser le modèle :

| Écriture | Qui | Comment | Garde-fou |
|----------|-----|---------|-----------|
| **Soumettre un TX hash** | utilisateur | `insert payments(status='pending')` via RLS `with check user_id=auth.uid() and status='pending'` | L'utilisateur ne peut écrire QUE du `pending` à son nom. Il ne peut jamais s'auto-activer. |
| **Vérifier / activer** | serveur | Route Handler `nodejs` (service-client) appelle TronGrid, transitionne `pending→verified`, insère `subscriptions(active)` | service_role server-only ; `tx_hash UNIQUE` (idempotence/anti-rejeu) ; montant/destinataire/contrat stricts |
| **Re-vérif différée** | job | `payment-watcher` reprend les `pending` (confirmations insuffisantes) | idempotent ; complète le check synchrone si l'user soumet trop tôt |
| **Webhook processeur (étage 2)** | serveur | Route Handler `nodejs`, signature vérifiée, corps brut | idempotent `order_id` ; IP whitelist ; jamais Edge |
| **Choisir un code promo** | utilisateur | cookie `?ref` → à l'activation, le serveur crée `referrals` | attribution faite **côté serveur** à l'activation, pas par l'utilisateur |
| **Commissions / outcomes / Telegram / expiration** | jobs | identique à l'existant | idempotents, `job_runs` |

**Règle d'or maintenue** : les **données monétaires d'état** (subscription active, payment verified, commission due) ne sont JAMAIS écrites par l'anon-client. Seul le `pending` déclaratif l'est, et il est sans effet tant que le serveur ne l'a pas validé on-chain. La frontière de confiance est préservée : l'argent suit le même principe que `persist.ts` (validation serveur déterministe avant tout état de confiance).

**Exception lint documentée** : les 2 Route Handlers paiement importent le service-client. Ajouter une allowlist explicite à la règle de lint (chemin `app/api/payments/**`, `app/api/webhooks/**`) + `server-only` + revue sécurité obligatoire sur ces fichiers.

---

## Architectural Patterns

### Pattern 1 : RSC Layout Gate + RLS (défense en profondeur)

**What:** Le layout serveur d'un route group fait la porte UX ; la RLS fait la porte données.
**When:** Tout segment gated (`(member)`, `(affiliate)`, `(admin)`).
**Trade-offs:** +1 requête DB par navigation de segment (acceptable, cache RSC) ; en échange, zéro fuite même si le layout a un bug.

```typescript
// app/[locale]/(member)/layout.tsx
import { requireActiveSub } from '@/lib/auth/gate'
export default async function MemberLayout({ children }) {
  await requireActiveSub() // getUser() + subscriptions active sinon redirect('/pricing')
  return <>{children}</>   // les pages lisent trade_setups via anon-client → RLS re-vérifie
}
```

### Pattern 2 : Middleware composé (locale → session → ref)

**What:** Chaîner next-intl middleware puis `updateSession()`.
**When:** Toujours (middleware racine unique).
**Trade-offs:** Ordre sensible — next-intl doit voir l'URL brute pour résoudre la locale avant que la session n'agisse. Tester la matrice (locale × authentifié × ?ref).

```typescript
// middleware.ts
const handleI18n = createIntlMiddleware(routing)
export async function middleware(req: NextRequest) {
  const res = handleI18n(req)              // 1. locale + rewrite
  captureRef(req, res)                      // 2. ?ref=CODE → cookie httpOnly
  return await updateSession(req, res)      // 3. refresh getUser() (existant, adapté pour réutiliser res)
}
```

### Pattern 3 : Job publicateur idempotent (Telegram / outcomes / commissions)

**What:** Job tsx lit un état clos, calcule, écrit le dérivé, marque l'item traité.
**When:** Toute publication/calcul récurrent.
**Trade-offs:** Idempotence par clé naturelle (`outcome_id`, `(affiliate_id, period)`) — rejeu sûr (PC éteint/reprise). Même discipline que l'ingestion.

```typescript
// telegram-publish.ts (registre JOB_REGISTRY)
// SELECT outcomes WHERE id NOT IN (SELECT outcome_id FROM telegram_posts)
// for each → bot.api.sendMessage(CHANNEL, fmt) → INSERT telegram_posts(outcome_id, message_id)
```

### Pattern 4 : Contenu DB multilingue vs UI strings (séparation i18n)

**What:** Deux mécanismes distincts d'i18n.
- **UI strings** (boutons, labels) → fichiers `messages/{ar,en,fr}.json` (next-intl).
- **Contenu DB** (articles, et plus tard textes de signaux vulgarisés) → colonne `locale` + une ligne par langue (`articles(slug, locale, …)`), requêté par la locale active.
**When:** Toujours — ne pas mélanger.
**Trade-offs:** Le contenu signaux généré par le moteur est aujourd'hui mono-langue ; v2.0 affiche tel quel (FR/EN) + traduit l'UI autour. La traduction arabe du *raisonnement* est un sujet à part (hors MVP, traduction humaine recommandée — voir anti-feature FEATURES.md).

---

## Data Flow

### Flux paiement (étage 1 MVP)

```
User wallet ──USDT TRC-20──> adresse plateforme (cold wallet, clé hors DB/code)
   │
   └─ colle TX hash ─> [member]/pay (form)
                          ↓
        POST /api/payments/submit  (Route Handler nodejs, service-client)
                          ↓
        insert payments(pending)  ──>  TronGrid gettransactioninfobyid(only_confirmed)
                          ↓ (to==wallet, montant>=dû, contrat USDT, SUCCESS, tx_hash UNIQUE)
        payments→verified  +  subscriptions(active, expires_at)
                          ↓ (si ?ref cookie présent)
        referrals(affiliate, referred_user)
                          ↓
        cas tordu/insuffisant ─> reste pending ─> file superadmin + payment-watcher (job)
```

### Flux track record / Telegram

```
trade_setups (expirés) ──outcome-tracker(job)──> compare prix réel (candles déjà en base)
        ↓                                              ↓
prediction_outcomes (win/loss)            pattern_stats (win rate mesuré, échantillon)
        ↓                                              ↓
telegram-publish(job) ──> canal Telegram        vitrine RSC lit pattern_stats → % affiché
```

### Flux affiliation

```
?ref=CODE ─middleware─> cookie ─activation─> referrals
                                                 ↓
commission-calc(job, récurrent) ─> commissions(period, amount, status=due)
                                                 ↓
[affiliate]/dashboard (RLS scoped: SES referrals/commissions)
superadmin: payout MANUEL validé ─> commissions.status=paid
```

---

## Scaling Considerations

| Scale | Ajustements |
|-------|-------------|
| 0-1k abonnés | Monolithe Next + Supabase suffit. Jobs sur scheduler cloud (GitHub Actions cron / petit worker croner). Vérif paiement synchrone OK. |
| 1k-10k | RLS `has_active_subscription()` appelée par lecture de signaux → indexer `subscriptions(user_id, status, expires_at)`. Mettre en cache le statut d'abo au niveau RSC (revalidate court). Realtime sur nouveaux signaux plutôt que polling. |
| 10k+ | Migrer la vérif paiement vers le processeur (étage 2, webhooks) — la file manuelle ne tient plus. Telegram rate limit (1 msg/s) → batcher. Considérer une vue matérialisée pour `pattern_stats`/win rate global. |

### Premiers goulots
1. **Vérif paiement manuelle** : la file superadmin sature avant l'infra → déclencheur de l'étage 2 processeur.
2. **RLS sur lecture signaux** : la fonction `has_active_subscription()` par requête → index + cache de statut.
3. **Fiabilité jobs 24/7** : Windows Task Scheduler local ne suffit plus pour une plateforme payante → migrer le scheduling cloud (décidé dans PROJECT.md, infra à trancher).

---

## Anti-Patterns

### AP1 : Gater les signaux uniquement au layout (sans RLS)
**Ce qu'on fait :** vérifier l'abonnement dans `(member)/layout.tsx` et laisser `trade_setups` en `select using(true)`.
**Pourquoi c'est faux :** le front lit avec l'anon-client ; un appel direct (devtools, script) contourne le layout et aspire tous les signaux → fuite du produit payant.
**À la place :** RLS `has_active_subscription()` sur trade_setups/analyses. Layout = UX, RLS = sécurité.

### AP2 : Activer l'abonnement côté client / faire confiance au TX hash sans vérif on-chain
**Ce qu'on fait :** insérer `subscriptions(active)` depuis une server action sans interroger TronGrid, ou laisser l'user écrire `verified`.
**Pourquoi c'est faux :** n'importe qui colle un faux hash → accès gratuit. Argent = frontière de confiance stricte.
**À la place :** seul le serveur (TronGrid + contrat/montant/destinataire stricts + `tx_hash UNIQUE`) active. L'user n'écrit que du `pending`.

### AP3 : Mettre le rôle dans le JWT et l'y croire
**Ce qu'on fait :** stocker `role` en app_metadata et gater dessus.
**Pourquoi c'est faux :** désync possible token/DB, révocation difficile, et `getSession()` serveur n'est pas revérifié.
**À la place :** `role` sur `profiles`, lu serveur après `getUser()`, et RLS via `is_superadmin()` security definer.

### AP4 : Poser l'i18n après coup
**Ce qu'on fait :** construire la vitrine en dur puis « ajouter » l'arabe.
**Pourquoi c'est faux :** RTL inverse tout le layout (marges, flèches, alignements) → refactor massif. C'est explicitement signalé HIGH dans FEATURES.md.
**À la place :** poser `[locale]` + propriétés logiques Tailwind (`ms-*`/`me-*`) + `dir` dès la première page.

### AP5 : Webhook paiement en Edge runtime
**Ce qu'on fait :** Route Handler par défaut (Edge) pour le webhook Cryptomus.
**Pourquoi c'est faux :** la vérif de signature exige le corps brut + `crypto` Node.
**À la place :** `export const runtime = 'nodejs'`, `await req.text()`.

### AP6 : Exposer l'identité du filleul à l'affilié
**Ce qu'on fait :** policy referrals qui laisse voir l'email du referred_user.
**Pourquoi c'est faux :** fuite de données personnelles inter-utilisateurs.
**À la place :** la table referrals ne porte pas de PII exploitable ; l'affilié voit des compteurs/alias, pas les identités.

---

## Integration Points

### External Services

| Service | Pattern d'intégration | Gotchas |
|---------|------------------------|---------|
| TronGrid | `fetch` + Zod (packages/data-sources/trongrid), appelé par Route Handler ET job | `only_confirmed:true` (anti-réorg) ; decimals USDT=6 ; contrat exact à whitelister ; clé API gratuite pour rate limit |
| Cryptomus (étage 2) | client maison + Route Handler webhook `nodejs` | signature MD5(base64(json)+key) sur corps brut ; idempotence order_id ; IP whitelist |
| Telegram | grammY `sendMessage` depuis job tsx | rate ~1 msg/s ; token en .env ; pas de webhook/runner nécessaire (publication only) |
| Anthropic API | `@anthropic-ai/sdk` dans apps/jobs, derrière `persist.ts` | remplace l'agent Max ; contrat JSON §3 inchangé ; prompt caching ; clé secret manager |
| TronGrid (payout commissions) | **reporté** ; si auto → TronWeb dans job isolé | clé privée JAMAIS en DB/code ; commencer en payout manuel |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| web ↔ DB (lecture) | anon-client + RLS | gating réel ici |
| web (Route Handler paiement) ↔ DB | service-client server-only | exception lintée, revue sécu obligatoire |
| jobs ↔ DB | service-client bypass | inchangé (producteur) |
| web ↔ jobs | **aucune** (découplés via DB) | les jobs publient, le web lit — invariant préservé |
| packages/core (règles pricing/commission) ↔ web & jobs | import partagé déterministe | éviter de dupliquer le calcul de commission/expiration |

---

## Build Order recommandé (argumenté par dépendances)

> Objectif directeur (FEATURES.md) : **encaisser le 1er abonnement** = vitrine + auth(✓) + paiement + activation + gating + 1 disclaimer + quelques signaux visibles. Tout le reste itère.

**Wave 1 — Socle transverse (débloque tout le reste)**
1. **i18n + `[locale]` + RTL** — transverse, refactor massif si tardif (AP4). Doit précéder toute UI publique.
2. **`profiles.role` + helpers RLS + `lib/auth/gate.ts`** — la primitive de gating dont dépendent member/affiliate/admin.
   - *Dépendance :* aucune (greffe sur auth existant). *Débloque :* tous les segments gated.

**Wave 2 — Chemin cash (le revenu)**
3. **subscriptions + payments (migrations + RLS) + RSC gate `(member)` + RLS signaux** — le mur qui protège le revenu et expose les signaux.
4. **Vitrine + pricing + disclaimer** — entrée du funnel (peut se paralléliser avec 3, dépend de 1).
5. **Espace membre : liste signaux + détail vulgarisé** — données déjà en base ; présentation. Dépend de 3 (gate).
6. **Paiement USDT MVP : client TronGrid + Route Handler submit + activation + file superadmin minimal** — dépend de 3 (tables) + cold wallet.
7. **subscription-expiry (job) + billing page** — cycle de vie ; dépend de 3.
   - *Jalon :* à la fin de Wave 2 → **encaissement possible**. (Disclaimers/revue légale = bloquant juridique parallèle, hors code.)

**Wave 3 — Track record & preuve (alimente la confiance/Telegram)**
8. **prediction_outcomes + pattern_stats + outcome-tracker (job)** — dépend de trade_setups (✓) + candles (✓). Indépendant du paiement → parallélisable avec Wave 2.
9. **% de réussite sur vitrine** — dépend de 8.
10. **telegram-publish (job)** — dépend de 8 (outcomes/win rate).

**Wave 4 — Acquisition & ops (après validation cash)**
11. **Affiliation : tables + capture ?ref + dashboard affilié (RLS) + commission-calc (job)** — dépend de subscriptions actives (Wave 2) pour compter les abonnés ramenés.
12. **CMS articles** — faible couplage, parallélisable dès que i18n posé (Wave 1) ; placé ici par priorité (P2).
13. **Superadmin enrichi** (perfs affiliés, santé jobs via `job_runs`/`v_data_freshness` existants).

**Wave 5 — Automatisation (déclenchée par le volume)**
14. **Processeur crypto étage 2** (Cryptomus + webhook) — déclencheur : file manuelle ingérable.
15. **Migration moteur agent Max → @anthropic SDK + scheduling cloud** — déclencheur : abonnés payants → fiabilité 24/7.
16. **Payout commissions on-chain** (TronWeb isolé) — déclencheur : confiance opérationnelle.

**Justification des arêtes critiques :**
- *i18n avant tout UI* : RTL = refactor global sinon.
- *role/gate avant member/affiliate/admin* : primitive partagée.
- *subscriptions avant affiliation* : on ne commissionne pas des abonnés actifs sans système d'abonnement (FEATURES.md dependency).
- *outcomes avant Telegram et avant % vitrine* : la preuve dérive des outcomes mesurés.
- *paiement MVP avant processeur* : ne pas bloquer le cash sur un tiers (anti-feature FEATURES.md).

---

## Sources

- Repo existant (lu 2026-06-14) — migrations 0001-0007 (RLS `select to authenticated`/service_role bypass, profiles+`handle_new_user`, trade_setups immuabilité), `apps/web/src/lib/supabase/middleware.ts` (`getUser()`), `apps/jobs/src/dispatch.ts` (JOB_REGISTRY), double barrière lint `__lint_fixtures__` — **HIGH** (source primaire)
- `.planning/PROJECT.md`, `.planning/MILESTONES.md` — invariants, contraintes pivot, sécurité clés — **HIGH**
- `.planning/research/STACK.md` (v2.0) — libs verrouillées (next-intl, grammY, TronGrid maison, Cryptomus, @anthropic SDK), runtime nodejs webhook, RTL natif Tailwind v4 — **HIGH**
- `.planning/research/FEATURES.md` (v2.0) — priorisation P1/P2/P3, dépendances features, anti-features — **HIGH**
- next-intl App Router routing/middleware/`setRequestLocale`, Next 15 Route Handler `runtime='nodejs'`, Supabase RLS `security definer` helpers — patterns recoupés docs officielles — **MEDIUM-HIGH**

---
*Architecture research for: v2.0 plateforme publique — intégration gating multi-rôles + paiement on-chain + affiliation + i18n RTL + CMS + Telegram sur monorepo Next 15/Supabase/jobs existant*
*Researched: 2026-06-14*
