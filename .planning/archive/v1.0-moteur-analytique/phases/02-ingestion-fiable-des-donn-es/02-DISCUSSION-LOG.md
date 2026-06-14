# Phase 2: Ingestion fiable des données - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-12
**Phase:** 2-Ingestion fiable des données
**Areas discussed:** Univers d'instruments MVP, Profondeur d'historique (backfill), Cadence d'ingestion & politique stale, Périmètre & mapping des news

---

## Univers d'instruments MVP

| Option | Description | Selected |
|--------|-------------|----------|
| 5 majors liquides | BTC, ETH, SOL, BNB, XRP — diversité pour le scoring sans saturer les rate limits | ✓ |
| BTC + ETH seulement | Minimal, extensible plus tard | |
| Top 10 par volume | Plus d'opportunités mais plus d'analyses par routine (quota ~15/j) | |

| Option | Description | Selected |
|--------|-------------|----------|
| 4 majors USD | EUR/USD, GBP/USD, USD/JPY, AUD/USD — liquides, bien couvertes par les news macro | ✓ |
| Majors + crosses (7-8) | Plus de divergences mais crosses plus dures fondamentalement | |
| EUR/USD seulement | Ultra-minimal, peu d'opportunités | |

| Option | Description | Selected |
|--------|-------------|----------|
| XAU + XAG + WTI | WTI plus liquide/suivi que le Brent côté retail (WTICO_USD) | ✓ |
| XAU + XAG + Brent | Référence mondiale, sensibilité géopolitique | |
| XAU + XAG + WTI + Brent | Spread possible mais très corrélés | |

| Option | Description | Selected |
|--------|-------------|----------|
| Table + flag actif | instruments.is_active — ajout/désactivation = UPDATE SQL | ✓ |
| Liste figée en code | Constante packages/core, redéploiement par ajout | |
| Tu décides | — | |

| Option | Description | Selected |
|--------|-------------|----------|
| Paires USDT | Les plus liquides, dispo testnet spot | ✓ |
| Paires USDC | Liquidité/historique moindres, testnet incertain | |
| Tu décides | — | |

| Option | Description | Selected |
|--------|-------------|----------|
| Essentiel trading | Catégorie, symbole par source, décimales, horaires de cotation | ✓ |
| Minimal (symbole + catégorie) | Juste le routage source | |
| Tu décides | — | |

| Option | Description | Selected |
|--------|-------------|----------|
| Format lisible unifié | BTC/USD, EUR/USD… + colonne mapping symbole source | ✓ |
| Symbole source brut | BTCUSDT, EUR_USD tels quels | |
| Tu décides | — | |

| Option | Description | Selected |
|--------|-------------|----------|
| Skip + log + continuer | Erreur tracée dans job_runs.stats, les autres continuent | ✓ |
| Désactivation auto | is_active=false après N échecs | |
| Tu décides | — | |

**User's choice:** toutes les options recommandées (univers de 12 instruments : 5 crypto USDT, 4 forex majors, XAU/XAG/WTI).

---

## Profondeur d'historique (backfill)

| Option | Description | Selected |
|--------|-------------|----------|
| 2 ans daily + ~6 mois H4/H1 | Couvre indicateurs + structure + futur backtest patterns | ✓ |
| Minimum indicateurs (~500/TF) | Backfill profond reporté | |
| Maximum disponible | Pulls longs, volume DB conséquent | |

| Option | Description | Selected |
|--------|-------------|----------|
| Même job auto-rattrapant | Gap fill depuis la dernière bougie en base — un seul code | ✓ |
| Job backfill séparé | Deux chemins de code, l'incrémental ne rattrape pas les trous | |
| Tu décides | — | |

| Option | Description | Selected |
|--------|-------------|----------|
| News au fil de l'eau + macro 2 ans | Free tiers limitent l'historique news ; FRED gratuit illimité | ✓ |
| Tout au fil de l'eau | Contexte macro sans recul | |
| Historique news maximal | Limité par les free tiers | |

| Option | Description | Selected |
|--------|-------------|----------|
| Pas de purge en P2 | Volumes ≪ 500 Mo free tier, tout gardé pour le backtest | ✓ |
| Purge glissante H1 | Économise mais ampute le backtest intraday | |
| Tu décides | — | |

**User's choice:** toutes les options recommandées.

---

## Cadence d'ingestion & politique stale

| Option | Description | Selected |
|--------|-------------|----------|
| Horaire | Task Scheduler horaire, H1 frais à ±1 h, gap fill rattrape | ✓ |
| Aux ouvertures de session + EOD | 4-5 runs/j, H1 en retard entre sessions | |
| Toutes les 15 min | Surdimensionné pour day/swing | |

| Option | Description | Selected |
|--------|-------------|----------|
| News horaire, macro 1×/jour | Un seul déclencheur horaire + pull FRED quotidien | ✓ |
| Tout horaire | 23 pulls FRED inutiles/jour | |
| News aux sessions seulement | Risque de rater un catalyseur | |

| Option | Description | Selected |
|--------|-------------|----------|
| 2× le timeframe attendu | H1→2h, H4→8h, Daily→48h, news→2h, macro→48h, horaires de cotation pris en compte | ✓ |
| Seuil fixe global | Faux pour H1 et Daily à la fois | |
| Tu décides | — | |

| Option | Description | Selected |
|--------|-------------|----------|
| Visible + analyse bloquée | Staleness exposée + le moteur P4 refusera d'analyser sur stale | ✓ |
| Visible seulement | Badge warning, analyse tourne quand même | |
| Tu décides | — | |

**User's choice:** toutes les options recommandées.

---

## Périmètre & mapping des news

| Option | Description | Selected |
|--------|-------------|----------|
| Mapping par requête ciblée | Providers interrogés PAR instrument/catégorie — news déjà mappée | ✓ |
| Flux global + matching mots-clés | Matching maison fragile | |
| Hybride | Requêtes ciblées + flux macro général | |

| Option | Description | Selected |
|--------|-------------|----------|
| Finnhub primaire, Marketaux fallback | Économe en quota, dédup simple | ✓ |
| Les deux en parallèle + dédup | Couverture max, deux sentiments à concilier | |
| Finnhub seul en P2 | Marketaux reporté | |

| Option | Description | Selected |
|--------|-------------|----------|
| Sentiment du provider | Stocké tel quel avec la source — déterministe, zéro coût | ✓ |
| Brut sans sentiment | Évaluation par Claude en P4 (coût contexte) | |
| Les deux | Provider + champ libre recalcul | |

| Option | Description | Selected |
|--------|-------------|----------|
| Calendrier éco dans P2 | Source gratuite à valider en recherche ; P3 consommera une table remplie | ✓ |
| Reporté en P3 | Risque de rouvrir l'ingestion en pleine P3 | |
| Tu décides | — | |

**User's choice:** toutes les options recommandées.

---

## Claude's Discretion

- Schéma SQL exact des tables (candles, news, macro, calendrier) — colonnes, index, clés uniques d'upsert.
- Structure interne de `packages/data-sources`.
- Valeurs `p-limit`/`p-retry` par source.
- Représentation des horaires de cotation et calcul du seuil stale hors heures de marché.
- Découpage et noms des jobs dans le dispatcher.

## Deferred Ideas

- Brent (BCO_USD) — ajout via is_active plus tard.
- Désactivation auto d'un instrument après N échecs.
- Historique news profond / backtest dimension news (phase patterns v1.1).
- Purge / rétention glissante H1.
- Sentiment recalculé maison.
- Actions/equities (STOCK-01..02, v1.1).
