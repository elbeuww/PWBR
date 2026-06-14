# Feature Research

**Domain:** Plateforme d'analyse / aide à la décision de trading (scoring /100, technique + fondamental + news, plan de trade, journal, backtest) — crypto + forex + or/argent/pétrole, day + swing
**Researched:** 2026-06-09
**Confidence:** MEDIUM-HIGH (features concurrents = HIGH via docs produits ; mapping MVP/complexité = MEDIUM, opinionné à partir de l'architecture du projet)

---

## Synthèse exécutive

Le marché se segmente en quatre familles de produits, et aucune ne fait tout :

1. **Charting + screener + alertes** (TradingView, Finviz) — la couche "voir le marché". Table stakes universel.
2. **Scanners IA / générateurs de signaux** (Trade Ideas/Holly, TrendSpider) — "dis-moi quoi regarder", avec entrée/SL/TP. C'est le cœur de notre produit, mais les concurrents sont US-equities only → notre niche multi-actifs (crypto/FX/métaux/énergie) est ouverte.
3. **Journaux de trading + analytics** (Edgewonk, TraderSync) — "mesure ma performance et ma discipline". Edgewonk a lancé "Edge Finder AI" (analyse hebdo planifiée par email) en janvier 2026 — exactement le pattern de notre routine Claude Max.
4. **Social / copy trading** (eToro-likes, Brokeree) — "suis les autres". Phase 2 chez nous, et plusieurs sous-features sont des **anti-features** (copy trading auto).

**Le différenciateur central du projet** n'est pas une feature isolée mais la **combinaison** : score /100 explicable + risque séparé + plan de trade complet + boucle de calibration (prédiction vs résultat) sur des **actifs que les leaders IA ne couvrent pas**. Aucun concurrent ne lie publiquement la calibration du score à la qualité des futures recommandations. C'est l'angle défendable.

**Avertissement table stakes implicite :** sur ce marché, un produit sans charting crédible, sans niveaux SL/TP, ou sans disclaimer légal est perçu comme cassé ou louche. La barre "ça a l'air sérieux" est haute.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Sans ça, l'utilisateur (même solo au départ, a fortiori la communauté) considère le produit incomplet ou peu fiable.

| Feature | Why Expected | Complexity | Notes (Phase) |
|---------|--------------|------------|-------|
| Dashboard d'opportunités trié par score | Raison d'être du produit : "qu'est-ce qui vaut le coup maintenant ?" | MEDIUM | **MVP**. Lecture Supabase `trade_setups` triés `opportunity_score desc`. Déjà dans l'archi (§2 dashboard). |
| Filtres dashboard (actif, classe, style, risque) | Day vs swing, crypto vs FX = besoins différents ; sans filtre, bruit | LOW | **MVP**. Filtrage SQL/client sur colonnes existantes. |
| Détail d'un trade : chart + niveaux SL/TP tracés | On ne fait pas confiance à un score sans voir le setup sur le graphe | MEDIUM | **MVP**. lightweight-charts + overlays entry/SL/TP. Cœur de la "Core Value". |
| Raisonnement explicite (technique/fondamental/news + invalidation) | Un score nu = boîte noire = abandon. L'explicabilité EST le produit | MEDIUM | **MVP**. Rendu du JSON §3 (technical_reasons, fundamental_reasons, news_catalysts, invalidation, veteran_note). |
| Charting interactif multi-timeframe (H1/H4/D) | Standard absolu (TradingView a fixé l'attente) ; changer de TF est réflexe | MEDIUM | **MVP** (lecture). lightweight-charts depuis `candles`. Pas besoin d'outils de dessin en MVP. |
| Indicateurs techniques visibles (RSI, MACD, EMA, ATR, Bollinger) | Un trader intermédiaire veut vérifier le raisonnement de l'IA | MEDIUM | **MVP**. Déjà calculés (déterministe) dans `technical_snapshot` — les afficher. |
| Niveaux clés / S-R sur le chart | Le "où" du trade ; attendu de tout outil d'analyse | MEDIUM | **MVP**. `key_levels` du snapshot → lignes horizontales. |
| Calculateur de taille de position / risque | Standard universel (Myfxbook, BabyPips) ; sans ça, sizing à la main = erreurs | LOW | **MVP**. Déterministe : risque$ / (distance SL × valeur pip). Risque fixe 1-2 %. Déjà spécifié §6. |
| Ratio R:R affiché par setup | Métrique #1 du risk management ; minimum 1:1.5–1:2 attendu | LOW | **MVP**. Déjà dans le JSON (`risk_reward`, par TP). |
| Journal de trading (log manuel des trades pris) | Sans journal, pas d'amélioration ; attente forte (Edgewonk/TraderSync) | MEDIUM | **MVP**. Table `journal`, RLS stricte `user_id=auth.uid()`. demo/live. |
| Analytics de performance (win rate, expectancy, R moyen, P&L) | Le "pourquoi" d'un journal ; chiffres bruts attendus | MEDIUM | **MVP**. Agrégation sur `journal` + `prediction_outcomes`. recharts. |
| Calendrier économique / events à venir | Trader FX/or sait que les news bougent le marché ; absence = amateur | MEDIUM | **MVP partiel**. `upcoming_risk_events` déjà dans le JSON + flag `news_risk`. Vue calendrier dédiée = v1.x. |
| Feed de news + sentiment par actif | Contexte indispensable ; intégré chez tous les leaders | MEDIUM | **MVP**. `news` ingéré + affiché sur le détail trade. |
| Watchlist personnelle | Pattern de base (screen → watchlist → alertes) ancré par TradingView | LOW | **v1.x**. Liste d'instruments suivis. Pas bloquant en solo MVP (peu d'actifs). |
| Authentification + données privées | Journal = données sensibles ; RLS obligatoire | LOW | **MVP** (Phase 0). Supabase Auth + RLS, déjà prévu. |
| Disclaimers "éducatif, pas un conseil" | Légal + crédibilité ; non négociable sur du financier | LOW | **MVP**. Déjà requirement explicite (PROJECT.md). |
| Historique / traçabilité des analyses passées | Confiance : "qu'avait dit le système et qu'est-il arrivé ?" | LOW | **MVP**. `analyses` immuables + `snapshot` stocké. Affichage liste. |

### Differentiators (Competitive Advantage)

Là où on gagne. À aligner sur la Core Value : analyse fiable, explicable, calibrée, sur des actifs mal servis par l'IA concurrente.

| Feature | Value Proposition | Complexity | Notes (Phase) |
|---------|-------------------|------------|-------|
| **Score /100 multi-facteur explicable** (confluence pondérée) | Vs signaux boîte-noire (Holly) : on montre la pondération (tendance/niveau/momentum/macro/news/R:R). Trader intermédiaire adore comprendre | MEDIUM | **MVP**. Déjà conçu (§3 pondération day/swing). Le rendu de la décomposition du score = fort différenciateur. |
| **Score de RISQUE séparé du score d'opportunité** | La plupart des outils mélangent ; séparer "bon setup" vs "dangereux maintenant" est rare et pro | LOW | **MVP**. `risk_level` dérivé (ATR, volatilité, news, session). Déjà spécifié. |
| **Plan de trade complet par setup** (entrée/zone, SL, TP multiples + alloc, invalidation) | Trade Ideas le fait sur US equities ; personne ne le fait bien sur crypto+FX+métaux+énergie ensemble | MEDIUM | **MVP**. JSON §3 déjà structuré (TP multiples avec alloc_pct + rr). |
| **Boucle de calibration du modèle** (win rate par bucket de score) | LE différenciateur défendable : "quand le système dit 80, ça gagne X% du temps". Aucun concurrent ne l'expose | HIGH | **MVP (partiel) → v1.x**. `prediction_outcomes` + `outcome-eval`. Mesure le MODÈLE indépendamment de l'exécution user. Tableau de calibration. |
| **Persona "trader vétéran 50 ans" + note narrative** | Différencie le ton : confluence + discipline + "je ne chasse pas". Voix mémorable vs métriques froides | MEDIUM | **MVP**. `veteran_note` dans le JSON. Coût quasi nul (déjà généré). |
| **Couverture multi-actifs unifiée** (crypto + FX + or/argent + WTI/Brent) | Trade Ideas/Holly = US stocks only ; Finviz couvre mais sans signaux IA. Notre niche : signaux IA sur ces actifs | MEDIUM | **MVP**. Cœur du choix produit. Adapté au capital 500 $ + 24/7 crypto. |
| **Backtest / replay des analyses passées** (walk-forward, out-of-sample) | TraderSync a le replay ; nous rejouons NOS analyses → valide le moteur, pas juste les trades user | HIGH | **MVP (basique) → v1.x (riche)**. `weekly-backtest` + viewer equity curve. Anti-surajustement déjà pensé (§6). |
| **Routine planifiée par session de marché** (Asie/Londres/NY + EOD) | Pattern "Edge Finder AI" d'Edgewonk (hebdo) mais appliqué à la génération d'opportunités, par session | MEDIUM | **MVP**. Scheduled agents Claude Max, coût zéro (pas de clé API). Avantage structurel unique du setup. |
| Écart modèle vs exécution (slippage, discipline) | Sépare "le système avait raison" de "j'ai mal exécuté" — rare et pédagogique | MEDIUM | **v1.x**. Compare `prediction_outcomes` (modèle) vs `journal` (réel). |
| Tracking de discipline / adhérence au plan | Edgewonk en a fait son ADN ; renforce la "discipline" de la Core Value | MEDIUM | **v1.x**. Champs notes/règles sur `journal`. |
| Alertes (prix touche zone d'entrée, nouveau setup score élevé) | Attendu chez TradingView, mais à fort ROI ici | MEDIUM | **v1.x / Phase 2**. Supabase Realtime (in-app) en v1.x ; email/push/Telegram en Phase 2 (déjà rangé Phase 2). |

### Anti-Features (Commonly Requested, Often Problematic)

Tentantes mais nuisibles — documentées pour bloquer le scope creep.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Copy trading / exécution auto des trades** | "Laisse le système trader pour moi" | Hors mission (aide à la décision ≠ bot) ; risque légal énorme ; perte d'apprentissage ; un drawdown = compte vidé. Déjà Out of Scope (PROJECT.md) | Plan de trade explicite + sizing → l'utilisateur exécute et apprend |
| **Promesses de gain / "signaux gagnants garantis"** | Marketing facile, attire les débutants | Illégal/trompeur ; détruit la crédibilité ; responsabilité | Calibration honnête ("80 = gagne X% historiquement") + disclaimers |
| **Leaderboard de P&L brut en Phase communauté** | "Voir les meilleurs traders" | Stats manipulables/gonflées ; pousse au high-risk ; sélection aveugle = désastre (recherche social trading) | Classement par calibration/R-multiple/discipline, pas par P&L brut ; transparence du risque |
| **Temps réel / scalping M1 + websockets en MVP** | "Je veux des signaux à la seconde" | Infra streaming lourde, coûts, rate limits ; pas adapté au forfait Max planifié. Déjà Phase 2 | Sessions planifiées H1/H4/D (day+swing) couvrent 95 % du besoin au départ |
| **Centaines d'indicateurs / 500+ filtres (à la Trade Ideas)** | "Plus de filtres = plus puissant" | Paralysie, bruit, dette de maintenance ; contredit la confluence pondérée | Set restreint pertinent (RSI/MACD/EMA/ATR/BB/structure/S-R) + score qui synthétise |
| **Analyses live à la demande (clé API Anthropic) en Phase 1** | "Analyse ce trade maintenant" | Coût par token, casse le modèle "coût zéro" du forfait Max. Déjà Phase 2 | Routines planifiées par session ; live à la demande en Phase 2 |
| **Couverture actions / equities** | "Ajoute les actions" | Sources payantes, dilue le focus, mal adapté à 500 $. Déjà Out of Scope | Rester crypto+FX+métaux+énergie (niche défendable, sources gratuites) |
| **Claude calcule les indicateurs / les chiffres** | "Laisse l'IA tout faire" | Hallucination de chiffres, coût tokens. Principe archi violé | Indicateurs en code déterministe ; Claude raisonne seulement (déjà §2/§9) |
| **DMs / chat temps réel communauté** | "Les traders veulent discuter" | Modération, spam, pump groups, charge légale | Commentaires sur setups + partage de watchlists (Phase 2, modéré) |

---

## Feature Dependencies

```
Ingestion candles/news/macro (Phase 0)
    └──requires──> rien (clients data-sources)
            │
            ▼
technical/fundamental/news engines (snapshot déterministe)
    └──requires──> Ingestion
            │
            ▼
veteran-analyzer (Claude) + scoring-aggregator (Zod/garde-fous)
    └──requires──> snapshots
            │
            ├──> trade_setups ──> Dashboard opportunités (tri/filtres)
            │                          └──> Détail trade (chart + SL/TP + raisons)
            │                                   └──requires──> candles + key_levels
            │
            └──> analyses (immuables, traçabilité)

Journal (trades user)
    └──enhances/requires──> trade_setups (lien optionnel setup→trade pris)
            └──> Analytics performance (win rate, expectancy, R)

prediction_outcomes (outcome-eval rejoue candles)
    └──requires──> trade_setups + candles
            └──> Calibration du score (win rate par bucket)  [LE différenciateur]
                    └──enhances──> pondération du moteur (feedback)

Backtest (weekly)
    └──requires──> analyses + candles

Calculateur de sizing
    └──requires──> risk_level + distance SL (depuis setup)  [autonome sinon]

Alertes
    └──requires──> trade_setups + Realtime (in-app) ; push/Telegram = Phase 2

Communauté (profils/follows/commentaires/watchlists partagées)  [Phase 2]
    └──requires──> Auth + analytics fiables + calibration prouvée
    └──conflicts──> Leaderboard P&L brut (anti-feature)
```

### Dependency Notes

- **Tout dépend de l'ingestion + des snapshots déterministes** : c'est la fondation (Phase 0). Aucun scoring fiable sans candles propres multi-TF.
- **Calibration requiert prediction_outcomes qui requiert trade_setups + candles historiques** : la calibration n'a de valeur qu'après plusieurs semaines de setups + outcomes. → Infrastructure en MVP, tableau de calibration significatif en v1.x.
- **Détail trade requiert key_levels + candles** : le chart sans niveaux = demi-feature.
- **Communauté requiert une calibration PROUVÉE avant ouverture** : partager des setups non validés = risque réputationnel/légal. Ne pas ouvrir la communauté avant que les métriques soient crédibles.
- **Leaderboard P&L conflicte avec la mission** : si communauté il y a, classer par qualité de calibration/discipline, jamais par gains bruts.
- **Sizing calculator est quasi autonome** : peut être livré tôt, dépend juste de la distance SL.

---

## MVP Definition

### Launch With (v1) — Phase 1 : Day/Swing, perso, démo

Minimum pour valider la Core Value : "produire une analyse fiable et explicable par trade".

- [ ] **Ingestion OHLCV multi-TF + news + macro** — fondation, rien ne marche sans (Phase 0)
- [ ] **Moteurs déterministes** (technical/fundamental/news snapshot) — entrée du raisonnement
- [ ] **veteran-analyzer + scoring-aggregator (Zod + garde-fous)** — produit le score/risque/plan
- [ ] **Dashboard opportunités trié par score + filtres** (actif/classe/style/risque) — la vue d'entrée
- [ ] **Détail trade** : chart lightweight-charts + SL/TP/zone + indicateurs + raisonnement + veteran_note — le cœur explicable
- [ ] **Score /100 décomposé + risque séparé + R:R** — le différenciateur lisible
- [ ] **Calculateur de sizing** (risque fixe 1-2 %) — risk management de base
- [ ] **Journal de trading** (demo/live, RLS stricte) + **analytics** (win rate, expectancy, R, P&L)
- [ ] **outcome-eval + infrastructure de calibration** (`prediction_outcomes`) — même si le tableau de calibration mûrit ensuite
- [ ] **Backtest hebdo basique** + equity curve — valide le moteur
- [ ] **Feed news + sentiment + events à venir** (flag news_risk)
- [ ] **Auth + RLS + disclaimers + traçabilité des analyses**
- [ ] **Realtime in-app** (nouvelles analyses apparaissent)

### Add After Validation (v1.x)

À ajouter une fois le solo loop éprouvé (quelques semaines de données).

- [ ] **Tableau de calibration riche** (win rate par bucket de score, par actif/session/style) — trigger : assez d'outcomes accumulés
- [ ] **Écart modèle vs exécution** — trigger : journal suffisamment rempli
- [ ] **Vue calendrier économique dédiée** — trigger : besoin de planifier autour des events
- [ ] **Watchlist personnelle** — trigger : nombre d'instruments suivis augmente
- [ ] **Alertes in-app** (zone d'entrée touchée, nouveau setup haut score) — trigger : trop de setups à surveiller manuellement
- [ ] **Tracking discipline / adhérence au plan** — trigger : besoin d'améliorer l'exécution
- [ ] **Backtest riche** (paramétrable, walk-forward visible) — trigger : confiance dans le moteur à approfondir

### Future Consideration (v2+) — Phase 2

Différer jusqu'au product-market fit perso et à une calibration prouvée.

- [ ] **Communauté** (profils, follows, commentaires sur setups, watchlists partagées) — défer : nécessite calibration crédible + modération
- [ ] **Leaderboard par calibration/discipline** (PAS P&L brut) — défer : dépend de la communauté
- [ ] **Alertes push/email/Telegram** — défer : infra notifications externe
- [ ] **Scalping M1 / streaming websockets** — défer : infra temps réel lourde
- [ ] **Analyses live à la demande (clé API Anthropic)** — défer : coût par token, casse le modèle coût-zéro
- [ ] **Monétisation Stripe (tiers free/pro)** — défer : nécessite valeur prouvée + communauté
- [ ] **Scale (Upstash Redis, CDN)** — défer : seulement sous charge réelle

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Dashboard opportunités + tri score | HIGH | MEDIUM | P1 |
| Détail trade (chart + SL/TP + raisons) | HIGH | MEDIUM | P1 |
| Score /100 décomposé + risque séparé | HIGH | MEDIUM | P1 |
| Plan de trade complet (entrée/SL/TP/R:R) | HIGH | MEDIUM | P1 |
| Calculateur de sizing | HIGH | LOW | P1 |
| Journal + analytics performance | HIGH | MEDIUM | P1 |
| outcome-eval (infra calibration) | HIGH | MEDIUM | P1 |
| Feed news + sentiment + events | MEDIUM | MEDIUM | P1 |
| Disclaimers + Auth + RLS + traçabilité | HIGH | LOW | P1 |
| Backtest hebdo basique | MEDIUM | HIGH | P1/P2 |
| Tableau de calibration riche | HIGH | MEDIUM | P2 |
| Alertes in-app | MEDIUM | MEDIUM | P2 |
| Watchlist personnelle | MEDIUM | LOW | P2 |
| Vue calendrier économique | MEDIUM | MEDIUM | P2 |
| Écart modèle vs exécution | MEDIUM | MEDIUM | P2 |
| Communauté (profils/follows/commentaires) | MEDIUM | HIGH | P3 |
| Alertes push/Telegram | MEDIUM | MEDIUM | P3 |
| Monétisation Stripe | LOW (au départ) | MEDIUM | P3 |
| Scalping / streaming temps réel | LOW (MVP) | HIGH | P3 |

**Priority key:** P1 = obligatoire au lancement (MVP Phase 1) · P2 = à ajouter dès que possible (v1.x) · P3 = futur / Phase 2

---

## Competitor Feature Analysis

| Feature | TradingView | Trade Ideas (Holly) | Finviz | Edgewonk / TraderSync | Notre approche |
|---------|-------------|---------------------|--------|----------------------|----------------|
| Charting multi-TF | Référence du marché, outils de dessin riches | Bon, secondaire | Basique | N/A (journal) | lightweight-charts (OSS TradingView) + niveaux du snapshot ; lecture, pas d'édition lourde en MVP |
| Screener / scanner | Manuel, dizaines de filtres | IA temps réel (US equities only) | Multi-actif (crypto/FX/futures) mais sans signaux IA | N/A | **Scanner IA multi-actifs crypto+FX+métaux+énergie** — niche non servie |
| Signaux entrée/SL/TP | Via stratégies user | Holly : entrée/SL/TP matin (US stocks) | Non | Non | **Plan de trade complet par setup, multi-actifs, explicable** |
| Scoring d'opportunité | Non (filtres) | Score de stratégie sur historique | Non | Non | **Score /100 confluence pondérée + risque séparé** |
| Alertes | Très complètes (5 conditions combinées) | Oui | Élite | Non | In-app (Realtime) en v1.x, push/Telegram en Phase 2 |
| Journal + analytics | Limité | Limité | Non | **Cœur de métier** (discipline, exit analysis, AI hebdo) | Journal + analytics + **calibration du modèle** (au-delà du journal) |
| IA planifiée hebdo | Non | Holly tourne la nuit | Non | **Edge Finder AI (hebdo, email), lancé jan 2026** | Routines Claude Max **par session**, coût zéro, génération d'opportunités |
| Backtest | Pine strategies | OddsMaker | Non | TraderSync : replay/backtest | Backtest walk-forward de **nos analyses** (valide le moteur) |
| Couverture marchés | Tous | **US equities only** | Crypto/FX/futures/stocks | Tous (import broker) | crypto + FX + or/argent + WTI/Brent (pas d'actions) |
| Calibration score vs résultat | Non | Backtest de stratégie | Non | Patterns hebdo | **win rate par bucket de score** — différenciateur défendable |

---

## Sources

- TradingView — Features / Screener / Watchlists / Alerts: https://www.tradingview.com/features/ , https://www.tradingview.com/support/solutions/43000718885-tradingview-screeners-walkthrough/ , https://www.tradingview.com/support/solutions/43000520149-introduction-to-tradingview-alerts/ (HIGH)
- Trade Ideas — Features / AI Signals (Holly): https://www.trade-ideas.com/features/ , https://www.trade-ideas.com/ai-signals/ (HIGH ; limite US equities confirmée)
- Trade Ideas vs Finviz (couverture multi-actifs Finviz): https://www.liberatedstocktrader.com/trade-ideas-vs-finviz/ , https://finviz.com/ (MEDIUM)
- Edgewonk — Features + Edge Finder AI (hebdo, jan 2026): https://edgewonk.com/features , https://www.luxalgo.com/blog/edgewonk-journal-tool-analysis/ (HIGH)
- TraderSync — broker import, replay, AI Cypher: https://tradersync.com/edgewonk-alternative-better-trade-journal/ (MEDIUM)
- Edgewonk vs TraderSync: https://tradingjournal.com/blog/edgewonk-vs-tradersync (MEDIUM)
- Position size / risk management standards (1-3 %, R:R 1:1.5–1:2): https://www.myfxbook.com/forex-calculators/position-size , https://www.babypips.com/tools/position-size-calculator (HIGH)
- Social / copy trading features + risques (manipulation stats, drawdown copié, perte d'apprentissage): https://www.benzinga.com/money/best-social-trading-platforms , https://www.forexbrokers.com/guides/social-copy-trading (MEDIUM)
- Contexte projet: `.planning/PROJECT.md` + `ARCHITECTURE.md` (HIGH — source de vérité interne)

---
*Feature research for: plateforme d'analyse de trading (scoring/100, technique+fondamental+news, journal, backtest) — crypto/FX/métaux/énergie, day+swing*
*Researched: 2026-06-09*
