# Roadmap: Plateforme d'Analyse de Trading "Vétéran"

**Created:** 2026-06-09
**Granularity:** fine (9 phases)
**Mode:** mvp (Vertical MVP)
**Core Value:** Produire, pour chaque opportunité, une analyse fiable et explicable — score /100 + niveau de risque + plan de trade (entrée/SL/TP/R:R) — qui aide à décider avec discipline.

Périmètre : MVP day/swing perso/démo. Les exigences v2 (scalping/temps réel, clé API live, communauté, monétisation) sont reportées en Phase 2 produit et ne figurent PAS dans cette roadmap.

## Phases

- [ ] **Phase 1: Fondations & Sécurité** - Monorepo, Supabase + RLS + auth, conventions temporelles verrouillées, modèle d'exécution des Routines Claude vérifié
- [ ] **Phase 2: Ingestion fiable des données** - Clients data-sources et jobs d'ingestion idempotents (OHLCV, news, macro) tolérants aux pannes
- [ ] **Phase 3: Moteur d'analyse déterministe** - Indicateurs, détection de structure de marché maison et snapshots technique/fondamental/news
- [ ] **Phase 4: Moteur IA "vétéran" & scoring** - Routines Claude planifiées produisant des setups JSON validés par Zod et garde-fous déterministes
- [ ] **Phase 5: Dashboard des opportunités** - Liste triée par score, filtres, temps réel et disclaimers légaux
- [ ] **Phase 6: Détail trade & charting** - Graphique chandeliers avec niveaux SL/TP, décomposition du score et raisonnement
- [ ] **Phase 7: Risque & dimensionnement** - Calculateur de sizing à risque fixe paramétrable avec garde-fous petit capital
- [ ] **Phase 8: Journal & boucle de feedback** - Journal privé RLS, analytics demo/live et évaluation automatique prédiction vs résultat
- [ ] **Phase 9: Backtest & calibration** - Backtest hebdo anti-surajustement et calibration du score par bucket

## Phase Details

### Phase 1: Fondations & Sécurité
**Goal**: Le socle technique est posé — un utilisateur peut s'authentifier, toutes les tables sont protégées par RLS, le service_role est isolé des jobs, et les conventions temporelles + le modèle d'exécution des Routines Claude sont verrouillés avant tout code d'analyse.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, DATA-05, JOB-03, JOB-04
**Success Criteria** (what must be TRUE):
  1. Un utilisateur peut créer un compte, se connecter via Supabase Auth, et sa session persiste entre rechargements.
  2. Toutes les tables ont une RLS active (vérifiable via `get_advisors`) ; les données de marché sont en lecture pour les authentifiés et la clé service_role n'apparaît jamais dans le bundle frontend (lint anti-import).
  3. La convention de bougie clôturée (exclut la bougie en cours), l'UTC et la convention daily cross-asset (OANDA 17:00 NY vs Binance 00:00 UTC) sont documentées et codées comme constantes partagées dans `core`.
  4. Le modèle d'exécution réel des Routines Claude est vérifié et documenté (cloud, quota ~15 runs/j Max, secrets via env de routine, MCP cloud-hosted) ; le fallback Windows Task Scheduler pour les étapes non-IA est posé et chaque exécution écrit une entrée `job_runs`.
**Plans**: TBD
**Research flag**: yes — vérifier la doc officielle des Routines Claude Code (dépendance externe la plus incertaine, confidence MEDIUM)

### Phase 2: Ingestion fiable des données
**Goal**: Le système dispose de données fraîches, normalisées et sans doublons pour tous les instruments MVP — un re-run d'ingestion ne crée jamais de doublon et une source en panne n'interrompt pas les autres.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, DATA-06, DATA-07
**Success Criteria** (what must be TRUE):
  1. Les bougies OHLCV multi-timeframes (H1, H4, Daily) sont ingérées pour la crypto (Binance testnet) et le forex + or + argent + pétrole (OANDA démo), normalisées en UTC.
  2. Les news + sentiment (Finnhub/Marketaux) et les séries macro (FRED : taux, CPI, DXY) sont ingérées et mappées par instrument.
  3. Un re-run d'un job d'ingestion ne crée aucun doublon (upsert idempotent sur clés uniques).
  4. Une source en échec n'interrompt pas les autres et la donnée périmée est marquée `stale` (rate limits gérés par backoff/p-limit).
**Plans**: TBD

### Phase 3: Moteur d'analyse déterministe
**Goal**: À partir des bougies et des données macro/news, le système produit en code déterministe (sans IA) les snapshots technique, fondamental et news que le moteur vétéran consommera — y compris la détection de structure de marché maison.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: TECH-01, TECH-02, TECH-03, TECH-04, FUND-01, FUND-02, FUND-03
**Success Criteria** (what must be TRUE):
  1. Les indicateurs (RSI, MACD, EMA, ATR, Bollinger) sont calculés en code déterministe et vérifiés par des tests golden values.
  2. La structure de marché (HH/HL, swings, BOS/CHoCH) et les niveaux clés (S/R, POC volume avec mesure de force) sont détectés de façon déterministe par un module maison.
  3. Un `technical_snapshot` structuré (tendance HTF/LTF, momentum, volatilité, niveaux, structure) est produit par instrument/style.
  4. Un `fundamental_context` (biais macro, environnement de taux, drivers par actif) et un `news_context` (sentiment net, catalyseurs, events à venir avec flag `news_risk`) sont produits par instrument.
**Plans**: TBD
**Research flag**: yes — détection de structure de marché maison absente des libs (effort sous-estimé) : algos déterministes HH/HL, BOS/CHoCH, swing detection, POC volume

### Phase 4: Moteur IA "vétéran" & scoring
**Goal**: Une routine Claude planifiée raisonne comme un trader vétéran sur les snapshots et produit, par session et en batch, des setups de trade en JSON ; chaque sortie passe la frontière de confiance unique (Zod + garde-fous déterministes) avant d'être persistée de façon immuable et traçable.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: SCORE-01, SCORE-02, SCORE-03, SCORE-04, SCORE-05, JOB-01, JOB-02
**Success Criteria** (what must be TRUE):
  1. Des routines planifiées s'exécutent aux ouvertures de sessions (Asie/Londres/New York) et en clôture daily (EOD swing) en UTC, chaque run traitant une session entière en batch dans le budget de runs Max.
  2. Chaque setup retenu est produit en JSON structuré (direction, entrée, SL, TP multiples, R:R, raisons technique/fondamentale/news, invalidation, note du vétéran) avec une note d'opportunité /100 décomposable et un niveau de risque séparé (low/medium/high/extreme).
  3. Le `scoring-aggregator` valide chaque sortie IA via Zod et applique les garde-fous déterministes (recalcul R:R, cohérence SL/TP, seuil de rejet) ; les sorties non conformes sont rejetées et loggées.
  4. Chaque analyse stocke le `snapshot` exact utilisé et n'est jamais mutée — une nouvelle version remplace, l'ancienne est marquée expired/invalidated.
**Plans**: TBD
**Research flag**: yes — point à plus haut risque : robustesse du prompt vétéran, taux de rejet Zod acceptable, méthode de scoring. À itérer.

### Phase 5: Dashboard des opportunités
**Goal**: L'utilisateur voit, sur un dashboard en lecture seule alimenté par Supabase, les opportunités actives triées par score, peut les filtrer, voit les mises à jour en temps réel, et lit un disclaimer légal explicite.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, LEGAL-01, LEGAL-02
**Success Criteria** (what must be TRUE):
  1. L'utilisateur voit la liste des setups actifs triés par note d'opportunité décroissante, chaque carte affichant actif, direction, score, risque, R:R et fraîcheur de la donnée.
  2. L'utilisateur filtre les opportunités par actif, classe d'actif, style (day/swing) et niveau de risque.
  3. Le dashboard se met à jour en temps réel quand de nouvelles analyses sont produites (Supabase Realtime).
  4. Un disclaimer "contenu éducatif, pas un conseil en investissement" est affiché ; aucune promesse de gain n'apparaît et les scores non calibrés ne sont pas présentés comme des probabilités.
**Plans**: TBD
**UI hint**: yes

### Phase 6: Détail trade & charting
**Goal**: L'utilisateur ouvre le détail d'un trade et comprend pourquoi le vétéran le propose — un graphique en chandeliers avec les niveaux tracés, la décomposition du score, le raisonnement complet et le scénario d'invalidation.
**Mode:** mvp
**Depends on**: Phase 5
**Requirements**: TRADE-01, TRADE-02, TRADE-03, TRADE-04
**Success Criteria** (what must be TRUE):
  1. L'utilisateur ouvre le détail d'un trade avec un graphique en chandeliers (lightweight-charts) sur lequel les niveaux d'entrée, stop-loss et take-profits sont tracés.
  2. Le détail affiche la décomposition du score, les raisons technique/fondamentale/news et la note du vétéran.
  3. Le détail affiche le scénario d'invalidation et les events de risque à venir.
  4. Le disclaimer légal est présent sur la vue détail.
**Plans**: TBD
**UI hint**: yes

### Phase 7: Risque & dimensionnement
**Goal**: L'utilisateur dimensionne ses positions avec discipline — un calculateur à risque fixe paramétrable calcule la taille à partir de la distance au SL et alerte sans jamais arrondir à la hausse, protégeant un capital de 500 $.
**Mode:** mvp
**Depends on**: Phase 6
**Requirements**: RISK-01, RISK-02, RISK-03
**Success Criteria** (what must be TRUE):
  1. L'utilisateur paramètre son capital et son pourcentage de risque par trade (défaut 1 %).
  2. Le système calcule la taille de position à partir de la distance au SL et du risque fixe paramétré.
  3. Le calculateur alerte si la taille calculée passe sous la taille minimale de l'instrument et ne l'arrondit jamais à la hausse.
**Plans**: TBD
**UI hint**: yes

### Phase 8: Journal & boucle de feedback
**Goal**: L'utilisateur enregistre ses trades réels dans un journal strictement privé et voit ses analytics, tandis qu'une évaluation automatique mesure la qualité du modèle indépendamment de son exécution.
**Mode:** mvp
**Depends on**: Phase 7
**Requirements**: JRNL-01, JRNL-02, JRNL-03, JRNL-04
**Success Criteria** (what must be TRUE):
  1. L'utilisateur enregistre ses trades réels (entrée, sortie, SL, taille, type de compte demo/live), liés optionnellement à un setup source.
  2. Le journal est strictement privé par utilisateur (RLS `user_id = auth.uid()`, vérifié par tests RLS cross-user).
  3. Le système calcule les analytics du journal (win rate, expectancy, R moyen, P&L, max drawdown) séparément pour demo et live.
  4. Le job `outcome-eval` rejoue les setups passés depuis leur `snapshot` et enregistre prédiction vs résultat (hit_tp/hit_sl/realized_r), indépendamment de l'exécution utilisateur.
**Plans**: TBD
**UI hint**: yes

### Phase 9: Backtest & calibration
**Goal**: Le système prouve (ou non) son edge avec honnêteté — un backtest hebdomadaire anti-surajustement produit des métriques et une courbe d'équité, et la calibration du score par bucket est affichée prudemment tant que l'échantillon est insuffisant.
**Mode:** mvp
**Depends on**: Phase 8
**Requirements**: CAL-01, CAL-02, CAL-03
**Success Criteria** (what must be TRUE):
  1. Un backtest hebdomadaire rejoue les analyses historiques avec des règles d'exécution fixes et produit des métriques (win rate, expectancy, profit factor, max DD) + courbe d'équité.
  2. Le système calcule la calibration du score (win rate réel par bucket de score) et affiche "calibration en cours, N trades" tant que l'échantillon est insuffisant.
  3. Le backtest applique une méthodologie anti-surajustement (walk-forward, rejeu depuis snapshot, jamais de ré-optimisation rétroactive).
**Plans**: TBD
**Research flag**: yes — calibration du score (méthode isotonic/Platt, échantillon minimal) à définir pendant le planning ; différenciateur central

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Fondations & Sécurité | 0/0 | Not started | - |
| 2. Ingestion fiable des données | 0/0 | Not started | - |
| 3. Moteur d'analyse déterministe | 0/0 | Not started | - |
| 4. Moteur IA "vétéran" & scoring | 0/0 | Not started | - |
| 5. Dashboard des opportunités | 0/0 | Not started | - |
| 6. Détail trade & charting | 0/0 | Not started | - |
| 7. Risque & dimensionnement | 0/0 | Not started | - |
| 8. Journal & boucle de feedback | 0/0 | Not started | - |
| 9. Backtest & calibration | 0/0 | Not started | - |

---
*Roadmap created: 2026-06-09*
*Coverage: 44/44 v1 requirements mapped*
