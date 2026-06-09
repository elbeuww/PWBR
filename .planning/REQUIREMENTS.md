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

## v2 Requirements

Reporté en Phase 2 (après product-market fit perso + bloquants levés). Suivi mais hors roadmap actuelle.

### Real-time / Scalping (RT)

- **RT-01**: Streaming temps réel (websockets OANDA/Binance) et timeframes M1/M5 pour le scalping
- **RT-02**: Moteur d'analyse temps réel (2e writer additif, sans réécrire le batch)

### Live AI (LIVE)

- **LIVE-01**: Clé API Anthropic + analyses live à la demande (file d'attente, jamais synchrone bloquant)

### Community (COMM)

- **COMM-01**: Profils, follows, commentaires, watchlists partagées
- **COMM-02**: Leaderboard basé sur la calibration/discipline (jamais sur le P&L brut)

### Monetization & Scale (MON)

- **MON-01**: Abonnements Stripe (tiers free/pro, quotas d'analyses live)
- **MON-02**: Alertes (email/push/Telegram) sur setups à score élevé
- **MON-03**: Mise à l'échelle multi-utilisateur (cache Upstash Redis, CDN)

**Portes bloquantes avant toute ouverture v2 :** (1) calibration du score prouvée (reliability diagram monotone, Brier mesuré) ; (2) revue juridique MiFID II/AMF + vérification des licences de redistribution des données.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Actions / equities | Hors focus MVP — concentration crypto + forex + métaux + énergie |
| Exécution automatique des ordres / copy trading | Outil d'aide à la décision, pas un bot d'exécution — risque financier et légal |
| Promesses de gain / garanties de performance | Risque légal et réputationnel ; contraire à l'honnêteté du produit |
| Leaderboard de P&L brut | Encourage la prise de risque malsaine ; on classe sur calibration/discipline |
| Claude qui calcule les chiffres (indicateurs/R:R/sizing) | Source d'hallucination — tout chiffre est calculé en code déterministe |
| 500+ filtres de screener | Complexité inutile ; la valeur est dans le scoring, pas la profusion de filtres |

## Traceability

À compléter par le roadmapper (mapping exigence → phase).

**Coverage:**
- v1 requirements: 44 total
- Mapped to phases: 0 (en attente de la roadmap)
- Unmapped: 44 ⚠️

---
*Requirements defined: 2026-06-09*
*Last updated: 2026-06-09 after initial definition*
