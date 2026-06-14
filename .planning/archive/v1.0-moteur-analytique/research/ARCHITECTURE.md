# Architecture Research

**Domain:** Plateforme d'analyse de trading (ingestion multi-sources + moteur IA via routines planifiées + persistance Supabase + frontend lecture seule)
**Researched:** 2026-06-09
**Confidence:** HIGH (décisions clés confirmées par patterns du domaine) — MEDIUM sur l'orchestration des routines Claude (specifics produit 2026)

> **Verdict global** : l'`ARCHITECTURE.md` racine est solide, conforme aux patterns standards du domaine, et bien découpée. Trois écarts importants à corriger (voir §"Écarts vs ARCHITECTURE.md racine"), tous liés à une hypothèse obsolète sur le fonctionnement des routines Claude Code (elles tournent sur le **cloud Anthropic**, pas sur le PC Windows, avec un **quota de 15 runs/jour** en Max). Le reste est validé.

---

## Standard Architecture

### System Overview

L'architecture racine suit le pattern canonique des systèmes de trading : **pipeline en couches avec séparation stricte génération → ingestion → calcul → décision → présentation**. Le domaine confirme ce découpage (cf. Brenndoerfer, Salguero, Google Cloud capital markets).

```
┌──────────────────────────────────────────────────────────────────┐
│                      SOURCES EXTERNES (pull)                       │
│  OANDA(FX/métaux/énergie)  Binance testnet  Finnhub/Marketaux  FRED│
└───────┬───────────────┬──────────────────┬─────────────┬──────────┘
        │ OHLCV         │ OHLCV            │ news+sent    │ macro
        ▼               ▼                  ▼              ▼
┌──────────────────────────────────────────────────────────────────┐
│   COUCHE INGESTION (scripts Node/TS, idempotents, service_role)    │
│   market-ingest      news-ingest        macro-ingest               │
│   normalise UTC      dédoublonne(hash)  upsert séries              │
│   upsert (uniq key)                                                │
└───────────────────────────────┬──────────────────────────────────┘
                                 │ écrit
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│                     SUPABASE (Postgres) = source de vérité         │
│  instruments candles news macro_series | analyses trade_setups     │
│  journal backtests prediction_outcomes job_runs                    │
│  + Auth + Realtime + RLS                                           │
└───┬──────────────────────────────────────────────┬────────────────┘
    │ lit candles/news/macro (read-only)            │ écrit analyses+setups
    │                                                ▼
    │           ┌────────────────────────────────────────────────────┐
    │           │  COUCHE CALCUL DÉTERMINISTE (code, PAS d'IA)         │
    │           │  technical-engine  fundamental-engine  news-engine   │
    │           │  → assemble technical/fundamental/news snapshot      │
    │           └───────────────────┬────────────────────────────────┘
    │                               │ snapshots (jsonb)
    │                               ▼
    │           ┌────────────────────────────────────────────────────┐
    │           │  MOTEUR "VÉTÉRAN" (routine Claude — cloud Anthropic) │
    │           │  Claude RAISONNE sur snapshots → JSON structuré      │
    │           │  scoring-aggregator : Zod + garde-fous déterministes │
    │           │  persistance via connecteur MCP Supabase / script    │
    │           └────────────────────────────────────────────────────┘
    ▼
┌──────────────────────────────────────────────────────────────────┐
│         FRONTEND Next.js (App Router) — LECTURE SEULE Phase 1      │
│  Dashboard(tri score)  Détail trade(chart+raisons)  Journal        │
│  Backtest viewer  Realtime(nouvelles analyses)                     │
└───────────────────────────────┬──────────────────────────────────┘
                                 ▼  UTILISATEUR
```

**Principe architectural central (VALIDÉ par le domaine)** : le backend Next.js n'appelle jamais le LLM en Phase 1. Supabase est l'unique frontière entre la couche productrice (routines) et la couche consommatrice (web). C'est un pattern **CQRS dégénéré** : un seul writer (les jobs, en `service_role`), des lecteurs multiples (web, en `authenticated`/RLS). Robuste, simple, traçable.

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **data-sources** (clients) | Wrappers HTTP par fournisseur, rate-limit, retry/backoff, mapping vers schéma unifié | `packages/data-sources` — un module par source, `p-retry`+`p-limit` |
| **market/news/macro-ingest** | Pull → normalise (UTC, schéma unifié) → upsert idempotent sur clé unique | `apps/jobs/ingest.ts`, client `service_role` |
| **technical-engine** | Indicateurs déterministes (RSI/MACD/EMA/ATR/Bollinger/structure/S-R) — PAS d'IA | `packages/indicators` wrappant `technicalindicators` |
| **fundamental-engine** | Biais macro/taux/DXY par actif depuis `macro_series` | code pur, agrégation |
| **news-engine** | Sentiment net + catalyseurs par actif | code pur, fenêtres temporelles |
| **veteran-analyzer** | Claude combine 3 snapshots → raisonnement → JSON setup | routine Claude (cloud), prompt versionné dans `/agents` |
| **scoring-aggregator** | Garde-fous post-IA : validation Zod, clamp R:R, cohérence SL/TP, filtre seuil, rejet+log | code pur, frontière de confiance |
| **persistence** | Repositories typés, upsert idempotent, application RLS | `packages/supabase` |
| **dashboard (web)** | Lecture Supabase, tri/filtre, charts, realtime | Next.js RSC + react-query + lightweight-charts |
| **journal-feedback** | Trades user, sizing, prediction vs réel | web (écriture user RLS) + job `outcome-eval` |
| **backtest** | Rejoue analyses sur candles → métriques | job hebdo |

**Frontière de confiance la plus importante** : `scoring-aggregator`. C'est le seul point où une sortie LLM (non déterministe, potentiellement malformée) devient une donnée de confiance. Tout ce qui passe doit être validé Zod + garde-fous arithmétiques. Le domaine est unanime (cf. arxiv Trading-R1, crosstrade.io) : **le LLM est un consultant qui interprète, le code est le cerveau qui décide quoi exécuter et valide**.

---

## Recommended Project Structure

La structure monorepo racine est conforme et bien pensée. Affinage proposé :

```
/apps
├── web/                    # Next.js — lecture Supabase + realtime
└── jobs/                   # entrypoints des routines
    ├── ingest.ts           # étape 1 : pull → upsert
    ├── snapshot.ts         # étape 2 : calcul déterministe → snapshots
    ├── persist.ts          # étape 4 : validation Zod + upsert setups
    └── outcome-eval.ts     # boucle feedback
/packages
├── core/                   # types partagés, schémas Zod, constantes (sessions, seuils)
├── data-sources/           # un client par fournisseur (oanda, binance, finnhub, fred)
├── indicators/             # wrappers déterministes (technicalindicators)
├── engines/                # technical/fundamental/news engines (assemblage snapshots)
└── supabase/               # client typé, repositories, types générés
/agents                     # prompts + définitions de routines (versionnés Git)
/supabase/migrations        # SQL versionné + politiques RLS
```

### Structure Rationale

- **`packages/data-sources` isolé de `apps/jobs`** : permet de tester les clients (mock HTTP) indépendamment de l'orchestration, et de réutiliser en Phase 2 pour le streaming. Frontière critique car c'est là que vivent les rate limits.
- **`packages/engines` séparé de `packages/indicators`** : les indicators = primitives pures (un nombre depuis des candles) ; les engines = assemblage métier (un snapshot depuis indicators + règles). Séparer facilite les tests unitaires des deux niveaux.
- **`/agents` versionné Git** : les prompts du "vétéran" sont du code critique. Les routines Claude clonent le repo → les prompts/skills doivent être committés (confirmé : "skills committed to the cloned repository").
- **Schémas Zod dans `core`, partagés web ↔ jobs** : un seul contrat de données pour le JSON de setup. Évite la dérive de schéma (cf. risque `schema_version`).

---

## Architectural Patterns

### Pattern 1: Single-Writer / Read-Only Backend (CQRS dégénéré)

**What:** Un seul producteur écrit (jobs en `service_role`), tous les consommateurs lisent (web en RLS). Aucune écriture métier côté web en Phase 1.
**When to use:** Quand la production de données est asynchrone/batch et découplée de la consommation — exactement le cas ici (routines vs dashboard).
**Trade-offs:**
- (+) Simplicité extrême, traçabilité, pas de logique IA dans le chemin requête web, scaling lecture trivial (cache/CDN).
- (+) Sécurité : `service_role` jamais exposé au front, isolé aux jobs cloud.
- (−) Latence de fraîcheur (données aussi récentes que le dernier run). Acceptable pour Day/Swing, bloquant pour scalping (→ Phase 2 ajoute un writer streaming).
- **Exception à cadrer** : le `journal` est écrit par l'utilisateur depuis le web (RLS `user_id = auth.uid()`). Ce n'est PAS de l'intelligence, juste de la donnée user — l'invariant "web ne produit pas d'analyse" tient.

### Pattern 2: Idempotent Reconciliation Ingestion

**What:** Chaque job d'ingestion est rejouable sans effet de bord : upsert sur clé unique `(instrument_id, timeframe, ts)`, dédoublonnage news par `url_hash`. Un run reconcilie tout le travail en attente depuis le dernier run réussi (pas un delta fragile).
**When to use:** Systématiquement pour tout pipeline planifié susceptible de manquer ou rejouer des runs. Le domaine l'impose (Google SRE, cron best practices).
**Trade-offs:**
- (+) Survit aux runs manqués (PC/cloud indisponible), runs dupliqués, re-runs manuels.
- (+) Permet le **catch-up** : au démarrage, le job pull une fenêtre glissante (ex. dernières N bougies par TF) plutôt qu'« uniquement depuis maintenant ».
- (−) Légèrement plus de requêtes API (pull de fenêtre vs delta) → tension avec rate limits gratuits. À doser par TF.

**Exemple (pull fenêtre + upsert idempotent) :**
```typescript
// Pull une fenêtre glissante, pas seulement le dernier point → catch-up gratuit
const candles = await source.fetchOHLCV(symbol, "H1", { lookback: 200 });
await supabase
  .from("candles")
  .upsert(candles.map(toRow), {
    onConflict: "instrument_id,timeframe,ts", // re-run = no-op
    ignoreDuplicates: true,
  });
```

### Pattern 3: Snapshot Immutability + Provenance (traçabilité)

**What:** Chaque `analysis` stocke le `snapshot` exact (jsonb) sur lequel le LLM a raisonné, plus un `raw_indicators_ref` (hash). Les setups ne sont jamais mutés : nouvelle version + ancien marqué `expired`/`invalidated`.
**When to use:** Indispensable pour la boucle de feedback honnête (prediction vs outcome) et le débogage du modèle. Sans ça, impossible de savoir « pourquoi le vétéran a dit ça à ce moment ».
**Trade-offs:**
- (+) Auditabilité complète, backtest reproductible, calibration par bucket fiable.
- (+) Découple la mesure du **modèle** (`prediction_outcomes`) de l'**exécution** (`journal`).
- (−) Croissance de stockage (jsonb par analyse). Négligeable au volume Phase 1 ; prévoir une politique de rétention/archivage en Phase 2.

### Pattern 4: LLM-as-Consultant (calcul ≠ raisonnement)

**What:** Les chiffres (indicateurs, R:R, sizing, outcome) sont calculés en code et **injectés** dans le snapshot. Le LLM interprète, ne calcule pas.
**When to use:** Toujours, dès qu'un LLM intervient dans une décision chiffrée. Consensus net du domaine : « le modèle est meilleur pour interpréter les indicateurs que pour les calculer » (crosstrade.io, arxiv 2509.11420).
**Trade-offs:** (+) Élimine l'hallucination de chiffres, économise les tokens (donc des runs), rend le pipeline testable. (−) Aucun réel — c'est le pattern dominant.

---

## Data Flow

### Flux principal (production d'une analyse)

```
[Routine planifiée se déclenche — cloud Anthropic, session X]
    ↓
1. INGEST   sources → normalise → upsert candles/news/macro (service_role)
    ↓
2. SNAPSHOT candles → technical-engine (code) → technical_snapshot
            macro   → fundamental-engine     → fundamental_context
            news    → news-engine            → news_context
    ↓
3. ANALYZE  Claude LIT les 3 snapshots → raisonne (vétéran) → JSON setup
    ↓
4. PERSIST  scoring-aggregator : Zod + garde-fous → upsert analyses+trade_setups
            (rejet+log si non conforme ou R:R < seuil)
    ↓
[Supabase Realtime notifie] → [Frontend rafraîchit la liste d'opportunités]
```

### Flux de feedback (mesure du modèle)

```
[Job outcome-eval, quotidien]
    ↓
lit trade_setups actifs + candles postérieures
    ↓
rejoue : TP avant SL → hit_tp/realized_r | SL avant → hit_sl | sinon expired
    ↓
upsert prediction_outcomes  →  [page métriques : win rate par bucket, calibration]
```

### Flux de lecture (web, read-only)

```
[User ouvre dashboard]
    ↓
RSC / react-query → Supabase (RLS authenticated) → trade_setups triés par score
    ↓
[Détail trade] → analyses.snapshot + candles → lightweight-charts + raisons
```

### Key Data Flows

1. **Single source of truth = Supabase** : aucune donnée ne transite directement source→web ni job→web. Tout passe par Postgres. Découplage total producteur/consommateur.
2. **Snapshot = contrat figé** : le code produit le snapshot, le LLM le consomme, le snapshot est persisté. C'est l'interface stable entre déterminisme et raisonnement.
3. **Feedback = boucle fermée mais asynchrone** : les outcomes nourrissent les métriques et (manuellement) l'ajustement des pondérations/prompts. Pas de ré-optimisation automatique (anti-surajustement).

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| **Phase 1 — perso (1 user, démo)** | Tout tel quel. Supabase free tier suffit. Goulot réel = **quota de runs Claude (15/j en Max)** et rate limits API gratuits, PAS la charge. |
| **Phase 1.5 — petite communauté (10-500 users)** | Lecture seule → cache agressif (react-query staleTime, CDN sur RSC). Realtime Supabase OK jusqu'à ~quelques centaines de connexions concurrentes. Aucun changement côté production. |
| **Phase 2 — temps réel + communauté (1k-100k)** | Ajouter un **2e writer streaming** (websockets exchange → service persistant → Supabase ou cache chaud Upstash Redis). Isoler le flux data du flux ordre/lecture. Clé API Anthropic pour analyses live à la demande. Possiblement Postgres read replicas. |

### Scaling Priorities

1. **Premier goulot (Phase 1) = budget de runs Claude.** 15 runs/jour en Max. L'architecture racine liste 6 jobs récurrents — OK si chaque run traite TOUS les instruments×styles d'une session **en un seul run** (batch interne), PAS un run par instrument. À cadrer explicitement (voir Écarts). Si dépassement : grouper davantage, ou activer l'overage métré, ou Windows Task Scheduler local pour les étapes non-IA (ingest/snapshot/outcome-eval qui ne consomment pas de run Claude).
2. **Deuxième goulot = rate limits API gratuits** (OANDA/Binance/Finnhub/FRED). Mitigation déjà prévue (backoff `p-retry`, `p-limit`, cache, pull ciblé). Espacer les étapes d'ingestion. Bien dimensionner la fenêtre de catch-up.
3. **Troisième goulot (Phase 2 seulement) = latence temps réel.** Le batch→streaming est une refonte de la couche production, pas du modèle de données. La séparation single-writer rend l'ajout d'un writer streaming additif (pas destructif). **C'est la principale validation du design** : Phase 2 n'oblige pas à réécrire Phase 1.

---

## Anti-Patterns

### Anti-Pattern 1: Faire calculer les indicateurs par le LLM

**What people do:** Envoyer les bougies brutes à Claude et lui demander RSI/ATR/R:R.
**Why it's wrong:** Hallucination de chiffres, non-déterminisme, gaspillage de tokens (donc de runs), impossible à tester. Le domaine le déconseille unanimement.
**Do this instead:** Calculer en code (`technicalindicators`), injecter dans le snapshot. Déjà la décision racine — la maintenir comme invariant non négociable.

### Anti-Pattern 2: Appeler le LLM depuis une route API du backend web

**What people do:** Endpoint Next.js qui appelle Claude à la volée pour « analyser maintenant ».
**Why it's wrong:** Couple la disponibilité/coût/latence du LLM au chemin requête utilisateur, casse le modèle read-only, expose la facturation à des requêtes non maîtrisées. En Phase 1 (sans clé API), c'est impossible de toute façon.
**Do this instead:** Garder web en lecture seule. Les analyses live à la demande sont explicitement Phase 2 (avec clé API + file d'attente, jamais synchrone dans la requête).

### Anti-Pattern 3: Ingestion par delta fragile (« depuis le dernier ts vu »)

**What people do:** Pull uniquement les points postérieurs au dernier timestamp connu.
**Why it's wrong:** Un run manqué (cloud indispo, erreur source) crée un trou définitif dans les candles → indicateurs faux silencieusement.
**Do this instead:** Pull d'une fenêtre glissante + upsert idempotent (catch-up gratuit). Marquer `stale` si la dernière bougie est trop vieille et **refuser l'analyse** plutôt que d'analyser des données périmées.

### Anti-Pattern 4: Un run Claude par instrument

**What people do:** Boucler une routine par paire/actif.
**Why it's wrong:** Explose le quota de 15 runs/jour en Max. Pour la directive utilisateur "prévenir avant >10 appels MCP répétitifs", c'est le piège exact.
**Do this instead:** Un run = une session entière = tous les instruments pertinents traités en une passe (le code prépare tous les snapshots, Claude raisonne sur le lot). Batch, pas boucle externe.

### Anti-Pattern 5: Confondre traçabilité et mutation

**What people do:** Mettre à jour un `trade_setup` in-place quand la situation change.
**Why it's wrong:** Détruit l'historique de prédiction, fausse la calibration, viole l'immutabilité.
**Do this instead:** Setups immuables. Nouvelle analyse → nouveau setup ; ancien marqué `expired`/`invalidated`. Déjà prévu — invariant à tester.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes / gotchas |
|---------|---------------------|-----------------|
| OANDA v20 REST | Pull OHLCV démo, REST polling | Granularités H1/H4/D ; UTC ; rate limits compte démo ; mapping pip_size par instrument |
| Binance testnet | Pull OHLCV (klines) | 24/7 ; testnet ≠ mainnet (données parfois divergentes) ; poids de requête par IP |
| Finnhub / Marketaux | Pull news+sentiment | Quotas gratuits serrés ; **dédoublonner par `url_hash`** ; mapper article→instrument(s) |
| FRED | Pull séries macro | Faible fréquence (daily/mensuel) ; upsert `(series_code, ts)` |
| **Claude Code Routines** | **Cloud Anthropic** (pas le PC) ; chaque run = session Claude Code complète (shell + skills repo + connecteurs MCP) ; quota **15 runs/j en Max** | **Écart majeur vs racine** : voir ci-dessous. Env vars/secrets configurés dans l'environnement de la routine, pas en `.env` local. MCP = **connecteurs cloud-hosted**, pas le serveur MCP Supabase local. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| data-sources ↔ ingest jobs | Appel direct (fonctions typées) | Rate-limit/retry vit dans data-sources |
| ingest ↔ engines | Via Supabase (candles/news/macro) | Découplage : engines lisent la DB, pas les sources |
| engines ↔ veteran-analyzer | Snapshot jsonb (contrat figé) | Frontière déterminisme/raisonnement |
| veteran-analyzer ↔ persistence | Via scoring-aggregator (Zod + garde-fous) | **Frontière de confiance** — seul point où sortie LLM devient donnée fiable |
| jobs ↔ web | **Uniquement Supabase** | Aucun appel direct ; web ne connaît pas les jobs |
| web ↔ Supabase | `@supabase/ssr` + RLS | `journal` strict `user_id=auth.uid()` ; reste lecture `authenticated` |

---

## Écarts vs ARCHITECTURE.md racine (à corriger / valider)

Trois écarts, tous dérivés du fonctionnement réel des **Claude Code Routines** (recherche 2026). L'`ARCHITECTURE.md` racine suppose des routines locales sur le PC Windows ; la réalité produit diffère.

### ÉCART 1 — CRITIQUE : modèle d'exécution des routines

**Racine dit** (§5, §8) : « Claude Code (app Windows) supporte des scheduled agents » + « PC potentiellement éteint → Windows Task Scheduler en backup » + « idempotence ».
**Réalité (MEDIUM confidence, doc produit avr. 2026)** : les Claude Code **Routines tournent sur l'infrastructure cloud d'Anthropic**, pas sur le PC local. Le laptop fermé n'empêche PAS l'exécution. Donc :
- Le risque « PC éteint » est **largement neutralisé** par le cloud (bonne nouvelle).
- **MAIS** : quota **15 runs/jour en Max**. L'architecture racine définit 6 jobs récurrents — viable **seulement si** chaque run batch traite toute la session (tous instruments×styles) d'un coup. Cadrer ça explicitement.
- Secrets (clés broker, `service_role`) → configurés dans **l'environnement de la routine** (network scope + env vars + setup script), pas un `.env` local.
- MCP Supabase → doit être un **connecteur cloud-hosted**, pas le serveur MCP local « déjà connecté ». Le MCP local sert au développement, pas aux routines.
**Recommandation** : conserver Windows Task Scheduler **uniquement** comme exécuteur des étapes non-IA (ingest/snapshot/outcome-eval — du Node pur qui ne consomme aucun run Claude), et réserver les 15 runs/jour Claude à l'étape ANALYZE. Cela découple le quota IA des besoins d'ingestion fréquente.

### ÉCART 2 — IMPORTANT : budget de runs vs nombre de jobs

**Racine dit** : 6 crons récurrents + crypto « chaque session ».
**Risque** : si l'on multiplie session × style × actif, on dépasse 15/jour. Le tableau de cron racine est ambigu sur la granularité.
**Recommandation** : un **run Claude = une session entière**, batch sur tous les instruments pertinents. Documenter le budget : ~4 runs ANALYZE (asia/london/ny/eod) + 1 outcome (peut être non-IA) + 1 backtest hebdo ≈ bien sous 15/jour. Les étapes ingest/snapshot ne devraient PAS consommer de run Claude (les sortir en Node planifié).

### ÉCART 3 — MINEUR : étapes déterministes dans la routine Claude

**Racine dit** (§5 anatomie du job) : étapes 1 (INGEST) et 2 (PREP/snapshot) à l'intérieur de la routine Claude.
**Observation** : faire tourner du Node déterministe dans un run Claude « gaspille » un run précieux et mélange déterminisme et orchestration IA.
**Recommandation** : séparer physiquement — INGEST + SNAPSHOT = jobs Node planifiés (Task Scheduler local ou GitHub Actions cron gratuit), ANALYZE + PERSIST = run Claude. Aligne le coût (runs) sur la valeur (raisonnement IA).

### Ce qui est VALIDÉ tel quel (ne pas changer)

- Séparation calcul déterministe / raisonnement IA — **pattern dominant du domaine, parfaitement appliqué**.
- Single-writer / backend read-only via Supabase — **robuste et conforme CQRS**.
- Idempotence par upsert sur clés uniques + dédoublonnage news — **standard SRE**.
- Snapshot immuable + traçabilité (`raw_indicators_ref`) — **indispensable, bien fait**.
- scoring-aggregator comme frontière de confiance (Zod + garde-fous) — **excellent**.
- Boucle feedback séparant modèle (`prediction_outcomes`) et exécution (`journal`) — **rigoureux**.
- Anti-surajustement (walk-forward, out-of-sample, pas de ré-optim a posteriori) — **conforme aux bonnes pratiques quant**.
- RLS stricte (journal `user_id=auth.uid()`, service_role isolé) — **correct**.
- Découpage monorepo / petits packages — **propre, testable**.
- Roadmap Phase 1 batch → Phase 2 streaming : la séparation single-writer rend Phase 2 **additive et non destructive** — **principal point fort du design**.

---

## Implications sur l'ordre de build (dépendances)

Ordre dérivé du graphe de dépendances des composants. Chaque étape ne dépend que des précédentes.

```
1. FONDATIONS
   core (types+Zod) → supabase (client typé, migrations, RLS de base) → data-sources clients
   [aucune dépendance amont ; tout le reste en dépend]

2. INGESTION (dépend de : data-sources, supabase)
   market/news/macro-ingest idempotents → candles/news/macro peuplées
   [première chose vérifiable de bout en bout : "les données arrivent et sont fraîches"]

3. CALCUL DÉTERMINISTE (dépend de : ingestion peuplée)
   indicators → engines (technical/fundamental/news) → snapshots
   [testable en isolation, 80% coverage facile car déterministe]

4. MOTEUR IA + GARDE-FOUS (dépend de : snapshots, schémas Zod)
   prompts /agents → routine ANALYZE → scoring-aggregator (Zod+garde-fous) → analyses/trade_setups
   [la frontière de confiance se construit ICI, pas avant]

5. FRONTEND LECTURE (dépend de : trade_setups peuplés)
   auth → dashboard (tri/filtre) → détail trade (charts+raisons) → realtime
   [peut démarrer en parallèle dès que le schéma trade_setups est figé, avec données seed]

6. FEEDBACK + JOURNAL (dépend de : trade_setups, candles historiques)
   journal+sizing (web, RLS) → outcome-eval (job) → backtest hebdo → page métriques
   [vient en dernier : nécessite des setups passés à évaluer]
```

**Conséquences pour le phasage roadmap :**
- **Phase 0 = étapes 1-2** : on ne peut rien analyser sans données fraîches et idempotentes. Valider la fraîcheur (flag `stale`) et l'idempotence (re-run safe) AVANT d'écrire le moindre prompt IA.
- **Phase 1 = étapes 3-6** : le cœur. L'étape 4 (moteur IA + garde-fous) est le **point à plus haut risque** — flaguer pour recherche/itération approfondie (calibration du scoring, robustesse du prompt, taux de rejet Zod).
- **Étape 5 (frontend)** peut être parallélisée tôt avec des données seed, car elle ne dépend que du **schéma figé** de `trade_setups`, pas du moteur IA réel. Bon candidat pour avancer le ressenti produit.
- **Étape 6 (feedback)** nécessite du temps écoulé (des setups à évaluer) → naturellement en fin de Phase 1.

---

## Sources

- [Quant Trading Systems: Architecture & Infrastructure — Brenndoerfer](https://mbrenndoerfer.com/writing/quant-trading-system-architecture-infrastructure) (séparation génération/ingestion/stratégie/exécution)
- [Data Pipeline Design in an Algorithmic Trading System — Salguero (Medium)](https://medium.com/@edwinsalguero/data-pipeline-design-in-an-algorithmic-trading-system-ac0d8109c4b9) (modularité, dédoublonnage timestamps)
- [Building real-time data pipelines for capital markets — Google Cloud](https://cloud.google.com/blog/topics/financial-services/building-real-time-data-pipelines-for-capital-markets-firms) (batch→streaming, schéma unifié)
- [Building real-time streaming pipelines for market data — Google Cloud](https://cloud.google.com/blog/topics/financial-services/building-real-time-streaming-pipelines-for-market-data) (isolation flux data/ordre)
- [LLM-Assisted Futures Trading: Signal Generation — crosstrade.io](https://crosstrade.io/blog/llm-assisted-futures-trading-using-ai-signal-generation-on-nt8) (LLM interprète, ne calcule pas ; "Python = cerveau, LLM = consultant")
- [Trading-R1: Financial Trading with LLM Reasoning — arXiv 2509.11420](https://arxiv.org/pdf/2509.11420) (séparation calcul/raisonnement)
- [Google SRE: Distributed Periodic Scheduling with Cron](https://sre.google/sre-book/distributed-periodic-scheduling/) (idempotence, runs manqués/dupliqués)
- [Cron Job Best Practices — CronBeacon](https://cronbeacon.dev/guides/cron-job-best-practices) (reconciliation, locks + idempotency keys)
- [Anacron for missed scheduled tasks — OneUptime](https://oneuptime.com/blog/post/2026-03-04-anacron-running-missed-scheduled-tasks-rhel-9/view) (catch-up sur machines éteintes)
- [Introducing routines in Claude Code — Anthropic](https://claude.com/blog/introducing-routines-in-claude-code) + [Claude Code Routines docs](https://code.claude.com/docs/en/routines) (cloud Anthropic, 15 runs/j Max, connecteurs MCP, shell+skills repo) — MEDIUM confidence (produit récent)

---
*Architecture research for: plateforme d'analyse de trading IA (batch routines + Supabase + Next.js read-only)*
*Researched: 2026-06-09*
