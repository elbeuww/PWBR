# Walking Skeleton — Plateforme d'Analyse de Trading "Vétéran"

**Phase:** 1
**Generated:** 2026-06-09

## Capability Proven End-to-End

Un utilisateur crée un compte, se connecte (Supabase Auth, session cookies httpOnly persistée), voit dans l'UI une ligne de la table protégée `instruments` (lecture RLS authentifiée) ; en parallèle, un job déterministe `tsx` exécutable hors agent Claude écrit une entrée `job_runs` via `service_role` — la clé `service_role` n'apparaît jamais dans le bundle frontend.

C'est le "socle qui tient debout" : il prouve la chaîne `signup → login → session persistée → lecture table RLS → job écrit job_runs` de bout en bout, contre le projet Supabase cloud existant.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Monorepo | pnpm workspaces (`apps/*`, `packages/*`) | Verrouillé CLAUDE.md/D-11. Partage `core`/`supabase` entre web et jobs sans publish. |
| Framework web | Next.js 15 App Router + RSC + TS strict | Verrouillé. RESTER sur 15 (PAS 16) — `@supabase/ssr` stabilisé sur 15. |
| Auth | Supabase Auth email+password via `@supabase/ssr 0.12.0` (cookies httpOnly, `getAll`/`setAll`, `getUser()` serveur) | D-01/D-03. `auth-helpers` INTERDIT (déprécié). Confirmation email désactivée (D-02). |
| Data layer | Supabase Postgres cloud + client typé (`supabase gen types`) + repositories maison | Verrouillé. PAS d'ORM (Drizzle/Prisma) — migrations SQL = source de vérité unique. |
| Autorisation | RLS Postgres (`auth.uid()`) sur toutes les tables | D-05/AUTH-02. Autorisation dans la DB, pas dans l'app. |
| Auto-profil | Trigger Postgres `handle_new_user` SECURITY DEFINER `SET search_path = ''` | D-06. Atomique avec le signup. |
| Isolation service_role | `import 'server-only'` + ESLint `no-restricted-imports` (double barrière) | D-07/AUTH-03. Clé admin jamais dans le bundle web. |
| Runner de jobs | Entrypoint `tsx` ESM unique (dispatcher), agnostique du scheduler | D-08/JOB-03. Appelable par Task Scheduler, croner, ou Routine Claude. Jobs appellent Supabase via SDK supabase-js (PAS MCP). |
| Monitoring jobs | Wrapper `runJob()` écrit `job_runs` (statut/timing/erreur) via service_role | JOB-04. |
| Constantes temps | `packages/core` (UTC, bougie clôturée, daily natif par source) + luxon | D-09/D-10/DATA-05. Source unique consommée par jobs et phases futures. |
| Secrets | `.env` local non commité + `.env.example` commité (contrat) | D-12. `.env` jobs = service_role ; `.env.local` web = anon. Pas de secret manager externe. |
| Tests | Vitest 4.1.8 (unit/intégration) + Playwright 1.60.0 (E2E) | D-13. Ciblé socle critique, pas 80% sur le scaffolding. |
| Déploiement Phase 1 | dev local (`next dev`) contre Supabase cloud existant | CONTEXT §specifics. Vercel/CI reportés (Deferred). |

## Stack Touched in Phase 1

- [ ] Project scaffold — pnpm workspace, `apps/web` (Next 15), `apps/jobs` (tsx), `packages/core`, `packages/supabase`, ESLint flat config, Vitest + Playwright
- [ ] Routing — `apps/web` route protégée affichant une ligne `instruments` + routes signup/login
- [ ] Database — read (`instruments` via anon RLS) ET write (`job_runs` via service_role) réels
- [ ] UI — formulaires signup/login interactifs câblés à Supabase Auth + page protégée
- [ ] Deployment — `pnpm --filter web dev` contre Supabase cloud (commande full-stack documentée) ; job lancé via `pnpm --filter jobs exec tsx src/dispatch.ts heartbeat`

## Out of Scope (Deferred to Later Slices)

- Confirmation email + magic link / OAuth Google — v2 (D-02, Deferred)
- Secret manager externe (Doppler/1Password) — Deferred
- Déploiement Vercel + CI GitHub Actions — Deferred
- Champs profil étendus (`capital`, `risk_percent`, `account_type`) — Phase 7 (RISK-03)
- Reste du schéma Supabase (`candles`, `news`, `macro_series`, `analyses`, `trade_setups`, `journal`, `prediction_outcomes`, `backtests`, `community_*`) — Phases 2/3/4/8
- Configuration réelle d'une Routine Claude (Environment cloud + network access) — Phase 4 (P1 = documentation seulement)
- Ingestion réelle de données, indicateurs, scoring IA, dashboard, sizing — Phases 2-8
- Cible de couverture 80% sur tout le code — phases métier

## Subsequent Slice Plan

Chaque phase ultérieure ajoute une tranche verticale au-dessus de ce socle sans modifier ses décisions architecturales :

- **Phase 2:** Ingestion fiable (clients OANDA/Binance/Finnhub/FRED, jobs idempotents OHLCV/news/macro) — réutilise le dispatcher + `runJob` + `service_role` + constantes temps.
- **Phase 3:** Moteur d'analyse déterministe (indicateurs + structure de marché maison) — consomme `candles` et les constantes `packages/core`.
- **Phase 4:** Moteur IA "vétéran" — Routine Claude Remote (configure l'Environment + network access vers Supabase) ; reste sur le même dispatcher pour les étapes déterministes.
- **Phase 5+:** Dashboard, détail trade, risque, journal, backtest — câblés sur le client typé `packages/supabase` et l'auth posée ici.
