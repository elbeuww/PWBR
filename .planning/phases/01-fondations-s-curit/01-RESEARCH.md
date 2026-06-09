# Phase 1 : Fondations & Sécurité — Recherche

**Recherché :** 2026-06-09
**Domaine :** Monorepo Next.js 15 + Supabase (Auth SSR, RLS, triggers), runner de jobs ESM, conventions temporelles, modèle d'exécution des Routines Claude Code
**Confiance globale :** HIGH sur la stack Supabase/Next/monorepo ; MEDIUM sur le modèle d'exécution des Routines Claude (dépendance externe, doc récente)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01 → D-13)

- **D-01 :** Auth = **email + mot de passe seul**. Pas de magic link ni OAuth en Phase 1.
- **D-02 :** Confirmation email **désactivée** au démarrage. À réactiver avant ouverture communauté (v2).
- **D-03 :** Auth via `@supabase/ssr 0.12.0` (cookies httpOnly, App Router/RSC) — **pas** `auth-helpers` (déprécié). Session persistée côté cookies serveur.
- **D-04 :** Schéma = **minimum walking skeleton**. Tables créées : `profiles`, `job_runs`, `instruments`. Reste du schéma arrive phase par phase.
- **D-05 :** RLS active sur **toutes** les tables (vérifiable via `get_advisors`). Patterns : `instruments` = lecture authentifiés ; `profiles` = chacun lit/écrit le sien (`id = auth.uid()`) ; `job_runs` = lecture authentifiés, écriture `service_role` uniquement.
- **D-06 :** `profiles` = champs minimaux `id` (= `auth.uid()`), `email`, `created_at`. **Trigger Postgres** sur insert `auth.users` → crée la ligne `profiles`. Champs `capital`/`risk_percent`/`account_type` reportés en Phase 7.
- **D-07 :** Client `service_role` exclusivement dans `packages/supabase` (module **server-only**), importable seulement par `apps/jobs`. Garde-fou = règle ESLint **`no-restricted-imports`** bloquant l'import depuis `apps/web`. Bundle frontend = clé `anon` uniquement.
- **D-08 :** Runner **agnostique** : un entrypoint `tsx` unique dans `apps/jobs` (dispatcher), appelable par Routine Claude, Windows Task Scheduler (`.cmd`) ou croner. Chaque run écrit une entrée `job_runs` (statut, timing, erreur).
- **D-09 :** Daily = **natif par source**. OANDA daily aligné 17:00 NY ; Binance/crypto aligné 00:00 UTC. Documenté comme constantes par source dans `packages/core`.
- **D-10 :** Stockage **UTC** systématique + convention **bougie clôturée** (exclut la bougie en cours) codées comme constantes partagées dans `packages/core`. luxon pour sessions/DST.
- **D-11 :** Packages Phase 1 = **strict skeleton** : `apps/web`, `apps/jobs`, `packages/core`, `packages/supabase`. PAS de `packages/data-sources` ni `packages/indicators` (créés à leur phase).
- **D-12 :** Secrets via **`.env` local + `.env.example` commité**. `.env` racine jobs = `service_role` (non commité) ; `.env.local` web = clé `anon` seulement. Task Scheduler/croner lisent `.env` via tsx ; la Routine Claude injecte les secrets via son env cloud. Pas de secret manager externe.
- **D-13 :** Tests **ciblés socle critique**, pas de cible 80% sur le scaffolding : (1) golden-values Vitest sur constantes temps, (2) test d'intégration RLS prouvant l'isolation entre users, (3) 1 E2E Playwright auth (signup → login → session persiste).

### Claude's Discretion

- Structure interne exacte des packages (arborescence, noms de modules).
- Forme précise des constantes temporelles (enums, objets config par source) dans `packages/core`.
- Détails de la config ESLint `no-restricted-imports` (patterns de chemins).
- Choix du déclencheur Task Scheduler (`.cmd` wrapper) et structure du dispatcher de jobs.
- Schéma SQL précis des 3 tables (types de colonnes, index) dans le respect des décisions.

### Deferred Ideas (HORS PÉRIMÈTRE)

- Confirmation email + magic link / OAuth Google (v2).
- Secret manager externe (Doppler/1Password CLI).
- Déploiement Vercel + CI GitHub Actions.
- Champs profil étendus (capital, risk_percent, account_type) — Phase 7.
- Reste du schéma Supabase (candles, news, macro, analyses, trade_setups, journal) — phases 2/3/4/8.
- Cible de couverture 80% sur tout le code — phases métier suivantes.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Support de recherche |
|----|-------------|----------------------|
| AUTH-01 | Compte + login Supabase Auth, session persiste | Pattern `@supabase/ssr 0.12.0` : `createBrowserClient`/`createServerClient` + `middleware.ts` (`updateSession` → `getUser`). Voir §Architecture Patterns. |
| AUTH-02 | Toutes les tables ont RLS active ; données marché en lecture pour authentifiés | SQL `ENABLE ROW LEVEL SECURITY` + policies par table ; `get_advisors` flag `rls_disabled_in_public`. Voir §Security Domain + §Code Examples. |
| AUTH-03 | `service_role` isolée aux jobs, jamais exposée au frontend (lint anti-import) | Module `server-only` + ESLint `no-restricted-imports` patterns. Voir §Don't Hand-Roll + §Code Examples. |
| DATA-05 | Bougies normalisées UTC + convention bougie clôturée explicite | Constantes `packages/core` + luxon ; daily natif par source (D-09/D-10). Voir §Code Examples. |
| JOB-03 | Étapes déterministes exécutables hors agent Claude (Windows Task Scheduler) | Dispatcher `tsx` ESM + `.cmd` wrapper. Voir §Architecture Patterns. |
| JOB-04 | Chaque exécution écrit une entrée `job_runs` (statut, timing, erreur) | Wrapper `runJob()` idempotent écrivant `job_runs` via `service_role`. Voir §Code Examples. |
</phase_requirements>

## Summary

Cette phase pose le walking skeleton d'un monorepo pnpm (Next.js 15 + Supabase cloud) qui prouve la chaîne `signup → login → session persistée → lecture d'une table RLS → un job écrit job_runs`. La stack est **verrouillée** dans CLAUDE.md : la recherche porte sur les **patterns d'usage corrects** de ces versions exactes, pas sur le choix des libs.

Les trois piliers techniques bien documentés (confiance HIGH) : (1) l'auth `@supabase/ssr 0.12.0` impose un pattern canonique strict — `getAll`/`setAll` pour les cookies, `middleware.ts` qui rafraîchit la session via `getUser()` (jamais `getSession()` côté serveur), et trois clients distincts (browser, server-RSC, middleware) ; (2) les policies RLS + le trigger `handle_new_user` SECURITY DEFINER avec `SET search_path = ''` obligatoire ; (3) l'isolation `service_role` via le package `server-only` doublée d'une règle ESLint `no-restricted-imports`.

Le seul point à confiance MEDIUM est le **modèle d'exécution des Routines Claude Code**. La doc officielle (code.claude.com/docs/en/routines) confirme : les Routines **Remote tournent dans le cloud Anthropic** (PC éteint OK), quota **15 runs/jour sur Max** (le projet supposait ~15, donc **correct**), secrets injectés via **Environments** (variables chiffrées + setup script + network access réglable), et les **connectors sont des MCP cloud-hosted — un MCP local stdio n'est PAS accessible** dans une Routine Remote. Implication directe : le MCP Supabase connecté interactivement n'est pas le chemin d'exécution des jobs ; les jobs doivent appeler Supabase via le **SDK supabase-js avec network access autorisé** (un projet Supabase cloud est une URL HTTPS publique, donc joignable). La Routine Local (Desktop Scheduled Task) existe mais ne tourne que PC allumé — c'est exactement le rôle du fallback Windows Task Scheduler de D-08.

**Primary recommendation :** Concevoir le dispatcher `tsx` comme un binaire ESM autonome qui (a) lit ses secrets depuis `process.env` (peuplé par `.env` via dotenv en local, ou par l'Environment Claude en cloud), (b) écrit `job_runs` via le SDK `service_role`, (c) ne dépend d'aucun MCP. Ainsi le **même binaire** est appelable par Windows Task Scheduler, croner, ou une Routine Claude — sans réécriture. L'analyse IA (Phase 4) restera le seul morceau qui exige l'agent Claude lui-même.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Signup / login / refresh session | Frontend Server (Next middleware + RSC) | Browser (client component pour le form) | `@supabase/ssr` gère les cookies httpOnly côté serveur ; le middleware rafraîchit le token. Jamais côté browser pur. |
| Vérification d'identité (`getUser`) | API / Supabase Auth server | — | `getUser()` revalide le token auprès du serveur Auth à chaque appel — seul appel digne de confiance côté serveur. |
| RLS / autorisation des lignes | Database (Postgres policies) | — | L'autorisation vit dans la DB, pas dans l'app. `auth.uid()` évalué côté Postgres. |
| Auto-création de `profiles` | Database (trigger SECURITY DEFINER) | — | Atomique avec l'insert `auth.users` ; aucun aller-retour app. |
| Lecture `instruments` dans l'UI | Frontend Server (RSC) | API (client anon) | RSC lit via client anon ; RLS autorise les authentifiés. |
| Ingestion / écriture `job_runs` | API / Backend (jobs `service_role`) | — | `service_role` bypasse RLS ; isolé à `apps/jobs`, jamais dans le bundle web. |
| Constantes temporelles (UTC, bougie clôturée, sessions) | Shared package (`packages/core`) | — | Consommées par jobs ET phases futures (indicateurs, moteur) — source unique. |
| Scheduling déterministe (fallback) | OS (Windows Task Scheduler) | In-process (croner) | Garantit l'ingestion même PC allumé sans agent ; croner si daemon Node souhaité. |
| Scheduling IA (analyse) | Cloud (Routine Claude Remote) | — | Seul chemin produisant le raisonnement IA ; cloud Anthropic, PC éteint OK. |

## Standard Stack

> **Stack VERROUILLÉE dans CLAUDE.md.** Aucune alternative proposée. Versions vérifiées sur npm le 2026-06-09.

### Core
| Library | Version (verrouillée / npm latest) | Purpose | Note de version |
|---------|------------------------------------|---------|-----------------|
| `next` | **15.x** (npm latest = `16.2.7`) | Front App Router + RSC | **RESTER sur 15.** npm `latest` pointe sur 16 — ne PAS suivre. `@supabase/ssr` stabilisé sur 15. [VERIFIED: npm registry] |
| `@supabase/ssr` | **0.12.0** (npm latest = `0.12.0`) | Auth cookies App Router/RSC | À jour. Remplace `auth-helpers` (déprécié). [VERIFIED: npm registry] [CITED: supabase.com/docs/guides/auth/server-side/nextjs] |
| `@supabase/supabase-js` | **2.108.0** verrouillé (npm latest = `2.108.1`) | Client DB/Auth/Realtime | Patch `.1` dispo ; `.0` verrouillé dans CLAUDE.md. Aligner sur le lock ou bump conscient vers `.1`. [VERIFIED: npm registry] |
| `zod` | **4.4.3** (npm latest = `4.4.3`) | Validation env + (futur) JSON IA | À jour. v4. [VERIFIED: npm registry] |
| `luxon` | **3.7.2** (npm latest = `3.7.2`) | UTC, sessions, DST, bornes de bougie | À jour. Cœur des constantes temps. [VERIFIED: npm registry] |
| `pnpm` | `9.x` workspaces | Monorepo | Verrouillé CLAUDE.md. |
| `typescript` | `5.7+` strict | Typage bout en bout | `strict: true` non négociable. |

### Supporting
| Library | Version (npm) | Purpose | When to Use |
|---------|---------------|---------|-------------|
| `tsx` | `4.22.4` | Exécution directe TS ESM des jobs | Entrypoint dispatcher `apps/jobs`. [VERIFIED: npm registry] |
| `server-only` | `0.0.1` | Marqueur build-time anti-import client | Importé en tête du module `service_role`. Fait planter le build si importé côté client. [VERIFIED: npm registry] |
| `pino` | `10.3.1` | Logs structurés des jobs → `job_runs.stats` | Dans le wrapper `runJob`. [VERIFIED: npm registry] |
| `croner` | `10.0.1` | Scheduling in-process optionnel (TZ-aware) | Seulement si daemon Node long-running souhaité. PAS node-cron. [VERIFIED: npm registry] |
| `dotenv` | (à vérifier au plan) | Charger `.env` en local pour tsx | Local uniquement ; en cloud les vars viennent de l'Environment Claude. |
| `vitest` | `4.1.8` | Tests unitaires (golden-values temps, RLS intégration) | [VERIFIED: npm registry] |
| `@playwright/test` | `1.60.0` | E2E auth (signup → login → session) | [VERIFIED: npm registry] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@supabase/ssr` | `@supabase/auth-helpers-nextjs` | **INTERDIT** (déprécié, ne supporte pas proprement App Router/RSC). |
| Types Supabase générés | Drizzle/Prisma | **INTERDIT** en Phase 1 (dédouble la source de vérité du schéma). |
| croner / Task Scheduler | `node-cron` | **INTERDIT** (support TZ et veille/réveil inférieurs). |
| Next 15 | Next 16 | **INTERDIT** (écosystème Supabase/ssr stabilisé sur 15). |

**Installation (indicatif — versions exactes au plan) :**
```bash
# racine workspace (dev)
pnpm add -D -w typescript tsx vitest @playwright/test eslint prettier
# apps/web
pnpm --filter web add next@15 react react-dom @supabase/ssr @supabase/supabase-js zod
# apps/jobs
pnpm --filter jobs add @supabase/supabase-js server-only luxon pino dotenv
# packages/core
pnpm --filter @app/core add luxon zod
```

**Vérification des versions effectuée :** `npm view <pkg> version` exécuté le 2026-06-09 — résultats reportés dans la colonne Version ci-dessus.

## Package Legitimacy Audit

> slopcheck **non disponible** dans cet environnement (pip non probé). Tous les paquets ci-dessous sont des dépendances **déjà verrouillées dans CLAUDE.md** et identifiées par sources autoritaires (docs officielles Supabase/Next/Vercel). Existence et version confirmées via `npm view`. Aucun paquet nouveau/inconnu introduit par cette recherche.

| Package | Registry | Source autoritaire | npm view | Disposition |
|---------|----------|--------------------|----------|-------------|
| `next` | npm | nextjs.org (officiel Vercel) | 16.2.7 (latest) — verrou 15 | Approuvé (rester sur 15) |
| `@supabase/ssr` | npm | supabase.com/docs (officiel) | 0.12.0 | Approuvé |
| `@supabase/supabase-js` | npm | supabase.com/docs (officiel) | 2.108.1 | Approuvé |
| `zod` | npm | zod.dev (officiel) | 4.4.3 | Approuvé |
| `luxon` | npm | moment.github.io/luxon (officiel) | 3.7.2 | Approuvé |
| `tsx` | npm | tsx.is (officiel) | 4.22.4 | Approuvé |
| `server-only` | npm | nextjs.org docs (publié par React/Next team) | 0.0.1 | Approuvé (version 0.0.1 normale — paquet stable et minimal) |
| `pino` | npm | getpino.io (officiel) | 10.3.1 | Approuvé |
| `croner` | npm | github.com/Hexagon/croner | 10.0.1 | Approuvé (optionnel) |
| `vitest` | npm | vitest.dev (officiel) | 4.1.8 | Approuvé |
| `@playwright/test` | npm | playwright.dev (officiel Microsoft) | 1.60.0 | Approuvé |

**Packages retirés (slopcheck [SLOP]) :** aucun.
**Packages suspects ([SUS]) :** aucun. *(Note : `server-only@0.0.1` a un numéro de version trompeur mais c'est le paquet officiel maintenu par l'équipe React/Next — confirmer au moment de l'install que le publisher est bien `vercel`/`react`.)*

*slopcheck étant indisponible, le planner DEVRAIT idéalement gater le premier `pnpm install` derrière une vérification humaine rapide du publisher de `server-only`. Tous les autres sont des libs ultra-connues (>1M downloads/sem).*

## Architecture Patterns

### System Architecture Diagram

```
                          ┌─────────────────────────────────────┐
   UTILISATEUR ──login──► │  apps/web (Next.js 15 App Router)    │
        ▲                 │  ┌─────────────┐  ┌───────────────┐  │
        │ session cookie  │  │ middleware  │  │ RSC / pages   │  │
        │ (httpOnly)      │  │ updateSession│ │ createServer  │  │
        └─────────────────┤  │ → getUser() │  │ Client (anon) │  │
                          │  └──────┬──────┘  └───────┬───────┘  │
                          └─────────┼─────────────────┼──────────┘
                                    │ refresh token   │ SELECT (RLS: authenticated)
                                    ▼                 ▼
                          ┌─────────────────────────────────────────────┐
                          │            SUPABASE CLOUD (Postgres)          │
                          │  auth.users ──trigger handle_new_user──►      │
                          │  public.profiles (RLS: id = auth.uid())       │
                          │  public.instruments (RLS: read authenticated) │
                          │  public.job_runs (RLS: read auth / write SR)  │
                          └───────▲───────────────────────────────────────┘
                                  │ INSERT job_runs + (futur) upsert data
                                  │ via service_role (bypass RLS)
                  ┌───────────────┴────────────────────────────────┐
                  │     apps/jobs  (dispatcher tsx ESM)             │
                  │     runJob(name, fn) → écrit job_runs           │
                  │     import { serviceClient } from @app/supabase │
                  │       (server-only — interdit dans apps/web)    │
                  └───────▲──────────────▲──────────────▲───────────┘
                          │              │              │
              ┌───────────┴──┐   ┌───────┴──────┐  ┌────┴─────────────┐
              │ Windows Task │   │   croner     │  │ Routine Claude   │
              │ Scheduler    │   │ (in-process, │  │ Remote (cloud)   │
              │ (.cmd, PC    │   │  optionnel)  │  │ secrets via Env, │
              │  allumé)     │   │              │  │ PC éteint OK     │
              └──────────────┘   └──────────────┘  └──────────────────┘

  packages/core ── constantes temps (UTC, bougie clôturée, sessions OANDA/Binance)
                   consommé par apps/jobs (et futures phases indicateurs/moteur)
```

Trace du cas principal : l'utilisateur se connecte → le middleware pose/rafraîchit le cookie httpOnly → un RSC lit `instruments` via le client anon (RLS autorise les authentifiés) → en parallèle, n'importe quel scheduler invoque le dispatcher `tsx` qui écrit une ligne `job_runs` via `service_role`.

### Recommended Project Structure
```
/
├── pnpm-workspace.yaml          # packages: apps/*, packages/*
├── package.json                 # scripts racine (dev, test, lint, typecheck)
├── tsconfig.base.json           # strict:true, paths @app/*
├── .env.example                 # CONTRAT commité (SUPABASE_URL, ANON_KEY, SERVICE_ROLE_KEY)
├── eslint.config.mjs            # flat config + no-restricted-imports
├── apps/
│   ├── web/                     # Next.js 15 — clé anon UNIQUEMENT
│   │   ├── .env.local           # NEXT_PUBLIC_SUPABASE_URL + ANON_KEY (non commité)
│   │   ├── middleware.ts        # updateSession
│   │   ├── next.config.ts       # transpilePackages: ['@app/core','@app/supabase']
│   │   └── src/
│   │       ├── lib/supabase/{client,server,middleware}.ts
│   │       └── app/(auth)/...   # signup/login + page protégée
│   └── jobs/                    # scripts TS — service_role
│       ├── .env                 # SERVICE_ROLE_KEY (non commité)
│       ├── src/
│       │   ├── dispatch.ts      # entrypoint tsx (lit argv: job name)
│       │   └── jobs/heartbeat.ts# job pilote Phase 1 (écrit job_runs)
│       └── windows/run-job.cmd  # wrapper Task Scheduler
├── packages/
│   ├── core/                    # constantes temps (UTC, closed-candle, sessions)
│   │   └── src/time/{constants,sessions,candle}.ts
│   └── supabase/                # client typé + repositories + types générés
│       └── src/
│           ├── database.types.ts        # généré (supabase gen types)
│           ├── anon-client.ts           # factory client anon (browser/server)
│           ├── service-client.ts        # import 'server-only' EN TÊTE
│           └── repositories/{profiles,jobRuns,instruments}.ts
└── supabase/
    └── migrations/              # SQL versionné (tables + RLS + trigger)
```

### Pattern 1 : Trois clients `@supabase/ssr` distincts (NE PAS confondre)
**What :** App Router exige trois fabriques de client séparées : browser (Client Components), server (RSC/Server Actions/Route Handlers), et middleware (refresh). Les RSC ne peuvent PAS écrire de cookies → d'où le middleware.
**When to use :** Tout accès Supabase côté web.
**Pitfall majeur :** Utiliser `getSession()` côté serveur. **Toujours `getUser()`** côté serveur/middleware (revalide le token auprès du serveur Auth). [CITED: supabase.com/docs/guides/auth/server-side/nextjs]

### Pattern 2 : Middleware = seul endroit qui rafraîchit la session
**What :** `middleware.ts` appelle `updateSession()` qui (1) lit les cookies de la requête, (2) appelle `supabase.auth.getUser()` pour rafraîchir, (3) propage le token rafraîchi à la fois à `request.cookies` (pour les RSC) et `response.cookies` (pour le browser).
**When to use :** Obligatoire dès qu'on a de l'auth. Sans lui, les tokens expirés ne sont jamais rafraîchis. [CITED: supabase.com/docs/guides/auth/server-side/nextjs]

### Pattern 3 : Cookies via `getAll`/`setAll` (API actuelle, NON dépréciée)
**What :** La config cookies de `createServerClient` utilise `{ getAll, setAll }` — PAS les anciens `{ get, set, remove }` individuels (dépréciés dans les versions récentes de `@supabase/ssr`).
**When to use :** Toutes les fabriques server/middleware. [CITED: supabase.com/docs/guides/auth/server-side/creating-a-client]

### Pattern 4 : Trigger SECURITY DEFINER pour auto-créer `profiles`
**What :** Fonction `public.handle_new_user()` en `SECURITY DEFINER` avec **`SET search_path = ''`** + trigger `AFTER INSERT ON auth.users`. Insère dans `public.profiles`.
**When to use :** D-06. Atomique avec le signup.
**Pitfall :** Omettre `SET search_path = ''` = faille (le caller peut détourner le search_path). Si le trigger plante, **le signup entier échoue** → tester rigoureusement. [CITED: supabase.com/docs/guides/auth/managing-user-data]

### Pattern 5 : Isolation `service_role` à deux barrières
**What :** Barrière 1 = `import 'server-only'` en tête de `service-client.ts` (plante le build Next si jamais importé côté client). Barrière 2 = ESLint `no-restricted-imports` interdisant `@app/supabase/service-*` depuis `apps/web`.
**When to use :** D-07/AUTH-03. Les deux barrières sont complémentaires (build-time + lint-time). [CITED: eslint.org/docs/latest/rules/no-restricted-imports]

### Pattern 6 : Dispatcher de jobs agnostique
**What :** Un seul entrypoint ESM `apps/jobs/src/dispatch.ts` lit `process.argv` (nom du job), charge `.env` via dotenv si présent (local), exécute le job dans un wrapper `runJob()` qui écrit `job_runs` (started/finished/status/error/stats). Le même binaire est appelé par `.cmd` (Task Scheduler), croner, ou une Routine.
**When to use :** D-08/JOB-03/JOB-04.

### Anti-Patterns à éviter
- **`getSession()` côté serveur** : non fiable, ne revalide pas. → `getUser()`.
- **Client `service_role` dans un Client Component ou importé par `apps/web`** : fuite de clé admin. → `server-only` + ESLint.
- **Trigger sans `SET search_path = ''`** : faille SECURITY DEFINER.
- **Confondre les 3 clients SSR** : utiliser le client browser dans un RSC casse les cookies httpOnly.
- **Compter sur le MCP Supabase pour les jobs cloud** : un MCP local stdio n'existe pas dans une Routine Remote. → SDK supabase-js direct.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Refresh de session / cookies httpOnly | Gestion manuelle des JWT/cookies | `@supabase/ssr` middleware + `getAll/setAll` | Edge cases (rotation, expiry, SSR/CSR) déjà gérés ; rouler maison = failles. |
| Autorisation des lignes | Filtres `WHERE user_id=` dans l'app | Policies RLS Postgres (`auth.uid()`) | L'autorisation app-level est contournable ; RLS est appliqué par la DB. |
| Création de la ligne profil | Insert app après signup | Trigger SECURITY DEFINER | Atomique, pas d'aller-retour, pas de fenêtre de course. |
| Empêcher la fuite de `service_role` | Revue manuelle / convention orale | `server-only` + ESLint `no-restricted-imports` | Garde-fou automatique build + lint, pas humain. |
| Fuseaux / DST / bornes de bougie | Maths de dates maison | luxon (`DateTime`, `setZone`) | DST, ouvertures de session (17:00 NY) corrects ; maison = bugs subtils. |
| Types DB | Types TS écrits à la main | `supabase gen types typescript` | Source de vérité = schéma SQL ; régénération automatique. |
| Backoff / retry des appels API | `setTimeout` maison | p-retry (phases data, pas P1) | Hors P1 mais à garder en tête. |

**Key insight :** En Phase 1 quasiment tout est du *plumbing standard Supabase/Next* — la valeur est de suivre **exactement** le pattern officiel non déprécié, pas d'inventer. Le seul code « maison » légitime de cette phase = les constantes temps de `packages/core` et le wrapper `runJob`.

## Runtime State Inventory

> Projet **greenfield** — aucun runtime state préexistant à migrer. Section incluse car la phase touche au scheduling externe.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None** — aucune table existante (schéma public vide, projet neuf). À confirmer par `get_advisors`/`list_tables` au moment de l'exécution. | Créer les 3 tables. |
| Live service config | **Routine Claude à créer** (Environment cloud + variables chiffrées + network access). N'existe pas encore — c'est une création, pas une migration. | Créer l'Environment + Routine en Phase 4 (ANALYZE). En Phase 1, seulement documenter le modèle. |
| OS-registered state | **Aucune tâche Task Scheduler existante.** À créer : 1 tâche pointant sur `run-job.cmd`. | Créer la tâche (manuel ou script PowerShell documenté). |
| Secrets/env vars | `.env` (jobs, `service_role`) + `.env.local` (web, `anon`) à créer ; `.env.example` commité comme contrat. **Rien à migrer.** | Créer les fichiers + `.env.example`. |
| Build artifacts | **Aucun** — monorepo à initialiser. | `pnpm install` initial. |

**Vérifié :** projet greenfield (STATE.md : 0 phase complétée, aucun code applicatif). Recommandation : exécuter `get_advisors` après création des tables pour prouver D-05 (RLS active partout).

## Common Pitfalls

### Pitfall 1 : `getSession()` côté serveur
**What goes wrong :** La session retournée n'est pas revalidée → un attaquant peut forger un cookie.
**Why :** `getSession()` lit le cookie sans appeler le serveur Auth.
**How to avoid :** `getUser()` partout côté serveur/middleware.
**Warning signs :** Code serveur appelant `auth.getSession()`.

### Pitfall 2 : Trigger `handle_new_user` qui bloque les signups
**What goes wrong :** Si le trigger lève une erreur (colonne manquante, contrainte), l'insert `auth.users` rollback → impossible de créer un compte.
**Why :** Le trigger est dans la même transaction que le signup.
**How to avoid :** Schéma `profiles` minimal (D-06 : `id`, `email`, `created_at`), `SET search_path = ''`, test E2E signup qui prouve la création de profil.
**Warning signs :** Signup qui retourne une 500 « Database error saving new user ».

### Pitfall 3 : RLS activée mais sans policy = tout bloqué
**What goes wrong :** `ENABLE ROW LEVEL SECURITY` sans aucune policy → **deny par défaut**, plus aucune lecture ne passe (même anon/authenticated).
**Why :** RLS sans policy = refus total.
**How to avoid :** Pour chaque table : `ENABLE RLS` **ET** au moins une policy explicite. Vérifier par `get_advisors`.
**Warning signs :** Les `SELECT` retournent 0 ligne alors que la donnée existe.

### Pitfall 4 : `service_role` qui fuit dans le bundle web
**What goes wrong :** Un import accidentel de `service-client.ts` depuis `apps/web` → la clé admin (bypass RLS) part dans le JS client.
**Why :** Pas de garde-fou automatique.
**How to avoid :** `import 'server-only'` + ESLint `no-restricted-imports`. Ne JAMAIS préfixer la clé service_role de `NEXT_PUBLIC_`.
**Warning signs :** `service_role` visible dans le bundle (grep le `.next` build).

### Pitfall 5 : MCP local supposé disponible en Routine cloud
**What goes wrong :** Plan qui suppose que la Routine Claude utilise le MCP Supabase → échoue car les Routines Remote n'ont que des **connectors cloud-hosted**, pas le stdio MCP local.
**Why :** Confusion entre la session interactive (MCP local OK) et la Routine cloud.
**How to avoid :** Les jobs appellent Supabase via le **SDK supabase-js** + network access autorisé dans l'Environment. Le MCP n'est qu'un outil de dev/recherche.
**Warning signs :** Tâche de plan qui dit « la routine persiste via MCP Supabase » sans network access ni SDK.

### Pitfall 6 : Quota de runs Max partagé
**What goes wrong :** Les 15 runs/jour Max sont **partagés entre Routines et sessions interactives** → planifier 6 jobs/jour mange dans le budget de dev interactif.
**Why :** Même quota.
**How to avoid :** Documenter ce partage ; en Phase 1 aucune Routine n'est encore planifiée (analyse = Phase 4). Garder l'ingestion déterministe sur Task Scheduler (hors quota Claude). [CITED: code.claude.com/docs/en/routines]

## Code Examples

> Patterns vérifiés sur les docs officielles. Les noms de variables/chemins sont indicatifs (discrétion D-Claude).

### Client server `@supabase/ssr` (RSC / Server Actions)
```typescript
// packages/supabase/src/anon-client.ts (variante server)
// Source: supabase.com/docs/guides/auth/server-side/creating-a-client
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies() // Next 15: cookies() est async
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options))
          } catch { /* appelé depuis un RSC en lecture seule — ignoré, le middleware gère */ }
        },
      },
    },
  )
}
```

### Middleware (refresh session)
```typescript
// apps/web/middleware.ts + lib/supabase/middleware.ts
// Source: supabase.com/docs/guides/auth/server-side/nextjs
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(URL, ANON, {
    cookies: {
      getAll() { return request.cookies.getAll() },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options))
      },
    },
  })
  // IMPORTANT: getUser(), jamais getSession()
  await supabase.auth.getUser()
  return response
}
```

### Migration SQL : 3 tables + RLS + trigger
```sql
-- supabase/migrations/0001_init.sql
-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles: lire le sien"  on public.profiles for select using (id = auth.uid());
create policy "profiles: écrire le sien" on public.profiles for update using (id = auth.uid());

-- instruments (table marché seed)
create table public.instruments (
  id uuid primary key default gen_random_uuid(),
  symbol text unique not null,
  broker text not null check (broker in ('oanda','binance')),
  asset_class text not null check (asset_class in ('crypto','forex','metal','energy')),
  display_name text not null,
  pip_size numeric, min_size numeric, precision int, active boolean default true
);
alter table public.instruments enable row level security;
create policy "instruments: lecture authentifiés"
  on public.instruments for select to authenticated using (true);

-- job_runs
create table public.job_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  status text not null check (status in ('running','success','error')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error text,
  stats jsonb
);
alter table public.job_runs enable row level security;
create policy "job_runs: lecture authentifiés"
  on public.job_runs for select to authenticated using (true);
-- AUCUNE policy insert/update pour authenticated → écriture seulement via service_role (bypass RLS)

-- trigger auto-profil
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''   -- CRITIQUE
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

### ESLint `no-restricted-imports` (flat config)
```javascript
// eslint.config.mjs — appliqué à apps/web/**
// Source: eslint.org/docs/latest/rules/no-restricted-imports
{
  files: ['apps/web/**/*.{ts,tsx}'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [{
        group: ['**/supabase/**/service-*', '@app/supabase/service-client'],
        message: 'service_role interdit côté web — réservé à apps/jobs.',
      }],
    }],
  },
}
```

### Client service_role (jobs only)
```typescript
// packages/supabase/src/service-client.ts
import 'server-only' // plante le build si importé côté client
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

export const serviceClient = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)
```

### Wrapper `runJob` + dispatcher (JOB-04)
```typescript
// apps/jobs/src/runJob.ts
import { serviceClient } from '@app/supabase/service-client'

export async function runJob(jobName: string, fn: () => Promise<object | void>) {
  const { data: run } = await serviceClient
    .from('job_runs')
    .insert({ job_name: jobName, status: 'running' })
    .select('id').single()
  try {
    const stats = await fn()
    await serviceClient.from('job_runs')
      .update({ status: 'success', finished_at: new Date().toISOString(), stats: stats ?? {} })
      .eq('id', run!.id)
  } catch (e) {
    await serviceClient.from('job_runs')
      .update({ status: 'error', finished_at: new Date().toISOString(), error: String(e) })
      .eq('id', run!.id)
    throw e
  }
}

// apps/jobs/src/dispatch.ts (entrypoint tsx)
import 'dotenv/config'
import { runJob } from './runJob'
const jobs: Record<string, () => Promise<object | void>> = {
  heartbeat: async () => ({ ok: true, ts: new Date().toISOString() }),
}
const name = process.argv[2]
const job = jobs[name]
if (!job) { console.error(`Unknown job: ${name}`); process.exit(1) }
runJob(name, job).then(() => process.exit(0)).catch(() => process.exit(1))
```

### Wrapper Windows Task Scheduler
```bat
:: apps/jobs/windows/run-job.cmd
@echo off
cd /d "%~dp0\..\..\.."
call pnpm --filter jobs exec tsx src/dispatch.ts %1
```

### Constantes temps (`packages/core`)
```typescript
// packages/core/src/time/sessions.ts
// Source: moment.github.io/luxon (zones/DST)
import { DateTime } from 'luxon'

export const DAILY_ANCHOR = {
  oanda:   { zone: 'America/New_York', hour: 17 }, // 17:00 NY (convention FX)
  binance: { zone: 'UTC',              hour: 0  }, // 00:00 UTC (crypto 24/7)
} as const

/** Borne haute exclusive : on n'inclut QUE les bougies clôturées (anti look-ahead). */
export function lastClosedCandleStart(now: DateTime, tfMinutes: number): DateTime {
  const utc = now.toUTC()
  const epoch = Math.floor(utc.toSeconds() / (tfMinutes * 60))
  // bougie en cours = epoch ; dernière clôturée = epoch - 1
  return DateTime.fromSeconds((epoch - 1) * tfMinutes * 60, { zone: 'utc' })
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2024 | Seul chemin supporté App Router/RSC. INTERDIT dans ce projet. |
| Cookies `{ get, set, remove }` | Cookies `{ getAll, setAll }` | versions récentes de `@supabase/ssr` | Utiliser `getAll/setAll`, sinon warnings/bugs. |
| `getSession()` côté serveur | `getUser()` côté serveur | recommandation Supabase actuelle | Sécurité : `getUser()` revalide. |
| Cron local / serveur dédié | Routines Claude cloud (analyse) + Task Scheduler (déterministe) | Routines Claude Code lancées ~avril 2026 | Analyse IA tourne PC éteint dans le cloud Anthropic. |
| `cookies()` synchrone | `cookies()` **async** (Next 15) | Next 15 | `await cookies()` dans les fabriques server. |

**Deprecated/outdated :**
- `@supabase/auth-helpers-*` : déprécié → `@supabase/ssr`.
- `node-cron` : préférer croner (TZ + veille/réveil).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Le projet Supabase cloud est joignable depuis une Routine Claude Remote via SDK si le **network access** de l'Environment autorise le domaine `*.supabase.co`. | Summary / Pitfall 5 | Si non autorisé par défaut, la Routine échoue à écrire — mitigé par le fallback Task Scheduler local. À confirmer en configurant l'Environment (Phase 4). |
| A2 | Les 15 runs/jour Max sont partagés avec les sessions interactives. | Pitfall 6 | Sources blog cohérentes mais à confirmer sur la facturation réelle ; impact = planning des jobs. |
| A3 | `server-only@0.0.1` est bien le paquet officiel React/Next (publisher `vercel`). | Package Audit | Si slopsquat, fuite ; mitigé par vérif publisher au moment de l'install (slopcheck indisponible). |
| A4 | `dotenv` reste la lib standard pour charger `.env` en local sous tsx. | Standard Stack | Faible — version à fixer au plan ; alternative `tsx --env-file`. |
| A5 | Le schéma des 3 tables est un sous-ensemble cohérent d'ARCHITECTURE.md (instruments/job_runs identiques ; profiles minimal vs profiles communauté P2). | Code Examples | ARCHITECTURE.md liste `profiles` sous « Communauté (P2) » — confirmer que le `profiles` minimal de P1 n'entre pas en conflit avec le `profiles` étendu P2/P7. Recommandation : même table, étendue par migration plus tard. |

## Open Questions

1. **Network access par défaut d'une Routine Claude vers Supabase**
   - Ce qu'on sait : l'Environment « Default » a un network access « Trusted » (registries de paquets, API cloud providers, domaines dev courants) et bloque le reste.
   - Ce qui est flou : `*.supabase.co` est-il dans la liste « Trusted » par défaut ?
   - Recommandation : en Phase 4, créer un Environment custom avec network access explicite vers le domaine du projet Supabase. En Phase 1, ne PAS dépendre de la Routine — l'ingestion déterministe passe par Task Scheduler.

2. **`profiles` P1 minimal vs `profiles` communauté (ARCHITECTURE.md §4)**
   - Ce qu'on sait : D-06 = `id/email/created_at` ; ARCHITECTURE.md mentionne `profiles` côté communauté P2.
   - Recommandation : une seule table `public.profiles`, créée minimale en P1, étendue par migrations additives en P7 (capital/risk) et P2 (communauté). Ne pas créer deux tables.

3. **Version `@supabase/supabase-js` : 2.108.0 (lock) vs 2.108.1 (latest)**
   - Recommandation : aligner sur le lock CLAUDE.md (2.108.0) ou bumper consciemment vers 2.108.1 (patch). Décision triviale, à acter au plan.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | tsx, Next, pnpm | À vérifier (`node -v`) au plan | — | Installer LTS ≥ 20 |
| pnpm | Monorepo workspaces | À vérifier (`pnpm -v`) | — | `npm i -g pnpm@9` |
| Supabase CLI | `supabase gen types`, migrations | À vérifier (`supabase --version`) | — | MCP `generate_typescript_types` / `apply_migration` (déjà connecté) |
| Projet Supabase cloud | Auth, DB, RLS | ✓ (MCP connecté) | — | — |
| Windows Task Scheduler | JOB-03 fallback | ✓ (Windows 11) | — | croner in-process |
| Routine Claude (Max) | Analyse IA (Phase 4, pas P1) | À configurer | — | Task Scheduler (déterministe) |

**Missing dependencies with no fallback :** aucune bloquante pour P1 (le projet Supabase cloud est connecté).
**Missing dependencies with fallback :** Supabase CLI → le MCP couvre génération de types et migrations en recherche/dev.

## Validation Architecture

> `nyquist_validation: true` dans config.json → section incluse.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.8 (unit/intégration) + Playwright 1.60.0 (E2E) |
| Config file | none — créer `vitest.config.ts` racine + `playwright.config.ts` (Wave 0) |
| Quick run command | `pnpm vitest run packages/core` |
| Full suite command | `pnpm vitest run && pnpm exec playwright test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-05 | `lastClosedCandleStart` exclut la bougie en cours ; ancres daily OANDA/Binance correctes | unit (golden) | `pnpm vitest run packages/core/src/time` | ❌ Wave 0 |
| AUTH-02 | User A ne lit pas `profiles`/`job_runs` de user B | intégration RLS | `pnpm vitest run packages/supabase/__tests__/rls.test.ts` | ❌ Wave 0 |
| AUTH-01 | signup → login → session persiste après reload | e2e | `pnpm exec playwright test auth.spec.ts` | ❌ Wave 0 |
| AUTH-03 | import service_role depuis apps/web = erreur lint | lint (statique) | `pnpm eslint apps/web` (doit échouer sur import interdit dans un test fixture) | ❌ Wave 0 |
| JOB-04 | `runJob` écrit une ligne job_runs (success + error) | intégration | `pnpm vitest run apps/jobs/__tests__/runJob.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit :** `pnpm vitest run <package touché>`
- **Per wave merge :** `pnpm vitest run && pnpm typecheck && pnpm lint`
- **Phase gate :** suite complète + 1 E2E Playwright verts avant `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `vitest.config.ts` racine + `playwright.config.ts`
- [ ] `packages/core/src/time/*.test.ts` — golden DATA-05
- [ ] `packages/supabase/__tests__/rls.test.ts` — intégration AUTH-02 (2 users)
- [ ] `apps/jobs/__tests__/runJob.test.ts` — JOB-04
- [ ] `apps/web/e2e/auth.spec.ts` — AUTH-01
- [ ] Fixture lint AUTH-03 (un fichier qui tente l'import interdit, attendu = erreur ESLint)
- [ ] Install : `pnpm add -D -w vitest @playwright/test && pnpm exec playwright install`

## Security Domain

> `security_enforcement` non `false` → section incluse.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth (email+password) ; pas de gestion maison des mots de passe. |
| V3 Session Management | yes | `@supabase/ssr` cookies httpOnly + refresh middleware ; `getUser()` côté serveur. |
| V4 Access Control | yes | RLS Postgres (`auth.uid()`) ; `service_role` isolé (server-only + ESLint). |
| V5 Input Validation | yes | Zod sur les variables d'env + (futur) entrées ; contraintes `CHECK` SQL. |
| V6 Cryptography | no | Supabase gère le hachage des mots de passe et la signature JWT — ne rien rouler maison. |
| V7 Error Handling/Logging | yes | pino → `job_runs` ; messages d'erreur sans fuite de secret. |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Fuite de `service_role` dans le bundle web | Information Disclosure | `server-only` + ESLint `no-restricted-imports` ; jamais `NEXT_PUBLIC_` sur la clé. |
| RLS désactivée / table sans policy | Elevation of Privilege | `ENABLE RLS` + policy explicite par table ; `get_advisors` en gate. |
| Forgerie de session via `getSession()` | Spoofing | `getUser()` côté serveur (revalidation). |
| Trigger SECURITY DEFINER détourné (search_path) | Elevation of Privilege | `SET search_path = ''` obligatoire. |
| Secrets commités | Information Disclosure | `.env` gitignore + `.env.example` contrat ; vérif au commit. |
| Signup cassé par trigger | Denial of Service | Schéma profil minimal + test E2E signup. |

## Sources

### Primary (HIGH confidence)
- supabase.com/docs/guides/auth/server-side/nextjs — pattern middleware, getUser vs getSession.
- supabase.com/docs/guides/auth/server-side/creating-a-client — createServerClient/createBrowserClient, getAll/setAll.
- supabase.com/docs/guides/auth/managing-user-data — trigger handle_new_user.
- supabase.com/docs/guides/database/postgres/row-level-security — RLS enable + policies.
- code.claude.com/docs/en/routines — modèle d'exécution Routines (cloud, environments, network access, connectors).
- eslint.org/docs/latest/rules/no-restricted-imports — config patterns.
- nextjs.org/docs/.../config/transpilePackages — packages internes monorepo.
- npm registry (vérifié 2026-06-09) — versions @supabase/ssr 0.12.0, supabase-js 2.108.1, zod 4.4.3, luxon 3.7.2, tsx 4.22.4, server-only 0.0.1, pino 10.3.1, croner 10.0.1, next 16.2.7, vitest 4.1.8, @playwright/test 1.60.0.

### Secondary (MEDIUM confidence)
- WebSearch « Claude Code Routines Max quota » → 15 runs/jour Max, quota partagé interactif (multiples sources blog cohérentes, recoupé avec doc officielle).
- WebSearch « Claude Code Routines secrets/MCP » → connectors cloud-hosted, env vars chiffrées, setup script (recoupé doc officielle).

### Tertiary (LOW confidence)
- Détails exacts du network access par défaut vers `*.supabase.co` dans une Routine (Open Question 1).

## Metadata

**Confidence breakdown :**
- Standard stack : HIGH — versions verrouillées + vérifiées npm le jour même.
- Architecture Supabase/Next (auth, RLS, trigger, monorepo) : HIGH — docs officielles.
- Isolation service_role : HIGH — pattern standard double barrière.
- Conventions temps : HIGH — luxon, logique déterministe testable.
- Modèle Routines Claude : MEDIUM — doc officielle confirme l'essentiel ; network access Supabase à confirmer (mitigé par fallback Task Scheduler, hors quota Claude).

**Research date :** 2026-06-09
**Valid until :** ~2026-07-09 (stable) ; Routines Claude = surveiller (fonctionnalité récente, ~7 jours pour la partie quota/connectors).
