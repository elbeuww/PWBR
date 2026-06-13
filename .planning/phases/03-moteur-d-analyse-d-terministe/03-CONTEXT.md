# Phase 3: Moteur d'analyse déterministe - Context

**Gathered:** 2026-06-13
**Status:** Ready for planning
**Mode:** mvp

<domain>
## Phase Boundary

Produire, en **code déterministe (zéro IA)**, les trois snapshots que le moteur vétéran (Phase 4) consommera — à partir des bougies / macro / news déjà ingérées en Phase 2 :

- **`technical_snapshot`** par instrument × style : tendance HTF/LTF, momentum, volatilité, niveaux clés, structure, volume_state (TECH-01..04).
- **`fundamental_context`** par instrument : biais macro risk_on/off, environnement de taux, drivers par actif (FUND-01).
- **`news_context`** par instrument : sentiment net, catalyseurs récents, events à venir avec flag `news_risk` (FUND-02, FUND-03).

Le module **technical-engine** calcule indicateurs (via `packages/indicators` wrappant `technicalindicators`) **+ détection de structure de marché MAISON** (HH/HL, swings, BOS/CHoCH, S/R, volume) — la lib ne fournit PAS la structure. Les snapshots sont persistés dans une table dédiée, traçables et testables isolément.

**Formes de sortie LOCKED** par `ARCHITECTURE.md §3` — ne pas réinventer, s'y conformer.

**Hors périmètre Phase 3** : raisonnement vétéran / scoring /100 / setups JSON (Phase 4 — veteran-analyzer + scoring-aggregator), dashboard (Phase 5+), calculateur de sizing (Phase 7), backtest (Phase 9), patterns chartiques catalogués (v1.1 PATT-01), actions/scalping temps réel (v1.1).

</domain>

<decisions>
## Implementation Decisions

### Détection de structure de marché (cœur "vétéran" — research flag)
- **D-32:** Swing highs/lows = **pivot fractal + filtre ATR** — un pivot sur N bougies (lookback symétrique) n'est retenu comme swing que si son amplitude dépasse k×ATR. Déterministe, robuste au bruit, paramétrable par TF. Écarté : ZigZag à seuil ATR% (trop dépendant du seuil, rate les structures fines en range) et pivot fractal pur (bruité, faux swings en consolidation). **Valeurs exactes de N et k = research/planning** (à figer par golden tests).
- **D-33:** BOS/CHoCH **confirmés par la CLÔTURE du corps** au-delà du swing — une simple mèche ne valide pas la cassure. Discipline vétéran (anti stop-hunt/faux break) et cohérent avec la convention de bougie clôturée déjà codée dans `packages/core`. Écarté : touche/mèche suffit (trop de faux signaux).

### Niveaux clés S/R + dimension volume
- **D-34:** S/R = **clusters de swings** (regroupement des swing highs/lows de D-32 dans une tolérance ATR). **Force = score multi-facteurs** : nombre de touches + ancienneté + récence du dernier test. Découle directement de la structure détectée. Écarté : force = nb de touches seul (ignore l'âge/récence) ; pivots classiques PP/R1/S1 (mécaniques, pas de mémoire de prix réelle).
- **D-35:** **Problème volume résolu par source** : crypto Binance a un **vrai volume** → POC calculé ; forex/commodities OANDA n'a que du **tick volume** (proxy d'activité, déjà présent dans les candles) → `volume_state` calculé, POC marqué **`proxy`**. Chaque `key_level` de type `poc` porte la **source du volume** (real/tick). Honnête et exploitable par le vétéran. Écarté : POC crypto uniquement (perd le signal tick FX) ; pas de POC en P3 (ARCHITECTURE.md prévoit `poc` dans key_levels).

### Timeframes ↔ style & périodes d'indicateurs
- **D-36:** Mapping TF → rôle : **Day = HTF H4 / LTF H1** ; **Swing = HTF Daily / LTF H4**. Colle aux 3 TF déjà ingérés (H1/H4/D), aucun TF manquant. `trend_htf`/`trend_ltf` calculés sur ces paires. Écarté : Day D→H1 (saute la structure H4 intermédiaire) ; les deux styles sur les 3 TF (alourdit le snapshot, brouille day/swing).
- **D-37:** Périodes d'indicateurs **standards et identiques sur tous les TF** : RSI 14, MACD 12/26/9, EMA 20/50/200, ATR 14, Bollinger 20/2. Éprouvées, attendues par les golden tests, comparables entre instruments. EMA200 justifie le backfill 2 ans déjà décidé (D-21). Écarté : périodes ajustées par style (multiplie les golden values, risque de sur-optimisation prématurée).

### Fundamental & News (dérivation déterministe, sans IA)
- **D-38:** `macro_bias` (risk_on/off/neutral) + `rate_environment` (hawkish/dovish/neutral) dérivés de **règles déterministes sur les séries FRED** (ex. DXY ↗ + real yields ↗ → risk_off). Une **table maison de drivers par actif** mappe chaque instrument à ses moteurs (or ↔ DXY/real-yields, JPY ↔ différentiel de taux, crypto ↔ risk sentiment/DXY). Transparent, testable, **extensible par UPDATE SQL** (cohérent avec la philosophie data-not-code de D-17). Écarté : biais global sans personnalisation par actif ; snapshot macro brut laissé à la P4 (ARCHITECTURE.md veut macro_bias déjà calculé).
- **D-39:** `net_sentiment` = **moyenne pondérée des sentiments news par instrument, fenêtre alignée au style** (≈ 24h day / 7j swing) **avec décroissance temporelle** (news récente pèse plus). `recent_catalysts` = top items de la fenêtre. Écarté : moyenne simple 24h fixe (vieille news = poids égal) ; dernier sentiment connu (trop bruité). **Bornes exactes de fenêtre + fonction de décroissance = planning.**
- **D-40:** `news_risk` = events économiques high-impact imminents **< 2h (day) / < 24h (swing)** par instrument/style — seuils LOCKED par `ARCHITECTURE.md §3`. Consomme la table calendrier éco déjà remplie en P2 (D-31).

### Persistance des snapshots (architecture — tranchée)
- **D-41:** **Table `snapshots` dédiée** — un snapshot daté par (instrument, style, timeframe-set), avec un **hash de contenu** servant de `raw_indicators_ref`. La Phase 4 référence le snapshot exact par ce hash (traçabilité immuable exigée par ARCHITECTURE.md §250 / success criterion P4-4). Rend la Phase 3 **testable isolément** (golden snapshot) et consultable (dashboard futur). Écarté : calcul à la volée figé seulement dans `analyses.snapshot` (pas testable seul, pas de cache, recalcul à chaque run vétéran).

### Claude's Discretion
- API exacte des wrappers `packages/indicators` (signatures, formats d'entrée OHLCV).
- Structure interne de `packages/indicators/structure` (fichiers swings / BOS-CHoCH / S-R / volume).
- Schéma SQL précis de la table `snapshots` (colonnes, index, type du jsonb, clé d'idempotence) dans le respect d'ARCHITECTURE.md §4 et des conventions P1/P2 (snake_case, RLS lecture authentifiés / écriture service_role, types régénérés).
- Valeurs numériques à figer par golden tests : N (lookback pivot) et k (multiplicateur ATR) de D-32, tolérance ATR du clustering S/R (D-34), bornes de fenêtre et fonction de décroissance du sentiment (D-39), seuils des règles macro (D-38).
- Découpage des jobs/moteurs (un job snapshot global vs un par moteur technique/fundamental/news) et nom(s) dans le dispatcher `apps/jobs`.
- Gestion des instruments sans assez d'historique pour EMA200 (skip indicateur vs snapshot partiel flaggé) — à arbitrer en planning.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture & schémas de sortie (LOCKED)
- `ARCHITECTURE.md` §2 (tableau modules : technical-engine / fundamental-engine / news-engine, entrées → sorties) et **§3 (formes exactes de `technical_snapshot`, `fundamental_context`, `news_context`)** — source de vérité des snapshots. Les sorties de P3 DOIVENT s'y conformer champ par champ.
- `ARCHITECTURE.md` §4 (schéma Supabase, convention snake_case / PK uuid / timestamps UTC) + §250 (traçabilité : chaque analyse stocke le snapshot exact) — cadre la table `snapshots` (D-41).

### Décisions amont à respecter
- `.planning/phases/02-ingestion-fiable-des-donn-es/02-CONTEXT.md` — univers 12 instruments (D-14..18), symboles canoniques/par source, métadonnées (catégorie, price_decimals, quote_hours), calendrier éco ingéré (D-31), staleness consultable (D-26/27 — P4 bloquera sur stale).
- `.planning/phases/01-fondations-s-curit/01-CONTEXT.md` — conventions temps (bougie clôturée, UTC, daily OANDA 17:00 NY / Binance 00:00 UTC) codées dans `packages/core` : **à consommer, jamais redéfinir**.

### Stack & contraintes
- `CLAUDE.md` (racine) — stack verrouillée : `technicalindicators 3.1.0` wrappé dans `packages/indicators` (lib **stale 2023**, figer le comportement par golden tests) ; **§What NOT to Use** : la structure de marché (HH/HL, BOS/CHoCH, swings, POC) n'existe PAS dans la lib → coder maison dans `packages/indicators/structure`. luxon pour sessions/TZ. Zod v4. Tests Vitest cible 80 %.
- `.planning/REQUIREMENTS.md` — TECH-01, TECH-02, TECH-03, TECH-04, FUND-01, FUND-02, FUND-03 (texte complet).
- `.planning/ROADMAP.md` §Phase 3 — goal et 4 success criteria.

### Données disponibles en base (sorties Phase 2)
- Table `candles` (instrument_id, timeframe H1/H4/D, ts, OHLCV + tick volume) — ~30 935 bougies crypto réelles déjà présentes ; OANDA en attente de confirmation du compte démo.
- Tables `macro_series` (séries FRED : DFF, CPIAUCSL, DTWEXBGS≈DXY, DFII10≈real yields), `news` (sentiment provider), `economic_calendar` (events FairEconomy) — repositories typés dans `packages/supabase`.

### Recherche à mener (research flag Phase 3)
- **Algos déterministes de structure maison** : pivot fractal (choix de N), filtre ATR (choix de k), détection BOS/CHoCH sur clôture, clustering S/R, POC volume (real vs tick) — état de l'art + pièges, pour figer les paramètres par golden values. C'est l'effort le plus sous-estimé de la phase.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/core` — constantes temps (bougie clôturée, UTC, daily cross-asset) déjà testées (16/16 golden) : les calculs de TF/structure les consomment.
- `packages/supabase` — client typé + pattern repositories (candles/news/macroSeries/economicCalendar déjà créés en P2) + migrations Supabase CLI + types régénérés. Ajouter un repository `snapshots`.
- `apps/jobs` (`runJob` + `dispatch.ts`) — infra d'exécution + monitoring `job_runs` ; le(s) job(s) snapshot s'y enregistrent comme les jobs d'ingestion.
- `run-job.cmd` (ASCII+CRLF) — déclencheur Task Scheduler réutilisable pour lancer le calcul des snapshots après l'ingestion.

### Established Patterns
- Migrations SQL versionnées + RLS sur toute nouvelle table (données marché = lecture authentifiés, écriture service_role) + types TS régénérés après migration.
- Golden value tests (fixtures offline) pour tout calcul déterministe — déjà la norme (`packages/core`, parsers data-sources). Étendre aux indicateurs ET à la structure.
- ESM only (`tsx`), moduleResolution Bundler, imports sans extension, `noEmit` sur packages consommés en source.

### Integration Points
- `packages/indicators` (nouveau, prévu par ARCHITECTURE.md §2) — wrappers indicateurs + sous-module `structure` maison. Consommé par le technical-engine.
- Nouvelle table `snapshots` (Supabase) — sous-ensemble cohérent d'ARCHITECTURE.md §4, RLS dès la création, hash de contenu = `raw_indicators_ref`.
- Jobs P3 lisent `candles`/`macro_series`/`news`/`economic_calendar`, écrivent `snapshots` — purement déterministes, aucun appel IA.

</code_context>

<specifics>
## Specific Ideas

- Le critère qui compte : **un même jeu de bougies produit toujours le même snapshot** (déterminisme prouvable par golden test) et **la structure maison (swings/BOS/CHoCH) est vérifiée sur des cas connus** — c'est le différenciateur "vétéran".
- La séparation ARCHITECTURE.md est sacrée : **le code calcule les chiffres, Claude (P4) raisonne** — aucun nombre d'indicateur ne doit être laissé à l'IA (anti-hallucination + économie de tokens).
- La table de drivers par actif (D-38) est pensée comme **données extensibles par UPDATE**, pas du code en dur — même philosophie que l'univers d'instruments (D-17).
- Honnêteté du volume (D-35) : ne jamais présenter un POC tick-volume FX comme un vrai POC — le flag de source est non négociable.

</specifics>

<deferred>
## Deferred Ideas

- **Catalogue de patterns chartiques déterministes (PATT-01)** et **mesure de leur taux de réussite réel (PATT-02)** — transverse v1.1, à brancher sur le moteur de structure une fois prouvé (mentionné ROADMAP §Scope Update). Hors P3.
- **Périodes d'indicateurs adaptatives par style/volatilité** — écarté en P3 (sur-optimisation prématurée) ; rouvrable si la calibration P9 le justifie.
- **Sentiment recalculé maison** (vs provider) — déjà reporté en P2 (D-30) ; le provider suffit, le net_sentiment P3 se contente d'agréger.
- **Indicateurs additionnels** (Stochastique, ADX, Ichimoku…) — non demandés par TECH-01 ; ajout possible plus tard via le wrapper sans changer l'architecture.
- **Détection de divergences RSI/MACD vs structure** — raffinement vétéran intéressant mais non scopé ; candidat à une phase d'enrichissement post-MVP.

### Reviewed Todos (not folded)
None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-moteur-d-analyse-d-terministe*
*Context gathered: 2026-06-13*
