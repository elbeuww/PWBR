# Stack Research

**Domain:** Plateforme SaaS trading (Next.js 15 + Supabase) — milestone v3.0 « dark néon NEXA » : dashboards riches + scalabilité DB 10k+ users + E2E + seed à l'échelle, sur données seedées.
**Researched:** 2026-06-22
**Confidence:** HIGH (versions npm vérifiées 2026-06-22 ; patterns Supabase confirmés docs officielles)

> **Cadrage** — Ce milestone est un AJOUT à une app déjà construite. La stack existante (Next 15 App Router/RSC, Supabase Postgres 15+/Auth/Realtime/RLS, TS strict, pnpm workspaces, Tailwind v4 CSS-first, next-intl 4.13 fr/en/ar RTL, next-themes, lightweight-charts 5, recharts 3, @tanstack/react-query 5, Zod 4, Vitest 4, Playwright 1.60) **ne se re-recherche pas et ne change pas**. Ci-dessous : UNIQUEMENT le NEUF nécessaire aux 5 axes, et ce qu'il NE faut PAS ajouter.

---

## Recommended Stack

### Le NEUF — 5 additions seulement

| Library | Version | Axe | Purpose | Why Recommended |
|---------|---------|-----|---------|-----------------|
| **@tanstack/react-table** | `8.21.3` | Dashboards | Datagrid **headless** (tri, filtre, colonnes, pagination) sans CSS imposé | Standard de fait pour tableaux riches React. Headless = se style à 100 % avec le DS dark néon (Tailwind v4) ; zéro conflit visuel, zéro thème à overrider. Même éditeur que react-query (déjà là) → cohérence ergonomique. v8 stable, maintenu (modifié 2026-06-20). Indispensable pour `/admin` (membres, paiements, affiliés, signaux) et tableaux denses utilisateur. |
| **@tanstack/react-virtual** | `3.14.3` | Dashboards + scalabilité front | Virtualisation de lignes (windowing) pour listes/tables longues | Sans virtualisation, afficher 10k lignes seedées tue le DOM. Rend des milliers de lignes à coût constant. S'intègre nativement avec react-table (recette officielle TanStack). À utiliser **seulement** sur les tables superadmin volumineuses, pas partout. Même famille TanStack. |
| **@faker-js/faker** | `10.5.0` | Seed à l'échelle | Génération de données réalistes (users, paiements, signaux, outcomes, affiliés) | Standard JS pour fixtures réalistes. `faker.seed(n)` = **déterminisme reproductible** (rejouer le même dataset). Locales `fr`/`ar`/`en` alignées sur l'audience MENA pour des noms/textes crédibles. devDependency seulement. v10 ESM natif (cohérent avec `"type":"module"`). |
| **nuqs** | `2.8.9` | Dashboards | État d'URL typé (filtres/tri/pagination ↔ searchParams) pour RSC | Les pages existantes utilisent déjà des **filtres via searchParams URL** (FilterBar v2.0 P3). nuqs typifie et centralise ce pattern (parsers Zod-like, defaults, shallow), compatible App Router + RSC + Server Components. Évite de réécrire à la main le parsing/sérialisation des filtres des nouveaux dashboards. **Optionnel** mais fortement recommandé vu le nombre de tableaux filtrables à livrer. |
| **@tanstack/react-query-devtools** | `5.101.0` | Dev/dashboards | Inspecteur de cache react-query en dev | devDependency. Accélère le debug des dashboards temps réel (cache, invalidation, états loading). Version **strictement alignée** sur react-query 5.101.0 déjà installé. |

> Tout le reste des 5 axes se fait avec la stack DÉJÀ présente. Voir « What NOT to Use ».

### Outillage scalabilité/audit DB — AUCUN paquet npm à ajouter

| Capacité | Outil | Comment (pas de dépendance) |
|----------|-------|------------------------------|
| `EXPLAIN (ANALYZE, BUFFERS)` sur requêtes clés | **MCP Supabase `execute_sql`** (déjà connecté) | Lancer EXPLAIN sur les requêtes des dashboards (listes signaux/membres/paiements) pour valider l'usage d'index avant/après. |
| `pg_stat_statements` | **Extension Supabase** (pré-activée sur la plateforme) | Identifier les requêtes lentes/fréquentes. Lire via `execute_sql`. Aucun client à installer. |
| Advisors (RLS perf, index manquants, sécurité) | **MCP Supabase `get_advisors`** (déjà utilisé en v2.0 P5) | `lint` + `performance`. Garde-fou systématique après chaque migration d'index/RLS. |
| Indexation ciblée | **Migrations SQL Supabase CLI** (source de vérité existante) | `CREATE INDEX ... ON (...)` pour les colonnes de tri/filtre/curseur. Pas d'outil tiers. |
| Pooling 10k+ connexions | **Supavisor transaction mode (port 6543)** — config, pas de paquet | Voir section dédiée ci-dessous. Impact app à comprendre, mais **rien à `npm install`**. |
| Pagination par curseur | **`@supabase/supabase-js` `.gt()/.lt()/.order().limit()`** (déjà là) | Keyset pagination native du client. Pas de lib de pagination. Voir section dédiée. |
| Seed massif performant | **`tsx` `4.22.4`** (déjà là) + faker + client Supabase service_role | `pnpm tsx apps/jobs/seed.ts` — réutilise le runner de jobs existant. Inserts par batch (upsert idempotent). |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **Playwright `1.60.0`** (déjà installé) | E2E des flux v3.0 | **Rien à ajouter.** Axe « tests fonctionnels E2E » = écrire des specs, pas changer d'outil. Réutilise la config + les specs authorées (32 ✓ en v2.0). Couvrir : auth, dashboard user, dashboard superadmin (gating 404 non-superadmin), filtres/pagination des tables, RTL ar. |
| **Vitest `4.1.8`** (déjà installé) | Unit (parsers seed, formatters dashboard, helpers curseur) | Inchangé. Cible 80 %. |
| **faker (mode seed déterministe)** | `faker.seed(42)` en tête de `seed.ts` | Garantit un dataset reproductible entre machines/CI. |
| **@tanstack/react-query-devtools** | Debug cache dashboards | Monté uniquement en `process.env.NODE_ENV !== 'production'`. |

---

## Installation

```bash
# Dashboards (apps/web) — runtime
pnpm --filter web add @tanstack/react-table@8.21.3 @tanstack/react-virtual@3.14.3 nuqs@2.8.9

# Dashboards — dev
pnpm --filter web add -D @tanstack/react-query-devtools@5.101.0

# Seed à l'échelle (apps/jobs, devDependency)
pnpm --filter jobs add -D @faker-js/faker@10.5.0
# (ou racine workspace si le seed vit hors apps/jobs)

# RIEN d'autre. Pooling = config Supavisor. Audit DB = MCP Supabase + migrations SQL. E2E = Playwright déjà là.
```

---

## Pagination par curseur (Supabase / RSC) — pattern recommandé

**Décision : keyset (cursor) pagination, PAS de lib dédiée.** Le client `@supabase/supabase-js` la fait nativement.

- **Pourquoi pas `.range()` (OFFSET) partout** : OFFSET scanne toutes les lignes sautées → O(n) sur les pages profondes ; **et avec RLS, `LIMIT/OFFSET` doit évaluer la policy sur toutes les lignes pour ordonner** (coût massif à 10k+). Inacceptable pour des tables superadmin qui grossissent.
- **Pattern keyset** : trier sur une clé stable et **indexée** (ex. `(created_at, id)` pour départager les ex æquo), puis `.lt('created_at', lastSeen)` (ou tuple) + `.order(...)` + `.limit(n)`. O(1) quelle que soit la profondeur.
- **Prérequis non négociable** : un **index B-tree composite** sur les colonnes d'`ORDER BY` du curseur (sinon keyset ne sert à rien). À créer par migration + valider via `EXPLAIN ANALYZE` (index scan, pas seq scan).
- **RSC** : le curseur transite par `searchParams` (`?after=<created_at>_<id>`), parsé/typé par **nuqs**, lu côté serveur, passé au client Supabase anon (RLS appliquée). Curseur opaque côté UI.
- **Quand `.range()` reste OK** : petites tables bornées (ex. liste de payouts d'un affilié) ou « page 1 » d'aperçu avec `count: 'estimated'`. Ne pas sur-ingénierer : keyset là où le volume seedé l'exige (signaux, paiements, users, outcomes).

---

## Pooling de connexions (Supavisor transaction mode) — impact app

**Décision : Supavisor en transaction mode (port 6543) pour les jobs/serveurs Node ; config, pas de paquet.**

- **Pourquoi** : à 10k+ users, les connexions Postgres directes (port 5432) s'épuisent. Transaction mode emprunte une connexion **pour la durée d'une transaction** puis la rend → supporte un grand nombre de clients concurrents. C'est le port pour le serverless/edge et les pics de trafic.
- **Impact app à connaître** :
  - **Pas de prepared statements persistants** en transaction mode (la connexion est réassignée). **`@supabase/supabase-js` (PostgREST/HTTP) n'est PAS concerné** — il passe par l'API REST, pas par une connexion SQL directe. Donc le front/RSC qui lit via supabase-js : **aucun changement**.
  - Le sujet ne concerne que **les connexions SQL directes** : jobs `tsx` qui ouvriraient un client `postgres`/`pg`, migrations, scripts de seed massif. Si un tel client est utilisé, viser le **driver `postgres` (porthos)** qui **ne crée pas de prepared statements par défaut** → compatible transaction mode sans flag. (Si jamais Prisma/Drizzle entraient en jeu : `pgbouncer=true`/`prepare:false` — mais on n'en ajoute pas, voir What NOT to Use.)
  - **Ne pas faire tourner PgBouncer ET Supavisor** simultanément (risque de saturer `max_connections` sur petit tier).
- **Seed à l'échelle** : insérer par **batch** (ex. 500–1000 lignes/insert) via supabase-js service_role ou un client `postgres` en transaction mode ; rester idempotent (upsert sur clés naturelles) pour rejouer le seed sans dupliquer.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| **@tanstack/react-table** (headless) | AG Grid, MUI DataGrid, shadcn DataTable « tout fait » | Jamais ici. AG Grid/MUI imposent leur CSS/thème → conflit frontal avec le DS dark néon OKLCH et le RTL. shadcn DataTable EST déjà react-table sous le capot. Headless = seul choix cohérent avec Tailwind v4 CSS-first. |
| **@tanstack/react-virtual** | `react-window`, `react-virtuoso` | react-virtuoso si on voulait un composant clé-en-main (mais opinionated, moins headless). react-window en maintenance douce. react-virtual s'imbrique mieux avec react-table. |
| **@faker-js/faker** | `@snaplet/seed`, drizzle-seed, fixtures SQL manuelles | **@snaplet/seed = ABANDONNÉ** (dernière publication 2024-08, Snaplet fermé) → ne pas adopter. drizzle-seed exigerait Drizzle (interdit). Fixtures SQL manuelles = ingérables à 10k. faker + tsx couvre tout. |
| **Keyset via supabase-js** | RPC SQL custom paginée, `pg_cursor` serveur | RPC seulement si une requête de dashboard devient trop complexe pour le query builder (jointures lourdes). Démarrer sans ; ajouter une RPC ciblée si `EXPLAIN` le justifie. |
| **nuqs** | Parsing manuel `searchParams` (pattern v2.0 existant) | Le pattern manuel reste valable pour 1-2 filtres simples. nuqs paie dès qu'on multiplie tables filtrables + tri + curseur. Adoption optionnelle mais recommandée. |
| **recharts 3** (déjà là) | visx, nivo, Tremor, ECharts | **Aucun ajout.** recharts 3.x couvre equity curve, barres de calibration, KPIs dashboards. Tremor imposerait son propre style (conflit DS). N'ajouter visx QUE si un graphe très custom (heatmap dense) s'avère impossible en recharts — à trancher au cas par cas, pas par défaut. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Drizzle / Prisma / tout ORM** | Dédouble la source de vérité du schéma (migrations SQL Supabase = source unique) ; complexifie RLS ; prepared statements incompatibles transaction mode. Déjà banni au CLAUDE.md. | Client Supabase typé (`supabase gen types`) + repositories `/packages/supabase` + migrations SQL CLI. |
| **Nouvelle lib de charting** (Tremor, nivo, ECharts, visx par défaut) | recharts 3 + lightweight-charts 5 couvrent déjà prix + analytique. Ajout = bundle + incohérence visuelle avec le DS dark néon. | recharts 3.x (déjà installé) pour l'analytique, lightweight-charts 5 pour les prix. |
| **AG Grid / MUI X DataGrid / table « stylée »** | CSS/thème imposés → cassent le DS dark néon OKLCH et le RTL ; lourd. | @tanstack/react-table (headless) stylé en Tailwind v4. |
| **@snaplet/seed / snaplet** | **Projet abandonné** (2024), non maintenu, risque supply-chain. | @faker-js/faker 10 + script tsx idempotent. |
| **Lib de pagination tierce** (react-paginate, etc.) | La pagination est une affaire de requête SQL (keyset) + état d'URL, pas un composant. | `.gt()/.lt()/.order().limit()` supabase-js + index composite + nuqs pour l'URL. |
| **PgBouncer auto-hébergé en plus de Supavisor** | Deux poolers = risque de saturer `max_connections`. | Supavisor seul (fourni par Supabase), transaction mode port 6543. |
| **Prepared statements forcés sur connexion SQL directe** en transaction mode | Cassent en transaction mode (connexion réassignée). | supabase-js (HTTP, non concerné) ; si SQL direct nécessaire, driver `postgres` (porthos, no-prepare par défaut). |
| **Outil d'audit DB tiers** (pganalyze, etc.) payant | Inutile : `get_advisors`, `pg_stat_statements`, `EXPLAIN ANALYZE` via MCP Supabase suffisent pour un audit de conception. | MCP Supabase (`execute_sql`, `get_advisors`) + migrations SQL. |
| **Outil de charge réel** (k6, Artillery) | **Hors scope explicite du milestone** (« PAS de test de charge réel », « scalabilité = conception + audit »). | EXPLAIN/advisors sur dataset seedé à l'échelle. |
| **Cypress** (autre runner E2E) | Playwright déjà la base E2E (config + 32 specs ✓). Doublon. | Playwright 1.60 (déjà installé). |

---

## Stack Patterns by Variant

**Si une table superadmin doit afficher > ~500 lignes simultanées :**
- Combiner @tanstack/react-table + @tanstack/react-virtual (windowing) + keyset pagination serveur.
- Parce que rendre 10k lignes seedées en DOM brut gèle le navigateur ; la virtualisation borne le coût de rendu et le keyset borne le coût DB.

**Si un dashboard a ≤ 1-2 filtres simples et peu de lignes :**
- Garder le pattern searchParams manuel existant + `.range()` (`count: 'estimated'`).
- Parce que nuqs + keyset seraient de la sur-ingénierie ; ne pas alourdir.

**Si une requête de dashboard devient trop complexe pour le query builder (jointures/agrégats lourds) :**
- Encapsuler dans une **RPC SQL** (`SECURITY INVOKER`, RLS respectée) testée + indexée, appelée via `supabase.rpc()`.
- Parce qu'une RPC indexée bat un empilement de filtres côté client et garde la logique paginable.

**Si le seed doit produire des séries temporelles cohérentes (candles/outcomes) :**
- `faker.seed(n)` + génération dérivée déterministe (marche aléatoire bornée, pas de random pur sur les prix) + upsert idempotent sur `(instrument_id, timeframe, ts)`.
- Parce que les % de réussite/outcomes seedés doivent rester reproductibles et plausibles.

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| @tanstack/react-table 8.21.3 | React 19 / Next 15 | v8 React-19-ready. Headless → aucun conflit Tailwind v4 / RTL. |
| @tanstack/react-virtual 3.14.3 | @tanstack/react-table 8.x | Recette d'intégration officielle TanStack (row virtualization). |
| @tanstack/react-query-devtools 5.101.0 | @tanstack/react-query 5.101.0 | **Versions doivent matcher** (déjà 5.101.0 installé). |
| nuqs 2.8.9 | Next 15 App Router / RSC | Adapter `nuqs/adapters/next/app`. Compatible Server Components + RTL (n'affecte pas le DOM dir). |
| @faker-js/faker 10.5.0 | Node ESM (`"type":"module"`) | v10 ESM natif. devDependency uniquement. Locales fr/ar/en disponibles. |
| supabase-js 2.108.x | Supavisor transaction mode | **Non concerné par prepared statements** (HTTP/PostgREST). Aucun changement front/RSC. |
| Driver `postgres` (porthos) 3.4.x | Supavisor transaction mode (6543) | **Seulement si** un job SQL direct est nécessaire ; no-prepare par défaut → OK transaction mode. Ne PAS ajouter sans besoin réel. |
| recharts 3.x | React 19 | Déjà installé. Aucun upgrade requis pour les graphes dashboards. |

---

## Sources

- npm registry (vérifié 2026-06-22) — @tanstack/react-table 8.21.3 (modifié 2026-06-20), @tanstack/react-virtual 3.14.3, @faker-js/faker 10.5.0 (2026-06-17), nuqs 2.8.9, @tanstack/react-query-devtools 5.101.0, recharts 3.8.1, @supabase/supabase-js 2.108.2, @snaplet/seed 0.98.0 **stale 2024-08 → abandonné**, drizzle-orm 0.45.2 (non retenu), postgres 3.4.9 — **HIGH**
- Supabase Docs — Connecting to Postgres / Supavisor FAQ / transaction mode port 6543, prepared statements, ne pas cumuler PgBouncer+Supavisor — https://supabase.com/docs/guides/database/connecting-to-postgres — **HIGH**
- Supabase Docs — RLS Performance and Best Practices (impact LIMIT/OFFSET sous RLS) — https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv — **HIGH**
- Supabase agent-skills — data-pagination (keyset > OFFSET, index requis sur ORDER BY) — https://github.com/supabase/agent-skills/blob/main/skills/supabase-postgres-best-practices/references/data-pagination.md — **HIGH**
- CLAUDE.md (stack verrouillée + What NOT to Use : pas d'ORM, pas de node-cron, supabase-js typé) + PROJECT.md (milestone v3.0, scope « conception + audit, pas de charge réelle », EXISTING_CONTEXT) — **HIGH** (source projet)
- apps/web/package.json + package.json racine (deps installées : react-query 5.101.0, Playwright 1.60, Vitest 4.1.8, tsx 4.22.4) — **HIGH** (lecture directe)

---
*Stack research for: NEXA v3.0 — dashboards dark néon + scalabilité DB 10k+ + E2E + seed à l'échelle (données seedées)*
*Researched: 2026-06-22*
