# Phase 2: Ingestion fiable des données - Context

**Gathered:** 2026-06-12
**Status:** Ready for planning
**Mode:** mvp

<domain>
## Phase Boundary

Mettre en place les clients data-sources et les jobs d'ingestion idempotents pour que le système dispose de données fraîches, normalisées et sans doublons pour tous les instruments MVP :

- **OHLCV multi-timeframes** (H1, H4, Daily) pour la crypto (Binance testnet) et le forex + or + argent + pétrole (OANDA démo), normalisés en UTC avec convention de bougie clôturée (DATA-01, DATA-02, DATA-05 — constantes déjà en place dans `packages/core`).
- **News + sentiment** par instrument depuis Finnhub/Marketaux (DATA-03) + **calendrier économique** (events à venir, nécessaire au `news_risk` de Phase 3).
- **Séries macro** (taux, CPI, DXY) depuis FRED (DATA-04).
- **Idempotence** : un re-run ne crée jamais de doublon — upsert sur clés uniques (DATA-06).
- **Tolérance aux pannes** : une source en échec n'interrompt pas les autres ; la donnée périmée est marquée `stale` ; rate limits gérés par backoff/p-limit (DATA-07).

Les jobs se branchent sur le runner agnostique de Phase 1 (`runJob` → `job_runs`, dispatcher tsx, `run-job.cmd` Task Scheduler).

**Hors périmètre Phase 2** : calcul d'indicateurs (Phase 3), analyse IA (Phase 4), dashboard (Phase 5+), actions/equities (v1.1 STOCK-01..02), streaming temps réel M1/M5 (v1.1 RT-01..02).

</domain>

<decisions>
## Implementation Decisions

### Univers d'instruments MVP (12 instruments)
- **D-14:** Crypto (Binance) = **5 majors en paires USDT** : BTCUSDT, ETHUSDT, SOLUSDT, BNBUSDT, XRPUSDT.
- **D-15:** Forex (OANDA) = **4 majors USD** : EUR/USD, GBP/USD, USD/JPY, AUD/USD.
- **D-16:** Commodities (OANDA) = **XAU/USD, XAG/USD, WTI** (pas de Brent — trop corrélé, ajout possible plus tard via la table).
- **D-17:** L'univers vit dans la table `instruments` avec un **flag `is_active`** — ajouter/désactiver un instrument = un UPDATE SQL, aucun changement de code. Les jobs ingèrent ce qui est actif.
- **D-18:** Identifiant canonique = **format lisible unifié** (`BTC/USD`, `EUR/USD`, `XAU/USD`, `WTI/USD`) utilisé partout (DB, dashboard, analyses, futurs signaux Telegram). Le symbole technique par source (`BTCUSDT`, `EUR_USD`, `WTICO_USD`) est une colonne de mapping.
- **D-19:** Métadonnées par instrument dès P2 = **essentiel trading** : catégorie (crypto/forex/commodity), symbole par source, décimales de prix, horaires de cotation (nécessaires à la politique stale — forex fermé le week-end ≠ stale).
- **D-20:** Instrument indisponible chez la source au run (symbole retiré, testnet incomplet) = **skip + erreur tracée dans `job_runs.stats` + les autres continuent** (cohérent DATA-07). Pas de désactivation automatique.

### Profondeur d'historique (backfill)
- **D-21:** Backfill initial OHLCV = **2 ans de Daily + ~6 mois de H4/H1** par instrument (~730 D, ~1100 H4, ~4400 H1) — suffisant pour EMA200, détection de structure (Phase 3) et le futur backtest des patterns (v1.1 PATT-01..02).
- **D-22:** **Un seul job auto-rattrapant (gap fill)** : le job regarde la dernière bougie en base et tire ce qui manque. Premier run = backfill complet, runs suivants = incrémental. Pas de script backfill séparé. Robuste au PC éteint plusieurs jours.
- **D-23:** News = **au fil de l'eau** (pas d'historique — les free tiers le limitent et la valeur analytique est dans le frais). Macro FRED = **2 ans d'historique** (taux, CPI, DXY) pour donner le contexte de tendance au vétéran.
- **D-24:** **Pas de purge en Phase 2** — volumes estimés très en-dessous des 500 Mo du free tier Supabase ; tout est conservé pour le futur backtest. Politique de rétention à revoir si le volume devient un problème.

### Cadence d'ingestion & politique stale
- **D-25:** Jobs OHLCV + news = **cadence horaire** via Windows Task Scheduler (un seul déclencheur). Macro FRED = **1×/jour**. Le gap fill (D-22) rattrape les périodes PC éteint.
- **D-26:** Seuil stale = **2× le timeframe attendu** : H1 stale après 2 h sans bougie fraîche, H4 après 8 h, Daily après 48 h, news après 2 h, macro après 48 h — en tenant compte des horaires de cotation (D-19) : marché fermé ≠ stale.
- **D-27:** Effet du flag stale = **visible ET bloquant** : la staleness est exposée (vue/colonne calculée consultable par le dashboard) et le futur moteur d'analyse (Phase 4) refusera de produire un setup sur donnée stale — une analyse sur donnée périmée est pire que pas d'analyse. En P2 on livre l'exposition de la staleness ; le blocage effectif est implémenté en Phase 4.

### Périmètre & mapping des news
- **D-28:** Mapping news → instruments = **par requête ciblée** : interroger les providers PAR instrument/catégorie (Finnhub `category=crypto/forex`, Marketaux `symbols`/keywords par instrument). La news arrive déjà mappée — pas d'heuristique de matching mots-clés maison.
- **D-29:** **Finnhub primaire, Marketaux fallback** : Marketaux n'est tiré que si Finnhub échoue ou est rate-limité. Économe en quota, déduplication simple.
- **D-30:** Sentiment = **celui du provider, stocké tel quel** (avec la source) — déterministe, zéro coût. Le vétéran le pondérera dans son raisonnement en Phase 4.
- **D-31:** **Calendrier économique ingéré dès P2** (FOMC, CPI, NFP, décisions de taux…) — la Phase 3 consommera une table déjà remplie pour le flag `news_risk`. **Source gratuite à valider en recherche** (Finnhub free le limite — évaluer les alternatives gratuites).

### Claude's Discretion
- Schéma SQL exact des tables (candles, news, macro, calendrier éco, colonnes/index/clés uniques d'upsert) dans le respect d'ARCHITECTURE.md.
- Structure interne de `packages/data-sources` (un module par source, clients fetch+Zod maison pour OANDA/Marketaux/FRED, SDK pour Binance/Finnhub — stack verrouillée CLAUDE.md).
- Valeurs précises de `p-limit`/`p-retry` par source (points de départ documentés dans CLAUDE.md §rate limits).
- Représentation des horaires de cotation par instrument (luxon, sessions) et calcul exact du seuil stale hors heures de marché.
- Découpage des jobs (un job par source vs par classe d'actif) et noms des jobs dans le dispatcher.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture & schéma
- `ARCHITECTURE.md` (racine) — source de vérité du schéma Supabase (tables candles/news/macro), flux de données, conventions. Les tables de P2 doivent en être un sous-ensemble cohérent.
- `.planning/phases/01-fondations-s-curit/01-CONTEXT.md` — décisions D-01..D-13 (runner agnostique D-08, conventions temps D-09/D-10, secrets D-12).

### Stack & contraintes
- `CLAUDE.md` (racine) — stack verrouillée : SDK `binance` (tiagosiebler, `useTestnet: true`), clients fetch+Zod maison pour OANDA/Marketaux/FRED, SDK `finnhub`, `p-retry`/`p-limit` (ESM only), luxon, Zod v4. §Gestion des rate limits = valeurs de départ par source. §What NOT to Use (pas de ccxt, pas de `@oanda/v20`).
- `.planning/REQUIREMENTS.md` — DATA-01, DATA-02, DATA-03, DATA-04, DATA-06, DATA-07 (texte complet).
- `.planning/ROADMAP.md` §Phase 2 — goal et success criteria.

### Code existant à réutiliser (Phase 1)
- `apps/jobs/src/runJob.ts` + `apps/jobs/src/dispatch.ts` — runner + dispatcher : chaque job d'ingestion s'enregistre dans le registre du dispatcher et s'exécute via `runJob` (écrit `job_runs`).
- `packages/core` — constantes temps (bougie clôturée, UTC, daily par source OANDA 17:00 NY / Binance 00:00 UTC) : à consommer, pas à redéfinir.
- `packages/supabase` — client typé + pattern repositories (`jobRuns.ts` comme modèle) ; migrations via Supabase CLI, types régénérés après chaque migration.
- `docs/routines-claude.md` — modèle d'exécution des routines (cloud, quota, fallback Task Scheduler).

### Recherche à mener (research flags)
- **Source gratuite de calendrier économique** (D-31) — Finnhub free le limite ; évaluer les alternatives gratuites (qualité, format, rate limits).
- Endpoints exacts : OANDA v20 `GET /v3/instruments/{instrument}/candles` (granularités H1/H4/D, pagination `count`/`from`), Binance klines testnet (limites de pagination pour le backfill 2 ans), Finnhub news + sentiment par catégorie, FRED `series/observations` (séries exactes : taux Fed, CPI, DXY).
- Symboles OANDA exacts pour WTI (`WTICO_USD`) et disponibilité sur compte démo.
- Disponibilité des 5 paires USDT sur le testnet spot Binance (fallback : API publique mainnet en lecture seule si le testnet manque d'historique).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `runJob`/`dispatch` (apps/jobs) — infra d'exécution + monitoring `job_runs` prête ; les jobs d'ingestion ne créent QUE leur logique métier.
- `run-job.cmd` (ASCII+CRLF, prouvé exit 0) — le déclencheur Task Scheduler horaire pointera dessus.
- `packages/core` — constantes temps DATA-05 déjà testées (16/16 golden values).
- `packages/supabase` — pattern repository typé + `.env` jobs (service_role) en place.

### Established Patterns
- Migrations SQL versionnées Supabase CLI, RLS sur toute nouvelle table (données marché = lecture authentifiés, écriture service_role), types TypeScript régénérés.
- Tests : Vitest racine avec `.env.test` chargé via `process.loadEnvFile` (suite autonome), tests d'intégration contre le projet Supabase cloud.
- `started_at`/`finished_at` depuis l'horloge locale (jamais mixer avec `now()` Postgres — dérive d'horloge).
- `.cmd` Windows = ASCII pur + CRLF (`.gitattributes` verrouille).

### Integration Points
- `packages/data-sources` (nouveau, créé en P2 selon D-11) — un module par source, consommé par les jobs.
- Registre de jobs dans `apps/jobs/src/dispatch.ts` — y ajouter les jobs d'ingestion.
- Nouvelles tables Supabase (candles, news, macro, calendrier) — sous-ensemble cohérent d'ARCHITECTURE.md, RLS dès la création.

</code_context>

<specifics>
## Specific Ideas

- Le critère de fiabilité qui compte : **un re-run complet ne change rien en base** (idempotence prouvable par test) et **couper une source (mauvaise clé API) laisse les autres ingérer** (tolérance prouvable par test).
- La staleness doit être consultable simplement (vue ou colonne calculée) — c'est le contrat que la Phase 4 utilisera pour refuser d'analyser.
- L'univers (12 instruments) est volontairement extensible par UPDATE SQL — penser le seed comme données, pas comme code.

</specifics>

<deferred>
## Deferred Ideas

- **Brent (BCO_USD)** — ajout possible plus tard via `instruments.is_active` ; écarté du MVP (trop corrélé au WTI).
- **Désactivation automatique d'un instrument après N échecs** — option notée, écartée en P2 (risque de désactiver sur panne temporaire).
- **Historique news profond / backtest de la dimension news** — limité par les free tiers ; à revoir avec la phase patterns (v1.1 PATT-01..02).
- **Purge / rétention glissante des H1** — à revoir si le volume DB approche les limites du free tier.
- **Sentiment recalculé maison** — le sentiment provider suffit en MVP ; champ extensible si besoin plus tard.
- **Actions/equities (STOCK-01..02)** — classe d'actif v1.1, source de données à valider dans sa propre phase.

</deferred>

---

*Phase: 02-ingestion-fiable-des-donn-es*
*Context gathered: 2026-06-12*
