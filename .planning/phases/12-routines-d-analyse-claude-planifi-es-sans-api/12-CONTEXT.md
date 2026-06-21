# Phase 12: Routines d'analyse Claude planifiées (sans API) - Context

**Gathered:** 2026-06-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Activer le moteur d'analyse en **production** via des routines **Claude Code Remote**
planifiées (day + swing) qui produisent de vrais setups par
`snapshot → analyze (vétéran agent-native) → persist`, **sans clé API Anthropic**,
**idempotentes et monitorées**. Lève la dette v1.0 P4.

On clarifie le **COMMENT** d'une activation déjà cadrée (ROUTINE-01..05). Le plumbing
déterministe existe déjà (v1.0) : `dispatch.ts`, `runJob.ts`→`job_runs`,
`combine-engine.ts`, `persist.ts` (frontière D-43), `sessionUniverse.ts`, `sessions.ts`,
`prompts/veteran.md`. **Aucune nouvelle capacité produit** n'est ajoutée ici — c'est de
l'activation + configuration + 1 run réel de bout en bout + monitoring.

**Hors scope (autres phases / différé) :** filtrage par plancher de score, tier
watchlist, reprise de run partiel (checkpoint), enrichissement des stats par instrument,
alerte active (Telegram/email), clé API Anthropic 24/7 (v2 ENGINE-API).

</domain>

<decisions>
## Implementation Decisions

### Rollout / périmètre d'activation
- **D-12-01 (rollout minimal puis élargir):** Activer d'abord **2 routines** —
  `newyork` (day) + `eod-swing` (swing) — valider 1 run réel de bout en bout
  (réseau + frontière D-43 + ≥1 setup persisté), **PUIS** élargir à `asia` + `london`.
  Dé-risque ROUTINE-03 avant de tout brancher. Cohérent avec la priorité quota D-12-03.

### Définition d'un run sain / "run vide"
- **D-12-02 (run vide = succès normal):** Un run qui tourne mais ne produit AUCUN setup
  au-dessus de la barre (marché calme, discipline du prompt) = `job_runs.status='success'`
  avec `stats {written:0}`, **rien persisté, PAS d'anomalie**. Le monitoring se base sur
  « le run a-t-il tourné dans sa fenêtre », **jamais** sur « a-t-il produit un setup ».
  Évite les faux `stale`. ⚠️ Nuance code à respecter : `persist()` throw aujourd'hui si
  `written===0 && rejected>0` (WR-04, pas de succès silencieux) — un run vrai-vide
  (0 artefact / 0 rejet) reste un succès ; à confirmer en planification que la sémantique
  « marché calme » ne déclenche pas ce throw.

### Quota (P11)
- **D-12-03 (priorité NY + eod-swing):** Si le budget quota se resserre, prioriser
  `newyork` (clôture la plus riche, H1/H4/D actifs) + `eod-swing` ; `asia` / `london`
  sont **sacrifiables en premier**. Note : 4 fenêtres/j ≪ quota (~15/j) → pression faible
  en pratique ; la priorité est une règle de dégradation, pas un goulot attendu.

### Monitoring / alerte
- **D-12-04 (dashboard passif):** Visibilité via le **flag `stale`** sur `/admin/sante`
  uniquement (déjà prévu, ROUTINE-04 / `v_data_freshness`). **Pas de notification active**
  (Telegram/email) en Phase 12 — l'alerte active est une amélioration future différée.

### Barre de publication d'un setup
- **D-12-05 (barre existante, pas de plancher de score):** Un setup est publié ssi il
  passe les **garde-fous déterministes** de `persist.ts` (`MIN_RR=1.2`, cohérence SL/entry/TP,
  `alloc_pct` somme=100, structure non contraire) **+** la discipline du prompt (pas de
  fichier sans confluence). **Aucun plancher d'`opportunity_score`** ajouté en P12 : le
  score (recalculé en code, D-43) s'affiche et le membre décide. = frontière de confiance
  déjà verrouillée, on ne la modifie pas.

### Idempotence du run multi-instruments
- **D-12-06 (s'appuyer sur le design existant):** Isolation par instrument (un artefact
  défaillant → `reject('insert_error')` isolé, ne crash pas le run — pattern fault-isolation)
  + idempotence par `session_day` (`expirePriorSetups` AVANT insert → re-run sûr, D-45).
  Un run partiel (quota/réseau coupé en cours) est **acceptable** : ≥1 setup = succès ; le
  flag `stale` + la fenêtre suivante couvrent le reste. **Pas de logique de reprise/checkpoint**.

### Stats job_runs / visibilité monitoring
- **D-12-07 (stats existantes):** Conserver `persist` → `{written, rejected, reasons[]}`
  (codes normalisés uniquement, T-02-13) + `finished_at`/durée de `runJob`. `/admin/sante`
  affiche écrits/rejetés + raisons agrégées. **Pas d'enrichissement** par instrument en P12
  (l'ANALYZE est agent-native, hors `persist`).

### Prompt vétéran (analyse agent-native)
- **D-12-08 (revue fondateur rapide puis fige):** Revue fondateur (Borhane) de
  `apps/jobs/prompts/veteran.md` (v1.0.0) **avant go-live** — c'est l'intelligence produit.
  Tout ajustement bumpe simplement le `prompt_version` (`semver front-matter + sha256`,
  D-51) ; mécanisme de versionnage inchangé. Pas de refonte structurelle.

### Mécanique des routines (élucidée — contraintes de configuration)
- **D-12-09 (création hybride CLI + dashboard):** Les routines **Remote** peuvent être
  créées depuis le terminal via `/schedule` (même type cloud que le dashboard, scriptable).
  **MAIS** la config fine de l'Environment (secrets chiffrés + network allowlist custom)
  reste **dashboard-only**. → Workflow : `/schedule` pour le cron, dashboard
  (`claude.ai/code/routines`) pour les secrets `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`
  (ou Vaults).
- **D-12-10 (réseau `*.supabase.co` couvert par défaut):** Le profil réseau **"Trusted"**
  (défaut) inclut déjà `*.supabase.co` (+ npm/GitHub/Docker). L'**Open Question A1** (network
  Remote vers Supabase) tombe : **pas d'allowlist custom nécessaire**, juste à confirmer au
  1er run. Gros dé-risquage de ROUTINE-01.
- **D-12-11 (NE PAS utiliser CronCreate/recurring tasks):** Les tâches récurrentes
  `Cron*` sont *session-scoped*, expirent en ~7 j → **inadaptées**. Utiliser les **Remote
  routines** (persistantes). Quota Remote = ~15 runs/j sur Max (⚠️ « partagé avec l'interactif »
  selon le projet/Pitfall 6 vs « dédié/séparé » selon vérification récente — non publié
  officiellement, à confirmer ; sans impact pratique car 4 fenêtres ≪ 15).

### Claude's Discretion
- Détails techniques laissés au planner : structure exacte des crons UTC (déjà esquissée
  dans `sessions.ts`), résolution day = « ouverture + clôture H1/H4 » vs run unique par
  fenêtre, format précis d'export `RUN_ID`/`PROMPT_VERSION` à l'ANALYZE, contrat exact
  d'affichage `stale` côté `/admin/sante`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Modèle d'exécution des routines (référence centrale)
- `docs/routines-claude.md` — modèle d'exécution Remote vs Local, injection de secrets
  via Environments, MCP cloud vs stdio (P12), fallback Windows Task Scheduler, horaires UTC
  des sessions, quota. **À lire en premier.** (NB : §4/§7 « A1 à confirmer » est résolu par
  D-12-10 ; §2 quota « partagé » à confronter à D-12-11.)
- `.planning/ROADMAP.md` §Phase 12 — goal, success criteria (5), notes (anti-patterns,
  pitfalls P10/P11/P12).
- `.planning/REQUIREMENTS.md` — ROUTINE-01..05 (texte exact des exigences).

### Frontière de confiance & moteur (cœur v1.0, invariant)
- `apps/jobs/src/jobs/persist.ts` — frontière de confiance unique D-43 : Zod §3 +
  `runGuardrails` (`MIN_RR=1.2`, cohérence, structure) + `scoreSetup` (score recalculé) +
  `expirePriorSetups` (idempotence `session_day`) + stats. **Ne pas dupliquer / contourner.**
- `apps/jobs/src/runJob.ts` — wrapper `startRun`/`finishRun` → `job_runs` (service_role,
  client lazy, supabase-js uniquement, jamais MCP).
- `apps/jobs/src/dispatch.ts` — entrypoint tsx ESM agnostique du scheduler (registre des jobs).
- `apps/jobs/src/jobs/combine-engine.ts` — assemble les 3 snapshots (technical/fundamental/news)
  en `kind='combined'` consommé par `persist` ; à lancer après les 3 engines, avant persist.
- `apps/jobs/config/sessions.ts` — univers par session (asset_classes × styles) + crons UTC
  esquissés (asia/london/newyork/eod-swing). Source de vérité du périmètre (D-49).
- `apps/jobs/src/jobs/sessionUniverse.ts` — `resolveSessionUniverse` (univers réel = config ∩
  instruments actifs).
- `apps/jobs/prompts/veteran.md` — prompt d'analyse agent-native (v1.0.0), défense anti-injection
  `<market_data>`, schéma §3, discipline. Versionné semver+sha256 (D-51). **L'ANALYZE reste
  agent-native — Anti-Pattern 1 : pas de job `analyze.ts`.**

### Monitoring / staleness
- `apps/jobs/__tests__/fault-isolation.test.ts` — preuve isolation des pannes (DATA-07) +
  contrat `v_data_freshness.is_stale` interrogeable.

### Exemples de runs passés (référence de forme)
- `apps/jobs/run-artifacts/` — artefacts de runs manuels passés (`<instrument>_<style>.json`),
  forme attendue de la sortie ANALYZE.

### Configuration produit Claude Code (mécanique routines)
- Docs officielles (vérifiées agent) : `code.claude.com/docs/en/routines`,
  `platform.claude.com/docs/en/managed-agents/environments`,
  `code.claude.com/docs/en/scheduled-tasks`. Réseau Trusted couvre `*.supabase.co` ;
  `/schedule` crée des routines cloud ; secrets/network custom = dashboard.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`persist()` (frontière D-43):** réutilisé tel quel comme seule voie d'écriture IA —
  pas de plancher de score ajouté (D-12-05). `RUN_ID` + `PROMPT_VERSION` (ou
  `computePromptVersion()`) requis en env.
- **`runJob` + `job_runs`:** déjà la source du monitoring (status running→success/error,
  stats, finished_at). Le flag `stale` s'appuie sur l'absence de mise à jour (D-12-04).
- **`sessions.ts`:** crons UTC déjà esquissés en commentaire (`asia 00 23 * * 0-4`,
  `london 00 07 * * 1-5`, `newyork 30 12 * * 1-5`, `eod-swing 00 21 * * 1-5`) — base du
  scheduling. Rollout minimal D-12-01 = activer d'abord `newyork` + `eod-swing`.
- **Bot Telegram (`telegram/bot.ts`, `telegram-publish.ts`):** existe — bas coût si alerte
  active souhaitée plus tard (différé, D-12-04).
- **Fallback Windows Task Scheduler (`windows/run-job.cmd`):** maintient l'ingestion
  déterministe hors quota Claude ; ne couvre PAS l'ANALYZE.

### Established Patterns
- **Boucle par artefact isolée + stats normalisées + throw si 0 produit (WR-04):** pattern
  partagé persist/engines/ingest — fonde D-12-02 et D-12-06.
- **`as const` + `keyof typeof` (data-not-code):** tout changement de périmètre = édition de
  `sessions.ts` versionné, jamais de logique dispersée.
- **supabase-js service_role lazy, jamais MCP (P12) ; pas de clé API Anthropic (forfait Max).**

### Integration Points
- Routine Remote (dashboard/`/schedule`) → `dispatch.ts <job>` → `runJob` → Supabase cloud.
- ANALYZE agent-native écrit les artefacts → `persist` (avec `RUN_ID`) les lit et persiste.
- `/admin/sante` lit `job_runs` / `v_data_freshness` pour le flag `stale`.

</code_context>

<specifics>
## Specific Ideas

- Pré-déploiement minimal volontaire : prouver 1 run réel `newyork`/`eod-swing` AVANT
  d'élargir — le fondateur veut inspecter un setup persisté réel.
- Revue fondateur du prompt vétéran comme garde-fou qualité avant que de vrais signaux
  partent aux membres.

</specifics>

<deferred>
## Deferred Ideas

- **Plancher d'`opportunity_score`** sous lequel un setup n'est pas publié — calibration
  future (lié au backtest Phase 13 / track record Phase 14), pas P12.
- **Tier "watchlist"** pour scores faibles — nouvelle capacité d'affichage, autre phase.
- **Reprise de run partiel (checkpoint des instruments traités)** — optimisation, non requise
  (idempotence par `session_day` suffit).
- **Stats enrichies par instrument** (scannés / produits vs persistés) — amélioration
  monitoring future.
- **Alerte active** (Telegram superadmin / email) sur routine ratée ou `job_runs=error` —
  amélioration robustesse future (infra Telegram déjà disponible).
- **Clé API Anthropic + infra 24/7** (ENGINE-API) — explicitement v2.

</deferred>

---

*Phase: 12-routines-d-analyse-claude-planifi-es-sans-api*
*Context gathered: 2026-06-21*
