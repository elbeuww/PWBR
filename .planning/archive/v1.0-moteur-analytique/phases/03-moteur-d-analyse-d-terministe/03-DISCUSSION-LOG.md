# Phase 3: Moteur d'analyse déterministe - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-13
**Phase:** 03-moteur-d-analyse-d-terministe
**Areas discussed:** Détection de structure, Niveaux S/R + volume, Timeframes ↔ style, Fundamental + News

---

## Détection de structure

### Méthode de détection des swings
| Option | Description | Selected |
|--------|-------------|----------|
| Pivot fractal + filtre ATR | Pivot sur N bougies retenu si amplitude > k×ATR. Déterministe, robuste au bruit, paramétrable par TF | ✓ |
| ZigZag à seuil ATR% | Garde les retournements > X%. Plus lisse mais dépend du seuil, rate les structures fines en range | |
| Pivot fractal pur | Pivot N bougies sans filtre. Simple mais bruité, faux swings en consolidation | |

**User's choice:** Pivot fractal + filtre ATR (Recommandé)

### Confirmation BOS/CHoCH
| Option | Description | Selected |
|--------|-------------|----------|
| Clôture du corps au-delà | Validé seulement si une bougie clôture au-delà du swing. Anti stop-hunt, cohérent bougie clôturée | ✓ |
| Touche/mèche suffit | Cassé dès qu'une mèche dépasse. Plus réactif mais beaucoup de faux signaux | |

**User's choice:** Clôture du corps au-delà (Recommandé)
**Notes:** N (lookback) et k (multiplicateur ATR) restent à figer par golden tests en research/planning.

---

## Niveaux S/R + volume

### Dérivation S/R et force
| Option | Description | Selected |
|--------|-------------|----------|
| Clusters de swings + score multi-facteurs | Zones de regroupement de swings (tolérance ATR). Force = touches + ancienneté + récence | ✓ |
| Clusters, force = nb touches seul | Même base, force = nombre de tests uniquement. Ignore l'âge/récence | |
| Pivots classiques PP/R1/S1 | Formules de pivots journaliers. Très déterministe mais mécanique, pas de mémoire de prix | |

**User's choice:** Clusters de swings + score multi-facteurs (Recommandé)

### Problème du volume forex
| Option | Description | Selected |
|--------|-------------|----------|
| Vrai volume crypto, tick-volume FX, flag source | POC crypto réel ; FX tick volume (proxy) avec volume_state ; source taggée par key_level | ✓ |
| POC crypto uniquement, rien sur FX | POC/volume_state seulement avec vrai volume. FX sans dimension volume | |
| Pas de POC volume en P3 | Report total de la dimension volume. Mais ARCHITECTURE.md prévoit 'poc' dans key_levels | |

**User's choice:** Volume réel crypto, tick-volume FX, flag source (Recommandé)

---

## Timeframes ↔ style

### Mapping TF → rôle HTF/LTF
| Option | Description | Selected |
|--------|-------------|----------|
| Day: H4→H1 / Swing: D→H4 | Day HTF=H4/LTF=H1, Swing HTF=Daily/LTF=H4. Colle aux 3 TF ingérés | ✓ |
| Day: D→H1 / Swing: D→H4 | Day regarde Daily directement (saut H4). Ignore la structure H4 intermédiaire | |
| Les deux styles utilisent les 3 TF | D+H4+H1 dans chaque snapshot. Plus riche mais alourdit et brouille day/swing | |

**User's choice:** Day: H4→H1 / Swing: D→H4 (Recommandé)

### Périodes d'indicateurs
| Option | Description | Selected |
|--------|-------------|----------|
| Standards, identiques tous TF | RSI 14, MACD 12/26/9, EMA 20/50/200, ATR 14, BB 20/2. Éprouvés, comparables, golden tests | ✓ |
| Ajustées par style | Périodes différentes day vs swing. Sur-mesure mais multiplie golden values, sur-optimisation | |

**User's choice:** Standards, identiques tous TF (Recommandé)

---

## Fundamental + News

### Dérivation macro_bias + drivers
| Option | Description | Selected |
|--------|-------------|----------|
| Règles + table de drivers par actif | macro_bias depuis règles FRED ; table maison actif→drivers, extensible par UPDATE | ✓ |
| macro_bias global seul | Un biais unique, pas de personnalisation par actif. Perd la finesse or vs BTC | |
| Snapshot macro brut, biais à la P4 | Expose les séries sans biais. Mais ARCHITECTURE.md veut macro_bias calculé en déterministe | |

**User's choice:** Règles + table de drivers par actif (Recommandé)

### Agrégation net_sentiment
| Option | Description | Selected |
|--------|-------------|----------|
| Fenêtre par style + décroissance | Moyenne pondérée par instrument, fenêtre alignée style (24h day / 7j swing), décroissance temporelle | ✓ |
| Moyenne simple 24h fixe | Non pondérée sur 24h. Simple mais vieille news = poids égal, perd le swing >24h | |
| Dernier sentiment connu | Sentiment de la news la plus récente. Minimal mais très bruité | |

**User's choice:** Fenêtre par style + décroissance (Recommandé)
**Notes:** Bornes exactes de fenêtre et fonction de décroissance à figer en planning. news_risk (<2h day / <24h swing) déjà LOCKED par ARCHITECTURE.md.

---

## Claude's Discretion

- Décision d'architecture tranchée pendant la discussion (non soumise au choix) : **table `snapshots` dédiée** (D-41), datée par instrument×style, hash de contenu = `raw_indicators_ref`, référencée par la Phase 4.
- API exacte des wrappers `packages/indicators` et structure interne du sous-module `structure`.
- Schéma SQL précis de `snapshots`, clé d'idempotence, RLS.
- Valeurs numériques à figer par golden tests : N et k (pivot/ATR), tolérance ATR du clustering S/R, bornes/décroissance du sentiment, seuils des règles macro.
- Découpage des jobs (snapshot global vs un par moteur) et noms dans le dispatcher.
- Gestion des instruments sans assez d'historique pour EMA200.

## Deferred Ideas

- Catalogue de patterns chartiques déterministes (PATT-01) + mesure du taux de réussite (PATT-02) — transverse v1.1.
- Périodes d'indicateurs adaptatives par style/volatilité — rouvrable si la calibration P9 le justifie.
- Sentiment recalculé maison (vs provider) — déjà reporté en P2 (D-30).
- Indicateurs additionnels (Stochastique, ADX, Ichimoku) — non scopés par TECH-01.
- Détection de divergences RSI/MACD vs structure — raffinement vétéran post-MVP.
