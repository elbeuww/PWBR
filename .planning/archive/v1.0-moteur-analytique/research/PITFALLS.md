# Pitfalls Research

**Domain:** Plateforme d'analyse de trading (scoring IA, données marché, backtest, petit capital, communauté)
**Researched:** 2026-06-09
**Confidence:** HIGH (biais de backtest, sessions/UTC, calibration : sources et littérature quant établies ; sécurité Supabase : docs officielles ; légal : MEDIUM, à valider juridiquement)

> Mapping vers la roadmap technique de `ARCHITECTURE.md` §7 : **Phase 0** (Fondations), **Phase 1** (MVP Day/Swing démo), **Phase 2** (scalping + communauté + API + monétisation).

---

## Critical Pitfalls

### Pitfall 1: Look-ahead bias (fuite du futur) dans l'analyse ET le backtest

**What goes wrong:**
L'analyse ou le backtest utilise une information non disponible au moment T de la décision. Exemples concrets ici :
- La routine `session-london` lit une candle H1 dont `ts` correspond à la bougie **en cours, pas encore clôturée** → l'indicateur "voit" la clôture future.
- `outcome-eval` / `weekly-backtest` rejoue une `analysis` créée à T mais lit des candles dont le `ts` est ≤ T+window au lieu de strictement après l'entrée, ou utilise le high/low de la **bougie d'entrée elle-même** pour décider TP/SL (on ne sait pas dans quel ordre le high et le low ont été touchés intra-bougie).
- News mappée à un instrument avec `published_at` antérieur mais ingérée/horodatée plus tard → le snapshot de T inclut un catalyseur "connu après coup".

**Why it happens:**
Les API renvoient la bougie courante incomplète par défaut. Les jointures temporelles "candles WHERE ts <= setup_ts" semblent correctes mais incluent la bougie partielle. Le rejoueur de backtest est écrit après coup sans rejouer l'état exact.

**How to avoid:**
- Indicateurs calculés **uniquement sur bougies clôturées** : `technical-engine` exclut systématiquement la dernière bougie si `now < ts + tf_duration`. Règle dure dans `technicalindicators` wrapper.
- `analyses.snapshot` (jsonb) stocke l'**état exact** utilisé (déjà prévu en architecture — exploiter pour rejouer à l'identique, jamais recalculer depuis les candles actuelles).
- Backtest TP/SL : pour la bougie d'entrée et chaque bougie suivante, appliquer une **convention pessimiste** documentée (si SL et TP touchés dans la même bougie → compter SL touché en premier). Jamais utiliser close pour détecter un hit intra-bougie.
- News : filtrer sur `published_at <= setup_ts`, jamais sur `created_at`/ingest time.

**Warning signs:**
- Win rate backtest > 65 % sur day-trading, expectancy "trop belle".
- Calibration parfaite (score 80 → win rate 80 %) dès les premiers échantillons.
- Résultats qui se dégradent fortement en live/démo vs backtest.

**Phase to address:** **Phase 1** (technical-engine, outcome-eval, weekly-backtest). Convention de clôture de bougie posée en **Phase 0** dans `packages/indicators`.

---

### Pitfall 2: Sur-ajustement (overfitting) du scoring et des poids

**What goes wrong:**
Les poids de scoring (`ARCHITECTURE.md` §3 : tendance 25/30, niveau 20, momentum 15/10…) et les seuils (R:R<1.2 rejet, cap à 45, etc.) sont ajustés a posteriori pour "bien noter" les trades qui ont historiquement gagné. Le modèle apprend le bruit du petit échantillon, pas un edge réel. >90 % des stratégies académiques échouent en réel pour cette raison.

**Why it happens:**
Tentation forte avec peu de données : on voit 30 trades, 3 perdants ont un score moyen, on baisse un poids pour les "expliquer". Boucle d'apprentissage mal disciplinée = ré-optimisation continue sur le même set.

**How to avoid:**
- **Walk-forward + out-of-sample strict** (déjà prévu §6) : figer les poids sur une période, valider sur la suivante jamais vue. Versionner les poids (`scoring_version`) et ne jamais ré-noter rétroactivement.
- Garder peu de paramètres (les 6 blocs + pénalités, pas 40 sous-règles).
- Mesurer la **calibration par bucket de score** (voir Pitfall 3) comme métrique de vérité, pas le win rate global.
- Période démo prolongée = out-of-sample naturel. Ne pas toucher aux poids pendant qu'on accumule l'échantillon.

**Warning signs:**
- Chaque semaine de backtest entraîne un ajustement de poids.
- Performance in-sample >> out-of-sample.
- Nombre de règles/exceptions qui grossit.

**Phase to address:** **Phase 1** (scoring-aggregator + weekly-backtest). Discipline anti-ré-optimisation à inscrire dans les critères de succès de phase.

---

### Pitfall 3: Scores IA non calibrés (un score /100 qui ne veut rien dire)

**What goes wrong:**
Le score d'opportunité /100 est traité comme une probabilité ou une confiance, mais rien ne garantit qu'un setup à 80 gagne plus souvent qu'un setup à 60. Sans calibration, le tri par score du dashboard est cosmétique. L'utilisateur (et la communauté en P2) sur-pondère les hauts scores qui ne délivrent pas.

**Why it happens:**
Le score sort d'une pondération arbitraire de confluences + raisonnement Claude. Aucune boucle ne vérifie que la distribution des scores correspond aux résultats réels. Claude peut aussi être systématiquement optimiste (biais de complaisance du "vétéran").

**How to avoid:**
- **Reliability diagram + Brier score** dans la page métriques : bucket les scores (0-20, 20-40… ou déciles), tracer win rate réalisé par bucket vs score. Doit être monotone croissant.
- Ne pas présenter le score comme une probabilité tant que la calibration n'est pas mesurée (échantillon insuffisant → afficher "calibration en cours, N trades").
- Séparer strictement **score d'opportunité** et **score de risque** (déjà fait en archi) — ne pas les fusionner.
- Re-calibrer via une fonction monotone (isotonic/Platt) seulement après échantillon suffisant, en out-of-sample.

**Warning signs:**
- Reliability diagram plat ou non monotone (score 90 perd autant que score 50).
- Brier score qui ne s'améliore pas.
- Concentration de tous les setups dans une bande étroite de scores (ex : tout entre 70 et 85 → pas de pouvoir discriminant).

**Phase to address:** **Phase 1** (page métriques + prediction_outcomes). Bloquant avant ouverture communauté en **Phase 2** (sinon on diffuse des scores trompeurs).

---

### Pitfall 4: Hallucination de chiffres par Claude (indicateurs, prix, niveaux)

**What goes wrong:**
Claude invente une valeur RSI, un prix de support, un niveau ATR, ou "arrondit" un SL/TP de façon incohérente avec les candles réelles. Un seul chiffre inventé dans un plan de trade = perte réelle.

**Why it happens:**
LLM génère du plausible, pas du calculé. Si on lui demande de calculer un indicateur ou de lire un prix "de tête", il hallucine. Risque amplifié par le persona "vétéran 50 ans" qui produit un texte assuré.

**How to avoid:**
- **Déjà central en archi** : tous les chiffres (indicateurs, R:R, ATR distance, sizing) calculés en **code déterministe**, Claude ne fait que le raisonnement/synthèse à partir du `technical_snapshot`.
- `scoring-aggregator` : garde-fous déterministes **post-IA** — recalculer R:R depuis entry/SL/TP fournis et **clamp/rejeter** si l'IA renvoie un R:R incohérent ; vérifier que entry/SL/TP sont dans des bornes plausibles vs prix courant et ATR ; vérifier cohérence directionnelle (long → SL < entry < TP).
- Validation **Zod stricte** + rejet+log de tout JSON non conforme (déjà prévu).
- Les `technical_reasons` qui citent un chiffre doivent référencer le snapshot (`raw_indicators_ref`) — audit possible.

**Warning signs:**
- R:R du payload ≠ R:R recalculé depuis les prix.
- Prix d'entrée hors range de la dernière candle.
- SL/TP du mauvais côté de l'entrée vs direction.
- Taux de rejet Zod élevé dans `job_runs`.

**Phase to address:** **Phase 1** (scoring-aggregator). Séparation déterministe/IA posée en **Phase 0** (`packages/indicators`, `packages/core` Zod).

---

### Pitfall 5: Désalignement UTC / sessions / weekend gap forex

**What goes wrong:**
Mélange de fuseaux entre sources → candles mal alignées, indicateurs faux, "bougies daily" qui ne correspondent pas. Spécifiquement :
- OANDA aligne le daily sur **17:00 NY (close)** par défaut, pas sur 00:00 UTC ; Binance crypto sur **00:00 UTC**. Empiler les deux sans normaliser = daily incohérents.
- Le DST décale les sessions de Londres/NY d'une heure vs UTC deux fois par an → cron en heure locale = jobs qui dérivent.
- **Gap de weekend forex** : marché ferme vendredi ~22:00 UTC, rouvre dimanche ~22:00 UTC. Un SL "garanti" ne l'est pas sur gap ; le backtest qui ignore les gaps surestime la fiabilité des stops.

**Why it happens:**
Chaque broker a sa convention de close daily et son server time. UTC semble simple mais les API renvoient des conventions différentes. Le gap weekend n'apparaît pas si on rejoue des candles continues sans modéliser la fermeture.

**How to avoid:**
- **Tout en UTC** côté stockage (déjà convention archi). `market-ingest` normalise explicitement le fuseau de chaque source vers UTC, avec **date-fns-tz/luxon** ; documenter la convention de daily retenue (recommandé : daily = 00:00 UTC pour cohérence cross-asset, ou expliciter et assumer 17:00 NY pour le FX si on suit OANDA — **choisir une seule convention et la verrouiller**).
- **Cron en UTC** (déjà fait §5) — ne jamais utiliser l'heure locale de la machine Windows.
- Modéliser le **gap weekend** dans le backtest : entre vendredi close et dimanche open, le prix peut sauter le SL → compter l'exécution au prix d'ouverture du dimanche, pas au SL. Flag `weekend_risk` sur les swings tenus le vendredi.
- Garde-fou : refuser/flag une analyse si la dernière candle est trop ancienne par rapport à `now` (déjà prévu, flag `stale`).

**Warning signs:**
- Daily candles décalées vs TradingView/charting de référence.
- Indicateurs (EMA200, structure HH/HL) qui divergent de la lecture manuelle.
- Backtest avec des stops "toujours respectés" même sur news/weekend.
- Jobs qui se déclenchent à la mauvaise heure après changement DST.

**Phase to address:** **Phase 0** (normalisation UTC dans `market-ingest` + clients data-sources). Modélisation gap : **Phase 1** (backtest).

---

### Pitfall 6: Écart démo-vs-réel (slippage, spread, psychologie) — la fausse confiance

**What goes wrong:**
Le compte démo remplit aux prix idéaux (pas de slippage, spread serré, exécution instantanée). Le journal démo affiche d'excellentes métriques. Au passage en réel avec 500 $ : slippage sur les stops, spread élargi sur news, et surtout effondrement de la discipline psychologique (un perdant à -5 $ "fait mal" différemment d'un perdant démo). L'edge mesuré en démo disparaît.

**Why it happens:**
La démo est faite pour donner confiance, pas pour simuler la friction. Le journal ne distingue pas la qualité de **prédiction du modèle** (prediction_outcomes) de la qualité d'**exécution** (slippage, timing réel) — déjà bien séparé en archi, mais facile à confondre dans l'UI.

**How to avoid:**
- **Séparation déjà en archi** : `prediction_outcomes` = perf du modèle (objectif, rejoue candles) ; `journal` = exécution réelle de l'user (slippage/discipline). Garder cette distinction **visible dans l'UI** et dans les métriques.
- Journal : champ `account_type (demo|live)` obligatoire (déjà prévu) ; afficher les métriques **séparées demo vs live**, jamais agrégées.
- Backtest/outcome-eval : intégrer un **coût de friction** (spread typique par instrument + slippage estimé sur les stops) plutôt que des fills parfaits. Sinon l'expectancy est surévaluée.
- Critère de transition démo→réel **explicite et chiffré** (ex : N trades démo, expectancy positive nette de frais sur out-of-sample, calibration mesurée) — pas "je me sens prêt".

**Warning signs:**
- Métriques démo excellentes, jamais validées net de frais.
- Pas de champ spread/slippage dans le calcul d'expectancy.
- Métriques demo et live mélangées dans un seul chiffre.
- Win rate live nettement < win rate prediction_outcomes pour les mêmes setups.

**Phase to address:** **Phase 1** (journal + sizing + outcome-eval avec coûts de friction). Critère démo→réel = critère de succès de fin de Phase 1.

---

### Pitfall 7: Gestion du risque sur petit capital (sur-levier, sizing, frais)

**What goes wrong:**
Sur 500 $, les frais et le spread pèsent proportionnellement énormément. Erreurs classiques :
- Risquer plus que 1-2 % par trade pour "que ça vaille le coup" → ruine en quelques pertes.
- Sizing impossible : risque 1 % = 5 $, mais avec un SL de 30 pips sur l'or et la taille minimale du broker, la position minimale risque déjà bien plus que 5 $ → on ne peut pas respecter le risque fixe.
- Ignorer la **valeur du pip** réelle par instrument et le `min_size` → calcul de taille faux.
- Levier élevé qui transforme une petite erreur en appel de marge.

**Why it happens:**
Frustration du petit capital + sizing calculé sans tenir compte des contraintes broker (min_size, pip_size, lot minimum). La formule `risque$ / (distance SL × valeur pip)` peut renvoyer une taille **inférieure au minimum tradable**.

**How to avoid:**
- Risque fixe **codé en dur** ≤1-2 % (déjà décision archi) — pas configurable au-dessus sans friction.
- `instruments` stocke `pip_size`, `min_size`, `precision` (déjà prévu) → le sizing calculator **vérifie la faisabilité** : si taille calculée < `min_size`, **alerter** "SL trop serré / capital insuffisant pour cet instrument à ce risque" plutôt que d'arrondir à la hausse silencieusement.
- Inclure frais + spread dans le calcul du R:R net (un R:R 1.5 brut peut être <1 net sur petit capital).
- Privilégier crypto/instruments à petite taille minimale pour 500 $ ; flagger les instruments dont le tick minimum est incompatible.

**Warning signs:**
- Sizing calculator qui arrondit à la hausse au lieu d'alerter.
- R:R affiché brut, jamais net de frais.
- Positions dont le risque réel dépasse 2 % du capital.
- Instruments proposés où la taille min impose >2 % de risque.

**Phase to address:** **Phase 1** (sizing calculator + intégration `instruments`). Métadonnées instruments (pip/min_size) en **Phase 0**.

---

### Pitfall 8: Responsabilité légale — conseil financier déguisé

**What goes wrong:**
Un score /100 + entrée + SL + TP + "note du vétéran" ressemble fortement à une **recommandation d'investissement personnalisée**. En UE (MiFID II / AMF en France), fournir des conseils en investissement est une activité réglementée. Le disclaimer "éducatif" ne suffit pas si le contenu est de facto une reco actionnable, surtout en P2 quand c'est diffusé à une communauté (voire monétisé via Stripe).

**Why it happens:**
La frontière "éducatif" vs "conseil" est floue et le produit est précisément conçu pour être actionnable. Le risque monte d'un cran avec la communauté + monétisation (on "vend" des signaux).

**How to avoid:**
- Disclaimers explicites et **persistants** (pas juste en footer) : "éducatif, pas un conseil en investissement, aucune promesse de gain, le trading comporte un risque de perte totale" — visible sur chaque setup et à l'inscription. **À valider par un juriste avant P2/monétisation** (confidence MEDIUM ici).
- Ne **jamais** afficher de promesse de rendement, de "garantie", de track record gonflé.
- Formuler comme **analyse/scénario**, pas comme ordre ("setup observé", "thèse", invalidation claire) — déjà l'esprit du JSON.
- En P2 communauté : modération, pas de leaderboard incitant au pari, conditions d'utilisation, déni de responsabilité sur le contenu user-généré.
- Vérifier les CGU des **sources de données** (OANDA/Binance/Finnhub/FRED) : redistribution de données de marché à une communauté peut violer leurs licences (Pitfall data-licensing).

**Warning signs:**
- Copy marketing avec "gains", "garanti", "x% par mois".
- Setups présentés comme ordres à exécuter sans nuance.
- Monétisation de signaux sans cadre juridique.
- Redistribution de données broker à des tiers sans vérifier la licence.

**Phase to address:** Disclaimers de base **Phase 1**. Revue juridique + licences données + cadre communauté **avant Phase 2** (bloquant pour monétisation).

---

### Pitfall 9: Sécurité — fuite de clés broker / service_role / RLS trop laxiste

**What goes wrong:**
- La **clé `service_role` Supabase** (bypass RLS total) finit dans le frontend Next.js (variable `NEXT_PUBLIC_*`, bundle client) → n'importe qui lit/écrit toute la base.
- Clés OANDA/Binance/Finnhub/FRED commitées dans le repo ou exposées côté client.
- RLS mal configurée : `journal` (trades privés de l'user) lisible par d'autres ; oubli d'activer RLS sur une table → ouverte par défaut.
- En P2, tables communauté avec RLS trop permissive exposant des données privées.

**Why it happens:**
`service_role` est pratique pour "que ça marche" en dev. RLS désactivée par défaut sur une nouvelle table tant qu'on ne l'a pas activée explicitement. Confusion entre `anon`, `authenticated`, `service_role`. Démo/testnet rassure faussement (les clés testnet n'ont pas de fonds mais peuvent fuiter vers les clés live).

**How to avoid:**
- `service_role` **uniquement dans `apps/jobs`** (scripts Node), **jamais** importé dans `apps/web` (déjà décision archi). Lint/CI : interdire l'import du client service_role depuis `apps/web`.
- Frontend utilise **uniquement** `anon`/`authenticated` via `@supabase/ssr`, RLS comme seule barrière.
- **RLS activée sur TOUTES les tables** + policies explicites (déjà détaillé §4). `journal` : `user_id = auth.uid()` strict. Vérifier via `get_advisors` Supabase (détecte tables sans RLS, policies manquantes).
- Toutes les clés en `.env` non commitées (`.gitignore` vérifié) + `.env.example` sans valeurs. Secret scanning en CI.
- Démo/testnet d'abord (déjà décision) — mais traiter les clés testnet avec la même rigueur que les clés live.
- Tests RLS automatisés (un user ne peut pas lire le journal d'un autre).

**Warning signs:**
- `NEXT_PUBLIC_` contenant un secret ou `service_role`.
- `get_advisors` Supabase signale tables sans RLS / policies manquantes.
- Une requête authenticated qui renvoie des lignes d'un autre user.
- Clé dans l'historique git (`git log -p` / secret scan).

**Phase to address:** **Phase 0** (RLS de base, isolation service_role, `.gitignore`, lint anti-import). Tests RLS + `get_advisors` à chaque ajout de table, renforcé **Phase 2** (tables communauté).

---

### Pitfall 10: Robustesse des routines — jobs manqués / non-idempotents / sources en panne

**What goes wrong:**
PC éteint à l'heure du cron → session manquée, pas d'analyse, données périmées. Ou job rejoué (Task Scheduler backup + Claude agent) → **doublons** de candles/analyses si non idempotent. Source API down → analyse produite sur données incomplètes sans le savoir.

**Why it happens:**
Machine Windows perso (pas un serveur 24/7). Deux déclencheurs (Claude scheduled agent + Task Scheduler backup) peuvent se chevaucher. Une source en timeout renvoie partiel ou rien.

**How to avoid:**
- **Idempotence** (déjà principe archi) : upsert sur index uniques (`candles` unique `(instrument_id, timeframe, ts)`, `news` `url_hash`, `macro_series` `(series_code, ts)`). Re-run sûr, aucun doublon.
- `job_runs` monitoré (déjà prévu) : statut, durée, erreurs, stats. Alerter si un job attendu n'a pas tourné.
- Source en échec → flag `stale`, **refuser de produire une analyse** sur données périmées plutôt que d'analyser dans le vide (déjà §8).
- Backoff (`p-retry`) + `p-limit` pour rate limits.
- Verrou anti-chevauchement (un seul run par session via clé dans `job_runs`).

**Warning signs:**
- Doublons dans candles/analyses.
- `job_runs` avec trous (sessions sans run).
- Analyses produites avec un snapshot dont les candles sont vieilles.
- 429 (rate limit) dans les logs.

**Phase to address:** **Phase 0** (idempotence des upserts, clients data-sources avec backoff). `job_runs` + flag stale + verrou : **Phase 1**.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Score affiché comme "probabilité" sans calibration | Dashboard "fini" rapidement | Décisions sur scores trompeurs, perte de confiance, risque légal en P2 | Jamais sans afficher "calibration en cours, N trades" |
| Backtest avec fills parfaits (pas de spread/slippage) | Métriques rapides et flatteuses | Sur-confiance, edge fictif qui s'effondre en réel | MVP interne seulement, JAMAIS pour décider du passage en réel |
| Recalculer indicateurs depuis candles actuelles au lieu de lire `snapshot` stocké | Moins de stockage jsonb | Look-ahead bias, backtest non reproductible | Jamais (le snapshot est la source de vérité) |
| Cron en heure locale Windows | Plus simple à lire | Dérive d'1h à chaque DST, sessions ratées | Jamais — UTC obligatoire |
| service_role pour "débloquer" une lecture front | Marche tout de suite | Bypass RLS total = base ouverte | Jamais côté `apps/web` |
| Sizing qui arrondit à min_size sans alerter | Toujours un trade possible | Risque réel >2 %, ruine sur petit capital | Jamais — alerter à la place |
| Ré-ajuster les poids de scoring chaque semaine | "Améliore" le backtest | Overfitting, échec en réel | Jamais sur le même set ; seulement out-of-sample versionné |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| OANDA v20 | Supposer daily = 00:00 UTC (OANDA aligne 17:00 NY) ; lire la bougie courante incomplète | Spécifier l'alignement de candle explicitement, exclure la bougie non clôturée, normaliser UTC |
| Binance testnet | Confondre conventions testnet vs live (symboles, limites) ; daily 00:00 UTC ≠ OANDA daily | Normaliser tout en UTC ; documenter que crypto daily diffère du FX daily |
| Finnhub/Marketaux | Dédoublonnage faible → news comptées plusieurs fois ; horodatage d'ingest vs `published_at` | `url_hash` unique (déjà archi) ; toujours filtrer sur `published_at` |
| FRED | Données macro **révisées a posteriori** (vintages) → look-ahead si on lit la valeur révisée | Idéalement données point-in-time/vintage ; sinon assumer le décalage de publication |
| Supabase (service_role) | Importé dans le bundle client | Isolé à `apps/jobs`, lint CI l'interdit côté web |
| Supabase Realtime | S'abonner à `trade_setups` sans filtre RLS → fuite ou volume | Realtime respecte RLS ; filtrer côté policy, limiter les canaux |
| Tiers gratuits (tous) | Ignorer rate limits → bans temporaires, données manquantes | `p-retry` + `p-limit`, espacer jobs, cache, pull ciblé (déjà archi) |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Backtest qui recharge toutes les candles en mémoire | Job hebdo lent, OOM | Requêtes paginées + index `(instrument_id, timeframe, ts desc)` (déjà prévu), traiter par fenêtre | Dès que l'historique dépasse quelques mois × instruments |
| Dashboard sans pagination sur `trade_setups` | Page lente quand setups s'accumulent | Index `(opportunity_score desc, created_at desc)` (déjà prévu) + LIMIT + filtre `status=active` | Quelques milliers de setups |
| Realtime sur toutes les tables | Trop d'événements, UI qui rame | Canaux ciblés (nouveaux setups actifs uniquement) | À l'arrivée de la communauté (P2) |
| Recalcul d'indicateurs à chaque requête front | Charge inutile | Indicateurs pré-calculés dans `analyses.snapshot`, front ne fait que lire | N/A si archi respectée |
| Pas de `valid_until` / expiration des setups | Setups périmés polluent le tri | `status` + `valid_until` (déjà prévu), job d'expiration | Dès la phase perso |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| `service_role` exposé côté front | Base entière lisible/modifiable par tous | Isolé à `apps/jobs`, lint anti-import, jamais en `NEXT_PUBLIC_` |
| Table sans RLS activée | Données ouvertes par défaut | RLS sur **toutes** les tables + `get_advisors` à chaque migration |
| `journal` lisible par d'autres users | Fuite de la stratégie/PnL privé | Policy stricte `user_id = auth.uid()` + test RLS automatisé |
| Clés broker/news commitées | Compromission de comptes (même testnet → réutilisation live) | `.env` non commité, secret scanning CI, `.env.example` vide |
| Snapshot/payload exposant des données sensibles via Realtime | Fuite cross-user | Realtime sous RLS, filtrer les colonnes diffusées |
| P2 : tables communauté trop permissives | Exposition de données privées (watchlists, follows) | Policies explicites par table, revue sécurité avant P2 |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Score /100 sans contexte de calibration | Sur-confiance dans les hauts scores non validés | Afficher "basé sur N trades, calibration en cours" + reliability diagram |
| Plan de trade sans invalidation visible | User tient une position invalidée | `invalidation` mise en avant (déjà dans le JSON) |
| Métriques demo + live agrégées | Fausse perception de la performance réelle | Vues séparées demo/live, jamais fusionnées |
| Pas d'avertissement news imminente sur un setup | Stop balayé par un event macro | Afficher `upcoming_risk_events` + flag `news_risk` (déjà dans JSON) |
| Sizing qui propose une taille >2 % sans alerte | Risque de ruine sur 500 $ | Alerte "capital insuffisant / SL trop serré", refus d'arrondi à la hausse |
| Persona "vétéran" trop affirmatif | User suit aveuglément, illusion de certitude | Ton mesuré, `confidence` affichée, disclaimer persistant |

## "Looks Done But Isn't" Checklist

- [ ] **Indicateurs techniques :** souvent calculés sur la bougie en cours — vérifier qu'on exclut la dernière bougie non clôturée.
- [ ] **Backtest :** souvent sans frais/slippage ni gap weekend — vérifier l'intégration des coûts et la convention SL-avant-TP intra-bougie.
- [ ] **Score /100 :** souvent affiché comme une vérité — vérifier reliability diagram + Brier mesurés avant de s'y fier.
- [ ] **outcome-eval :** souvent un look-ahead caché — vérifier qu'on rejoue depuis `snapshot` et que les candles lues sont strictement postérieures à l'entrée.
- [ ] **Sizing :** souvent arrondit à la hausse — vérifier l'alerte quand taille < `min_size`.
- [ ] **RLS :** souvent oubliée sur une nouvelle table — lancer `get_advisors` + test cross-user après chaque migration.
- [ ] **service_role :** souvent leak dans le bundle — grep `apps/web` pour tout import du client service_role.
- [ ] **Cron :** souvent en heure locale — vérifier que tous les schedules sont en UTC et survivent au DST.
- [ ] **Normalisation UTC :** souvent partielle — vérifier que OANDA daily et Binance daily sont alignés sur la même convention documentée.
- [ ] **Disclaimers :** souvent en footer seulement — vérifier présence sur chaque setup + à l'inscription, validés juridiquement avant P2.
- [ ] **Idempotence :** souvent supposée — re-run un job deux fois et vérifier zéro doublon.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Look-ahead bias détecté | MEDIUM | Corriger la jointure/exclusion de bougie, **invalider tous les backtests/calibrations passés**, rejouer proprement |
| Scores non calibrés diffusés | MEDIUM | Afficher avertissement, suspendre le tri "par fiabilité", recalibrer en out-of-sample avant de re-publier |
| service_role leaké | HIGH | **Rotation immédiate** de la clé Supabase, audit des accès/logs, scan du repo, purge de l'historique git si commitée |
| Clé broker commitée | HIGH | Révoquer/régénérer la clé broker, vérifier l'absence de transactions non autorisées, secret scan repo |
| RLS trop permissive en prod | MEDIUM | Corriger la policy, `get_advisors`, vérifier les logs d'accès, notifier si données privées exposées |
| Overfitting des poids | MEDIUM | Revenir à une version de poids antérieure validée, re-figer, valider en out-of-sample |
| Passage en réel sur edge fictif | HIGH | Repasser en démo, intégrer frais/slippage, re-mesurer expectancy nette avant nouveau passage |
| Gap weekend non modélisé | LOW | Ajouter modélisation du gap au backtest, re-mesurer la fiabilité des stops |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Look-ahead bias (#1) | Phase 0 (convention bougie) + Phase 1 (backtest/outcome-eval) | Win rate plausible ; backtest reproductible depuis snapshot |
| Overfitting scoring (#2) | Phase 1 (scoring + weekly-backtest) | In-sample ≈ out-of-sample ; poids versionnés non re-ajustés |
| Scores non calibrés (#3) | Phase 1 (page métriques) — bloquant avant P2 | Reliability diagram monotone ; Brier mesuré |
| Hallucination chiffres (#4) | Phase 0 (séparation déterministe/IA) + Phase 1 (garde-fous Zod) | R:R recalculé == payload ; taux rejet Zod bas |
| Désalignement UTC/sessions/gap (#5) | Phase 0 (normalisation UTC) + Phase 1 (gap backtest) | Daily candles == référence ; cron survit au DST |
| Écart démo-vs-réel (#6) | Phase 1 (journal + friction) | Métriques demo/live séparées ; expectancy nette de frais |
| Risque petit capital (#7) | Phase 0 (métadonnées instruments) + Phase 1 (sizing) | Sizing alerte si <min_size ; risque réel ≤2 % |
| Légal / conseil financier (#8) | Phase 1 (disclaimers) — revue juridique bloquante avant P2 | Disclaimers persistants ; CGU/licences validées |
| Sécurité clés/RLS (#9) | Phase 0 (RLS, isolation service_role) — renforcé P2 | `get_advisors` clean ; tests RLS cross-user ; pas de secret en bundle |
| Robustesse routines (#10) | Phase 0 (idempotence) + Phase 1 (job_runs, stale, verrou) | Re-run = zéro doublon ; alerte sur job manqué |

## Sources

- [The critical pitfalls of backtesting trading strategies — Starqube](https://starqube.com/backtesting-investment-strategies/)
- [A Practical Guide To The Backtesting Mistakes That Kill Quant Strategies — HedgeFundAlpha](https://hedgefundalpha.com/education/backtesting-mistakes-kill-quant-strategies-guide/)
- [How To Avoid Bias in Backtesting — ForTraders](https://www.fortraders.com/blog/how-to-avoid-bias-in-backtesting)
- [How to Avoid Overfitting When Testing Trading Rules — adventuresofgreg](http://adventuresofgreg.com/blog/2025/12/18/avoid-overfitting-testing-trading-rules/)
- [Interpretable Hypothesis-Driven Trading: Walk-Forward Validation Framework — arXiv](https://arxiv.org/html/2512.12924v1)
- [Time Zone Difference in Forex — EarnForex](https://www.earnforex.com/guides/time-zone-difference-in-forex/)
- [The DAILY candlestick is not the universal DAILY candlestick — ProRealCode](https://www.prorealcode.com/topic/the-daily-candlestick-is-not-the-universal-daily-candlestick-on-prt-ig/)
- [Forex 24/5 Trading: Market Hours & Sessions — Capital.com](https://capital.com/en-int/learn/glossary/forex-24-hours-trading)
- Calibration (Brier score, reliability diagrams) : littérature standard de prévision probabiliste — confidence HIGH
- Supabase RLS / service_role : docs officielles Supabase (`get_advisors`, RLS by default) — confidence HIGH
- Légal MiFID II / AMF : connaissance générale — **confidence MEDIUM, à valider par un juriste avant monétisation P2**
- ARCHITECTURE.md + PROJECT.md du projet (contexte interne)

---
*Pitfalls research for: Plateforme d'analyse de trading (scoring IA, backtest, petit capital, communauté)*
*Researched: 2026-06-09*
