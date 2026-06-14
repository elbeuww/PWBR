# Feature Research

**Domain:** Plateforme publique d'abonnement aux signaux de trading (SaaS payant), audience MENA non technique, paiement crypto USDT, acquisition influenceurs/Telegram
**Researched:** 2026-06-14
**Confidence:** MEDIUM-HIGH (patterns du domaine signaux + flux paiement USDT vérifiés sur sources externes ; spécificités MENA = MEDIUM, déduit du contexte projet)

> **Périmètre.** Ce milestone v2.0 est la **couche produit** au-dessus d'un cœur analytique DÉJÀ livré (setups scorés /100 avec entrée/SL/TP/R:R/risque + raisons technique/fondamentale/news, persistés en base Supabase). On ne recherche PAS l'analyse de trading. On recherche : comment EXPOSER, VENDRE, ENCAISSER, et DISTRIBUER ces setups à un public non technique.
>
> **Axe de priorisation downstream.** Pour chaque feature : ce qu'il faut pour **encaisser le 1er abonnement** (chemin critique cash) vs le reste. Le chemin minimal pour encaisser = vitrine + auth + page paiement USDT (collecte du hash) + activation (même manuelle) + gating de l'espace membre + 1 disclaimer + au moins quelques signaux visibles. Tout le reste est itératif.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Sans ça, le produit paraît cassé ou pas crédible pour un service de signaux payant.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Vitrine publique avec proposition de valeur claire** | Premier contact ; un non technique doit comprendre « j'achète quoi » en 10 s | LOW-MED | Hero + 3 bénéfices + exemple de signal flouté/teaser + CTA. Réutilise le design system. RTL arabe obligatoire (pas un afterthought). |
| **% de réussite / track record visible** | C'est LE déclencheur de confiance qui fait payer. Notre Core Value en dépend | HIGH | Doit être **mesuré, jamais inventé** (contrainte projet + risque légal). Phase 1 = win rate des patterns backtestés ; ensuite track record réel. Voir section dédiée plus bas. Dépend de la boucle track record (PATT-01/02 + prediction_outcomes). |
| **Pricing affiché + offre découverte** | L'utilisateur veut savoir le prix avant de s'engager | LOW | 9 $/mois + 3 $/15 j. Notre prix est **agressivement bas** vs marché (services concurrents 30-100 $/mois) → argument de conversion fort, à mettre en avant. |
| **Inscription / connexion (auth)** | Évident. DÉJÀ livré (Supabase SSR, P1) | DONE | Réutiliser. Vérifier parcours trilingue + mobile-first (MENA = mobile dominant). |
| **Gating de l'espace membre par abonnement** | Le contenu payant ne doit pas fuiter aux non-abonnés | MED | Middleware Next + RLS sur la lecture des signaux selon statut d'abonnement actif. Le gating est le mur qui protège le revenu. |
| **Liste des signaux triée par score** | Cœur de l'offre. L'abonné veut « les meilleurs trades en haut » | LOW-MED | Données déjà en base. Tri par score /100 desc + statut (actif/clos). @tanstack/react-query + realtime pour push. |
| **Filtres simples sur la liste** | Marché (crypto/forex/or…), style (day/swing), risque | LOW | Filtres = chips, pas un panneau complexe (public non technique). |
| **Vue détail d'un trade vulgarisée** | Le différenciateur de fond, mais aussi attendu : « pourquoi ce trade ? » | MED | **Explication simple D'ABORD** (1 paragraphe + niveaux entrée/SL/TP en gros), analyse approfondie **dépliable** (technique/fondamental/news). Chart lightweight-charts avec niveaux tracés. |
| **Paiement USDT fonctionnel (même MVP manuel)** | Sans encaissement, pas de produit | HIGH | MVP : afficher adresse TRC-20 + l'utilisateur colle son hash → vérif on-chain TronGrid (montant/destinataire/confirmations) → activation. Voir section dédiée. |
| **Renouvellement / expiration d'abonnement** | L'utilisateur doit savoir quand ça expire ; le système doit couper l'accès | MED | Date d'expiration visible dans l'espace membre + bandeau de relance J-3/J-0 + coupure auto à expiration. Job idempotent (infra jobs déjà en place). |
| **Disclaimers légaux systématiques** | Obligatoire AVANT 1er encaissement (contrainte projet : conseil non agréé + crypto MENA) | LOW (technique) / HIGH (juridique) | Bandeau « contenu éducatif, pas de conseil, aucune promesse de gain » sur vitrine, espace membre, Telegram. Le travail juridique réel (structure, juridiction) est hors code mais BLOQUANT. |
| **Dashboard superadmin minimal** | L'opérateur doit valider les paiements et voir qui est actif | MED | Au lancement : file de validation des paiements + liste membres + statut. Le reste s'ajoute. |
| **i18n trilingue AR(RTL)/EN/FR** | Audience non anglophone majoritairement ; l'arabe RTL est non négociable | HIGH (transverse) | Pas une feature isolée : contrainte transverse sur tout l'UI. RTL casse beaucoup de layouts → traiter tôt. |
| **Mobile-first** | MENA = trafic majoritairement mobile, acquisition via Telegram (mobile) | MED | Tout doit être pensé téléphone d'abord. |

### Differentiators (Competitive Advantage)

Ce qui nous distingue. Aligné sur la Core Value (analyse traçable + honnêteté du % mesuré).

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Analyse explicable en 2 niveaux (simple → approfondie)** | La plupart des services balancent « BUY BTC entry X SL Y TP Z » sans le pourquoi. Nous expliquons, vulgarisé | MED | C'est le cœur différenciant. La donnée existe déjà (raisons technique/fondamentale/news en base). Le travail = la PRÉSENTATION pédagogique progressive. |
| **% de réussite honnête et mesuré** | Le marché regorge de win rates gonflés non vérifiés. « Jamais inventé » est un positionnement de confiance | HIGH | Différenciateur SI on communique la méthode (backtest, échantillon). Montrer aussi les pertes (les services crédibles le font). |
| **Telegram public = preuve permanente** | Win rate affiché en continu + résultats journaliers = machine d'acquisition + preuve sociale vivante | MED | Bot poste les clôtures (gagné/perdu) + win rate cumulé. Transparence (montrer les pertes) = crédibilité. |
| **Affiliation récurrente à paliers (max 20 %)** | Aligne les influenceurs sur le long terme (commission sur abonnés ACTIFS, pas one-shot) | HIGH | Lève d'acquisition principale. Codes promo + tracking + dashboard affilié + paiement commissions crypto. |
| **Tarif d'entrée très bas (9 $) + essai 3 $** | Abaisse drastiquement la barrière pour un public MENA sensible au prix | LOW | Différenciateur de positionnement, déjà décidé. L'essai 3 $/15 j convertit mieux qu'un gratuit (filtre les curieux). |
| **CMS éducatif « de zéro »** | « C'est quoi un portefeuille » → capture le public débutant que les concurrents ignorent | MED | Contenu = acquisition SEO + nurturing + réduction du support. Différencie d'un pur canal de signaux. |
| **Paiement 100 % crypto natif MENA** | Adapté à l'usage réel (USDT/P2P) là où la carte échoue | HIGH | C'est une nécessité du marché autant qu'un différenciateur vs plateformes carte-only. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Garantie de gains / « 95 % win rate »** | « Ça vend » | Mensonger, illégal (conseil non agréé + promesse de gain), tue la confiance long terme, expose juridiquement | % mesuré + disclaimers + montrer les pertes |
| **Processeur crypto automatisé (NOWPayments/Cryptomus) dès le lancement** | Plus propre, automatique | Dépendance tierce, KYC/onboarding du processeur, délai, complexité, peut bloquer le 1er encaissement | MVP = collecte du hash + vérif TronGrid + file superadmin. Processeur en étage 2. |
| **Exécution automatique des trades / passage d'ordres** | « Je veux juste copier » | Hors scope projet, énorme risque réglementaire et technique (custody, connexion broker), responsabilité directe sur les pertes | Aide à la décision uniquement. Disclaimer explicite. |
| **Multi-chaînes de paiement (ERC-20, BEP-20, SOL…)** | « Plus de choix » | Multiplie les watchers/vérifs, surface d'erreur, frais ETH élevés ; TRC-20 domine déjà en MENA | TRC-20 USDT uniquement au lancement. Étendre si demande mesurée. |
| **Notifications temps réel / streaming M1** | « Je veux être alerté à la seconde » | Infra temps réel coûteuse, hors scope, l'analyse est day/swing (pas scalping) | Realtime Supabase pour push des nouveaux signaux (suffisant) + notif Telegram. |
| **Communauté sociale (profils, follows, chat, leaderboard)** | « Engagement » | Modération, scope énorme, hors v2.0 (déjà Out of Scope projet) | Telegram public suffit comme couche sociale au lancement. |
| **Auto-traduction machine de l'arabe** | « Gratuit, rapide » | Qualité médiocre en finance/arabe, casse la confiance, RTL mal géré | Traductions humaines/relues des chaînes UI + contenu éducatif clé. |
| **Paliers d'affiliation complexes (5+ niveaux, MLM)** | « Motiver plus » | Ressemble à un schéma pyramidal (risque légal + réputation), complexité de calcul | Paliers simples basés sur nb d'abonnés actifs, plafond 20 %, 1 seul niveau (pas de sous-affiliés). |
| **Wallet custodial intégré / garder les fonds des users** | « Pratique » | Custody = régulation lourde, cible de hack, responsabilité | Paiement direct vers cold wallet plateforme, watcher lecture seule. Clés jamais en DB. |
| **Auto-payout des commissions affiliées on-chain** | « Automatique » | Risque de fuite de fonds, bugs = pertes réelles irréversibles, clés chaudes | Calcul auto du dû + payout MANUEL validé dans superadmin (au moins au lancement). |

---

## Feature Dependencies

```
[Encaisser le 1er abonnement]  ← OBJECTIF CASH
    ├──requires──> [Auth] (DONE, P1)
    ├──requires──> [Vitrine + pricing + 1 disclaimer]
    ├──requires──> [Paiement USDT MVP: adresse + collecte hash]
    │                   └──requires──> [Vérif on-chain TronGrid]
    │                                      └──requires──> [Cold wallet + adresse de réception]
    ├──requires──> [Activation d'abonnement (statut + expiration)]
    │                   └──requires──> [File validation superadmin (fallback manuel)]
    └──requires──> [Gating espace membre]
                        └──requires──> [Liste signaux] (données DONE, présentation à faire)

[% de réussite affiché]
    └──requires──> [Boucle track record: catalogue patterns + backtest mesuré]
                        └──requires──> [prediction_outcomes + calibration]

[Telegram public] ──enhances──> [Acquisition] ──feeds──> [Vitrine conversion]
    └──requires──> [Track record / win rate calculé]

[Affiliation] ──requires──> [Activation d'abonnement] (compter les abonnés actifs ramenés)
    └──requires──> [Codes promo au signup]
    └──requires──> [Payout commissions] (manuel au début)

[Renouvellement/expiration] ──requires──> [Activation] + [Paiement]

[CMS éducatif] ──independent──> (peut être livré en parallèle, faible couplage)

[i18n trilingue] ──cross-cuts──> TOUT (à poser dès la 1re page)
```

### Dependency Notes

- **Encaisser le 1er abonnement requiert le chemin paiement→activation→gating, PAS l'automatisation.** La file de validation superadmin manuelle suffit pour démarrer. C'est le découplage clé : le cash ne dépend ni du processeur crypto, ni de l'affiliation, ni du track record réel.
- **% de réussite réel dépend de la boucle track record** (catalogue patterns + backtest). Au lancement on affiche le **win rate backtesté des patterns** ; le track record réel s'accumule ensuite. Ne pas bloquer le lancement sur le track record réel.
- **Affiliation dépend de l'activation d'abonnement** : impossible de compter/commissionner des abonnés actifs sans système d'abonnement fiable. Donc affiliation APRÈS le système de paiement.
- **Telegram dépend du calcul de win rate** : le canal poste des résultats vérifiés. Le bot peut démarrer en publication semi-manuelle puis s'automatiser.
- **i18n est transverse** : si posé en retard, RTL arabe force un refactor UI massif. À traiter dès la première page de vitrine.

---

## MVP Definition

### Launch With (v1 — chemin pour ENCAISSER + crédibilité minimale)

Ruthless : strictement ce qui permet le 1er abonnement payé + ne pas paraître louche.

- [ ] **Vitrine publique** (hero, valeur, pricing 9 $ + essai 3 $, teaser signaux, disclaimer) — sans elle, personne ne convertit
- [ ] **i18n posé dès le départ** (au minimum FR + AR-RTL ; EN suit) — refactor douloureux sinon
- [ ] **Gating espace membre** par statut d'abonnement — protège le revenu
- [ ] **Liste signaux triée par score + filtres simples** — données déjà en base, présentation à faire
- [ ] **Détail trade vulgarisé** (simple d'abord, approfondi dépliable, chart + niveaux) — le produit lui-même
- [ ] **Paiement USDT MVP** : adresse TRC-20 + collecte hash + vérif TronGrid + activation auto — encaissement
- [ ] **File de validation paiements superadmin** + liste membres/statut — fallback manuel indispensable
- [ ] **Activation / expiration / relance d'abonnement** — cycle de vie du revenu
- [ ] **% de réussite = win rate des patterns backtestés** affiché honnêtement (avec note de méthode + taille d'échantillon) — confiance
- [ ] **Disclaimers + revue légale réalisée** — BLOQUANT avant 1er encaissement (contrainte projet)

### Add After Validation (v1.x — une fois le cash qui rentre)

- [ ] **Affiliation à paliers** (codes promo, tracking, dashboard affilié, payout manuel) — déclencheur : 1ers influenceurs prêts à pousser
- [ ] **Telegram public automatisé** (résultats journaliers + win rate permanent) — déclencheur : assez de trades clos pour un canal vivant
- [ ] **CMS éducatif** (premiers articles « de zéro ») — déclencheur : besoin d'acquisition SEO / nurturing
- [ ] **Track record RÉEL** (prediction_outcomes mûri) remplace/complète le backtest dans l'affichage — déclencheur : échantillon réel suffisant
- [ ] **Superadmin enrichi** (perfs affiliés, santé jobs/données détaillée, signaux publiés) — déclencheur : volume d'opérations

### Future Consideration (v2+)

- [ ] **Processeur crypto automatisé** (NOWPayments/Cryptomus, adresse unique/facture, webhooks) — déclencheur : volume de paiements manuels ingérable
- [ ] **Payout commissions automatisé on-chain** — déclencheur : confiance opérationnelle + volume
- [ ] **Multi-chaînes de paiement** — déclencheur : demande mesurée hors TRC-20
- [ ] **Communauté sociale** — déjà Out of Scope projet
- [ ] **Notifications push / app mobile** — déclencheur : rétention à améliorer

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Vitrine + pricing + disclaimer | HIGH | LOW-MED | P1 |
| i18n trilingue (RTL) | HIGH | HIGH | P1 (transverse, tôt) |
| Gating espace membre | HIGH | MED | P1 |
| Liste signaux triée + filtres | HIGH | LOW-MED | P1 |
| Détail trade vulgarisé | HIGH | MED | P1 |
| Paiement USDT MVP (hash + TronGrid) | HIGH | HIGH | P1 |
| File validation + membres (superadmin min) | HIGH | MED | P1 |
| Renouvellement / expiration | HIGH | MED | P1 |
| % réussite backtest affiché | HIGH | HIGH | P1 |
| Disclaimers + revue légale | HIGH | LOW code / HIGH juridique | P1 (bloquant) |
| Affiliation à paliers | HIGH | HIGH | P2 |
| Telegram public auto | HIGH | MED | P2 |
| CMS éducatif | MED | MED | P2 |
| Track record réel (vs backtest) | HIGH | HIGH | P2 |
| Superadmin enrichi | MED | MED | P2 |
| Processeur crypto auto | MED | HIGH | P3 |
| Payout commissions auto | LOW | HIGH | P3 |
| Multi-chaînes paiement | LOW | HIGH | P3 |

**Priority key:** P1 = lancement (encaisser + crédibilité) · P2 = après validation · P3 = futur.

---

## Deep Dives par feature demandée

### 1. Vitrine + funnel d'abonnement

**Comment ça marche / attente utilisateur.** Le visiteur arrive (souvent via lien Telegram d'un influenceur sur mobile). Il doit comprendre en quelques secondes : ce que c'est, la preuve que ça marche, le prix, et comment payer. Funnel typique : vitrine → preuve (win rate + résultats) → pricing → essai 3 $ → page paiement → activation → espace membre.

**Preuve sociale = % de réussite mesuré.** Les services crédibles publient un track record complet incluant les pertes ; les services qui « garantissent » des taux extrêmes sans preuve sont le signal d'arnaque. Notre avantage = montrer la méthode (backtest, échantillon) et les pertes.

**À montrer / NE PAS montrer légalement.** Montrer : exemples d'analyses (teaser flouté), win rate mesuré avec méthode, disclaimers. NE PAS : promesses de gain, « rejoignez et devenez riche », performances individuelles présentées comme reproductibles, conseil personnalisé. Positionnement strictement éducatif.

**Classe : table stakes** (la vitrine, le pricing) + **différenciateur** (preuve honnête + prix bas).

### 2. Espace membre signaux

**Attente.** Une liste « les meilleurs trades en haut » (tri par score), filtrable par marché/style/risque, et un détail qui explique SIMPLEMENT d'abord. Public non technique → pas de jargon en première lecture. L'analyse approfondie (indicateurs, structure, news) est dépliable pour qui veut.

**Données prêtes.** Les setups (score, entrée/SL/TP/R:R, risque, raisons) sont déjà persistés. Le travail v2.0 = lecture gated + présentation pédagogique + chart lightweight-charts avec niveaux tracés.

**Classe : table stakes** (liste + détail) avec la **vulgarisation 2-niveaux en différenciateur**.

### 3. Paiement crypto USDT (MENA)

**Comportement attendu / peurs.** L'audience MENA paie en USDT, souvent acquis en P2P. Peurs réelles : se tromper d'adresse, mauvais réseau (TRC-20 vs autres), ne pas savoir si « c'est passé ». Besoins : adresse copiable en 1 tap + QR, réseau indiqué très clairement (TRC-20), confirmation visible de réception, message rassurant pendant les confirmations.

**Flux MVP (étage 1).** Afficher adresse + montant exact + QR → l'utilisateur paie depuis son wallet/exchange → il colle son **hash de transaction** (TxID, 64 hex) + screenshot optionnel → le backend interroge **TronGrid** pour vérifier : destinataire = notre adresse, montant ≥ dû, token = USDT TRC-20, confirmations suffisantes, statut success → **activation auto**. Cas tordus (montant faux, hash déjà utilisé, sous-paiement) → **file de validation superadmin**.

**Garde-fous critiques.** Hash unique (anti-rejeu : un même TxID ne peut activer qu'un compte une fois), vérifier le **contrat USDT exact** (pas un faux token), montant et destinataire stricts, fenêtre de confirmations. Clés du wallet jamais en DB/code (cold wallet + watcher lecture seule).

**Étage 2 (futur).** Processeur (NOWPayments/Cryptomus) = adresse unique par facture + webhooks → automatisation complète. À reporter pour ne pas bloquer le 1er encaissement.

**Renouvellement / expiration / relance.** Date d'expiration visible, bandeau J-3/J-0, coupure auto à expiration via job idempotent, relance par Telegram/email. Réabonnement = même flux paiement.

**Classe : table stakes** (le MVP hash) + **anti-feature** (processeur auto / multi-chaînes au lancement).

### 4. Affiliation à paliers

**Attente influenceur.** Un code promo à partager, un dashboard montrant : abonnés ramenés (actifs/inactifs), revenus générés, commission due, historique des paiements. Modèle = commission **récurrente** sur abonnés ACTIFS (alignement long terme), plafond **20 %**.

**Mécanique.** Code promo capturé au signup → attribution de l'abonné à l'affilié → à chaque paiement validé d'un filleul actif, créditer la commission selon le palier → payout crypto (manuel validé en superadmin au début). Paliers simples (1 niveau, pas de MLM/sous-affiliés → évite l'apparence pyramidale).

**Classe : différenciateur** (lève d'acquisition) — **P2** (dépend du système d'abonnement).

### 5. Dashboard superadmin

**Ce que l'opérateur doit voir.** Lancement (minimal) : **file de validation des paiements** (cas tordus à valider) + liste membres (actif/inactif/expiration). Enrichi (P2) : affiliés + perfs + commissions à payer, signaux publiés, **santé jobs/données** (réutilise `job_runs` + `v_data_freshness` déjà en place), alertes de staleness.

**Classe : table stakes** (file paiements + membres) puis **enrichi en P2**.

### 6. CMS cours/articles gratuits

**Attente.** Contenu « de zéro » (« c'est quoi un portefeuille / un ordre / le levier ») pour le public débutant. Sert l'acquisition (SEO), le nurturing avant abonnement, et réduit le support. Trilingue.

**Implémentation.** CMS léger (contenu en base + rendu RSC, ou MDX). Pas besoin d'un CMS lourd au début. Faible couplage → livrable en parallèle.

**Classe : différenciateur** (capte les débutants) — **P2**.

### 7. Canal Telegram public

**Rôle.** Moteur d'acquisition : résultats journaliers (gagné/perdu) + **win rate cumulé permanent**. Transparence (montrer les pertes) = crédibilité = conversion. Lien vers vitrine.

**Implémentation.** Bot poste les clôtures de trades + win rate calculé. Peut démarrer en semi-manuel puis s'automatiser. Dépend du calcul de win rate / track record.

**Classe : différenciateur** (preuve sociale vivante) — **P2**.

### 8. % de réussite / track record

**Comment l'afficher honnêtement.** Deux temps : (a) **lancement** = win rate des patterns mesuré par backtest maison, avec mention explicite de la méthode et de la taille d'échantillon ; (b) **ensuite** = track record réel (prediction_outcomes) qui prend le relais. **Jamais un chiffre non mesuré** (Core Value + risque légal).

**Échantillon insuffisant.** Afficher la taille d'échantillon ; sous un seuil, indiquer « échantillon en construction » plutôt qu'un pourcentage trompeur ; ne pas claimer de win rate sur quelques trades. Distinguer clairement backtest vs résultats réels dans l'UI.

**Classe : table stakes** (un % crédible est attendu) avec **l'honnêteté mesurée en différenciateur fort**. — **P1** (backtest) puis **P2** (réel).

---

## Competitor Feature Analysis

| Feature | Services de signaux typiques (Telegram VIP, forex/crypto) | Notre approche |
|---------|-----------------------------------------------------------|----------------|
| Prix | 30-100 $/mois, parfois 19,95 $ VIP | **9 $/mois + essai 3 $/15 j** (positionnement bas, MENA) |
| Win rate | Souvent claimé (75-95 %) **non vérifié** | **Mesuré (backtest puis réel), méthode + échantillon affichés** |
| Explication des trades | Rare (« BUY X, SL Y, TP Z ») | **Vulgarisation 2-niveaux (simple → approfondie)** |
| Paiement | Carte / PayPal / crypto variable | **USDT TRC-20 natif MENA, MVP hash + TronGrid** |
| Preuve sociale | Nb d'abonnés Telegram, captures sélectives | **Telegram public transparent (pertes incluses) + win rate permanent** |
| Affiliation | Souvent one-shot ou absente | **Récurrente sur abonnés actifs, plafond 20 %, 1 niveau** |
| Langue | Anglais surtout | **Trilingue AR(RTL)/EN/FR** |
| Éducation | Peu / payante | **CMS gratuit « de zéro »** |

---

## Sources

- Patterns de pricing, win rate et disclaimers des services de signaux payants — [ValueWalk best signals](https://www.valuewalk.com/investing/best-stock-trading-signals/), [Trasignal paid signals](https://trasignal.com/blog/crypto/paid-trading-signals/), [NFTevening best crypto signals (verified results)](https://nftevening.com/best-crypto-signals/), [DailyForex free vs paid](https://www.dailyforex.com/forex-articles/free-forex-signals-vs-paid-signal-services/243514) — MEDIUM (consensus multi-sources : prix 30-100 $, montrer les pertes, win rates non vérifiés = drapeau rouge)
- Vérification on-chain USDT TRC-20 (hash/TxID, montant/destinataire/confirmations, TronGrid) — [TRON developers — TRC-20 tx history](https://developers.tron.network/docs/get-trc20-transaction-history), [Kriptomat — vérifier une tx TRC-20](https://kriptomat.hr/en/how-to-check-a-usdt-trc-20-transaction/), [Gem Wallet — track USDT tx](https://gemwallet.com/learn/how-to-track-a-usdt-transaction-and-what-to-do-if-its-not-received/) — HIGH (flux et champs vérifiés)
- Contexte projet (audience MENA, USDT/P2P, trilingue, contraintes légales, paliers affiliation, cœur analytique livré) — `.planning/PROJECT.md`, `.planning/MILESTONES.md` — HIGH (source projet)

---
*Feature research for: plateforme publique d'abonnement aux signaux de trading (MENA, USDT, trilingue)*
*Researched: 2026-06-14*
