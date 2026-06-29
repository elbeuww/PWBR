# Project Research Summary

**Project:** NEXA — Plateforme d'Analyse de Trading « Vétéran »
**Domain:** SaaS trading-signals (abonnement, audience MENA non technique, trilingue fr/en/ar RTL)
**Researched:** 2026-06-22
**Confidence:** HIGH

## Executive Summary

Le milestone v3.0 unifie NEXA sous l'identité **dark néon** de la landing et la dote de **dashboards utilisateur et superadmin** complets, tout en la rendant **scalable à 10k+ utilisateurs** — sur **données seedées** (aucun branchement API/paiement/signaux réel ce milestone). La recherche est convergente et à forte confiance : la plateforme produit existe déjà (v2.0/v2.1), donc le neuf est surtout du **design, de l'agrégation de données et du durcissement DB**, pas de la construction from-scratch.

L'approche recommandée est **minimale et chirurgicale**. Côté stack, seulement **5 ajouts npm** (TanStack Table + Virtual, nuqs, Faker en dev) ; `recharts` déjà présent suffit pour l'analytique ; aucun ORM/AG Grid/k6. Côté design, la migration multi-thème → dark unique se fait en **ne touchant que la couche sémantique des tokens** (`forcedTheme="dark"`, primitives et noms shadcn intacts), ce qui évite une casse globale. Côté DB, la recherche a **confirmé une dette de perf RLS dans le code livré** (policies appelant les fonctions `auth.uid()`/`has_active_subscription()` en clair → réévaluées **par ligne**) : le fix `(select …)` + index sur colonnes de policy donne un gain >100× et doit précéder toute montée en charge.

Les risques principaux sont : (1) un dé-scopage mécanique de `.nxl` qui ferait déborder les tokens globalement, (2) une fuite cross-tenant via une vue/matview admin mal gatée, (3) Realtime `postgres_changes` qui sature à l'échelle, (4) un seed non FK-cohérent qui rendrait l'audit de scalabilité faussement vert. Tous sont adressables par phase, avec un **build order strict** : Design System → reskins → fondation DB scalable → seed massif → dashboards → E2E/audit.

## Key Findings

### Recommended Stack

Stack quasi inchangée : on prolonge l'existant (Tailwind v4 CSS-first, RSC, supabase-js typé, repositories maison, recharts, Vitest/Playwright). Voir `STACK.md` pour le détail et les versions vérifiées (npm 2026-06-22).

**Core technologies (ajouts) :**
- **@tanstack/react-table `8.21.3`** : datagrid headless (tris/filtres/pagination) pour les tableaux des dashboards — seul choix cohérent avec le DS dark néon OKLCH + RTL Tailwind v4 (pas d'AG Grid/MUI qui imposent leur CSS).
- **@tanstack/react-virtual `3.14.3`** : windowing des grandes tables superadmin (utilisateurs/paiements/affiliés) — évite de rendre 10k lignes.
- **nuqs `2.8.9`** : état d'URL typé (filtres/tri/pagination) — prolonge le pattern `searchParams` déjà en place.
- **@faker-js/faker `10.5.0` (devDep)** : seed déterministe (`faker.seed()`), locales fr/ar/en — via `tsx` déjà installé. `@snaplet/seed` écarté (abandonné 2024).
- **recharts `3` (déjà présent)** : graphes analytiques (MRR, funnel, calibration) — rien à ajouter.

**Pas de paquet pour :** pagination par curseur (keyset natif supabase-js `.gt/.lt/.order/.limit` + index composite), pooling (Supavisor txn mode 6543 = config), audit DB (`EXPLAIN ANALYZE` + `pg_stat_statements` + `get_advisors` via MCP). Pas de Drizzle/Prisma, AG Grid, Tremor/nivo, k6, Cypress.

### Expected Features

Voir `FEATURES.md`. `/dashboard` actuel est un **stub** (liste `instruments` seule) → à remplacer. Les onglets membre **agrègent des surfaces déjà livrées** (signaux, abonnement, affiliation) — ne pas réimplémenter.

**Must have (table stakes) :**
- Dashboard utilisateur : vue d'ensemble (état abonnement, derniers signaux, raccourcis), signaux suivis/historique, gestion abonnement (statut/expiration via ExpiryBanner existant), dashboard affilié (déjà bâti — intégrer), paramètres.
- Dashboard superadmin « cockpit 4 axes » : Acquisition (funnel/affiliés), Revenus (MRR/churn/mix plans — **mesurés**), Ops (santé `job_runs`/`v_data_freshness`, file paiements), Conformité (gate `LEGAL_REVIEW_DONE`). Les 6 pages `/admin` existent en germe → enrichir + reskin, pas recréer.

**Should have (différenciateurs) :**
- Watchlist membre (`user_followed_setups`) — **seule écriture front membre** du milestone (1re policy insert/delete scopée `auth.uid()` → revue IDOR).
- Tables superadmin virtualisées avec filtres d'URL profonds (utilisateurs/paiements/affiliés).

**Anti-features (à NE PAS faire — VITR-03 / aucune promesse de gain) :**
- Pas d'equity curve / P&L / ROI personnel (chiffre non mesuré + promesse implicite).
- Pas d'édition manuelle des % ni création/édition manuelle de signaux côté admin (casserait `persist.ts`, frontière producteur-unique).

### Architecture Approach

Voir `ARCHITECTURE.md`. Intégration chirurgicale dans Next 15 App Router + Supabase RLS. Groupe de routes `(dash)` distinct de `(member)` : gate `requireUser` (pas `requireActiveSub`) pour permettre la conversion ; les signaux suivis restent gated par la **RLS**, jamais par le gate UX seul.

**Major components :**
1. **Design System v3 (tokens)** — promotion de `.nxl` (landing) en DS global ; migration = copier les valeurs `.dark` dans `:root`, supprimer `.dark`, `forcedTheme="dark"` ; primitives (couche 1) et noms shadcn (couche 3) intacts ; RTL/i18n orthogonaux non touchés.
2. **Fondation DB scalable** — migration `0017` : wrap `(select auth.uid())`/`(select has_active_subscription())` dans les policies + index sur colonnes de policy (gain >100×) ; index composites alignés `ORDER BY` pour keyset ; matviews KPIs superadmin avec **unique index** (pour `REFRESH CONCURRENTLY`) et **wrapper `is_superadmin()`** (les matviews n'ont pas de RLS).
3. **Dashboards** — RSC + agrégation par vues/RPC (`Promise.all`, anti-N+1), `react-table`/`react-virtual`/`nuqs`, keyset pagination, Realtime via Broadcast plutôt que `postgres_changes` à l'échelle.

### Critical Pitfalls

Top 5 sur 12 (voir `PITFALLS.md`, chacun mappé à une phase) :

1. **Dé-scopage `.nxl` mécanique** → débordement global des tokens + 2 DS coexistants. Migrer la couche sémantique, pas un copier-coller de classes. *(Phase Design System)*
2. **Perf RLS qui s'effondre à 10k** → policies en clair réévaluées par ligne. Wrap `(select …)` + index colonne de policy, **avant** la charge. *(Phase Fondation DB)*
3. **Fuite cross-tenant admin** → route admin sans `is_superadmin()` en 1ʳᵉ ligne, ou matview sans wrapper. Défaut = client anon + RLS `is_superadmin()` ; jamais service_role côté pages. *(Phases Dashboards)*
4. **Realtime `postgres_changes` qui sature** → passer à **Broadcast** pour les flux à fort volume ; migrations bloquantes → `CREATE INDEX CONCURRENTLY` hors transaction (gérer l'état INVALID). *(Phase Fondation DB)*
5. **Seed non FK-cohérent / sous-dimensionné** → audit scalabilité faussement vert. Seed idempotent, volumes ~10k représentatifs, RLS re-testée **depuis client anon** (pas service_role). *(Phase Seed)*

## Implications for Roadmap

Structure de phases suggérée (le roadmapper continue la numérotation après la phase 14 de v2.1) :

### Phase 1 (suggérée) : Design System v3 « dark néon unique »
**Rationale :** Toute la suite (reskins, dashboards) en dépend ; le faire après = double passage.
**Delivers :** tokens dark unique (couche sémantique promue depuis `.nxl`), `forcedTheme="dark"` + retrait du toggle light, conventions de composants, résolution collision `ring`/glow, gardes étendues, décision **green vs volt** par défaut.
**Avoids :** pitfall #1 (débordement tokens), FOUC.

### Phase 2 (suggérée) : Reskin transversal de toutes les pages
**Rationale :** Une fois le DS figé, repeindre toutes les surfaces existantes d'un coup.
**Delivers :** vitrine, légal, auth, espace membre signaux/détail, paiement, compte/abonnement, académie, admin sur le DS v3.
**Uses :** DS v3 ; conserve RTL/i18n/no-perf-claims/no-mera-brand.

### Phase 3 (suggérée) : Fondation DB scalable (perf avant charge)
**Rationale :** Durcir la DB avant d'exposer des vues lourdes à l'échelle.
**Delivers :** migration `0017` (wrap RLS + index colonnes de policy), index composites keyset, infra matviews KPIs (+ unique index + wrapper `is_superadmin()`), migrations non bloquantes.
**Implements :** composant architecture #2 ; **Avoids** pitfalls #2 et #4.

### Phase 4 (suggérée) : Seed de données réalistes à l'échelle
**Rationale :** Sans données ~10k FK-cohérentes, rien à afficher ni à mesurer.
**Delivers :** `seed.ts` (faker, déterministe, idempotent, labels `backtest`/`démo`), volumes représentatifs, RLS re-testée depuis client anon.
**Avoids :** pitfall #5.

### Phase 5 (suggérée) : Dashboard utilisateur
**Rationale :** Surface membre à plus forte valeur, sur DS + données seedées.
**Delivers :** `(dash)` vue d'ensemble, signaux suivis/historique, abonnement, affiliation intégrée, watchlist `user_followed_setups` (revue IDOR).
**Uses :** react-table/react-virtual/nuqs, keyset pagination.

### Phase 6 (suggérée) : Dashboard superadmin
**Rationale :** Cockpit ops/revenus/conformité, consomme les matviews de la phase 3.
**Delivers :** enrichissement des 6 pages `/admin` en cockpit 4 axes (Acquisition/Revenus/Ops/Conformité), tables virtualisées gated `is_superadmin()`.

### Phase 7 (suggérée) : Tests E2E + audit scalabilité
**Rationale :** Valider les flux et prouver la tenue à l'échelle une fois tout en place.
**Delivers :** specs Playwright des flux principaux + audit `EXPLAIN ANALYZE`/`get_advisors`/`pg_stat_statements` sur les requêtes clés, validation des index/keyset.

### Phase Ordering Rationale

- **DS avant reskin** : repeindre sur un DS non figé = double travail (arête dure).
- **Perf DB avant exposition à l'échelle** : le fix RLS/index est le gain le plus rentable et doit exister avant que les dashboards tapent la DB.
- **Seed avant dashboards ET audit** : sans données représentatives, ni démonstration ni mesure fiable.
- **E2E/audit en fin** : valide l'ensemble assemblé.

### Research Flags

Phases nécessitant une recherche plus poussée en planification (`/gsd-ultraplan-phase`) :
- **Phase Design System v3 :** décision produit green vs volt + matrice de contraste AA en dark sur surfaces translucides.
- **Phase Fondation DB / Audit :** seuils exacts de bascule OFFSET→keyset et `postgres_changes`→Broadcast à confirmer par `EXPLAIN ANALYZE` une fois le seed en place (compute Supabase non profilé).

Phases à patterns standards (recherche légère) :
- **Reskin transversal**, **Dashboard utilisateur** : patterns établis, dépendances internes connues.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | npm vérifié 2026-06-22 ; cohérent avec « What NOT to Use » |
| Features | HIGH | surfaces existantes lues ; anti-features VITR-03 explicites |
| Architecture | HIGH | chaque point cite un fichier réel ; claims scalabilité vérifiés sur docs Supabase/Postgres à jour |
| Pitfalls | HIGH (MEDIUM sur seuils chiffrés) | sources officielles ; seuils de bascule à profiler post-seed |

**Overall confidence:** HIGH

### Gaps to Address

- **Thème par défaut (green vs volt)** : trancher en phase Design System v3 (décision produit fondateur).
- **Prix mensuel pour MRR seedé** : 9 $ standard / 3 $ découverte (PROJECT.md) — confirmer au moment du seed pour cohérence du MRR superadmin.
- **Seuils de scalabilité chiffrés** : à mesurer par `EXPLAIN ANALYZE`/advisors une fois le seed ~10k en place (compute non profilé).
- **Driver `postgres` (SQL direct)** : à ajouter uniquement si `seed.ts` massif passe en SQL direct plutôt que supabase-js service_role (non bloquant).

## Sources

### Primary (HIGH confidence)
- Docs officielles Supabase (RLS performance `(select auth.uid())`, Supavisor pooler, Realtime Broadcast vs postgres_changes, keyset pagination) — vérifiées 2026-06-22.
- Docs Postgres (`CREATE INDEX CONCURRENTLY`, matviews `REFRESH CONCURRENTLY`, index composites/keyset).
- npm registry — versions @tanstack/react-table 8.21.3, @tanstack/react-virtual 3.14.3, nuqs 2.8.9, @faker-js/faker 10.5.0 (dates de publication incluses dans STACK.md).
- Codebase NEXA : `globals.css`, `nexa-landing.css`, `[locale]/layout.tsx`, migrations 0006/0009/0016, `/dashboard` + `/admin`, `package.json`.

### Secondary (MEDIUM confidence)
- Consensus communautaire sur TanStack Table/Virtual pour datagrids headless RTL-friendly.

---
*Research completed: 2026-06-22*
*Ready for roadmap: yes*
