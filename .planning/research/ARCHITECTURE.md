# Architecture Research

**Domain:** Plateforme SaaS trading (Next.js 15 App Router + Supabase RLS) — milestone v3.0 « dark néon NEXA » : DS dark-unique, dashboards user + superadmin, scalabilité DB 10k+.
**Researched:** 2026-06-22
**Confidence:** HIGH (archi existante lue dans le repo ; patterns Supabase/Postgres vérifiés sur docs officielles 2026)

> Milestone SUBSÉQUENT. Ce document cible UNIQUEMENT l'intégration du neuf dans l'archi livrée (phases 1-11). Tout ce qui n'est pas listé « modifié/neuf » reste tel quel.

---

## Standard Architecture

### System Overview (état cible v3.0)

```
┌──────────────────────────────────────────────────────────────────────┐
│  CLIENT (navigateur) — dark unique, RTL-aware, reduced-motion gardé    │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │
│  │ Vitrine .nxl │ │ Espace membre│ │ Dash USER    │ │ Dash ADMIN   │  │
│  │ (landing)    │ │ (signaux)    │ │ (NEUF)       │ │ (refondu)    │  │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘  │
└─────────┼────────────────┼────────────────┼────────────────┼─────────┘
          │  RSC fetch (anon-client + cookies)   │ react-query (client islands)
┌─────────┴────────────────┴────────────────┴────────────────┴─────────┐
│  NEXT.JS 15 — App Router                                               │
│  middleware composé : handleI18n ∘ updateSession ∘ x-pathname          │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │ [locale]/(public|member|account|dash) + (admin) hors-locale     │   │
│  │ gate.ts : requireUser / requireActiveSub / requireRole          │   │
│  │ Design System GLOBAL dark (globals.css) — `.nxl` dé-scopé        │   │
│  └────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────┬────────────────────────────────────────┘
                               │ @supabase/ssr (cookies) · service_role (jobs only)
┌──────────────────────────────┴────────────────────────────────────────┐
│  SUPABASE Postgres 15 — RLS STRICTE (source de vérité = migrations SQL) │
│  Tables: profiles, subscriptions, trade_setups, analyses, payments,    │
│          referrals, commissions, affiliates, job_runs, pattern_stats…  │
│  Helpers security-definer: has_active_subscription(), is_superadmin()  │
│  NEUF: vues + MATVIEWS KPI (admin) · index keyset · RLS (select auth.uid())│
│  Realtime postgres_changes (hérite RLS) · Pooler Supavisor (txn 6543)  │
└────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Statut v3.0 |
|-----------|----------------|-------------|
| **DS global dark** (`globals.css`) | Tokens 3 couches OKLCH, dark UNIQUE, plus de flip | **MODIFIÉ** (fusion `.nxl` → tokens globaux) |
| `nexa-landing.css` (`.nxl`) | Ambiance riche vitrine | **MODIFIÉ** (dé-scopé : ce qui est réutilisable monte en DS ; le reste reste local mais sans dépendre du flip) |
| `[locale]/layout.tsx` (shell) | Seul `<html lang dir>`, header, ThemeProvider | **MODIFIÉ** (retrait toggle light + `forcedTheme=dark`) |
| `(member)/layout.tsx` | Gate abo + ExpiryBanner | inchangé (gate), reskin only |
| `(dash)/` user dashboard | Vue d'ensemble / signaux suivis / abo / affiliation | **NEUF** |
| `(admin)/layout.tsx` + pages | Pilotage signaux/santé/affiliés/paiements/users | **MODIFIÉ/refondu** (KPI via matviews) |
| `gate.ts` | requireUser/ActiveSub/Role | inchangé (réutilisé tel quel) |
| `packages/supabase` repos | Accès typé au-dessus du client | **+ repos neufs** (keyset list, KPI reads) |
| migrations SQL | Source de vérité schéma + RLS | **+ migrations neuves** (RLS perf, index, matviews) |

---

## Recommended Project Structure (deltas v3.0)

```
apps/web/src/
├── app/
│   ├── [locale]/
│   │   ├── layout.tsx            # MODIFIÉ : dark forcé, toggle retiré
│   │   ├── (member)/             # reskin only
│   │   ├── (account)/            # reskin only
│   │   └── (dash)/               # NEUF : groupe dashboard utilisateur
│   │       ├── layout.tsx        # NEUF : gate requireUser + nav dash (RSC)
│   │       ├── page.tsx          # NEUF : overview (RSC, agrège vues SQL)
│   │       ├── signaux-suivis/   # NEUF : keyset list (RSC) + island react-query
│   │       ├── abonnement/       # peut réutiliser (account) — éviter doublon
│   │       └── affiliation/      # NEUF côté dash user (miroir no-PII existant)
│   └── (admin)/                  # hors [locale], FR fixe — REFONDU
│       ├── layout.tsx            # inchangé (requireRole superadmin)
│       ├── page.tsx              # MODIFIÉ : KPI lus depuis matviews
│       ├── utilisateurs/         # NEUF/étendu : keyset + filtres URL
│       ├── paiements/            # étendu
│       └── sante/                # étendu (job_runs, advisors)
├── components/
│   ├── nexa/                     # primitives DS promues (ex-.nxl réutilisables)
│   ├── landing/nexa-landing.css  # MODIFIÉ : dé-scopé partiellement
│   └── dash/                     # NEUF : cartes KPI, tables keyset, sparklines
└── styles/globals.css           # MODIFIÉ : DS dark unique

supabase/migrations/
├── 0017_rls_perf_select_authuid.sql   # NEUF : réécrit toutes les policies en (select …)
├── 0018_scale_indexes_keyset.sql      # NEUF : index keyset par requête clé
├── 0019_admin_kpi_matviews.sql        # NEUF : matviews KPI + unique index + refresh
└── 0020_user_dashboard_views.sql      # NEUF : vues d'agrégation user (RLS héritée)
```

### Structure Rationale

- **`(dash)/` séparé de `(member)/` :** le dashboard user n'exige pas forcément un abo actif (vue d'ensemble + abo + affiliation accessibles à un user authentifié sans abo, pour le faire convertir). Gate = `requireUser`, pas `requireActiveSub`. Les listes de signaux **suivis** restent gated par la RLS `has_active_subscription()` (défense en profondeur — le gate UX ne remplace jamais la RLS).
- **`(admin)/` reste hors `[locale]` :** déjà mono-FR (D-15). Refonte = pages + matviews, pas de changement de groupe.
- **matviews dans migrations, pas en SQL ad-hoc :** source de vérité unique (CLAUDE.md « PAS d'ORM, migrations = vérité »).

---

## Architectural Patterns

### Pattern 1 — Migration DS « multi-thème → dark unique » sans casser RTL/no-flash/i18n

**What :** Le DS actuel a 3 couches (primitives OKLCH theme-indépendantes → sémantique `:root`/`.dark` qui FLIPPE → component `@theme inline` noms shadcn). Le neuf supprime le flip : on garde **une seule** couche sémantique = les valeurs dark, et on dé-scope les bonnes parties de `.nxl`.

**When to use :** dès le début du milestone (arête critique : DS AVANT reskin).

**Trade-offs :** approche conservatrice (réécrire la couche sémantique, pas les primitives ni les noms component) = zéro casse des composants shadcn consommateurs (`bg-primary`, `text-foreground`…). Risque si on touche les primitives ou les noms component → casse silencieuse (Pitfall connu du repo).

**Recette concrète (ordre interne) :**
1. **Couche 2 (sémantique) :** copier les valeurs `.dark { … }` actuelles dans `:root { … }`, supprimer le bloc `.dark`. Les tokens ne flippent plus → dark partout. Garder les noms component (couche 3) **intacts**.
2. **`@custom-variant dark` :** laisser le variant exister mais ne plus poser `.dark` (il devient inerte) pour minimiser le diff ; retirer progressivement les usages `dark:` résiduels du JSX.
3. **`ThemeProvider` / `layout.tsx` :** retirer `ThemeToggle`, fixer `forcedTheme="dark"` (next-themes) → garde le script no-flash sur `<html>` mais sans alternance. RTL (`dir`) et i18n (`NextIntlClientProvider`) **non touchés** (orthogonaux au thème).
4. **`.nxl` :** promouvoir vers `globals.css` ce qui est partagé (auras, grilles, reveal, marquee — déjà tokenisés via `var()`). Laisser sous `.nxl` ce qui est spécifique vitrine. Critère : si un effet utilise déjà `var(--primary)/--accent-brand`, il monte sans risque. Les valeurs HEX littérales de `.nxl[data-theme]` (`--bg:#070b08`…) deviennent les **nouvelles valeurs primitives dark** du DS — mappées en OKLCH (cohérence couche 1), pas copiées en HEX brut.

**Garde-fous à conserver :** text-scan RTL logical-props, no-flash, parité i18n. Ajouter un garde « no light-theme residue » (grep `dark:` / `data-theme` orphelins).

**Example :**
```css
/* AVANT (flip) */
:root { --background: var(--nexa-white); }
.dark { --background: var(--nexa-ink); }
/* APRÈS (dark unique) — couche 3 (noms component) inchangée */
:root { --background: var(--nexa-ink); /* + reste des valeurs dark */ }
/* plus de bloc .dark ; --color-background: var(--background) reste tel quel */
```

### Pattern 2 — Dashboards : RSC pour la donnée, islands client pour l'interactif

**What :** Layout + page de premier rendu = RSC (lecture anon-client + cookies → RLS). Tri/filtre/pagination temps réel = Client Components ciblés sous `@tanstack/react-query` (déjà dans la stack). L'admin KPI lit des **matviews** (pas de COUNT/GROUP BY live).

**When to use :** tous les dashboards. RSC par défaut (cohérent avec le repo) ; react-query seulement là où l'UX exige refetch/optimistic sans full reload.

**Trade-offs :** RSC = pas de waterfall client, SEO/perf, mais navigations filtrées coûtent un round-trip serveur → d'où les islands react-query pour les listes très interactives (`/dash/signaux-suivis`, tables admin). Realtime reste via `postgres_changes` (hérite RLS) comme en phase 3, pas de polling.

**Agrégation — vue SQL vs requête :**
- **User overview** : vue SQL simple (jointures scopées RLS, faible cardinalité par user) → `0020_user_dashboard_views.sql`. La vue **hérite** de la RLS des tables sous-jacentes (pas de SECURITY DEFINER → pas de fuite cross-user).
- **Admin KPI** (totaux globaux : MRR, users actifs, signaux/jour, santé jobs) : **matview** rafraîchie périodiquement, pas une vue live (cf. Pattern 4).

**Example :**
```tsx
// (dash)/page.tsx — RSC, agrège la vue user
const supabase = await createClient()
const { data } = await supabase.from('v_user_overview').select('*').single()
// pas de service_role : RLS scope user_id = (select auth.uid())
```

### Pattern 3 — Keyset (cursor) pagination en RSC pour les grandes listes

**What :** Remplacer `OFFSET`/`.range()` par un curseur composite `(tri, id)`. En Supabase JS : `.or()` + `.lt()/.gt()` + `.order()` + `.limit()`. Le curseur transite par searchParams (RSC-friendly, partageable, pas d'état client).

**When to use :** listes membres (signaux), tables admin users/paiements — toute table qui dépasse quelques milliers de lignes. **Garder l'offset** uniquement pour l'admin où l'accès « page N aléatoire » est exigé et la table reste petite.

**Trade-offs :** O(1) vs O(n) — sur 10M lignes, OFFSET profond ≈ 8 s vs keyset ≈ constant (bench vérifié). Coût : exige un **index composite** exactement aligné sur l'ORDER BY, et pas de saut « page 500 » direct (acceptable pour feeds/infinite-scroll).

**Example :**
```ts
// tri opportunity_score desc, id desc — curseur = (score, id) du dernier vu
let q = supabase.from('trade_setups')
  .select('id, opportunity_score, instrument_id, created_at')
  .order('opportunity_score', { ascending: false })
  .order('id', { ascending: false })
  .limit(20)
if (cursor) {
  // (score, id) < (cursorScore, cursorId)
  q = q.or(`opportunity_score.lt.${cursor.score},and(opportunity_score.eq.${cursor.score},id.lt.${cursor.id})`)
}
```
> Index requis : `(opportunity_score desc, id desc)` — voir Pattern 5.

### Pattern 4 — Matviews pour les KPI superadmin

**What :** Les KPI globaux (totaux, agrégats temporels) sont précalculés en `MATERIALIZED VIEW` avec **unique index** (obligatoire pour `REFRESH … CONCURRENTLY` qui ne verrouille pas les lecteurs). Refresh planifié.

**When to use :** dashboard admin uniquement (lecture super-admin via `is_superadmin()`), tolérance fraîcheur minutes. Jamais pour de la donnée par-user (utiliser une vue scopée RLS).

**Trade-offs :** lecture O(1) constante quelle que soit la taille des tables ; coût = recompute complet à chaque refresh (acceptable à 10k users). Refresh : `pg_cron` (extension Supabase) si dispo, sinon job existant (l'archi a déjà `job_runs` + Windows Task Scheduler) qui appelle un RPC `refresh_admin_kpis()`.

**Sécurité :** une matview ne porte pas de RLS → la protéger par une **vue/RPC vérifiant `is_superadmin()`** OU restreindre les GRANT à un rôle non exposé. Ne jamais exposer la matview brute à `authenticated`/`anon`.

**Example :**
```sql
create materialized view admin_kpi_daily as
  select date_trunc('day', created_at) d,
         count(*) filter (where status='active') active_subs
  from public.subscriptions group by 1;
create unique index admin_kpi_daily_d_idx on admin_kpi_daily (d); -- requis CONCURRENTLY
-- refresh: select cron.schedule('refresh-kpi','*/10 * * * *',
--   $$refresh materialized view concurrently admin_kpi_daily$$);
```

### Pattern 5 — RLS performante : `(select auth.uid())` + index ciblés

**What :** Les policies actuelles appellent `auth.uid()` / `has_active_subscription()` **directement** (vérifié dans migrations 0006/0009) → Postgres réévalue la fonction **par ligne**. Le fix : envelopper dans un sous-`SELECT` → Postgres en fait un **initPlan** mis en cache **par requête** (une seule évaluation). Gain mesuré >100x sur grandes tables (docs Supabase).

**When to use :** AVANT toute montée en charge (arête critique : perf DB AVANT exposition à l'échelle). S'applique à **toutes** les policies du repo (`profiles`, `subscriptions`, `trade_setups`, `analyses`, `payments`, `referrals`, `commissions`…).

**Trade-offs :** réécriture mécanique, zéro changement de sémantique (le `(select …)` est valide car le résultat ne dépend pas de la ligne). Limite : ne pas envelopper une fonction qui prend une colonne de la ligne en argument.

**Example :**
```sql
-- AVANT (réévalué par ligne) — état actuel du repo
using (user_id = auth.uid())
using (public.has_active_subscription())
-- APRÈS (initPlan, évalué une fois)
using (user_id = (select auth.uid()))
using ((select public.has_active_subscription()))
```
> Compléter par des **index B-tree** sur les colonnes RLS (`user_id`) et les clés d'ORDER BY keyset. Vérifier avec `EXPLAIN (ANALYZE)` + `get_advisors` (lint `0003_auth_rls_initplan`).

---

## Data Flow

### Request Flow (dashboard user, état cible)

```
[User authentifié] → /dash
   ↓ middleware (handleI18n ∘ updateSession → cookies frais + x-pathname)
[(dash)/layout RSC] requireUser()            ← gate UX
   ↓
[(dash)/page RSC] anon-client.from('v_user_overview')
   ↓ RLS: user_id = (select auth.uid())       ← vraie barrière
[Postgres] vue scopée → lignes du seul user
   ↓
[RSC stream HTML] + island react-query (signaux suivis, keyset cursor)
   ↓ realtime postgres_changes (hérite RLS) → push nouveaux signaux
```

### Request Flow (admin KPI)

```
[superadmin] → /admin
   ↓ (admin)/layout requireRole('superadmin') → sinon notFound() (404 discret)
[page RSC] read wrapper(is_superadmin()) → admin_kpi_daily (matview)
   ↓ lecture O(1) précalculée (pas de COUNT live)
[refresh] pg_cron OU job_runs → refresh materialized view concurrently (hors requête)
```

### Key Data Flows

1. **DS unifié** : `.nxl[data-theme]` (HEX) → primitives OKLCH dark (couche 1) → sémantique `:root` (plus de `.dark`) → noms component inchangés → composants shadcn rendus en dark sans flip.
2. **Keyset** : searchParams `?cursor=score_id` → `.or(...)` Supabase → page suivante O(1) → nouveau curseur renvoyé au client.
3. **Realtime** : inchangé phase 3 (`postgres_changes`, replica identity FULL sur `trade_setups`) — hérite de la RLS performante (donc bénéficie aussi du fix `(select …)`).

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k users | Archi actuelle suffit. Appliquer quand même `(select auth.uid())` (dette zéro-coût) + index `user_id`. |
| 1k-10k users | **Cœur du milestone.** RLS initPlan partout · index keyset · matviews KPI · pooler **transaction mode (port 6543)** pour les RSC/serverless (connexions courtes nombreuses). |
| 10k-100k+ | Curseurs partout (zéro OFFSET profond), matviews + `pg_cron`, surveiller `get_advisors` perf, envisager read-replica si lecture domine ; Realtime : borner les canaux par client. |

### Scaling Priorities (ordre « ce qui casse en premier »)

1. **RLS réévaluée par ligne (casse en 1er)** → `(select auth.uid())` + `(select has_active_subscription())` sur **toutes** les policies. Vérifié docs Supabase, gain >100x.
2. **OFFSET profond sur listes** → keyset pagination + index composite aligné ORDER BY. O(n)→O(1).
3. **COUNT/GROUP BY live sur dashboard admin** → matviews + refresh planifié.
4. **Épuisement des connexions (serverless)** → **Supavisor transaction mode (6543)** : partage les connexions directes (≤ limite compute). Attention : **pas de prepared statements** en txn mode (le repo n'utilise pas d'ORM type Prisma → non bloquant ; ne pas activer de prepared statements côté client). Session mode (5432) réservé aux migrations/longues sessions.
5. **Realtime** → hérite RLS (donc du fix #1) ; limiter les souscriptions, repli silencieux déjà en place.

---

## Anti-Patterns

### Anti-Pattern 1 — Reskinner les dashboards avant d'unifier le DS

**What people do :** appliquer le look dark néon page par page pendant que le DS flippe encore.
**Why it's wrong :** double travail (chaque composant retouché deux fois), tokens incohérents, regressions light/dark. Viole l'arête critique « DS AVANT reskin ».
**Do this instead :** figer le DS dark unique (Pattern 1) **d'abord**, puis reskin mécanique qui ne fait que consommer les tokens stabilisés.

### Anti-Pattern 2 — Exposer la donnée à l'échelle avant le fix RLS/index

**What people do :** ouvrir les dashboards/listes 10k users avec les policies `auth.uid()` bare et de l'OFFSET.
**Why it's wrong :** dégradation O(n)/par-ligne invisible en seed, catastrophique en charge. Viole « perf DB AVANT montée en charge ».
**Do this instead :** migrations `0017` (RLS initPlan) + `0018` (index keyset) AVANT d'exposer/reskinner les listes.

### Anti-Pattern 3 — Matview exposée sans garde superadmin

**What people do :** `grant select on admin_kpi_daily to authenticated`.
**Why it's wrong :** une matview ne porte pas de RLS → fuite de KPI globaux à tout user connecté.
**Do this instead :** wrapper RPC/vue vérifiant `is_superadmin()`, GRANT restreint.

### Anti-Pattern 4 — service_role dans les dashboards pour « simplifier » l'agrégation

**What people do :** lire les KPI/listes avec le client service_role (bypass RLS) côté page.
**Why it's wrong :** casse l'invariant du repo (service_role réservé aux jobs, double barrière lint + server-only) ; un bug de scope = fuite cross-user totale.
**Do this instead :** anon-client + vues scopées RLS (user) ; matviews + garde superadmin (admin).

### Anti-Pattern 5 — Garder un `data-theme`/`dark:` résiduel après le passage dark-unique

**What people do :** laisser des utilitaires `dark:` ou `.nxl[data-theme="volt"]` actifs.
**Why it's wrong :** chemins de rendu morts, incohérences, regressions au moindre re-mount.
**Do this instead :** garde text-scan « no light residue », `forcedTheme="dark"`, un seul `data-theme` (ou aucun).

---

## Build Order (respecte les arêtes critiques)

```
WAVE 1 — Design System dark unique  [DS AVANT reskin]
  1. globals.css : couche sémantique → valeurs dark, suppression .dark
  2. layout.tsx : forcedTheme dark, retrait ThemeToggle, no-flash conservé
  3. .nxl : promotion des effets tokenisés en DS global + garde no-light-residue
        └─ verif : RTL/i18n/no-flash intacts ; composants shadcn rendus dark

WAVE 2 — Scalabilité DB  [perf DB AVANT exposition à l'échelle]
  4. 0017 RLS initplan : (select auth.uid()) / (select has_*()) sur TOUTES policies
  5. 0018 index keyset + index user_id RLS  (EXPLAIN ANALYZE + get_advisors)
  6. 0019 matviews KPI admin + unique index + refresh (pg_cron/job_runs)
  7. 0020 vues d'agrégation user (RLS héritée)
        └─ verif : advisors perf PASS, EXPLAIN sans seq-scan par-ligne

WAVE 3 — Dashboards (consomment DS figé + DB perf-ready)
  8. (dash)/ user : layout requireUser, overview (vue), signaux-suivis (keyset+rq),
     abonnement, affiliation                          [dépend de 1-3 et 4-7]
  9. (admin)/ refonte : KPI matviews, users/paiements keyset, santé
        └─ realtime postgres_changes (hérite RLS fixée)

WAVE 4 — Reskin transversal restant + E2E
 10. reskin pages restantes sur DS figé (vitrine/légal/auth/académie)
 11. E2E Playwright flux principaux + gardes (RTL, gating RLS, anti-IDOR)
```

**Arêtes critiques (non négociables) :** `1→2→3` avant `8,9,10` (DS avant reskin). `4→5` avant `8,9` exposés à l'échelle (perf avant charge). `6` (matview) avant `9` (admin KPI). `5` (index keyset) avant toute liste paginée keyset.

---

## Integration Points

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `(dash)` ↔ Supabase | anon-client + cookies (RSC) ; react-query (islands) | RLS = vraie barrière ; gate = UX. Jamais service_role. |
| `(admin)` ↔ matviews | RSC read via wrapper `is_superadmin()` | matview hors RLS → garde explicite obligatoire. |
| DS global ↔ `.nxl` | tokens `var(--primary)`, `--accent-brand` | dé-scope = montée des effets tokenisés ; le reste local. |
| middleware ↔ RSC | `x-pathname` header + cookies updateSession | inchangé ; `forcedTheme` ne touche pas i18n/RTL. |
| jobs ↔ matviews | `refresh materialized view concurrently` via RPC | réutilise `job_runs` + Windows Task Scheduler (backup) ou pg_cron. |

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Supabase Postgres | migrations SQL versionnées (CLI/MCP) | source de vérité unique, PAS d'ORM. |
| Supavisor (pooler) | **transaction mode 6543** pour RSC/serverless | pas de prepared statements en txn mode — OK (pas d'ORM Prisma). Session 5432 = migrations. |
| Realtime | `postgres_changes`, replica identity FULL | hérite RLS (donc du fix initPlan) ; borner les canaux. |
| pg_cron (extension) | refresh matviews planifié | si indisponible → fallback job_runs. |

---

## Sources

- Repo NEXA (lu 2026-06-22) : `globals.css` (3 couches tokens, flip `.dark`), `nexa-landing.css` (`.nxl[data-theme]`), `[locale]/layout.tsx` (shell, ThemeProvider `defaultTheme="light"`), `(member)/(admin)/layout.tsx`, migrations `0006`/`0009` (policies `auth.uid()` bare, helpers security-definer), `anon-client.ts`, `packages/supabase` repos — **HIGH** (source projet directe).
- [Supabase — RLS Performance and Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) — `(select auth.uid())` → initPlan, >100x ; index sur colonnes RLS ; wrapper security-definer — **HIGH**.
- [Supabase — Database Advisors (0003_auth_rls_initplan)](https://supabase.com/docs/guides/database/database-advisors?lint=0003_auth_rls_initplan) — lint qui détecte la réévaluation par-ligne — **HIGH**.
- [Supabase — Supavisor FAQ](https://supabase.com/docs/guides/troubleshooting/supavisor-faq-YyP5tI) et [Connect to your database](https://supabase.com/docs/guides/database/connecting-to-postgres) — transaction mode (6543) partage les connexions, pas de prepared statements ; session mode (5432) — **HIGH**.
- [Supabase agent-skills — data pagination](https://github.com/supabase/agent-skills/blob/main/skills/supabase-postgres-best-practices/references/data-pagination.md) et [SupaExplorer — cursor not OFFSET](https://supaexplorer.com/best-practices/supabase-postgres/data-pagination/) — keyset O(1) vs OFFSET O(n), `.gt()/.lt()` Supabase, index composite requis — **HIGH/MEDIUM**.
- [PostgreSQL — REFRESH MATERIALIZED VIEW](https://www.postgresql.org/docs/current/sql-refreshmaterializedview.html) — `CONCURRENTLY` requiert unique index, ne verrouille pas les lecteurs ; pg_cron pour le refresh — **HIGH**.

---
*Architecture research for: plateforme trading Next.js 15 + Supabase, milestone v3.0 dark néon / dashboards / scalabilité 10k+*
*Researched: 2026-06-22*
