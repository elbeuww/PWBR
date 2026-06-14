# Project Research Summary

**Project:** Plateforme d'Analyse de Trading "Vétéran"
**Domain:** Plateforme d'analyse / aide à la décision de trading (scoring IA explicable, technique + fondamental + news, plan de trade, journal, backtest) — crypto + FX + métaux + énergie, day + swing
**Researched:** 2026-06-09
**Confidence:** MEDIUM-HIGH

## Executive Summary

C'est un produit de la famille "scanner IA / générateur de signaux" (type Trade Ideas/Holly, TrendSpider) mais appliqué à une niche **non servie par les leaders** : crypto + forex + or/argent + WTI/Brent. Les concurrents IA sont quasi tous US-equities only. La façon dont les experts construisent ces systèmes est un consensus net : **pipeline en couches avec séparation stricte ingestion → calcul déterministe → raisonnement → décision → présentation**, où le LLM est un *consultant qui interprète* et le *code est le cerveau qui calcule et décide*. L'architecture racine du projet applique déjà ce pattern correctement — c'est le principal point fort du design.

L'approche recommandée tient en trois invariants non négociables : (1) **tous les chiffres** (indicateurs, R:R, sizing, outcomes) sont calculés en code déterministe, Claude ne fait que le raisonnement ; (2) **Supabase est l'unique frontière** entre la couche productrice (routines) et consommatrice (web read-only) — un CQRS dégénéré, single-writer ; (3) **idempotence + immutabilité + traçabilité** (upsert sur clés uniques, snapshot figé par analyse, setups jamais mutés). Le différenciateur défendable n'est pas une feature isolée mais la **combinaison** score/100 explicable + risque séparé + plan complet + boucle de calibration sur des actifs mal couverts. **La calibration du score (win rate par bucket) est le différenciateur le plus défendable** — aucun concurrent ne lie publiquement calibration et qualité des futures recommandations.

Trois risques dominent. **(A) Découverte critique sur les Routines Claude Code** : elles tournent sur le cloud Anthropic (PC éteint OK, bonne nouvelle) MAIS avec un **quota ~15 runs/jour en Max** → 1 run doit traiter une session entière en batch (jamais 1 run/instrument), secrets via env de la routine, MCP via connecteur cloud-hosted (pas le serveur MCP local). C'est la dépendance externe la plus incertaine, **à vérifier sur la doc officielle en Phase 0**. **(B) Biais quant** : look-ahead bias, overfitting des poids, scores non calibrés, écart démo-vs-réel — ils transforment un edge fictif en perte réelle. **(C) Légal** : un score + entrée + SL + TP ressemble à du conseil en investissement réglementé (MiFID II / AMF) — bloquant avant toute diffusion communautaire / monétisation.

## Key Findings

### Recommended Stack

Stack **validée et verrouillée** (versions vérifiées via npm registry le 2026-06-09, confidence HIGH). Next.js 15 (rester sur 15, pas 16 — écosystème `@supabase/ssr` stabilisé), Supabase (Postgres/Auth/Realtime/RLS), monorepo pnpm. Trois alertes structurantes sont sorties de la recherche.

**Core technologies:**
- **Next.js 15 + TypeScript strict + Tailwind 4 + shadcn/ui** : front App Router/RSC en lecture seule — réutilise les compétences du fondateur.
- **Supabase JS 2.108 + `@supabase/ssr` 0.12** : DB/Auth/Realtime ; `@supabase/ssr` remplace `auth-helpers` (déprécié). Types générés par CLI + repositories maison — **PAS d'ORM** (éviter de dédoubler la source de vérité du schéma).
- **lightweight-charts 5.2** : charting candles + overlays SL/TP (API v5 ≠ v4).
- **technicalindicators 3.1** : indicateurs déterministes — **ALERTE : non maintenu depuis 2023-07**. OK car maths figées, mais wrapper dans `/packages/indicators` + tests golden values. **La détection de structure de marché (HH/HL, BOS/CHoCH, swings, POC) n'y est PAS → à coder maison.** C'est un item d'effort sous-estimé et le cœur du "vétéran".
- **Clients data maison (fetch + Zod) pour OANDA / Marketaux / FRED** ; SDK `binance` (tiagosiebler) et `finnhub` officiels. Les bindings/wrappers npm de OANDA/FRED sont non typés/anciens → client mince maison, plus sûr et aligné sur le déterminisme.
- **Zod 4** : garde-fou central du JSON IA. **luxon** (pas date-fns) pour sessions/DST côté jobs. **p-retry + p-limit** sur chaque source (rate limits gratuits). **tsx** pour les jobs, **pino** → `job_runs`, **Vitest** (80 %) + **Playwright** (RLS).
- **Scheduling** : Windows Task Scheduler pour les étapes non-IA (ingest/snapshot/outcome-eval, Node pur) ; croner si daemon in-process souhaité ; runs Claude réservés à ANALYZE.

### Expected Features

Le marché se segmente en 4 familles (charting/screener, scanners IA, journaux/analytics, social) et **aucun produit ne fait tout** — la niche multi-actifs + IA explicable est ouverte. Barre "ça a l'air sérieux" haute : sans charting crédible, niveaux SL/TP et disclaimer légal, le produit paraît cassé.

**Must have (table stakes):**
- Dashboard d'opportunités trié par score + filtres (actif/classe/style/risque) — raison d'être du produit.
- Détail trade : chart + niveaux SL/TP tracés + indicateurs + raisonnement explicite + `veteran_note` — l'explicabilité EST le produit.
- Calculateur de sizing (risque fixe 1-2 %) + R:R affiché — risk management de base.
- Journal de trading (demo/live, RLS stricte) + analytics (win rate, expectancy, R, P&L).
- Feed news + sentiment + events à venir ; Auth + RLS + disclaimers + traçabilité des analyses.

**Should have (competitive):**
- **Score /100 multi-facteur explicable** (décomposition de la pondération) — vs boîte-noire concurrente.
- **Score de RISQUE séparé** du score d'opportunité — rare et pro.
- **Plan de trade complet** par setup (entrée/zone/SL/TP multiples + alloc/invalidation) — personne ne le fait bien sur crypto+FX+métaux+énergie ensemble.
- **Boucle de calibration** (win rate par bucket de score) — LE différenciateur défendable.
- Couverture multi-actifs unifiée + routine planifiée par session (coût zéro via Max) — avantage structurel.

**Defer (v2+):**
- Communauté (profils/follows/commentaires/watchlists) — nécessite calibration prouvée + modération + cadre légal.
- Leaderboard (par calibration/discipline, JAMAIS P&L brut) ; alertes push/Telegram ; scalping M1/streaming ; clé API Anthropic (analyses live) ; monétisation Stripe ; scale (Upstash/CDN).

**Anti-features explicites :** copy trading/exécution auto, promesses de gain, leaderboard P&L brut, Claude qui calcule les chiffres, couverture actions. À bloquer pour éviter le scope creep.

### Architecture Approach

Pipeline en couches, **single-writer / backend read-only** : les jobs (service_role) écrivent dans Supabase, le web (RLS authenticated) lit seulement. Le `journal` est la seule écriture user (RLS `user_id=auth.uid()`). La séparation rend la **Phase 2 streaming additive et non destructive**. L'architecture racine est jugée solide ; 3 écarts à corriger, tous liés au fonctionnement réel des Routines Claude (cloud + quota).

**Major components:**
1. **data-sources** (`/packages/data-sources`) — un client par source, rate-limit/retry, mapping vers schéma unifié.
2. **ingest jobs** — pull → normalise UTC → upsert idempotent (fenêtre glissante, pas delta fragile).
3. **engines** (`/packages/engines` + `/packages/indicators`) — snapshots déterministes (technical/fundamental/news).
4. **veteran-analyzer** (routine Claude cloud) — raisonne sur les 3 snapshots → JSON setup.
5. **scoring-aggregator** — **frontière de confiance unique** : Zod + garde-fous arithmétiques (recalcul R:R, cohérence SL/TP, rejet+log). Le seul point où une sortie LLM devient donnée fiable.
6. **web (Next.js RSC)** — dashboard/détail/journal/backtest + realtime, lecture seule.

### Critical Pitfalls

1. **Look-ahead bias** — indicateurs sur bougie en cours, backtest qui lit la bougie d'entrée, news horodatée à l'ingest. Éviter : exclure la dernière bougie non clôturée, rejouer depuis le `snapshot` stocké (jamais recalculer), convention pessimiste SL-avant-TP, filtrer news sur `published_at`.
2. **Overfitting des poids de scoring** — ré-ajustement continu sur le même petit échantillon. Éviter : walk-forward + out-of-sample strict, poids versionnés (`scoring_version`) jamais ré-notés rétroactivement, peu de paramètres.
3. **Scores non calibrés** — un /100 qui ne reflète aucune probabilité réelle rend le tri cosmétique. Éviter : reliability diagram + Brier score, afficher "calibration en cours, N trades", ne pas le présenter comme probabilité tant que non mesuré. **Bloquant avant communauté.**
4. **Hallucination de chiffres par Claude** — un seul SL/RSI inventé = perte. Éviter : tout en code déterministe, garde-fous Zod post-IA, audit via `raw_indicators_ref`.
5. **Désalignement UTC/sessions/gap weekend** — OANDA daily = 17:00 NY, Binance = 00:00 UTC ; DST décale les sessions. Éviter : tout en UTC, cron UTC, choisir UNE convention daily et la verrouiller, modéliser le gap weekend au backtest.
6. **Sécurité service_role / RLS** — leak du service_role dans le bundle, table sans RLS. Éviter : service_role isolé à `apps/jobs` + lint anti-import, RLS sur TOUTES les tables + `get_advisors`, tests RLS cross-user.

## Implications for Roadmap

Ordre de build dérivé du graphe de dépendances (chaque étape ne dépend que des précédentes). **Le moteur IA + scoring-aggregator est le point à plus haut risque, à flaguer pour itération.**

### Phase 0: Fondations + Ingestion fiable
**Rationale:** Rien ne s'analyse sans données fraîches, idempotentes et propres. Toutes les autres couches en dépendent. La convention de bougie clôturée, l'UTC, l'idempotence et la sécurité RLS doivent être posées AVANT d'écrire le moindre prompt IA.
**Delivers:** monorepo pnpm, `core` (types + Zod + constantes sessions/seuils), client Supabase typé + migrations + RLS de base + isolation service_role, clients data-sources (OANDA/Binance/Finnhub/Marketaux/FRED en fetch+Zod maison), `ingest.ts` idempotent (candles/news/macro), métadonnées instruments (pip_size/min_size/precision), squelette Next.js + auth.
**Addresses:** Auth + RLS + traçabilité (table stakes).
**Avoids:** UTC/sessions (#5), sécurité clés/RLS (#9), robustesse routines/idempotence (#10), convention de bougie pour look-ahead (#1).
**À VÉRIFIER en priorité :** modèle d'exécution réel des Routines Claude (cloud, quota 15/j, secrets via env de routine, MCP cloud-hosted, offload INGEST+SNAPSHOT vers Task Scheduler/GitHub Actions cron). Dépendance externe la plus incertaine.

### Phase 1: MVP Day/Swing (perso, démo)
**Rationale:** Le cœur de la Core Value. Se construit en 4 étapes ordonnées : calcul déterministe → moteur IA + garde-fous → frontend lecture → feedback/journal. Le frontend peut démarrer en parallèle tôt sur données seed (ne dépend que du schéma figé de `trade_setups`).
**Delivers:** engines déterministes (technical/fundamental/news + **détection de structure maison**), routines Claude (asia/london/ny/eod) en batch par session, scoring-aggregator (Zod + garde-fous), dashboard tri/filtres, détail trade (lightweight-charts + SL/TP + raisons + veteran_note), score décomposé + risque séparé + R:R, sizing calculator, journal + analytics, outcome-eval + infra calibration, backtest hebdo basique, realtime, disclaimers.
**Uses:** technicalindicators (wrappé + golden values), lightweight-charts 5, luxon, p-retry/p-limit, recharts (calibration/equity).
**Implements:** components 3-6 (engines, veteran-analyzer, scoring-aggregator, web).
**Avoids:** look-ahead (#1), overfitting (#2), calibration (#3), hallucination (#4), écart démo-réel (#6 — friction/spread dans le backtest, métriques demo/live séparées), petit capital (#7 — alerte si taille < min_size, jamais arrondir à la hausse).

### Phase 2: Scalping + communauté + API + monétisation
**Rationale:** Différer jusqu'au product-market fit perso. **Deux bloquants explicites avant d'ouvrir :** (1) calibration du score prouvée (reliability diagram monotone, Brier mesuré) ; (2) revue juridique (MiFID II/AMF — diffuser/monétiser des analyses actionnables peut relever du conseil en investissement réglementé) + vérification des licences de redistribution des données (OANDA/Binance/Finnhub/FRED).
**Delivers:** clé API Anthropic (analyses live à la demande, file d'attente jamais synchrone), scalping M1/streaming (2e writer websockets, additif), communauté (profiles/follows/commentaires/watchlists), leaderboard par calibration/discipline (PAS P&L), Stripe, alertes push/Telegram, scale (Upstash/CDN).
**Avoids:** légal/conseil financier (#8), sécurité tables communauté (#9 renforcé).

### Phase Ordering Rationale

- **Dépendances :** ingestion+snapshots = fondation absolue ; calibration nécessite des semaines de setups+outcomes accumulés → infra en Phase 1, tableau riche en v1.x ; communauté requiert une calibration prouvée.
- **Architecture :** la séparation single-writer rend Phase 2 (streaming) additive — pas de réécriture de Phase 1. Le frontend lecture est parallélisable tôt (schéma figé suffit).
- **Pitfalls :** déterminisme + UTC + RLS + idempotence en Phase 0 (corriger plus tard coûte HIGH) ; calibration et légal sont des portes bloquantes vers Phase 2.

### Research Flags

Phases nécessitant une recherche approfondie pendant le planning :
- **Phase 0 — Routines Claude Code :** vérifier la doc officielle (cloud, quota 15/j Max, secrets, connecteurs MCP, offload des étapes non-IA). Dépendance externe la plus incertaine (confidence MEDIUM).
- **Phase 1 — moteur IA + scoring-aggregator :** point à plus haut risque. Recherche sur la robustesse du prompt vétéran, le taux de rejet Zod acceptable, et surtout la **calibration du scoring** (méthode, échantillon minimal, isotonic/Platt). À itérer.
- **Phase 1 — détection de structure de marché maison :** absente de technicalindicators, effort sous-estimé. Rechercher algos déterministes HH/HL, BOS/CHoCH, swing detection, POC volume.
- **Phase 2 — légal (MiFID II/AMF) :** revue juridique réelle requise avant monétisation (confidence LOW sur le légal).

Phases avec patterns standards (skip research-phase) :
- **Phase 0 — ingestion/RLS/Supabase :** patterns SRE + Supabase bien documentés.
- **Phase 1 — frontend lecture + charting :** lightweight-charts + Next.js RSC + react-query bien établis.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Versions vérifiées via npm registry 2026-06-09 + docs officielles. Seule alerte : technicalindicators stale (mitigé). |
| Features | MEDIUM-HIGH | Features concurrents = HIGH (docs produits) ; mapping MVP/complexité = MEDIUM (opinionné). |
| Architecture | HIGH (MEDIUM sur routines) | Patterns du domaine confirmés et bien appliqués ; specifics produit Routines Claude 2026 = MEDIUM. |
| Pitfalls | HIGH (MEDIUM légal) | Biais quant/calibration/UTC = littérature établie ; sécurité Supabase = docs officielles ; légal = à valider juridiquement. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Modèle d'exécution des Routines Claude Code** : le plus gros risque non résolu. Valider en Phase 0 sur la doc officielle ; prévoir le fallback Task Scheduler/GitHub Actions cron pour INGEST+SNAPSHOT si le quota ou les connecteurs MCP cloud ne conviennent pas.
- **Détection de structure de marché** : non couverte par les libs, à concevoir et tester maison (golden values).
- **Calibration du score** : différenciateur central mais nécessite un échantillon réel ; méthode de re-calibration (isotonic/Platt) et seuil d'échantillon à définir pendant la planif Phase 1.
- **Cadre légal MiFID II/AMF** : confidence LOW — revue juridique bloquante avant Phase 2.
- **Convention daily cross-asset** (OANDA 17:00 NY vs Binance 00:00 UTC) : choisir et verrouiller une convention en Phase 0.

## Sources

### Primary (HIGH confidence)
- npm registry (vérifié 2026-06-09) — versions et dates de publication de tous les paquets.
- Docs officielles : Supabase (ssr/gen-types/RLS/get_advisors), lightweight-charts v5, developer.oanda.com (REST v20).
- Littérature quant : calibration (Brier/reliability diagrams), backtesting bias, walk-forward.
- ARCHITECTURE.md racine + PROJECT.md — source de vérité interne.

### Secondary (MEDIUM confidence)
- WebSearch SDK Binance/OANDA Node 2025 (choix client maison vs binding).
- Docs features concurrents : TradingView, Trade Ideas (Holly, US-equities only confirmé), Finviz, Edgewonk (Edge Finder AI jan 2026), TraderSync.

### Tertiary (LOW confidence)
- Claude Code Routines (claude.com/blog + code.claude.com/docs) — produit récent, cloud + 15 runs/j Max — **à re-vérifier en Phase 0**.
- Légal MiFID II / AMF — connaissance générale — **à valider par un juriste avant monétisation P2**.

---
*Research completed: 2026-06-09*
*Ready for roadmap: yes*
