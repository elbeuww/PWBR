# Phase 5: Track record mesuré & % affiché - Context

**Gathered:** 2026-06-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Mesurer le **track record réel** de la plateforme et afficher un **% de réussite TOUJOURS mesuré, jamais inventé**. Trois livrables (TRACK-01..03) :

1. Un job `outcome-tracker` rejoue chaque setup expiré contre les candles réelles et persiste le résultat (`hit_tp` / `hit_sl` / `realized_r`) dans `prediction_outcomes`, idempotent par `setup_id`, indépendamment de toute exécution utilisateur, en réutilisant les constantes anti look-ahead du cœur v1.0.
2. Calcul du taux de réussite **par catégorie** ET du **track record réel agrégé** (`pattern_stats`), clairement distingués.
3. Affichage sur la **vitrine** (et dans la plateforme payante) d'un % mesuré avec **méthode + taille d'échantillon** ; sous le seuil → « échantillon insuffisant, N trades ».

**Hors périmètre (autres phases) :** publication Telegram du win rate (P6), ingestion de bougies plus fines (M5/M1), modification du moteur de génération des setups (v1.0, figé).
</domain>

<decisions>
## Implementation Decisions

### Mesure du résultat d'un trade (TRACK-01)
- **D-01 :** Résultat = **binaire « TP1 atteint avant SL »**. Gagnant si le premier take-profit (TP1) est touché avant le stop-loss. `realized_r` mesuré = R réalisé jusqu'à TP1. (Le multi-TP n'est pas découpé en simulation partielle au MVP — décision tranchée sur la nature du multi-TP, voir Specific Ideas.)
- **D-02 :** Trade **« flat »** (ni TP ni SL touché avant `valid_until`) = valorisé au **prix de clôture à `valid_until`** : prix dans le sens du trade = petit gain partiel (R>0), contre le sens = petite perte partielle (R<0). N'est ni exclu ni neutre — compte avec son R réalisé.
- **D-03 :** Granularité de mesure = **bougies H1** (déjà en base, `candles.timeframe='H1'`). Exact pour ~99 % des trades (TP et SL tombent à des heures différentes). Pas d'ingestion M5 au MVP.
- **D-04 :** **Cas ambigu** (une même bougie H1 touche TP **et** SL) = règle **« le niveau le plus proche du prix d'entrée est touché en premier »**. Conséquence : dans le cas multi-TP (TP1 proche de l'entrée), c'est un **gagnant** ; si le SL est plus proche que TP1 (trade serré), c'est une **perte**. Règle principielle, défendable, non gonflée — alignée valeur cœur « jamais inventé » (cf. discussion : choix « optimiste » initial raffiné en règle de distance).
- **D-05 :** Job **idempotent par `setup_id`** (re-run = même résultat, pas de double comptage). Tracé dans `job_runs`. Indépendant de toute exécution utilisateur. Réutilise les constantes temporelles/anti look-ahead de `packages/core/src/time/constants.ts`.

### Catégories & chiffres (TRACK-02)
- **D-06 :** Catégories de découpage du taux de réussite : **par actif / classe d'actif**, **par style (day/swing)**, **par tranche de score** (ex. 80-100 vs 60-80), **par niveau de risque** (low/medium/high/extreme). Toutes les dimensions sont déjà disponibles sur `trade_setups` (instrument_id, style, opportunity_score, risk_level).
- **D-07 :** Le **chiffre vedette (« track record réel agrégé »)** = % de **tous les signaux publiés** (les setups réellement montrés aux abonnés). Les **taux par catégorie** = ce **même ensemble** simplement découpé. **Un seul pipeline de données** — pas de backtest synthétique sur de l'historique non publié.
- **D-08 (interprétation SC#2) :** SC#2 demande de distinguer « taux par pattern (backtest) » et « réel agrégé ». Au MVP, on collapse : tout vient de **trades réels publiés** (« mesuré sur trades réels », jamais inventé). Le « par pattern » = le découpage par catégorie des trades réels, pas un backtest séparé. Renforce la promesse anti-arnaque. **À signaler au verifier** : pas de dataset backtest distinct ; si un vrai backtest moteur sur historique non publié est souhaité un jour → extension future.

### Seuil & métriques affichées (TRACK-03)
- **D-09 :** Seuil minimal = **30 trades terminés** avant d'afficher un %. Vaut pour le **chiffre global ET chaque catégorie**. En dessous : « **échantillon insuffisant, N trades** » (jamais de % sur N<30).
- **D-10 :** Métriques affichées = **win rate + R moyen + expectancy** (espérance en R par trade). Le fondateur (trader intermédiaire) assume ces 3 notions.
- **D-11 :** Périodes = **all-time** (depuis le lancement) **+ fenêtre glissante 90 jours** (forme récente). Les deux affichés.
- **D-12 :** **N (taille d'échantillon) TOUJOURS affiché** à côté de chaque chiffre (exigence TRACK-03).

### Affichage & transparence (TRACK-03)
- **D-13 :** Surface publique = la **vitrine** (slot % déjà construit/masqué en P2 — D-08 de la P2 — à débloquer). Le détail **par catégorie** est affiché **sur la vitrine** (public, transparence-first), pas réservé. Le % apparaît **aussi** dans la plateforme payante.
- **D-14 :** Méthode exposée via **tooltip court** près de chaque chiffre (« Mesuré sur N trades réels clôturés ; gagnant = TP atteint avant le stop ») **+ page méthodologie dédiée** (règle H1, départage par distance, trade flat, définition R/expectancy). Transparence maximale = argument de vente anti-arnaque.
- **D-15 :** Le bloc % cohabite avec les **disclaimers LEGAL-01** (« aucune promesse de gain ») déjà en place — un track record mesuré n'est pas une promesse de performance future.

### Claude's Discretion
- Cadence/déclenchement du job `outcome-tracker` (quotidien, ou après sweep d'expiry) — laissé au researcher/planner ; contrainte : idempotent + tracé `job_runs`.
- Schéma exact `prediction_outcomes` / `pattern_stats` et matérialisation (table vs vue) — planner ; contrainte : frontière producteur-unique (écriture service_role, lecture publique des stats agrégées sur la vitrine), migration via MCP `apply_migration` (PAS `supabase db push`).
- Format d'affichage RTL/arabe des nombres/% (réutiliser `<bdi>`/`Intl` posés en P1).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Périmètre & exigences
- `.planning/ROADMAP.md` § « Phase 5 » — Goal + Success Criteria 1-3 (source du périmètre, fixe).
- `.planning/REQUIREMENTS.md` § TRACK — TRACK-01, TRACK-02, TRACK-03 (libellés exacts).

### Schéma de données (cœur v1.0 à rejouer)
- `supabase/migrations/0006_analyses_trade_setups.sql` — table `trade_setups` : `entry_price`, `stop_loss`, `take_profits` (jsonb `[{price,alloc_pct}]`), `direction`, `style`, `session`, `session_day`, `valid_until`, `status` (active/invalidated/expired), `opportunity_score`, `risk_level`, `confidence`, `payload` (§3). Immuabilité D-45 (seul `status` transitionne).
- `supabase/migrations/0003_data_ingestion_tables.sql` (table `candles`, l.75-103) — `instrument_id`, `timeframe` in ('H1','H4','D'), `ts`, OHLC, volume. Index `candles_uniq` / `candles_read_idx`.
- `supabase/migrations/0005_snapshots.sql` + `0007_snapshots_kind_combined.sql` — `snapshots` (instrument×style×kind×computed_for_ts) pour traçabilité du replay.

### Cœur déterministe (anti look-ahead, à réutiliser — SC#1)
- `packages/core/src/time/constants.ts` — `TIMEFRAMES` (H1/H4/D), `UTC_ZONE`. Source de vérité temporelle.
- `packages/core/src/schemas/output.ts` — contrat §3 : `take_profits` = `{price, alloc_pct}`, `entry`, `stop_loss`, `direction`.
- `packages/core/src/time/candle.ts`, `packages/core/src/scoring/` — logique de fermeture de bougie / scoring déterministe (référence anti look-ahead).

### Patterns de job & frontière producteur-unique
- `apps/jobs/src/jobs/subscription-expiry.ts` — modèle de job idempotent (`expireDue` + sweep), écriture service_role, tracé `job_runs`. Modèle direct pour `outcome-tracker`.
- `apps/jobs/src/jobs/persist.ts` — frontière de confiance, persistance des setups (service_role).
- `apps/jobs/src/runJob.ts`, `apps/jobs/src/dispatch.ts` — enregistrement/dispatch d'un nouveau job.

### Surfaces d'affichage
- `.planning/phases/02-vitrine-publique-trilingue-gate-l-gal/02-CONTEXT.md` § D-08 — slot % de la home **construit mais masqué jusqu'à P5** (à débloquer ici, zéro chiffre inventé).
- `apps/web/src/app/[locale]/(member)/layout.tsx` + `apps/web/src/components/member/ExpiryBanner.tsx` — exemples de surface plateforme payante (lecture anon-client + RLS).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Job idempotent `subscription-expiry`** : copier sa structure (idempotence, service_role, écriture `job_runs`) pour `outcome-tracker`.
- **`packages/core` constantes temps + schéma §3** : `TIMEFRAMES`, `UTC_ZONE`, `take_profits {price,alloc_pct}` — pas de réinvention.
- **Repositories `@app/supabase`** (candles, trade_setups) : lecture des candles H1 et des setups expirés.
- **Slot % vitrine (P2/D-08)** : structure home déjà prête à accueillir le chiffre — il « suffit » de le brancher.
- **Helpers i18n/RTL/format (P1)** : `<bdi>`/`Intl` pour afficher %/R en AR/EN/FR.

### Established Patterns
- **Frontière producteur-unique** : écriture service_role bypass (AUCUNE policy write), lecture `authenticated`/public selon la surface. Les stats agrégées affichées sur la vitrine publique exigent une lecture **publique** (anon) → prévoir RLS/vue dédiée pour `pattern_stats` (≠ `trade_setups` qui est gated).
- **Migrations** : SQL versionné, appliqué via **MCP `apply_migration`** (jamais `db push`), types régénérés (`database.types.ts`).
- **Idempotence** : clés uniques DB comme filet (ex. `UNIQUE(setup_id)` sur `prediction_outcomes`).

### Integration Points
- Nouveau job `apps/jobs/src/jobs/outcome-tracker.ts` (+ enregistrement dispatch/runJob).
- Migration `0013` : `prediction_outcomes` + `pattern_stats` (+ RLS lecture publique des agrégats).
- Vitrine : composant % mesuré branché sur le slot D-08 + page méthodologie.
- Plateforme payante : réutilise le même composant/source pour afficher le %.

</code_context>

<specifics>
## Specific Ideas

- **Nature du multi-TP (fondateur) :** les 3 TP ne sont PAS systématiques. Ils n'apparaissent que quand l'objectif final est **loin de l'entrée** → on découpe pour sécuriser des gains intermédiaires, donc **le TP1 est proche de l'entrée**. C'est ce qui justifie D-04 (règle de distance) : dans un cas multi-TP, TP1 proche = touché en premier = gain.
- **Modèle d'accès (fondateur) :** pas de palier gratuit. La plateforme (signaux) est **réservée aux payants** ; un visiteur non-payant n'a pas de compte. → la seule surface publique est la **vitrine**. *(À garder en tête : peut interagir avec le flux signup/paiement de P4 — non re-architecturé ici.)*
- **Minimisation des données (fondateur) :** « je ne stocke pas de données dont je n'ai pas besoin » — ne pas sur-dimensionner `prediction_outcomes`/`pattern_stats`.
- **Positionnement transparence = vente :** « track record en cours de mesure, % publié dès échantillon suffisant » est l'argument différenciant vs les arnaques (hérité P2/D-08).

</specifics>

<deferred>
## Deferred Ideas

- **Ingestion de bougies M5 (5 min)** pour un replay first-touch ultra-précis sur les cas ambigus — bonne idée du fondateur, mais nécessite un nouveau job d'ingestion + volume + limites API + backfill historique. **Reporté** (amélioration future si la précision H1 + règle de distance s'avère insuffisante).
- **Backtest moteur sur historique non publié** (échantillon par catégorie élargi) — reporté ; au MVP, tout est mesuré sur trades réels publiés (D-07/D-08).
- **Simulation TP partiels complète** (alloc_pct + break-even, equity curve fidèle) — reporté ; MVP = binaire TP1-avant-SL (D-01).
- **Publication Telegram du win rate** — Phase 6 (TG-02).

</deferred>

---

*Phase: 5-Track record mesuré & % affiché*
*Context gathered: 2026-06-15*
