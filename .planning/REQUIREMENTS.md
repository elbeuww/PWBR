# Requirements: Plateforme d'Analyse de Trading "Vétéran"

**Defined:** 2026-06-09
**Core Value:** Produire, pour chaque opportunité, une analyse fiable et explicable — score /100 + niveau de risque + plan de trade (entrée/SL/TP/R:R) — qui aide à décider avec discipline.

## v1 Requirements

Périmètre MVP (Phase 0 fondations + Phase 1 day/swing, usage perso/démo). Chaque exigence est mappée à une phase de la roadmap.

### Data Ingestion (DATA)

- [ ] **DATA-01**: Le système ingère les bougies OHLCV multi-timeframes (H1, H4, Daily) pour les instruments crypto depuis Binance (testnet)
- [ ] **DATA-02**: Le système ingère les bougies OHLCV (H1, H4, Daily) pour forex + or (XAU) + argent (XAG) + pétrole (WTI/Brent) depuis OANDA (démo)
- [ ] **DATA-03**: Le système ingère les news et leur sentiment par instrument depuis Finnhub/Marketaux
- [ ] **DATA-04**: Le système ingère les séries macro pertinentes (taux, CPI, DXY) depuis FRED
- [ ] **DATA-05**: Toutes les bougies sont normalisées en UTC avec une convention de bougie clôturée explicite (exclut la bougie en cours)
- [ ] **DATA-06**: L'ingestion est idempotente (upsert sur clés uniques) — un re-run ne crée pas de doublons
- [ ] **DATA-07**: Une source en échec n'interrompt pas les autres ; la donnée périmée est marquée `stale`

### Technical Analysis Engine (TECH)

- [ ] **TECH-01**: Le système calcule en code déterministe les indicateurs (RSI, MACD, EMA, ATR, Bollinger) à partir des bougies
- [ ] **TECH-02**: Le système détecte la structure de marché (HH/HL, swings, BOS/CHoCH) de façon déterministe
- [ ] **TECH-03**: Le système identifie les niveaux clés (support/résistance, POC volume) avec une mesure de force
- [ ] **TECH-04**: Le système produit un `technical_snapshot` structuré (tendance HTF/LTF, momentum, volatilité, niveaux, structure) par instrument/style

### Fundamental & News Engine (FUND)

- [ ] **FUND-01**: Le système produit un `fundamental_context` (biais macro risk-on/off, environnement de taux, drivers par actif) à partir des données macro
- [ ] **FUND-02**: Le système produit un `news_context` (sentiment net, catalyseurs récents, events à venir) par instrument
- [ ] **FUND-03**: Le système flag les events économiques à fort impact imminents (`news_risk`) par instrument/style

### Veteran Analysis & Scoring (SCORE)

- [ ] **SCORE-01**: Une routine planifiée (agent Claude) produit, par instrument/style retenu, un setup de trade en JSON structuré (direction, entrée, SL, TP multiples, R:R, raisons technique/fondamentale/news, invalidation, note du vétéran)
- [ ] **SCORE-02**: Chaque setup reçoit une note d'opportunité /100 dérivée d'une pondération explicite et décomposable
- [ ] **SCORE-03**: Chaque setup reçoit un niveau de risque séparé (low/medium/high/extreme)
- [ ] **SCORE-04**: Le `scoring-aggregator` valide chaque sortie IA via Zod et applique des garde-fous déterministes (recalcul du R:R, cohérence SL/TP, seuil de rejet) ; les sorties non conformes sont rejetées et loggées
- [ ] **SCORE-05**: Chaque analyse stocke le `snapshot` exact utilisé (traçabilité) et n'est jamais mutée (versions immuables, ancien marqué expired/invalidated)

### Scheduling & Routines (JOB)

- [ ] **JOB-01**: Des routines planifiées s'exécutent aux ouvertures de sessions (Asie, Londres, New York) et en clôture daily (EOD swing), en UTC
- [ ] **JOB-02**: Un run traite une session entière en batch (tous instruments/styles), dans le budget de runs du forfait Max
- [ ] **JOB-03**: Les étapes déterministes (ingestion, snapshot) peuvent s'exécuter hors agent Claude (Windows Task Scheduler) en filet de sécurité
- [ ] **JOB-04**: Chaque exécution écrit une entrée `job_runs` (statut, timing, erreur) pour le monitoring

### Dashboard & Opportunities (DASH)

- [ ] **DASH-01**: L'utilisateur voit la liste des opportunités (setups actifs) triées par note d'opportunité décroissante
- [ ] **DASH-02**: L'utilisateur filtre les opportunités par actif, classe d'actif, style (day/swing) et niveau de risque
- [ ] **DASH-03**: Le dashboard se met à jour en temps réel quand de nouvelles analyses sont produites (Supabase Realtime)
- [ ] **DASH-04**: Chaque carte d'opportunité affiche actif, direction, score, risque, R:R et fraîcheur de la donnée

### Trade Detail & Charting (TRADE)

- [ ] **TRADE-01**: L'utilisateur ouvre le détail d'un trade avec un graphique en chandeliers (lightweight-charts)
- [ ] **TRADE-02**: Le détail trace les niveaux d'entrée, stop-loss et take-profits sur le graphique
- [ ] **TRADE-03**: Le détail affiche la décomposition du score, les raisons technique/fondamentale/news et la note du vétéran
- [ ] **TRADE-04**: Le détail affiche le scénario d'invalidation et les events de risque à venir

### Risk & Position Sizing (RISK)

- [ ] **RISK-01**: Le système calcule la taille de position pour un risque fixe paramétrable (défaut 1 % du capital) à partir de la distance au SL
- [ ] **RISK-02**: Le calculateur alerte si la taille calculée passe sous la taille minimale de l'instrument (jamais arrondie à la hausse)
- [ ] **RISK-03**: L'utilisateur paramètre son capital et son pourcentage de risque par trade

### Journal & Feedback Loop (JRNL)

- [ ] **JRNL-01**: L'utilisateur enregistre ses trades réels (entrée, sortie, SL, taille, type de compte demo/live), liés optionnellement à un setup source
- [ ] **JRNL-02**: Le journal est strictement privé par utilisateur (RLS `user_id = auth.uid()`)
- [ ] **JRNL-03**: Le système calcule les analytics du journal (win rate, expectancy, R moyen, P&L, max drawdown), séparément pour demo et live
- [ ] **JRNL-04**: Une évaluation automatique (`outcome-eval`) rejoue les setups passés depuis leur `snapshot` et enregistre prédiction vs résultat (hit_tp/hit_sl/realized_r), indépendamment de l'exécution utilisateur

### Backtest & Calibration (CAL)

- [ ] **CAL-01**: Un backtest hebdomadaire rejoue les analyses historiques avec des règles d'exécution fixes et produit des métriques (win rate, expectancy, profit factor, max DD) + courbe d'équité
- [ ] **CAL-02**: Le système calcule la calibration du score (win rate réel par bucket de score) et affiche "calibration en cours, N trades" tant que l'échantillon est insuffisant
- [ ] **CAL-03**: Le backtest applique une méthodologie anti-surajustement (walk-forward, rejeu depuis snapshot, jamais de ré-optimisation rétroactive)

### Auth & Security (AUTH)

- [ ] **AUTH-01**: L'utilisateur peut créer un compte et se connecter (Supabase Auth) ; la session persiste
- [ ] **AUTH-02**: Toutes les tables ont une RLS active ; les données de marché/analyses sont en lecture pour les utilisateurs authentifiés
- [ ] **AUTH-03**: La clé service_role est isolée aux jobs et jamais exposée au frontend (lint anti-import)

### Compliance & Disclaimers (LEGAL)

- [ ] **LEGAL-01**: Un disclaimer "contenu éducatif, pas un conseil en investissement" est affiché sur le dashboard et le détail trade
- [ ] **LEGAL-02**: Aucune promesse de gain n'est affichée ; les scores non calibrés ne sont pas présentés comme des probabilités

## v1.1 Requirements — Vision élargie (2026-06-12)

Décision fondateur : la plateforme devient un produit par abonnement (9 $/mois) avec distribution Telegram (1 signal/jour public + résumé quotidien des trades sur canal privé abonnés), ajout des actions, scalping confirmé. Ces exigences étendent la roadmap APRÈS le cœur analytique (Phases 1-4) — voir « Scope Update » dans ROADMAP.md. Non encore mappées à des phases.

### Distribution Telegram (DIST)

- [ ] **DIST-01**: Un bot Telegram publie 1 signal par jour (le mieux scoré du jour) sur le canal public, formaté (actif, direction, entrée, SL, TP, score, disclaimer)
- [ ] **DIST-02**: Le bot publie le résumé quotidien des trades du jour sur le canal privé réservé aux abonnés
- [ ] **DIST-03**: L'accès au canal privé est contrôlé par le statut d'abonnement (liens d'invitation / retraits automatisés via l'API Telegram)
- [ ] **DIST-04**: Chaque publication est tracée en base (setup, canal, timestamp) — idempotente, jamais de double post

### Monétisation (MON) — promu de v2

- [ ] **MON-01**: Abonnement Stripe 9 $/mois (checkout, portail client, webhooks de statut)
- [ ] **MON-02**: Le statut d'abonnement gate l'accès au contenu premium de la plateforme et au canal Telegram privé
- [ ] **MON-03**: Page pricing publique + flux d'inscription

### Actions / Equities (STOCK) — sorti du out-of-scope

- [ ] **STOCK-01**: Ingestion OHLCV pour une liste curatée d'actions (source à valider — research : les candles actions ne sont plus dans le tier gratuit Finnhub ; candidats Alpha Vantage / Twelve Data / Polygon)
- [ ] **STOCK-02**: Les moteurs technique/fondamental/vétéran traitent les actions comme classe d'actif supplémentaire (heures de marché, gaps, earnings)

### Patterns chartiques à taux de réussite mesuré (PATT)

- [ ] **PATT-01**: Le moteur détecte un catalogue de patterns chartiques classiques en code déterministe (engulfing, pin bar, double top/bottom, breakout de range, continuation, etc.)
- [ ] **PATT-02**: Le taux de réussite de chaque pattern est MESURÉ par le backtest maison (par actif/timeframe) et alimente la pondération du score — jamais affirmé sans données

### Scalping temps réel (RT) — promu de v2, en dernier

- [ ] **RT-01**: Streaming temps réel (websockets Binance/OANDA) et timeframes M1/M5 pour le scalping
- [ ] **RT-02**: Moteur d'analyse temps réel (2e writer additif, sans réécrire le batch)

## v2 Requirements

Reporté (après lancement abonnement + bloquants levés). Suivi mais hors roadmap actuelle.

### Live AI (LIVE)

- **LIVE-01**: Clé API Anthropic + analyses live à la demande (file d'attente, jamais synchrone bloquant)

### Community (COMM)

- **COMM-01**: Profils, follows, commentaires, watchlists partagées
- **COMM-02**: Leaderboard basé sur la calibration/discipline (jamais sur le P&L brut)

### Scale (SCALE)

- **SCALE-01**: Mise à l'échelle multi-utilisateur (cache Upstash Redis, CDN)
- **SCALE-02**: Alertes additionnelles (email/push) sur setups à score élevé

**Portes bloquantes avant d'encaisser le moindre abonnement :** (1) calibration du score prouvée (reliability diagram monotone, Brier mesuré) sur compte démo ; (2) revue juridique conseil en investissement (MiFID II/AMF — vendre des signaux à des tiers est une exposition réglementaire bien plus forte qu'un outil perso) + licences de redistribution des données.

## Out of Scope

| Feature | Reason |
|---------|--------|
| ~~Actions / equities~~ | **Sorti du out-of-scope le 2026-06-12** → STOCK-01/02 (v1.1) |
| Exécution automatique des ordres / copy trading | Outil d'aide à la décision, pas un bot d'exécution — risque financier et légal |
| Promesses de gain / garanties de performance | Risque légal et réputationnel ; contraire à l'honnêteté du produit |
| Leaderboard de P&L brut | Encourage la prise de risque malsaine ; on classe sur calibration/discipline |
| Claude qui calcule les chiffres (indicateurs/R:R/sizing) | Source d'hallucination — tout chiffre est calculé en code déterministe |
| 500+ filtres de screener | Complexité inutile ; la valeur est dans le scoring, pas la profusion de filtres |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| DATA-05 | Phase 1 | Pending |
| JOB-03 | Phase 1 | Pending |
| JOB-04 | Phase 1 | Pending |
| DATA-01 | Phase 2 | Pending |
| DATA-02 | Phase 2 | Pending |
| DATA-03 | Phase 2 | Pending |
| DATA-04 | Phase 2 | Pending |
| DATA-06 | Phase 2 | Pending |
| DATA-07 | Phase 2 | Pending |
| TECH-01 | Phase 3 | Pending |
| TECH-02 | Phase 3 | Pending |
| TECH-03 | Phase 3 | Pending |
| TECH-04 | Phase 3 | Pending |
| FUND-01 | Phase 3 | Pending |
| FUND-02 | Phase 3 | Pending |
| FUND-03 | Phase 3 | Pending |
| SCORE-01 | Phase 4 | Pending |
| SCORE-02 | Phase 4 | Pending |
| SCORE-03 | Phase 4 | Pending |
| SCORE-04 | Phase 4 | Pending |
| SCORE-05 | Phase 4 | Pending |
| JOB-01 | Phase 4 | Pending |
| JOB-02 | Phase 4 | Pending |
| DASH-01 | Phase 5 | Pending |
| DASH-02 | Phase 5 | Pending |
| DASH-03 | Phase 5 | Pending |
| DASH-04 | Phase 5 | Pending |
| LEGAL-01 | Phase 5 | Pending |
| LEGAL-02 | Phase 5 | Pending |
| TRADE-01 | Phase 6 | Pending |
| TRADE-02 | Phase 6 | Pending |
| TRADE-03 | Phase 6 | Pending |
| TRADE-04 | Phase 6 | Pending |
| RISK-01 | Phase 7 | Pending |
| RISK-02 | Phase 7 | Pending |
| RISK-03 | Phase 7 | Pending |
| JRNL-01 | Phase 8 | Pending |
| JRNL-02 | Phase 8 | Pending |
| JRNL-03 | Phase 8 | Pending |
| JRNL-04 | Phase 8 | Pending |
| CAL-01 | Phase 9 | Pending |
| CAL-02 | Phase 9 | Pending |
| CAL-03 | Phase 9 | Pending |

**Coverage:**
- v1 requirements: 44 total
- Mapped to phases: 44 ✓
- Unmapped: 0
- v1.1 requirements (vision élargie): 13 total (DIST×4, MON×3, STOCK×2, PATT×2, RT×2) — à mapper lors de l'extension de roadmap (voir ROADMAP.md « Scope Update »)

---
*Requirements defined: 2026-06-09*
*Last updated: 2026-06-12 — vision élargie v1.1 (abonnement 9 $/mois, Telegram, actions, scalping, patterns mesurés)*
