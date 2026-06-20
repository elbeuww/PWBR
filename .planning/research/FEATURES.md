# Feature Research — Milestone v2.1 « Mise en vie : identité NEXA, moteur live & track record »

**Domain:** Plateforme d'analyse/signaux trading (MENA, non-technique, trilingue AR-RTL/EN/FR) — milestone subséquent sur app v2.0 déjà livrée.
**Researched:** 2026-06-20
**Confidence:** HIGH (design + scheduling + backtest tous ancrés sur le code/infra existant lu : `persist.ts`, `outcome.ts`, `pattern_stats` view 0014, `sessions.ts`, `Nexa - Landing.html`). MEDIUM seulement sur les conventions externes « état de l'art » UI (non re-vérifiées web, jugées stables).

Périmètre : **uniquement le comportement attendu des 3 NOUVELLES capacités** (design system NEXA, routines IA planifiées, backtest + bascule track record). Tout le reste (pages, paiement, académie, affiliation, infra track-record) est **déjà livré** et hors recherche.

---

## Axe 1 — DESIGN SYSTEM « NEXA »

### Ce que « bon » veut dire pour une UI de signaux financiers

Le HTML de référence (`Nexa - Landing.html`, encore brandé MERA) fixe l'intention : OKLCH, multi-thème `volt`/`green` via `data-theme`, tokens sémantiques (`--bg`, `--surface`, `--line`, `--sub`, `--mute`, `--primary`, `--buy`, `--sell`, `--text`, `--mono`), gauges de score en anneau SVG, cartes signal, niveaux entrée/SL/TP, stats de confiance, marquee. Tout est déjà exprimé en **variables CSS sémantiques** — c'est la cible d'architecture, pas une refonte par page.

### Table Stakes (attendu — sinon l'app paraît cassée/amateur)

| Feature | Why Expected | Complexity | Notes / dépendances infra |
|---------|--------------|------------|---------------------------|
| **Token layering primitive→semantic→component** | Sans couche sémantique, chaque thème = réécriture par page | MEDIUM | Le mock définit déjà les tokens sémantiques (`--bg/--surface/--line/--buy/--sell/--primary`). À porter en `@theme`/`:root` Tailwind v4 CSS-first. **Existant à remplacer** : v2.0 P2 a livré « 2 thèmes bleus » + polices Inter/IBM Plex Arabic — NEXA remplace par volt/green + Archivo/Chakra Petch/Space Grotesk/JetBrains Mono/Noto Sans Arabic. |
| **Multi-thème volt/green, switch sans flash (no-FOUC)** | Thème appliqué après hydratation = flash blanc/mauvaise couleur au 1er paint | MEDIUM | `data-theme` sur `<html>` posé par script inline pré-hydratation (lecture cookie/localStorage). **Existant à réutiliser** : v2.0 P2 a déjà livré un `ThemeToggle` no-flash RTL-safe — étendre, pas réinventer. |
| **RTL safety (arabe) sur tous les composants du design** | Audience #1 = arabe ; gauges/cartes/niveaux cassent si codés en left/right physiques | MEDIUM | Propriétés logiques Tailwind v4 natives (déjà la norme du projet, « pas de tailwindcss-rtl »). Le mock est `dir=ltr` → **chaque composant porté doit être re-testé en `dir=rtl`** (ordre niveaux, sens anneau, marquee). |
| **Application transversale sans CSS bespoke par page** | Vitrine + membre + académie + auth + admin doivent partager le même langage | MEDIUM-HIGH | Composants partagés (SignalCard, ScoreGauge, LevelsRow, TrustStat) consommant les tokens. Risque = dérive si une page recode ses couleurs en dur. |
| **Score gauge (anneau /100) lisible + accessible** | C'est l'objet central de confiance du produit | LOW-MEDIUM | Anneau SVG `stroke-dasharray` (déjà dans le mock). Couleur par bande (vert haut / ambre moyen / rouge bas). **Contrainte** : doit aussi exister en variante non-promesse (le score ≠ % de réussite — voir anti-features). |
| **Signal card (symbole, direction buy/sell, score, source, TF, style)** | Unité de scan de la liste membre | LOW | Mock fournit la maquette exacte (`fc-dir buy/sell`, ring, `Binance · 4H · Day`). Mappe sur `trade_setups` existants. |
| **Levels row entrée / SL / TP1·2·3 / (levier)** | Le « plan de trade » est le livrable | LOW | `sd-levels` dans le mock. Couleurs sémantiques `--sell` (stop), `--buy` (TP), `--primary` (levier). **Données déjà persistées** par `persist.ts` (`entry_price` conservateur, `stop_loss`, `take_profits` jsonb, `risk_reward`). |
| **Trust stats (taux mesuré, instruments suivis, styles)** | Bandeau de preuve | LOW | Mock : `data-count` animés. **Le « 73 % » du mock est un placeholder de démo** — en prod il DOIT venir de `pattern_stats` seuillé (jamais codé en dur). |
| **Polices self-hostées (perf + offline MENA)** | Google Fonts CDN lent/bloqué selon réseau ; CLS si FOUT | LOW-MEDIUM | Mock charge via `fonts.googleapis.com` — **à self-host** (le projet self-hoste déjà ses polices en P2). 5 familles + Noto Sans Arabic obligatoire pour AR. |

### Differentiators (avantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Double univers de marque volt/green** | Identité forte, mémorable ; rare sur un produit de signaux | LOW (une fois le token layering en place) | Quasi gratuit si les tokens sont bien couchés. Persistance du choix utilisateur. |
| **Gauge animée + scène hero (globe, float-cards, data-rain, marquee)** | « Make it feel alive » → perçu premium/sérieux par un public non-technique | MEDIUM-HIGH | `landing.js` non fourni → **reconstruction interprétative** (parallax `data-depth`, reveal, count-up, tilt). Respecter `prefers-reduced-motion`. |
| **Cohérence design jusque dans l'admin/auth** | La plupart des concurrents ont une vitrine léchée + un back-office laid | MEDIUM | Différenciateur de soin, pas de fonction. |

### Anti-Features (design)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Slogan « Make Everybody Rich Again » / promesse de gain visuelle** | Présent dans le mock, accrocheur | **Viole la contrainte légale dure** (aucune promesse de gain avant encaissement) ; déjà tranché 2026-06-20 | Baseline NEXA « Nouvelle Ère · Alliance d'Échange ». Écarter tout copy/visuel suggérant un gain. |
| **% de réussite codé en dur dans le composant (le « 73 % » du mock)** | Le mock le montre, ça « décore » | Affiche un chiffre non mesuré → casse le socle de confiance | Toujours brancher trust-stats/gauge sur `pattern_stats` seuillé ; « échantillon insuffisant » si N<30. |
| **Refonte page-par-page avec CSS ad-hoc** | Plus rapide visuellement à court terme | Dette : 5 surfaces qui divergent, thèmes cassés, RTL non testé | Couche tokens + composants partagés d'abord, pages ensuite. |
| **Confondre `opportunity_score /100` et `% de réussite`** | Les deux sont des « chiffres de confiance » | Le score est généré (qualité du setup) ; le % est mesuré (backtest/réel) — les fusionner ré-introduit un chiffre inventé | Deux UI distinctes : gauge = score ; trust-stat/bandeau = % mesuré seuillé. |

---

## Axe 2 — ROUTINES IA PLANIFIÉES (Claude Code Remote, sans clé API)

### Comment l'agent autonome décide des « moments opportuns » day vs swing

Logique **déjà à moitié spécifiée** dans le code : `apps/jobs/config/sessions.ts` mappe chaque session → classes d'actifs + styles, avec les crons UTC en commentaire. C'est la source de vérité.

| Session | Cron UTC (config agent, hors git) | Styles produits | Classes d'actifs | Rationale timing |
|---------|-----------------------------------|-----------------|------------------|------------------|
| `asia` | `00 23 * * 0-4` | **day** | forex, metal, crypto | Pré/ouverture Tokyo (00:00 UTC). Pas d'énergie (marché inactif). |
| `london` | `00 07 * * 1-5` | **day + swing** | forex, metal, energy, crypto | Ouverture Londres (la session la plus liquide FX) → fenêtre day la plus riche. |
| `newyork` | `30 12 * * 1-5` | **day** | forex, metal, energy, crypto | Pré-ouverture NY (13:00 UTC). |
| `eod-swing` | `00 21 * * 1-5` | **swing** | forex, metal, energy, crypto | Avant la clôture quotidienne FX (17:00 NY ≈ 21–22 UTC) → bougies D fraîches pour le swing. |

**Principe de décision (à formaliser, déjà implicite) :**
- **Day** = déclenché aux **ouvertures de session** (asia/london/newyork) : on analyse sur H1/H4 fraîchement clôturées, validité 24 h (`DAY_VALID_HOURS` dans `persist.ts`).
- **Swing** = déclenché à la **frontière de clôture quotidienne** (`eod-swing`, + london qui couvre aussi swing) : on analyse sur H4/D, validité 72 h (`SWING_VALID_HOURS`).
- L'univers réel d'un run = `SESSIONS[session].asset_classes ∩ instruments actifs` (résolu par `resolveSessionUniverse`). Crypto présente dans **chaque** session (24/7).
- « Moment opportun » = **alignement candle-close × ouverture de session**, pas une décision libre de l'agent. La config est *data-not-code* : changer le périmètre = éditer `sessions.ts`, jamais disperser la logique.

### Cadence vs budget ~15 runs/jour

| Contrainte | Valeur | Source |
|-----------|--------|--------|
| Quota Max | ~15 runs/jour, **partagé** avec les sessions interactives Claude Code | `docs/routines-claude.md §2` |
| Sessions d'analyse définies | **4/jour** (asia, london, newyork, eod-swing) | `sessions.ts` |
| Marge | 4 runs analyse ≪ 15 → confortable, **mais** un run = pipeline complet `snapshot→analyze→persist` couvrant plusieurs instruments en un seul run | — |
| Jobs déterministes (ingestion candles/news/macro) | **HORS quota Claude** → Windows Task Scheduler | `docs/routines-claude.md §2/§5` |

→ **Cadence cible : 1 run par session × 4 sessions ouvrables** (jours de semaine ; `asia` dim-jeu, les autres lun-ven). Ne JAMAIS faire tourner l'ingestion déterministe sur le quota Claude.

### Ce que produit UN run d'analyse

Pipeline `snapshot → analyze (vétéran) → persist`, frontière de confiance unique = **`apps/jobs/src/jobs/persist.ts`** (déjà livré v1.0 P4) :
1. L'agent écrit des **fichiers** (raw JSON par instrument) — il n'écrit jamais en DB directement (D-43).
2. `persist.ts` (service_role) pour chaque artefact : `stripFence` → `JSON.parse` → `OutputSchema.parse` (Zod §3) → résout le snapshot par hash → `runGuardrails` (R:R ≥ 1.2, cohérence SL/entry/TP, structure non contraire) → `scoreSetup` déterministe (jamais le score de l'agent) → `expirePriorSetups` (clé `session_day`) → `insertAnalysis` + `insertTradeSetups` (status `active`, `valid_until` 24 h/72 h).
3. Sortie = `{ written, rejected, reasons[] }` (codes normalisés) → `job_runs.stats`.

### Idempotence & comportement « stale »

| Aspect | Comportement | Source |
|--------|--------------|--------|
| **Idempotence** | `expirePriorSetups` sur `(instrument_id, style, session, session_day)` expire les setups antérieurs AVANT insert → un re-run du même jour/session ne duplique pas | `persist.ts §f` |
| **0 écrit + rejets** | `persist` **throw** (« 0 setup écrit sur N rejet(s) ») → pas de succès silencieux | `persist.ts` WR-04 |
| **PC éteint / agent ne tourne pas** | Ingestion déterministe continue (Task Scheduler) ; **aucune nouvelle analyse/setup** — c'est attendu (l'IA exige l'agent) | `routines-claude.md §5` |
| **Stale visible** | `job_runs` reste `running` → flag `stale` au dashboard `/admin/sante` (déjà livré v2.0 P8 : feux fraîcheur + `job_runs`) | `routines-claude.md §5` ; PROJECT v2.0 P8 |
| **Secrets** | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` via Environments Claude Code (chiffrés) ; `dotenv/config` no-op en cloud | `routines-claude.md §3` |
| **MCP** | Le MCP Supabase stdio local **n'est PAS accessible** en Remote → SDK `supabase-js` HTTPS uniquement | `routines-claude.md §4` |

### Table Stakes (routines)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| 4 routines Remote planifiées (asia/london/newyork/eod-swing) | Sans elles, zéro signal frais → produit mort | MEDIUM | Config = lever la dette v1.0 P4 « configurer routines + 1 run réel ». Crons déjà en commentaire `sessions.ts`. |
| Environment Claude Code (secrets chiffrés + network `*.supabase.co`) | Le run doit écrire en DB | LOW-MEDIUM | À confirmer : network access par défaut (Open Question A1 de `routines-claude.md`). |
| Monitoring `job_runs` + flag stale au dashboard | PC potentiellement éteint → l'opérateur doit voir la fraîcheur | LOW | Infra déjà livrée (P8). Vérifier que `running` jamais clôturé = stale. |
| Run réel de bout en bout (snapshot→analyze→persist) ≥ 1 setup persisté | Preuve que le pipeline IA fonctionne en prod | MEDIUM | Le « 1 run réel » reporté de v1.0 P4. |

### Differentiators (routines)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Timing piloté par session × candle-close (pas un cron naïf) | Signaux émis quand le marché vient de produire de l'info exploitable | LOW (déjà conçu) | Différencie d'un bot qui poste à heure fixe sans contexte marché. |
| Scoring déterministe + garde-fous (Claude raisonne, ne chiffre pas) | Anti-hallucination = socle de confiance | — (livré) | Le différenciateur produit majeur ; v2.1 l'active simplement en prod. |

### Anti-Features (routines)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Ingestion candles/news sur le quota Claude | « tout via l'agent » | Brûle le quota 15/j partagé pour du déterministe | Task Scheduler / croner hors quota |
| Retry agressif d'un JSON non conforme | « ne rien perdre » | Boucle/coût ; le JSON IA peut être structurellement faux | Rejet + raison loggée, pas de retry en P1 (déjà la décision `persist.ts`) |
| WebSockets / streaming M1 pour « temps réel » | sensation de live | Hors scope P1, infra lourde ; le produit est day/swing | Pulls REST OHLCV + Supabase Realtime pour push des analyses (déjà livré P3) |
| Laisser l'agent décider librement « quand le marché est intéressant » | autonomie max | Non déterministe, non auditable, gaspille le quota | Fenêtres figées `sessions.ts` (data-not-code) |
| Clé API Anthropic en v2.1 | fiabilité 24/7 | Hors scope/budget de ce milestone (différé au lancement payant) | Routines Max ; migration API = milestone ultérieur |

---

## Axe 3 — BACKTEST + BASCULE TRACK RECORD

### Comment un backtest de catalogue de patterns produit un win-rate mesuré

L'infra de mesure d'issue existe déjà et est **golden-testée** : `replayOutcome` (`packages/core/src/replay/outcome.ts`) fait exactement le first-touch demandé.

**Algorithme first-touch (déjà livré, à réutiliser tel quel) :**
- `hit_tp` si TP1 touché avant SL ; `hit_sl` si SL touché avant TP1 (parcours des bougies H1 ordonnées par `ts` croissant).
- **Bougie ambiguë** (TP1 ET SL dans la même H1) → règle de distance D-04 : le niveau le plus proche de l'entrée est touché en premier (`distTp <= distSl` → `hit_tp`, égalité → `hit_tp`).
- **flat** (ni TP ni SL avant `valid_until`) → valorisé au close de la dernière bougie ≤ `valid_until` ; `realized_r` signé.
- **R multiple** : `winR = |TP1 − entry| / |entry − SL|` pour un hit_tp ; `−1` pour un hit_sl ; close-based pour flat.
- **Anti look-ahead** : les candles DOIVENT être bornées `ts < valid_until` — responsabilité de l'appelant (déjà respectée par `outcome-tracker.ts` qui borne `[created_at, valid_until]`).
- **Minimum sample** : seuil `MIN_SAMPLE = 30` (`packages/core/src/track-record/threshold.ts`) — sous 30, « échantillon insuffisant », jamais de %.

**Ce qui est NOUVEAU à construire (le backtest) :**
- Un **moteur de backtest du catalogue de patterns** qui, sur l'historique de candles, (1) détecte chaque occurrence d'un pattern, (2) construit un setup hypothétique (entry/SL/TP cohérent avec les règles `persist.ts`), (3) le rejoue via `replayOutcome` sur les bougies postérieures bornées, (4) agrège win-rate / avg_r / expectancy / N **par pattern** (et par les dimensions de `pattern_stats` : style, asset, asset_class, score_band, risk).
- Réutilise la détection de structure maison (swings, BOS/CHoCH, S/R, POC) livrée v1.0 P3 + les indicateurs golden-testés.

### Comment le % affiché bascule de backtest-seeded → track record réel

**Contrainte produit dure** : « jamais affirmer un % sans le mesurer ». Le backtest EST une mesure → légitime dès J1, mais doit être **étiqueté backtest** et **remplacé progressivement** par le réel.

**Constat d'architecture (clé pour le requirements author) :** la vue `pattern_stats` (migration 0014) dérive **exclusivement** de `prediction_outcomes` JOINT à `trade_setups` réels + `instruments`. Elle ne connaît PAS le backtest. Donc le backtest **ne peut pas** alimenter `pattern_stats` sans choisir une voie :

| Option de seed | Mécanique | Risque | Verdict |
|----------------|-----------|--------|---------|
| **A. Insérer des trade_setups + prediction_outcomes synthétiques** | Marquer `source='backtest'`, réutiliser la vue telle quelle | **Pollue** les tables live (liste membre, realtime, outcome-tracker rejouerait des faux) ; viole « frontière producteur-unique » D-05 | À éviter |
| **B. Table dédiée `backtest_stats` + blend applicatif** | Backtest écrit ses agrégats (mêmes dimensions/buckets) dans sa propre table ; la couche front COALESCE : réel si N_réel≥30, sinon backtest, avec **label de provenance** | Logique de bascule à coder + tester ; deux sources à garder cohérentes (mêmes buckets) | **Recommandé** |
| **C. Vue `pattern_stats` étendue (UNION réel + backtest + colonne `provenance`)** | Une seule surface de lecture, provenance portée en SQL | Migration de la vue existante ; le front doit gérer la provenance | Acceptable, plus DB-centrique |

**Règle de bascule recommandée (par bucket/dimension, miroir du seuil existant) :**
- N_réel ≥ `MIN_SAMPLE` (30) → afficher le **% réel** (track record), provenance = `live`.
- N_réel < 30 mais backtest disponible → afficher le **% backtest**, provenance = `backtest` (badge explicite « mesuré par backtest »), N_backtest visible.
- Ni l'un ni l'autre ≥ seuil → « échantillon insuffisant » (comportement actuel).
- N (réel et/ou backtest) **toujours exposé** (D-12, jamais masqué).

→ Bascule **progressive et par-bucket** : un instrument très tradé passe au réel pendant qu'un instrument rare reste sur backtest. Pas de bascule globale « big bang ».

### Table Stakes (backtest)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| % mesuré affiché dès J1 (backtest), pas « insuffisant » partout au lancement | Sinon la vitrine n'a aucune preuve à montrer | HIGH | Le cœur du milestone. Dépend de B/C ci-dessus. |
| Backtest first-touch réutilisant `replayOutcome` | Cohérence stricte backtest ↔ réel (même définition de victoire) | MEDIUM | **Ne PAS recoder** le first-touch — réutiliser `@app/core replayOutcome` (golden-testé) |
| Win-rate / avg_r / expectancy / N par pattern + dimensions | Le membre veut savoir quel pattern marche | MEDIUM | Mêmes buckets que `pattern_stats` (overall/style/asset/asset_class/score_band/risk) |
| Seuil N≥30 + N toujours visible + label provenance backtest/live | « jamais inventé » + honnêteté de la source | LOW | Étendre `applyThreshold` pour porter la provenance |
| Anti look-ahead vérifié dans le backtest | Un backtest qui triche = % faux = produit malhonnête | MEDIUM | Borner candles `ts < valid_until` ; golden tests dédiés |

### Differentiators (backtest)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Bascule progressive par-bucket backtest→réel avec provenance affichée | Honnêteté radicale : le visiteur voit la source du chiffre évoluer | MEDIUM | Rare ; renforce le socle de confiance |
| Calibration (score_band vs win-rate réel) | Prouve que le score /100 prédit vraiment | MEDIUM | `score_band` déjà dans `pattern_stats` + `recharts` prévu pour la page calibration |

### Anti-Features (backtest)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Insérer des outcomes backtest dans `prediction_outcomes` | « réutiliser la vue » | Pollue les tables live, fausse le track record réel, l'outcome-tracker rejouerait du faux | Table/vue séparée + blend (option B/C) |
| Bascule globale « big-bang » réel | simple à raisonner | Jette des données backtest encore utiles sur les buckets peu tradés | Bascule par-bucket sur N≥30 |
| Backtest sur-paramétré / fitté au passé | maximiser le % affiché | Over-fitting → % réel s'effondre → perte de confiance | Catalogue de patterns figé, règles SL/TP identiques au live, R:R≥1.2 |
| Cacher N pour « faire joli » | UX | Viole D-12 (« jamais masqué ») | N toujours rendu, suffisant ou non |

---

## Feature Dependencies

```
[Design tokens NEXA (volt/green, OKLCH, RTL)]
    └──requires──> [Tailwind v4 CSS-first @theme] (livré)
    └──enhances──> [ScoreGauge] [SignalCard] [LevelsRow] [TrustStat]
                       └──TrustStat requires──> [pattern_stats seuillé] (NE PAS hardcoder le 73%)

[Routines Remote planifiées]
    └──requires──> [Environment Claude Code + secrets]
    └──requires──> [sessions.ts univers/cron] (livré)
    └──produces──> [trade_setups actifs via persist.ts] (livré)
                       └──feeds──> [outcome-tracker → prediction_outcomes] (livré)
                                       └──feeds──> [pattern_stats RÉEL]

[Backtest catalogue patterns]
    └──requires──> [replayOutcome first-touch] (livré, réutiliser)
    └──requires──> [détection structure + indicateurs] (livré v1.0 P3)
    └──produces──> [backtest_stats (nouvelle source)]
                       └──blend avec──> [pattern_stats réel] ──> [% affiché par bucket + provenance]

[TrackRecordBlock affiché] ──requires──> [bascule backtest→réel] ──requires──> [seuil MIN_SAMPLE=30] (livré)
```

### Dependency Notes

- **TrustStat/gauge du design requiert `pattern_stats` seuillé :** le « 73 % » du mock est un placeholder ; le brancher en dur ré-introduit un chiffre inventé (anti-feature critique transverse design×backtest).
- **Le backtest requiert `replayOutcome` (livré) :** réutilisation obligatoire pour garantir que « victoire backtest » == « victoire réelle » (même first-touch, même règle d'ambiguïté D-04).
- **`pattern_stats` (réel) dépend des routines :** sans run d'analyse → pas de `trade_setups` → pas d'`prediction_outcomes` → la colonne « réel » reste vide et l'app reste sur backtest. Les 3 axes convergent sur le même bloc de confiance.
- **Conflit à arbitrer :** backtest ↔ tables live `trade_setups`/`prediction_outcomes` — le backtest ne doit PAS y écrire (frontière producteur-unique D-05). Source séparée requise.

---

## MVP Definition (v2.1)

### Launch With (le milestone)

- [ ] **Design tokens NEXA volt/green** (OKLCH, sémantiques) + no-flash + RTL — fondation transverse, tout en dépend.
- [ ] **Composants partagés** ScoreGauge / SignalCard / LevelsRow / TrustStat consommant les tokens, appliqués vitrine + membre + académie + auth + admin.
- [ ] **Rebranding MERA→NEXA** + baseline sans promesse de gain (slogan écarté).
- [ ] **4 routines Remote** (asia/london/newyork/eod-swing) configurées + Environment secrets + **1 run réel** persistant ≥ 1 setup.
- [ ] **Moteur de backtest** du catalogue → `backtest_stats` (mêmes dimensions/buckets que `pattern_stats`), réutilisant `replayOutcome`.
- [ ] **Bascule backtest→réel par bucket** (N_réel≥30 → live ; sinon backtest ; sinon insuffisant) + **label provenance** + N toujours visible, branché dans `TrackRecordBlock`/`TrustStat`/gauge.

### Add After Validation (v2.1.x)

- [ ] Calibration visuelle (score_band × win-rate réel) avec `recharts` — quand N réel suffisant sur ≥1 bucket.
- [ ] Scène hero animée complète (parallax/data-rain/tilt) si la reconstruction interprétative prend du temps — version statique acceptable d'abord.

### Future Consideration (au-delà)

- [ ] Migration clé API Anthropic (fiabilité 24/7) — au lancement payant réel.
- [ ] Streaming M1/scalping — après moteur prouvé.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Design tokens volt/green no-flash + RTL | HIGH | MEDIUM | P1 |
| Composants partagés (gauge/card/levels/trust) transverses | HIGH | MEDIUM | P1 |
| Rebranding NEXA + baseline légale | HIGH | LOW | P1 |
| 4 routines Remote + 1 run réel persisté | HIGH | MEDIUM | P1 |
| Backtest catalogue → backtest_stats (réutilise replayOutcome) | HIGH | HIGH | P1 |
| Bascule backtest→réel par bucket + provenance | HIGH | MEDIUM | P1 |
| Scène hero animée (parallax/data-rain) | MEDIUM | MEDIUM-HIGH | P2 |
| Calibration score_band × win-rate | MEDIUM | MEDIUM | P2 |
| Clé API Anthropic 24/7 | MEDIUM | HIGH | P3 |

---

## Sources

- `apps/jobs/src/jobs/persist.ts` (frontière de confiance, garde-fous, valid_until 24/72h, idempotence `expirePriorSetups`) — **HIGH** (code livré lu)
- `apps/jobs/src/jobs/outcome-tracker.ts` + `packages/core/src/replay/outcome.ts` (first-touch, ambiguïté D-04, flat, R, anti look-ahead) — **HIGH** (code golden-testé lu)
- `supabase/migrations/0014_prediction_outcomes_pattern_stats.sql` (vue dérive de prediction_outcomes+trade_setups ; dimensions/buckets ; D-05 producteur unique ; D-12 N exposé) — **HIGH**
- `packages/core/src/track-record/threshold.ts` (`MIN_SAMPLE=30`, applyThreshold) — **HIGH**
- `apps/jobs/config/sessions.ts` (univers session × style, crons UTC asia/london/newyork/eod-swing) — **HIGH**
- `docs/routines-claude.md` (Remote vs Local, quota 15/j partagé, Environments, MCP cloud≠stdio, stale, horaires UTC) — **HIGH**
- `Nexa - Landing.html` (tokens sémantiques OKLCH, data-theme volt/green, gauges anneau, signal card, sd-levels, trust stats, marquee ; slogan MERA à écarter) — **HIGH** (référence design)
- `apps/web/src/components/track-record/TrackRecordBlock.tsx` + `types.ts` (pipeline anon→getPatternStats→applyThreshold→view ; seuil côté front) — **HIGH**
- `.planning/PROJECT.md` (core value « % mesuré jamais inventé », décisions 2026-06-20 NEXA/routines/backtest, scope/hors-scope v2.1) — **HIGH**
- Conventions UI « état de l'art » signaux financiers (no-FOUC theming, propriétés logiques RTL, self-host fonts) — **MEDIUM** (training, non re-vérifié web, jugé stable)

---
*Feature research for: plateforme signaux trading MENA — milestone v2.1 (design NEXA · routines IA · backtest+track record)*
*Researched: 2026-06-20*
