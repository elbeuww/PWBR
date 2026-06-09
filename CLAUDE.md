<!-- GSD:project-start source:PROJECT.md -->
## Project

**Plateforme d'Analyse de Trading "Vétéran"**

Plateforme d'analyse de trading qui combine analyse chartique (technique) et analyse fondamentale + news pour identifier des opportunités, noter chaque trade sur 100, évaluer son risque, et proposer entrée / stop-loss / take-profits / ratio R:R avec un raisonnement explicite. L'IA se comporte comme un trader vétéran (50 ans d'expérience). D'abord outil personnel (capital réel 500 $, démarrage sur compte démo), puis partagé avec une communauté. Utilisateur de niveau intermédiaire.

**Core Value:** Produire, pour chaque opportunité, une analyse fiable et explicable — score /100 + niveau de risque + plan de trade (entrée/SL/TP/R:R) — qui aide à décider avec discipline. Si tout le reste échoue, **la qualité et la traçabilité de l'analyse d'un trade** doit fonctionner.

### Constraints

- **Tech stack**: Next.js 15 + Supabase (Postgres/Auth/Realtime/RLS) — réutilise les compétences existantes du fondateur.
- **Budget**: Phase 1 à coût quasi nul — sources de données gratuites (testnet/démo), pas de clé API Anthropic (forfait Max + routines).
- **Données**: OANDA (forex/métaux/énergie), Binance (crypto), Finnhub/Marketaux (news), FRED (macro). Tiers gratuits → gérer les rate limits.
- **Sécurité**: démo/testnet d'abord (pas de fonds réels), clés en `.env` non commitées, service_role réservé aux jobs, RLS stricte (journal privé).
- **Légal**: contenu éducatif, disclaimers explicites, aucune promesse de gain (responsabilité communauté).
- **Robustesse routines**: PC potentiellement éteint → jobs idempotents + monitoring `job_runs` + Windows Task Scheduler en backup.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Core Technologies
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Next.js** | `15.x` (latest stable de la branche 15 ; npm `latest` pointe sur 16.2.x — **rester sur 15 comme verrouillé**) | Front App Router + RSC, lecture Supabase + realtime | Verrouillé. Compétences du fondateur. App Router/RSC = rendu serveur des dashboards lourds en data. **NE PAS** sauter sur Next 16 maintenant : `@supabase/ssr` et l'écosystème sont stabilisés sur 15. |
| **TypeScript** | `5.7+` (strict) | Typage bout en bout (Zod ↔ DB ↔ JSON IA) | Indispensable pour le contrat JSON §3 et les types Supabase générés. `strict: true` non négociable vu le déterminisme exigé. |
| **Supabase JS** | `@supabase/supabase-js 2.108.0` | Client DB/Auth/Realtime, service_role côté jobs | Verrouillé. v2 stable, realtime fiable. Publié 2026-06-08 (très actif). |
| **Supabase SSR** | `@supabase/ssr 0.12.0` | Auth cookies côté Next.js App Router | Remplace l'ancien `@supabase/auth-helpers` (déprécié). Seul chemin supporté pour RSC + middleware. |
| **lightweight-charts** | `5.2.0` (publié 2026-04-24) | Charting financier (candles, niveaux SL/TP, S/R) | Verrouillé. TradingView OSS, ~45 kB, canvas perf, conçu pour OHLCV. v5 = API series unifiée (`addSeries(CandlestickSeries, …)`). Suffisant pour Day/Swing (pas de streaming M1 en P1). |
| **technicalindicators** | `3.1.0` | Calcul déterministe RSI/MACD/EMA/ATR/Bollinger | Verrouillé. **AVERTISSEMENT : dernière publication 2023-07** — non maintenu activement. OK car le périmètre (indicateurs classiques) est stable et figé ; les maths ne bougent pas. Mitigation : wrapper dans `/packages/indicators` + tests de golden values pour verrouiller le comportement. Voir « What NOT to Use » pour la structure de marché (HH/HL, BOS/CHoCH) qui n'y est PAS et doit être codée maison. |
| **Supabase** (plateforme) | Postgres 15+/Auth/Realtime/RLS | Persistance, auth, realtime push des nouvelles analyses | Verrouillé. MCP déjà connecté. RLS = sécurité journal privé. Realtime = dashboard live sans polling. |
| **Zod** | `4.4.3` (npm `latest`) | Validation du JSON IA §3, frontières d'ingestion, env | Verrouillé. **Décision : Zod v4** (perf x2, `z.iso.datetime`, meilleurs messages). v3 (`3.25.x`) reste sous le dist-tag `legacy` si une lib tierce le force, mais aucun blocage ici → partir directement sur v4. C'est le garde-fou central contre la dérive du JSON IA. |
| **pnpm** | `9.x` workspaces | Monorepo (`apps/`, `packages/`) | Verrouillé. Workspaces = partage `core`/`supabase`/`indicators` entre web et jobs sans publish. |
### Supporting Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **binance** (tiagosiebler) | `3.5.9` (publié 2026-06-01) | Client Binance REST + WebSocket, TS natif | **Décision : utiliser `binance` plutôt que `@binance/connector`.** TS natif, maintenu mensuellement, testnet supporté (`useTestnet: true`), promesses modernes. `@binance/connector` (3.6.1) est plus bas niveau et moins typé. Pour P1 = REST OHLCV seulement (klines). |
| **ccxt** | `4.5.56` (publié 2026-05-27) | Abstraction multi-exchange unifiée | **NE PAS en Phase 1.** Surdimensionné (centaines d'exchanges, gros bundle). Le garder en tête pour Phase 2 si ajout d'exchanges. P1 = un seul exchange (Binance) → SDK dédié plus léger et mieux typé. |
| **OANDA v20** | **client REST maison** (fetch + Zod), PAS `@oanda/v20` | Pull OHLCV FX/métaux/énergie (instruments candles endpoint) | **Décision : écrire un client mince dans `/packages/data-sources/oanda`.** `@oanda/v20` (3.0.25-0) est un binding généré, sans types TS modernes, à l'API peu ergonomique. L'API v20 REST est simple (Bearer token + endpoints REST documentés) : `GET /v3/instruments/{instrument}/candles?granularity=H1&count=…`. Un client `fetch` + parsing Zod est plus sûr, plus léger, et aligné sur le déterminisme exigé. |
| **finnhub** | `2.0.14` (publié 2026-04-21) | News + sentiment (actualités marché) | Verrouillé. SDK officiel maintenu. Tier gratuit → gérer rate limit (60 req/min). |
| **Marketaux** | **client REST maison** (fetch + Zod) | News + sentiment complémentaire | Pas de SDK officiel npm fiable. API REST simple (`/v1/news/all?api_token=…`). Client `fetch` maison dans `data-sources/marketaux`. Sert de seconde source / fallback de Finnhub. |
| **FRED** | **client REST maison** (fetch + Zod) | Séries macro (taux, CPI, DXY, real yields) | Les wrappers npm (`fred-api` 2.0.1) sont anciens/non maintenus. API FRED REST triviale (`/fred/series/observations?series_id=…&api_key=…`, JSON). Client `fetch` maison. |
| **p-retry** | `8.0.0` | Backoff exponentiel sur appels API (rate limits, 429/5xx) | Verrouillé. Sur chaque appel data-source. ESM only — OK (jobs en ESM/tsx). |
| **p-limit** | `7.3.0` | Borne la concurrence des pulls (éviter de saturer les tiers gratuits) | Verrouillé. Ex : `pLimit(2)` pour les requêtes OANDA concurrentes. ESM only. |
| **luxon** | `3.7.2` | Normalisation UTC, sessions marché (Tokyo/Londres/NY), DST | **Décision : luxon plutôt que date-fns** pour le coeur jobs. Gestion des fuseaux/DST de première classe (`DateTime.fromISO(…, {zone})`) — critique pour les ouvertures de session et les bornes de candles. date-fns gère mal les TZ sans `date-fns-tz` add-on. |
| **date-fns** | `4.4.0` | Formatage léger côté UI (front) | Optionnel, côté `apps/web` uniquement si besoin de format simple. Ne pas dupliquer la logique TZ — la logique session vit dans les jobs avec luxon. |
| **@tanstack/react-query** | `5.101.0` | Cache/fetch côté front, invalidation, états loading | Verrouillé. Au-dessus du client Supabase pour les listes d'opportunités (tri/filtre) ; complémentaire au realtime. |
| **pino** | `10.3.1` | Logs structurés des jobs → écrits dans `job_runs` | Verrouillé. JSON logs, perf. Pipe les stats de run vers Supabase pour monitoring (PC potentiellement éteint). |
| **tsx** | `4.22.4` | Exécution directe des scripts TS des jobs (sans build) | Verrouillé. `tsx apps/jobs/ingest.ts` — démarrage rapide pour des jobs cron, pas de bundle. |
| **recharts** | `3.6.1` | Equity curve, calibration par bucket de score (page métriques) | Verrouillé. lightweight-charts pour les prix ; recharts pour les graphes analytiques (barres/lignes). |
| **Tailwind CSS** | `4.3.0` | Styling | Verrouillé. Tailwind v4 (nouveau moteur, config CSS-first). Vérifier compat shadcn/ui v4. |
| **shadcn/ui** | (composants copiés, pas versionné npm) | Primitives UI (tables, filtres, dialogs) | Verrouillé. S'assurer d'utiliser la branche compatible Tailwind v4 + React 19 (Next 15). |
### Client Supabase typé (point ouvert tranché)
| Choix | Détail |
|-------|--------|
| **Types générés par Supabase CLI** | `supabase gen types typescript --linked > packages/supabase/database.types.ts`, puis `createClient<Database>()`. **Décision : PAS d'ORM (pas de Drizzle/Prisma).** Supabase fournit déjà un client typé via types générés + RLS au niveau DB. Ajouter Drizzle dédoublerait la source de vérité du schéma (migrations SQL versionnées = source unique). Repositories typés maison dans `/packages/supabase` au-dessus du client. |
| Migrations | SQL versionné via **Supabase CLI** (`supabase migration new …`), source de vérité unique. |
### Development Tools
| Tool | Purpose | Notes |
|------|---------|-------|
| **Vitest** | `4.1.8` | Tests unitaires (indicateurs golden values, scoring, Zod, garde-fous). Cible 80 %. Plus rapide que Jest, ESM natif, partage la config Vite. |
| **Playwright** | `@playwright/test 1.60.0` | E2E (auth, dashboard, détail trade, RLS journal privé). Tests RLS = vérifier qu'un user ne voit pas le journal d'un autre. |
| **ESLint + Prettier** | latest | TS strict, ordre d'imports. |
| **Croner** | `node` lib `croner 10.0.1` | **Scheduling sous Windows (point ouvert tranché) — voir section dédiée.** |
| **GitHub Actions** | CI | Lint + typecheck + Vitest sur PR. |
## Scheduling de jobs sous Windows (point ouvert — tranché)
| Couche | Outil | Rôle |
|--------|-------|------|
| **Primaire (intelligence)** | Claude Code scheduled agents (forfait Max) | Lance la routine complète (ingest → snapshot → ANALYZE par Claude → persist). C'est le seul chemin qui produit le raisonnement IA. |
| **Backup ingestion (déterministe)** | **Windows Task Scheduler** appelant un `.cmd` → `pnpm tsx apps/jobs/ingest.ts <session>` | Garantit que candles/news/macro restent à jour même si l'agent ne tourne pas. N'inclut PAS l'analyse IA (qui exige l'agent). |
| **Scheduling in-process (optionnel)** | **croner `10.0.1`** | **Décision : croner, PAS node-cron.** Si un process Node long-running est souhaité (ex. un daemon local qui orchestre les pulls), croner est TS natif, supporte les fuseaux horaires (crucial pour les crons UTC vs sessions), zéro dépendance, et gère mieux les machines qui se réveillent/dorment que `node-cron` (3.0.x, moins de support TZ). |
## Gestion des rate limits (point clé)
- **Finnhub** : 60 req/min (free) → `pLimit(1)` + délai inter-requêtes, `p-retry` avec respect du header `Retry-After`.
- **OANDA** : ~120 req/s (généreux) mais `pLimit(2)` suffit pour des pulls multi-TF séquencés.
- **Binance** : poids par requête (1200 weight/min) → klines = poids faible, `pLimit(3)`.
- **FRED** : 120 req/min → `pLimit(2)`.
- Cache : ne pas re-puller des candles déjà en base (upsert idempotent sur `(instrument_id, timeframe, ts)` rend les re-runs sûrs et bornés).
## Installation
# Front (apps/web)
# Jobs / moteur (apps/jobs, packages/*)
# OANDA / Marketaux / FRED = clients fetch maison (pas de paquet npm) dans packages/data-sources
# Dev (racine workspace)
## Alternatives Considered
| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `binance` (tiagosiebler) | `@binance/connector` officiel / `ccxt` | ccxt si Phase 2 ajoute plusieurs exchanges. `@binance/connector` si on veut le SDK « officiel » strict — mais moins bien typé. |
| Client OANDA fetch maison | `@oanda/v20` officiel | Jamais recommandé ici (binding non typé, ergonomie faible). À la rigueur si on veut le streaming pricing officiel en P2. |
| Types Supabase générés + repositories | Drizzle ORM `0.45.2` / Prisma | Drizzle si on voulait des requêtes SQL typées complexes hors de Supabase. Inutile ici (RLS + migrations SQL = source de vérité ; éviter double schéma). |
| luxon | `date-fns` + `date-fns-tz` | date-fns seul OK côté UI pour du formatage trivial sans TZ. luxon obligatoire pour la logique sessions/DST des jobs. |
| croner | `node-cron`, Windows Task Scheduler seul | Task Scheduler suffit si AUCUN daemon Node long-running. croner si un orchestrateur in-process est souhaité. |
| Zod v4 | Zod v3 (`legacy`) | v3 uniquement si une dépendance tierce impose son peer range. Aucune contrainte ici → v4. |
| lightweight-charts | Recharts/visx pour les prix | Jamais pour les candles (perf canvas indispensable). Recharts réservé aux graphes analytiques. |
## What NOT to Use
| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@supabase/auth-helpers-nextjs` | Déprécié, ne supporte pas proprement App Router/RSC | `@supabase/ssr 0.12.0` |
| `technicalindicators` pour la **structure de marché** (HH/HL, BOS/CHoCH, swings, POC volume) | La lib ne fournit que des indicateurs classiques — PAS de détection de structure. Tenter de l'y forcer = hallucination de logique | Coder la détection de structure maison dans `/packages/indicators/structure` (déterministe, testée golden values). C'est le coeur du « vétéran ». |
| `ccxt` en Phase 1 | Bundle lourd, surface API énorme pour un seul exchange | SDK `binance` dédié |
| `@oanda/v20` | Binding généré non typé, peu maintenu, ergonomie pauvre | Client `fetch` + Zod maison |
| ORM (Drizzle/Prisma) | Dédouble la source de vérité du schéma vs migrations SQL Supabase ; complexité RLS | Client Supabase typé (`gen types`) + repositories |
| `node-cron` | Support TZ et robustesse veille/réveil inférieurs | `croner` (in-process) ou Windows Task Scheduler |
| Clé API Anthropic en Phase 1 | Hors scope (coût). L'intelligence vient de l'agent Claude Code (Max) | Routines Claude Code scheduled, backend lit seulement Supabase |
| WebSockets / streaming M1 | Hors scope P1 (scalping en P2), infra temps réel lourde | Pulls REST OHLCV H1/H4/D + Supabase Realtime pour push des analyses |
| Next.js 16 (npm `latest`) | Écosystème Supabase/ssr stabilisé sur 15 ; verrouillé sur 15 | Next.js 15.x |
## Stack Patterns by Variant
- Windows Task Scheduler maintient l'ingestion déterministe (candles/news/macro) à jour.
- Pas de nouvelles `analyses`/`trade_setups` tant que l'agent ne reprend pas — c'est attendu (l'IA exige l'agent).
- `job_runs` + flag `stale` rendent l'état visible au dashboard.
- Ajouter la clé API Anthropic pour analyses live à la demande (backend appelle l'API).
- Passer à `ccxt` si multi-exchange ; WebSockets pour M1 streaming.
- Upstash Redis pour cache/rate-limit distribué, Stripe pour monétisation.
- Isoler dans son package, ou utiliser le tag `legacy` localement. Le coeur reste v4.
## Version Compatibility
| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Next.js 15 | React 19 | Next 15 embarque React 19 ; vérifier que shadcn/ui utilisé est React 19-ready. |
| `@supabase/ssr 0.12.0` | `@supabase/supabase-js 2.108.0` | Paire supportée pour App Router. Ne pas mélanger avec auth-helpers. |
| Tailwind 4.3 | shadcn/ui (branche v4) | Tailwind v4 = config CSS-first ; utiliser les composants shadcn compatibles v4 sinon styles cassés. |
| lightweight-charts 5.x | — | API v5 ≠ v4 (`addSeries(SeriesType, …)`). Suivre la doc v5, pas les tutos v4. |
| `p-retry 8` / `p-limit 7` | jobs en ESM (tsx) | **ESM only** — ne pas tenter `require()` en CommonJS. Les jobs doivent être ESM (`"type":"module"` ou tsx). |
| Zod 4 | technicalindicators / SDKs | Aucune dépendance Zod chez les SDKs data → pas de conflit de peer. |
| `binance 3.5.9` | testnet | `useTestnet: true` + clés testnet ; aligné sur la contrainte « démo/testnet d'abord ». |
## Sources
- npm registry (vérifié 2026-06-09) — versions `latest` et dates de publication de tous les paquets listés (next, @supabase/supabase-js 2.108.0 publié 2026-06-08, @supabase/ssr 0.12.0, lightweight-charts 5.2.0 publié 2026-04-24, technicalindicators 3.1.0 **modifié 2023-07-12 → stale**, zod 4.4.3 + tag legacy 3.25.x, binance 3.5.9 publié 2026-06-01, ccxt 4.5.56, finnhub 2.0.14, @oanda/v20 3.0.25-0, p-retry 8.0.0, p-limit 7.3.0, luxon 3.7.2, croner 10.0.1, vitest 4.1.8, @playwright/test 1.60.0) — **HIGH**
- WebSearch Binance SDK Node 2025 — `binance` (tiagosiebler) = SDK communautaire TS le mieux maintenu ; `@binance/connector` = officiel bas niveau — **MEDIUM** (vérifié recoupé avec dates npm)
- WebSearch OANDA v20 Node — `@oanda/v20` officiel = binding généré sans TS moderne → client maison recommandé — **MEDIUM**
- ARCHITECTURE.md §9 (stack verrouillée) + PROJECT.md (contraintes) — **HIGH** (source projet)
- Docs officielles : developer.oanda.com (REST v20 endpoints candles), Supabase ssr/gen-types, lightweight-charts v5 — **HIGH** (vérifié pour le pattern, pas chaque endpoint)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
