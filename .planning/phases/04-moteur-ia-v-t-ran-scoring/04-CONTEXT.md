# Phase 4: Moteur IA "vétéran" & scoring - Context

**Gathered:** 2026-06-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Une **routine Claude planifiée** raisonne comme un trader vétéran sur les `snapshots` produits en Phase 3 et génère, **par session et en batch**, des setups de trade en JSON (contrat §3). Chaque sortie franchit une **frontière de confiance unique** (Zod + garde-fous déterministes = `scoring-aggregator`) avant d'être persistée de façon **immuable et traçable** dans `analyses` + `trade_setups`.

Couvre : SCORE-01..05, JOB-01, JOB-02.

**Principe directeur tranché (P4) :** l'agent ne produit qu'un **jugement qualitatif borné** — direction, niveaux (entry/SL/TP), raisons, `veteran_note`, et la *sélection* des setups. **Tout ce qui est noté, scoré, classé en risque, ou validé est déterministe (code) et golden-testé.** Le « cœur IA » se réduit à la narration et au choix des niveaux ; le risque (robustesse prompt, taux de rejet Zod) est ainsi confiné.

**Hors scope (autres phases) :** dashboard/lecture des opportunités (P5) ; `outcome-eval` / `prediction_outcomes` / calibration / backtests (P6) ; journal utilisateur ; communauté ; clé API Anthropic (l'agent Claude Code *est* le modèle).
</domain>

<decisions>
## Implementation Decisions

### Calcul du score & du risque (déterministe)
- **D-42:** `opportunity_score` /100 calculé par le **code** (déterministe : à partir du `snapshot` + barème de pondération ARCHITECTURE §3, poids day/swing distincts). L'agent fournit direction, niveaux, raisons, `veteran_note` et **sélectionne** les setups — il n'émet **jamais** le chiffre. Motivation : reproductibilité, golden tests, calibration win-rate/bucket fiable (boucle feedback §6 l'exige).
- **D-46:** `risk_level ∈ {low,medium,high,extreme}` dérivé par le **code** des facteurs §3 (distance SL en ATR, `atr_percentile`, news imminente, liquidité de session, contre-tendance HTF). L'agent n'émet pas le niveau.
- **D-48:** `confidence ∈ {low,moderate,high}` dérivé par **règle code** (mapping depuis `opportunity_score` + nombre de confluences alignées + flag `news_risk`). Reproductible, cohérent avec score/risk.

### Frontière unique & persistance (scoring-aggregator)
- **D-43:** La frontière unique est un **script Node `apps/jobs/persist.ts`** : validation **Zod §3** + garde-fous déterministes (recalcul R:R, cohérence SL/entry/TP selon la direction, règles dures, seuil de rejet) + **upsert via service_role**. L'agent ne fait **JAMAIS** d'insert MCP Supabase direct (sinon la garde est contournable — aligné sur l'isolation service_role T-03). JSON rejeté → **log dans `job_runs.stats` + skip** ; **pas de retry auto en P1** (le taux de rejet est mesuré pour itérer le prompt).
- **D-52:** La logique de **scoring vit dans `packages/core`** (pur, déterministe, réutilisable web+jobs) ; `persist.ts` (apps/jobs) l'appelle. Verrouillée par **golden tests** : fixtures `snapshot → {score, risk_level, confidence}` attendus (même pattern que les golden values indicateurs P3). Couvre barème day/swing, règles dures (R:R<1.2 rejet, cap 45 sur contre-tendance HTF sans catalyseur), dérivation risk_level & confidence.

### Run batch & rétention
- **D-44:** Run = **boucle instrument×style** (l'agent lit le snapshot, raisonne, émet un bloc JSON, passe au suivant) ; **1 run couvre la session entière** (JOB-02). Contexte borné, échecs isolés par instrument. On écrit **tous** les setups passant les **règles dures** (R:R ≥ 1.2) ; **aucun seuil de score à l'écriture** (le dashboard P5 filtrera par score ; tout est conservé pour la calibration §6).
- **D-49:** L'univers session→instruments vit dans une **config versionnée** (`apps/jobs/config/sessions.ts`) : `session → asset_classes + styles (day/swing)`, intersectée avec la table `instruments` WHERE `active`. Crypto incluse dans **chaque** session (24/7). Ajuster la stratégie de couverture = un commit, pas une migration.

### Immuabilité & cycle de vie
- **D-45:** Clé de version = `(instrument, style, session, jour)`. Une ré-analyse crée une **nouvelle ligne** `analyses` + `trade_setups` ; **à l'insert, le code marque les setups antérieurs de la même clé `expired`**. `valid_until` : **day ≈ 24h** (jusqu'à la prochaine session équivalente), **swing = quelques jours**. Le statut `invalidated` (ou réalisé) sera posé par `outcome-eval` en P6. Jamais de mutation des champs d'analyse (SCORE-05).

### Multi-TP & niveaux
- **D-50:** `take_profits[]` : l'**agent propose 1–3 TP** (cibles structurelles = jugement vétéran) avec `alloc_pct` ; le **code borne** (1–3 TP, somme `alloc_pct` = 100), recalcule `rr` par TP et le R:R global. Entrée en **zone [min,max]** → R:R calculé sur le **bord conservateur** (pire prix d'entrée dans le sens du trade) pour ne jamais surestimer le R:R.

### Traçabilité de version
- **D-51:** **Colonnes dédiées sur `analyses`** : `model`, `prompt_version` (semver/hash du fichier `veteran.md`), `schema_version` (du JSON §3), `run_id`. Indexables → comparer la calibration **par version de prompt** (itération du point recherche #1, boucle §6). Le `snapshot` exact est déjà lié via `raw_indicators_ref` (D-41, P3).

### Prompt vétéran & sortie JSON
- **D-47:** Le prompt/runbook vétéran vit dans un **fichier versionné du repo** (`apps/jobs/prompts/veteran.md`) : rôle (trader 50 ans), philosophie de confluence §3, champs à produire, **format JSON strict + exemple**. L'agent émet **un bloc JSON par instrument** ; `persist.ts` parse + Zod. Versionné = traçable, diffable, itérable.

### Claude's Discretion
- Forme exacte des colonnes/index des migrations `analyses` / `trade_setups` (suivre §4 + conventions P3), format précis du `run_id`, structure interne du module `packages/core/scoring`, ergonomie du fichier de config sessions — laissés au research/planner dans le cadre des décisions ci-dessus.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Contrat IA & scoring (cœur de la phase)
- `ARCHITECTURE.md` §3 — Moteur "vétéran" : entrées assemblées par code, **barème de pondération day/swing**, règles dures (R:R<1.2 rejet, cap 45, news_risk <2h day/<24h swing), dérivation `risk_level`, **schéma JSON de sortie §3 complet** (source de vérité du contrat).
- `ARCHITECTURE.md` §4 — Schéma Supabase : tables **`analyses`** (run_id, session, style, instrument_id, snapshot jsonb, model) et **`trade_setups`** (analysis_id, direction, opportunity_score indexé, risk_level, entry/SL, take_profits jsonb, risk_reward, payload jsonb, status active|invalidated|expired, valid_until ; index `(opportunity_score desc, created_at desc)`).
- `ARCHITECTURE.md` §5 — Routines planifiées : anatomie INGEST→PREP→ANALYZE→PERSIST, **crons UTC par session** (asia/london/newyork/eod-swing), agent Claude Code = modèle (pas de clé API).
- `ARCHITECTURE.md` §6 — Boucle feedback/calibration : justifie le score déterministe (win-rate par bucket) et la traçabilité de version.

### Requirements
- `.planning/REQUIREMENTS.md` — **SCORE-01..05, JOB-01, JOB-02** (libellés exacts des critères de la phase).
- `.planning/ROADMAP.md` §"Phase 4" — Goal + 4 Success Criteria + Research flag (robustesse prompt vétéran, taux de rejet Zod, méthode de scoring).

### Réutilisable de Phase 3 (entrées du moteur)
- `packages/indicators/src/snapshots/schema.ts` — schémas Zod §3 LOCKED (technical/fundamental/news) ; types via `z.infer`.
- `packages/indicators/src/snapshots/hash.ts` — `content_hash` canonique sha256 = `raw_indicators_ref` (D-41 : idempotence/intégrité, pas un contrôle d'accès).
- `packages/supabase/src/repositories/snapshots.ts` — `getSnapshotByHash` (lecture du snapshot exact pour traçabilité).
- `.planning/phases/03-moteur-d-analyse-d-terministe/03-CONTEXT.md` — décisions D-32..D-41 (structure, S/R, TF, fundamental/news, table snapshots).
- `.planning/phases/03-moteur-d-analyse-d-terministe/03-SECURITY.md` — modèle de menace P3 (RLS select-only, double barrière service_role) à prolonger sur `analyses`/`trade_setups`.

### Conventions
- `CLAUDE.md` (racine projet) — stack verrouillée (Zod v4, luxon TZ/sessions, pino→job_runs, tsx ESM, Vitest golden) + "What NOT to Use".
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Schémas §3 Zod** (`packages/indicators/src/snapshots/schema.ts`) : réutilisés tels quels pour valider les *entrées* du scoring ; le JSON de *sortie* §3 aura son propre schéma Zod (à créer, validé par `persist.ts`).
- **`getSnapshotByHash`** (`packages/supabase/src/repositories/snapshots.ts`) : l'agent référence le snapshot par hash ; `persist.ts` vérifie l'existence et lie `raw_indicators_ref`.
- **Repositories typés + service-client** (`packages/supabase/src/repositories/*`, `service-client.ts`) : patron à suivre pour de nouveaux repos `analyses`/`trade_setups` (upsert idempotent, service_role).
- **Dispatch / JOB_REGISTRY** (`apps/jobs/src/dispatch.ts`) : `persist`/jobs de session s'enregistrent ici (cf. heartbeat, *-engine, *-ingest existants).
- **Pattern golden tests** (P3, `packages/indicators/**/*.test.ts`) : modèle pour les golden fixtures de scoring dans `packages/core`.
- **`startRun`/`job_runs` + pino** : monitoring des runs de session, log du taux de rejet Zod.
- **luxon** : fenêtres de session / DST des crons (déjà utilisé dans `news-engine.ts`).

### Established Patterns
- **RLS select-only `to authenticated`, écriture service_role, AUCUNE write policy** (D-05) → à reproduire sur `analyses` / `trade_setups`.
- **service-client jamais ré-exporté du barrel** (D-07 ; `server-only` + ESLint `no-restricted-imports` + fixture) → `persist.ts` importe par chemin exact.
- **Migrations via MCP `apply_migration`** (D-17), source de vérité SQL versionnée ; **PAS** `supabase db push`. Prochaine migration = `0006_*`.
- **Zod `.parse` à la frontière avant tout upsert** (T-03-08/10/14) → `persist.ts` applique ce contrat sur le JSON IA.
- **`job_runs.stats.errors` = messages normalisés uniquement, jamais de valeur de clé** (T-02-13).

### Integration Points
- `persist.ts` ← JSON émis par l'agent ; appelle `packages/core/scoring` (score/risk/confidence/garde-fous) puis repos `analyses`/`trade_setups` (service_role).
- Migration `0006` crée `analyses` + `trade_setups` (§4) + RLS + index ; appliquée au cloud via MCP au checkpoint human-action.
- `apps/jobs/config/sessions.ts` ← lu par le run de session pour dériver l'univers (∩ `instruments.active`).
- `apps/jobs/prompts/veteran.md` ← prompt versionné lu par la routine ; `prompt_version` stocké sur `analyses`.
</code_context>

<specifics>
## Specific Ideas

- Le contrat JSON §3 (exemple `XAU_USD`) est la cible exacte de sortie — `persist.ts` doit le valider champ par champ.
- L'entrée en **zone [min,max]** est explicitement gérée : R:R sur le bord conservateur (anti-surestimation).
- `veteran_note` = narration humaine du raisonnement (« je ne chasse pas, j'attends le retest… ») — c'est la valeur produit visible, à préserver telle quelle dans le payload.
- La traçabilité par `prompt_version` est pensée pour **A/B le prompt** sur la calibration future.
</specifics>

<deferred>
## Deferred Ideas

- **`outcome-eval` / `prediction_outcomes` / calibration win-rate par bucket / backtests** — Phase 6 (boucle feedback §6). P4 produit les prédictions ; P6 les évalue.
- **Dashboard de lecture / tri / filtre des opportunités** — Phase 5.
- **Retry auto de l'agent sur JSON rejeté** — écarté en P1 (D-43) ; à reconsidérer si le taux de rejet mesuré le justifie.
- **Champ `confidence` en jugement agent** — écarté (D-48 = règle code) ; réévaluer si la calibration montre un signal.
- **Clé API Anthropic / analyses live à la demande** — post-pivot (milestone produit).

</deferred>

---

*Phase: 4-Moteur IA "vétéran" & scoring*
*Context gathered: 2026-06-13*
