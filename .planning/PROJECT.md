# Plateforme d'Analyse de Trading "Vétéran"

## What This Is

**Plateforme publique par abonnement (9 $/mois, payé en USDT)** donnant accès à un outil d'analyse des marchés et à des **signaux de trade complets** : point d'entrée, take-profits, stop-loss, marge/levier suggéré si souhaité, score /100, niveau de risque — avec, pour chaque trade, **toute l'analyse (chartique + fondamentale + news) qui justifie le signal**, expliquée d'abord simplement, puis en profondeur pour qui veut comprendre le pourquoi.

Chaque signal affiche un **pourcentage de réussite visible** : au lancement, le taux mesuré par backtest maison du pattern détecté ; avec le temps, le track record réel de la plateforme.

**Audience cible** : Algérie d'abord, Afrique du Nord et Moyen-Orient ensuite — un public **non technique**. Tout est vulgarisé, rien n'est jargonneux. **Trilingue : arabe (RTL), anglais, français.**

**Le produit (penser comme une société d'une cinquantaine de personnes — construire tous les outils dont elle aurait besoin)** :
- **Vitrine publique** : présentation, % de réussite affiché, cours/articles gratuits qui partent de zéro (« c'est quoi un portefeuille ? »…), funnel d'abonnement.
- **Espace membre (payant)** : signaux + analyses détaillées + outil d'analyse du marché.
- **Paiement crypto** : abonnement réglé en USDT vers un portefeuille de la plateforme ; détection automatique des paiements on-chain et association paiement → compte (activation/expiration d'abonnement sans intervention manuelle).
- **Affiliation à paliers** (stratégie influenceurs) : codes promo pour tracer les abonnés ramenés, dashboard affilié (abonnés, revenus, paiements), commissions payées en crypto. Palier maximum : **20 % récurrent des abonnements ramenés** (ex. 1 000 abonnés × 9 $ → 1 800 $/mois).
- **Dashboard superadmin** : vue claire des membres (actifs/inactifs, état de paiement), des affiliés et de leurs performances, des signaux publiés, de la santé des jobs/données.
- **Canal Telegram public** : résultats journaliers des trades partagés + **% de trades gagnants visible en permanence** (canal d'acquisition).

L'IA se comporte comme un trader vétéran (50 ans d'expérience). L'analyse chartique s'appuie sur un catalogue de patterns dont le taux de réussite est **mesuré par backtest maison — jamais affirmé sans mesure**.

## Core Value

Produire, pour chaque opportunité, une analyse fiable et explicable — score /100 + niveau de risque + plan de trade (entrée/SL/TP/R:R/levier) — vulgarisée pour un public non technique. Si tout le reste échoue, **la qualité et la traçabilité de l'analyse d'un trade** doit fonctionner : le % de réussite affiché est toujours mesuré, jamais inventé — c'est le socle de confiance qui fait payer l'abonnement.

## Current Milestone: v2.0 Plateforme publique d'analyse & signaux (MENA)

**Goal:** Transformer le moteur analytique livré (P1-4) en plateforme publique payante (9 $/mois USDT) — vitrine trilingue, espace membre signaux, paiement crypto on-chain, affiliation, superadmin, contenu éducatif, Telegram — avec un % de réussite mesuré (jamais inventé).

**Target features:**
- Vitrine publique trilingue AR(RTL)/EN/FR + funnel d'abonnement
- Espace membre gated par abonnement : liste des signaux triés/filtrés + détail trade (chart + explication simple/approfondie)
- Paiement USDT TRC-20 (MVP : soumission TX hash + vérif on-chain TronGrid → activation auto + file de validation superadmin) + renouvellement/expiration auto ; offre découverte 3 $/15 j
- Affiliation à paliers (codes promo, dashboard affilié, commissions crypto, max 20 % récurrent)
- Dashboard superadmin (membres/paiements/affiliés/signaux/santé jobs)
- CMS articles/cours gratuits vulgarisés
- Bot/canal Telegram public (résultats journaliers + win rate permanent)
- Boucle track record : catalogue de patterns + backtest mesuré → % de réussite affiché ; prediction_outcomes + calibration
- Disclaimers + revue légale (conseil non agréé + statut crypto MENA/Algérie) AVANT le 1er encaissement
- i18n trilingue (transverse)

**Prérequis livré (v1.0, P1-4) :** moteur analytique déterministe + frontière de persistance des setups scorés. Numérotation des phases reset à 1 pour v2.0 ; roadmap v1.0 archivée (`.planning/archive/v1.0-moteur-analytique/`, voir `MILESTONES.md`).

## Requirements

### Validated

- [x] **Fondations & sécurité (Phase 1, 2026-06-12)** : monorepo pnpm + auth Supabase SSR (signup→login→session, E2E 5/5), RLS active 3 tables avec isolation cross-user prouvée (6/6), double barrière service_role (lint + server-only), constantes temps anti look-ahead (16/16 golden values), runner de jobs `job_runs` + dispatcher Windows Task Scheduler exécuté hors agent (exit 0, ligne cloud vérifiée). Requirements AUTH-01/02/03, DATA-05, JOB-03/04.
- [x] **Ingestion fiable des données (Phase 2, 2026-06-13)** : 4 tables RLS (candles/news/macro_series/economic_calendar) + 12 instruments seedés + vue `v_data_freshness` (horaires de cotation NY-DST), 5 clients data-sources (Binance mainnet public, OANDA démo, Finnhub, Marketaux, FRED, FairEconomy) avec parsers Zod golden-testés, 4 jobs idempotents gap-fill avec isolation des pannes. 88/88 tests, idempotence prouvée contre le cloud. Requirements DATA-01/02/03/04/06/07. Reste UAT humain : clés API + premier run live (02-HUMAN-UAT.md).
- [x] **Moteur d'analyse déterministe (Phase 3, 2026-06-13)** : indicateurs golden-testés (RSI/MACD/EMA/ATR/Bollinger) + détection de structure de marché maison (swings, BOS/CHoCH, S/R, POC volume), snapshots technique/fondamental/news par instrument/style. Requirements TECH-01..04, FUND-01..03.
- [x] **Moteur IA « vétéran » & scoring (Phase 4, 2026-06-14, code livré 261/261 tests)** : setups JSON structurés, frontière de confiance unique `persist.ts` (Zod + garde-fous déterministes + scoring /100 décomposable + immuabilité/expiry), prompt versionné sha256, anti-injection. Migrations 0006/0007 appliquées. Requirements SCORE-01..05, JOB-01/02. **Ops restant (reporté) :** configurer les routines planifiées Claude + 1 run réel.

### Active — Milestone v2.0 (plateforme publique, pivot 2026-06-13)

> Le cœur analytique (indicateurs, moteur vétéran, persistance) est **livré** ci-dessus. Restent pour v2.0 le track record mesuré + toute la couche produit.

- [ ] Boucle track record : catalogue de patterns chartiques déterministes + **taux de réussite mesuré par backtest** (PATT-01..02) + prédiction vs résultat (prediction_outcomes) + métriques (win rate, calibration, expectancy) → % de réussite réel affiché

- [ ] Vitrine publique trilingue (arabe RTL / anglais / français) : présentation, % de réussite, funnel d'abonnement
- [ ] Espace membre gated par abonnement : liste des signaux triés par score, filtres, vue détail trade (chart lightweight-charts + niveaux + explication simple + analyse approfondie dépliable)
- [ ] Paiement abonnement en USDT (TRC-20) — **deux étages** : (1) MVP lancement : adresse de paiement affichée + l'utilisateur soumet le hash de transaction (+ screenshot optionnel) → vérification du hash on-chain via TronGrid (montant/destinataire/confirmations) avec activation auto, file de validation manuelle dans le superadmin pour les cas tordus ; (2) ensuite : processeur crypto (NOWPayments/Cryptomus) pour l'automatisation complète (adresse unique par facture + webhooks). Renouvellement/expiration automatiques dans les deux étages.
- [ ] Offre découverte : **3 $ pour 15 jours** d'essai de la plateforme (en plus du 9 $/mois)
- [ ] Système d'affiliation à paliers : codes promo, tracking des abonnés ramenés, dashboard affilié, calcul et suivi des commissions (palier max 20 % récurrent), paiement des commissions en crypto
- [ ] Dashboard superadmin : membres (actifs/inactifs/paiements), affiliés et leurs stats, signaux, santé jobs/données
- [ ] CMS articles/cours gratuits vulgarisés (de la base : outils, portefeuille, …) sur la vitrine
- [ ] Bot/canal Telegram public : publication des résultats journaliers des trades + win rate permanent
- [ ] Disclaimers (contenu éducatif, pas de conseil personnalisé, aucune promesse de gain) sur vitrine, espace membre et Telegram

### Out of Scope

- Stripe / paiement par carte — remplacé par paiement crypto USDT (décision 2026-06-13)
- Trajectoire « outil perso + capital 500 $ » — **abandonnée le 2026-06-13** (la plateforme reste utilisable par le fondateur pour ses trades perso, mais ce n'est plus l'objectif produit)
- Communauté sociale (profils, follows, commentaires, leaderboard) — v2
- Exécution automatique des trades (passage d'ordres) — hors scope (aide à la décision, pas de bot d'exécution)
- Scalping temps réel M1/M5 (websockets) — après moteur prouvé
- Actions/equities — à revalider après le lancement du cœur (source de données à trancher)

## Context

- **Fondateur** : Borhane, développeur (Next.js + Supabase). Niveau trading intermédiaire.
- **Audience** : MENA (Algérie → Moyen-Orient), non technique, acquise via influenceurs + Telegram. L'USDT y est le moyen de paiement crypto dominant (généralement via P2P).
- **Forfait Claude Max** disponible → routines/agents planifiés sans coût par token (à réévaluer pour une plateforme publique : fiabilité 24/7).
- **MCP Supabase connecté.** Architecture détaillée : `ARCHITECTURE.md` (à réviser post-pivot pour les briques plateforme).
- **Principe clé inchangé** : les indicateurs sont calculés en code (déterministe) — Claude raisonne, n'invente pas les chiffres. Le % de réussite vient du backtest, jamais d'une affirmation.

## Constraints

- **Tech stack** : Next.js 15 + Supabase (Postgres/Auth/Realtime/RLS).
- **Budget** : coût quasi nul jusqu'au lancement — sources de données gratuites, pas de clé API Anthropic tant que les routines Max suffisent.
- **Données** : OANDA (forex/métaux/énergie), Binance (crypto), Finnhub/Marketaux (news), FRED (macro), FairEconomy (calendrier éco). Tiers gratuits → rate limits gérés.
- **Sécurité** : clés en `.env` non commitées, service_role réservé aux jobs, RLS stricte ; portefeuille crypto de la plateforme = clés jamais dans le code ni la DB (cold wallet pour les fonds, watcher en lecture seule).
- **Légal — ATTENTION RENFORCÉE POST-PIVOT** : vendre des signaux à un public non averti = exposition réglementaire réelle (conseil en investissement non agréé). Positionnement strictement éducatif + disclaimers systématiques. ⚠️ La réglementation crypto en Algérie (interdiction légale des crypto-monnaies) et dans certains pays ciblés est un risque structurel à traiter (structure juridique, juridiction d'exploitation) **avant d'encaisser le premier abonnement**.
- **Robustesse routines** : PC potentiellement éteint → jobs idempotents + monitoring `job_runs` + Windows Task Scheduler en backup. Pour une plateforme publique payante, la fiabilité des publications devra être garantie (à trancher : migration vers clé API/infra cloud au lancement).

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Forfait Max + routines planifiées (pas de clé API) tant que viable | Coût zéro, backend ne fait que lire Supabase | — Pending |
| Marchés : crypto + forex + or/argent/pétrole | Sources gratuites, 24/7 crypto, audience crypto-friendly | — Pending |
| Styles Day + Swing d'abord, scalping plus tard | Même moteur ; scalping = temps réel coûteux | — Pending |
| Indicateurs calculés en code, Claude raisonne seulement | Évite l'hallucination de chiffres | — Pending |
| Stack Next.js + Supabase | Compétences fondateur, MCP connecté | — Pending |
| **2026-06-13 — PIVOT PRODUIT** : plateforme publique payante (9 $/mois) d'analyses + signaux, vitrine + espace membre, audience MENA non technique, trilingue AR/EN/FR | Passage direct au produit ; l'outil perso n'est plus l'objectif | — Pending |
| **2026-06-13** — Paiement exclusivement en USDT vers portefeuille crypto, détection on-chain des paiements, commissions affiliés en crypto | Audience MENA : carte bancaire inadaptée, USDT dominant ; pas de Stripe | — Pending |
| **2026-06-13** — Affiliation à paliers basée sur les abonnés actifs ramenés (code promo), palier max 20 % récurrent | Acquisition par influenceurs, alignement long terme | — Pending |
| **2026-06-13** — % de réussite affiché = taux des patterns backtestés d'abord, track record réel ensuite | Honnêteté produit : jamais un chiffre non mesuré | — Pending |
| % de réussite des patterns = mesuré par notre backtest, jamais affirmé | Honnêteté produit + risque légal | — Pending |
| Revue légale obligatoire AVANT d'encaisser le premier abonnement (conseil non agréé + statut crypto dans les pays cibles, dont l'Algérie) | Exposition réglementaire réelle | — Pending |
| **2026-06-13** — Paiement en deux étages : MVP = soumission TX hash (+ screenshot) vérifiée via TronGrid + file superadmin ; ensuite processeur crypto automatisé | Démarrer immédiatement sans dépendre d'un tiers, automatiser ensuite | — Pending |
| **2026-06-13** — Moteur : routines Claude Max pendant la construction, migration clé API Anthropic au lancement payant | Coût zéro avant revenus, fiabilité 24/7 quand des abonnés paient | — Pending |
| **2026-06-13** — Lancement payant direct (influenceurs déjà engagés) + offre découverte 3 $/15 jours | Pas d'attente de track record ; l'offre d'essai abaisse la barrière ; le Telegram public accumule le track record en parallèle | — Pending |
| Phases 1-2 (fondations, ingestion) inchangées par le pivot ; roadmap aval (phases 3+) à réviser | Le cœur analytique sert les deux visions ; ne pas geler l'exécution | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-14 — Milestone v1.0 (moteur analytique P1-4) clôturé et archivé ; démarrage du milestone v2.0 « Plateforme publique d'analyse & signaux (MENA) ». Cœur analytique livré (P1-4, 261/261 tests). v2.0 = vitrine trilingue + espace membre + paiement USDT + affiliation + superadmin + CMS + Telegram + track record mesuré. Numérotation des phases reset à 1 ; roadmap v1.0 dans `.planning/archive/v1.0-moteur-analytique/`.*
