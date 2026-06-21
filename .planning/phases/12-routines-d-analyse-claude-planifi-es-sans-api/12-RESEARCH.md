# Phase 12: Routines d'analyse Claude planifiées (sans API) - Research

**Researched:** 2026-06-21
**Domain:** Claude Code Remote routines (cloud agents) — activation production d'un moteur déterministe existant, sans clé API Anthropic
**Confidence:** HIGH (mécanique routines vérifiée sur docs officielles + gist allowlist + issues GitHub) / MEDIUM (quota exact non publié numériquement)

## Summary

Phase 12 = **activation + configuration + 1 run réel + monitoring**, AUCUNE nouvelle capacité produit. Tout le plumbing déterministe existe (`dispatch.ts`, `runJob.ts`→`job_runs`, `combine-engine.ts`, `persist.ts` D-43, `sessionUniverse.ts`, `sessions.ts`, `prompts/veteran.md`). L'ANALYZE reste **agent-native** (Anti-Pattern 1 : pas de `analyze.ts`) ; `persist.ts` reste la seule frontière d'écriture IA. Le travail est de configurer une **Remote routine** (cloud, PC éteint OK) qui exécute `snapshot → analyze (agent) → persist`, idempotente et monitorée via `job_runs` + flag `stale`.

**⚠️ Découverte majeure qui CORRIGE D-12-10 / Open Question A1 :** le profil réseau **"Trusted"** par défaut **N'INCLUT PAS** `*.supabase.co`. La liste par défaut vérifiée = **uniquement** package registries + GitHub + Ubuntu + Anthropic (npm/PyPI/crates/yarn/github.com). "Trusted" ajoute des *cloud SDKs* (AWS/GCP nommés) mais **bloque tout le reste**, y compris une URL HTTPS Supabase arbitraire. Un appel hors allowlist échoue avec `403 x-deny-reason: host_not_allowed`. → **Il FAUT passer l'Environment en `Custom` et ajouter `*.supabase.co` (+ option « inclure les package managers par défaut »)**, sinon `getServiceClient()` lèvera au 1er appel réseau. C'est le risque #1 de ROUTINE-01 et il doit être planifié, pas supposé résolu.

**Primary recommendation :** Créer **1 Environment Custom** (réseau = Custom + `*.supabase.co` + defaults inclus ; env vars `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`), créer **2 Remote routines** (`newyork` day + `eod-swing` swing) via dashboard (pas `/schedule` seul — la config réseau/secrets est dashboard-only), valider 1 run réel `newyork` end-to-end (≥1 setup persisté via `persist.ts`), PUIS élargir `asia` + `london`. Chaque routine lance, en UN seul run cloud (même filesystem éphémère), la séquence `ingest → engines → combine → ANALYZE agent → persist` avec `RUN_ID` exporté en variable d'environnement de session.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ROUTINE-01 | Environment Claude Code avec secrets (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) + accès réseau `*.supabase.co` confirmé | § Standard Stack (mécanique Environment) + § Common Pitfalls P-NET (réseau Custom OBLIGATOIRE, pas Trusted) + § Code Examples (création Environment) |
| ROUTINE-02 | Routines Remote couvrant day (ouverture + clôture H1/H4) et swing (pré-clôture daily), alignées sur `sessions.ts` | § Architecture Patterns (mapping crons UTC ↔ routines) + § Open Questions (day = 1 vs 2 runs) — crons déjà esquissés dans `sessions.ts` |
| ROUTINE-03 | Run réel end-to-end `snapshot → analyze → persist` ≥1 setup persisté via `persist.ts` (frontière intacte) | § Architecture (séquence run unique cloud) + § Pitfalls P-EMPTY (WR-04 vrai-vide) + artefacts existants `run-artifacts/` |
| ROUTINE-04 | Runs idempotents + monitorés (`job_runs` + flag `stale` `/admin/sante`), sous quota ~15/j | § Architecture (idempotence existante D-45/D-06) + § Validation (job_runs / v_data_freshness) + § Pitfalls P-QUOTA |
| ROUTINE-05 | Accès DB via `supabase-js` uniquement (jamais MCP cloud), aucune clé API Anthropic | § Don't Hand-Roll + § Pitfalls P-MCP (MCP cloud-hosted ≠ stdio local ; service_role via supabase-js) |
</phase_requirements>

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-12-01 (rollout minimal puis élargir):** activer d'abord `newyork` (day) + `eod-swing` (swing), valider 1 run réel (réseau + frontière D-43 + ≥1 setup), PUIS élargir `asia` + `london`.
- **D-12-02 (run vide = succès normal):** run sans setup au-dessus de la barre = `job_runs.status='success'` `stats{written:0}`, rien persisté, PAS d'anomalie. Monitoring = « a-t-il tourné dans sa fenêtre », jamais « a-t-il produit un setup ». ⚠️ Confirmer que `persist()` ne throw pas sur vrai-vide (0 artefact / 0 rejet) vs WR-04 (`written===0 && rejected>0`).
- **D-12-03 (priorité NY + eod-swing):** si quota se resserre, prioriser `newyork` + `eod-swing` ; `asia`/`london` sacrifiables. 4 fenêtres ≪ ~15/j → pression faible.
- **D-12-04 (dashboard passif):** visibilité via flag `stale` sur `/admin/sante` uniquement. Pas de notification active (Telegram/email) en P12.
- **D-12-05 (barre existante, pas de plancher de score):** setup publié ssi passe les garde-fous déterministes `persist.ts` (`MIN_RR=1.2`, cohérence SL/entry/TP, `alloc_pct` somme=100, structure non contraire) + discipline du prompt. Aucun plancher d'`opportunity_score` ajouté.
- **D-12-06 (idempotence par design existant):** isolation par artefact (`reject('insert_error')` isolé) + idempotence `session_day` (`expirePriorSetups` AVANT insert, D-45). Run partiel acceptable. Pas de checkpoint/reprise.
- **D-12-07 (stats existantes):** conserver `persist` → `{written, rejected, reasons[]}` (codes normalisés, T-02-13) + `finished_at`/durée. Pas d'enrichissement par instrument.
- **D-12-08 (revue fondateur prompt puis fige):** revue Borhane de `veteran.md` (v1.0.0) avant go-live ; tout ajustement bumpe `prompt_version` (semver+sha256, D-51). Pas de refonte.
- **D-12-09 (création hybride CLI + dashboard):** `/schedule` (CLI) pour le cron ; dashboard (`claude.ai/code/routines`) pour secrets + network allowlist custom.
- **D-12-10 (réseau *.supabase.co « couvert par défaut »):** ⚠️ **PARTIELLEMENT INVALIDÉ par cette recherche — voir § Common Pitfalls P-NET.** Le profil Trusted N'inclut PAS `*.supabase.co` ; un Environment **Custom** avec `*.supabase.co` est requis. La décision « pas d'allowlist custom nécessaire » est à corriger en planification.
- **D-12-11 (NE PAS utiliser CronCreate/recurring session-scoped):** utiliser Remote routines persistantes. Quota Remote ~15/j. ✅ Confirmé : `/schedule` crée des routines cloud persistantes ; les tâches Cron* de session sont distinctes.

### Claude's Discretion
- Structure exacte des crons UTC (esquissés `sessions.ts`), day = « ouverture + clôture H1/H4 » vs run unique par fenêtre, format précis d'export `RUN_ID`/`PROMPT_VERSION` à l'ANALYZE, contrat exact d'affichage `stale` côté `/admin/sante`.

### Deferred Ideas (OUT OF SCOPE)
- Plancher d'`opportunity_score` (calibration future, Phase 13/14).
- Tier « watchlist » scores faibles.
- Reprise de run partiel (checkpoint des instruments traités).
- Stats enrichies par instrument.
- Alerte active (Telegram superadmin / email) sur routine ratée.
- Clé API Anthropic + infra 24/7 (ENGINE-API, v2).
</user_constraints>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Planification (cron, fenêtres) | Claude Code Remote routine (cloud) | Windows Task Scheduler (fallback ingestion déterministe, hors ANALYZE) | Seul le runtime cloud Anthropic produit le raisonnement vétéran sans clé API. |
| Injection secrets | Cloud Environment (env vars) | — | Pas de `.env` ni secrets store cloud ; env vars de l'Environment uniquement. |
| Accès réseau Supabase | Cloud Environment (allowlist Custom) | — | Egress proxifié ; `*.supabase.co` doit être explicitement autorisé. |
| Ingestion + engines + combine | `apps/jobs` (tsx ESM, supabase-js) | — | Déterministe, idempotent ; lit/écrit `snapshots` via service_role. |
| ANALYZE (raisonnement) | Agent Claude (cloud, agent-native) | — | Anti-Pattern 1 : pas de `analyze.ts`. L'agent lit les snapshots et écrit des fichiers `run-artifacts/<RUN_ID>/`. |
| Frontière d'écriture IA (validation/score/persist) | `persist.ts` (service_role) | — | D-43 : seule voie d'écriture ; Zod §3 + guardrails + `scoreSetup` recalculé. |
| Monitoring / staleness | `job_runs` + `v_data_freshness` → `/admin/sante` | — | Flag `stale` = absence de mise à jour dans la fenêtre. |

## Standard Stack

> **Aucun nouveau package npm requis.** Phase d'activation/config. Le « stack » est la mécanique produit **Claude Code Remote routines** + l'infra `apps/jobs` existante. Pas de § Package Legitimacy Audit (zéro install).

### Mécanique Claude Code Remote routines (concepts à manipuler)

| Concept | Rôle | Vérifié |
|---------|------|---------|
| **Remote routine** | Routine cloud planifiée tournant sur l'infra Anthropic (PC éteint OK). Choisir « Remote » à la création (« Local » = Desktop scheduled task = machine locale). | [CITED: code.claude.com/docs/en/routines] |
| **Cloud Environment** | Contrôle réseau + variables d'env + setup script. Une routine **inherit** la network policy de son Environment à chaque run. | [CITED: code.claude.com/docs/en/routines] |
| **Environment variables** | Injectées dans `process.env` du run cloud (lues par `dotenv/config` no-op en cloud). **Pas de secrets store dédié** — stockées dans la config de l'Environment, visibles par tout éditeur de l'Environment. | [VERIFIED: code.claude.com/docs/en/claude-code-on-the-web — « A dedicated secrets store is not yet available… visible to anyone who can edit that environment »] |
| **Network access levels** | `None` / `Trusted` (defaults : package registries + GitHub + cloud SDKs, **bloque tout le reste**) / `Full` (tout domaine) / `Custom` (votre allowlist, defaults optionnels). | [VERIFIED: code.claude.com/docs/en/routines + gist allowlist] |
| **`/schedule` (CLI)** | Crée une routine **scheduled** (cron) conversationnellement. `/schedule update` pour fixer un cron custom. **Crée des routines planifiées uniquement** ; triggers API/GitHub = édition dashboard. | [CITED: code.claude.com/docs/en/routines] |
| **Fresh clone / pas de .env** | Chaque run = clone frais du repo depuis la branche par défaut. Pas de `.env`, pas de cookies, pas de session browser. Seuls le repo + env vars + connectors. | [VERIFIED: WebSearch « each fresh run starts with a clean repository clone » + docs « no .env file »] |
| **Min cron interval** | **1 heure** ; expressions sub-horaires rejetées. Heure saisie en local → convertie en UTC. | [VERIFIED: code.claude.com/docs/en/routines — « The minimum interval is one hour; expressions that run more frequently are rejected »] |
| **Quota / usage** | Routines consomment l'usage d'abonnement « comme toute autre session » (→ partagé avec l'interactif). Daily run cap par compte (~15/j Max d'après le projet, non publié numériquement officiellement). One-off runs NE comptent PAS dans le daily cap. | [VERIFIED: code.claude.com/docs/en/routines — « They consume your plan's regular subscription usage like any other session »; chiffre 15/j = MEDIUM (docs/routines-claude.md §2, non re-confirmé officiellement)] |

### Infra `apps/jobs` réutilisée telle quelle

| Module | Rôle | Note d'activation |
|--------|------|-------------------|
| `apps/jobs/src/dispatch.ts` | Entrypoint tsx ESM, registre des jobs. | `pnpm --filter jobs exec tsx src/dispatch.ts <job>`. Agnostique du scheduler (D-08). |
| `apps/jobs/src/runJob.ts` | `startRun`/`finishRun` → `job_runs` (service_role lazy, supabase-js, jamais MCP). | Source du monitoring. Status `running`→`success`/`error`. |
| `apps/jobs/src/jobs/combine-engine.ts` | Assemble 3 snapshots → `kind='combined'`. | À lancer APRÈS les 3 engines, AVANT `persist`. |
| `apps/jobs/src/jobs/persist.ts` | Frontière D-43 : Zod §3 + `runGuardrails` (`MIN_RR=1.2`) + `scoreSetup` + `expirePriorSetups` + stats. | Requiert `RUN_ID` en env (throw sinon). `PROMPT_VERSION` optionnel (sinon `computePromptVersion()`). |
| `apps/jobs/config/sessions.ts` | Univers par session + crons UTC esquissés. | Source de vérité du périmètre (D-49). |
| `apps/jobs/src/jobs/sessionUniverse.ts` | `resolveSessionUniverse` = config ∩ instruments actifs. | Pur, testable. |
| `apps/jobs/prompts/veteran.md` | Prompt agent-native v1.0.0 (semver+sha256, D-51). | Revue fondateur avant go-live (D-12-08). |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Network `Custom` + `*.supabase.co` | Network `Full` (tout domaine) | `Full` marche mais ouvre tout l'egress — moins sûr. `Custom` minimal est préférable (principe du moindre privilège). |
| Env vars dans l'Environment | Secrets store dédié | N'existe pas encore en cloud. Env vars = seule voie. ⚠️ visibles par éditeurs de l'Environment (limiter l'accès). |
| Remote routine persistante | Cron* session-scoped | Cron* expire ~7j, session-scoped (D-12-11). Remote routine persistante = bon choix. |
| `/schedule` + dashboard | `/schedule` seul | `/schedule` ne configure ni network Custom ni secrets → dashboard obligatoire pour ROUTINE-01 (D-12-09). |

## Architecture Patterns

### System Architecture Diagram

```
[Anthropic Cloud — Remote routine planifiée (cron UTC)]
        │  (à l'heure de la fenêtre : newyork / eod-swing / …)
        ▼
  Fresh clone du repo NEXA (branche par défaut)
  + Cloud Environment : env vars (SUPABASE_URL, SERVICE_ROLE_KEY)
  + Network Custom (*.supabase.co autorisé)  ◄── SANS ça : 403 host_not_allowed
        │
        ▼  (UN seul run cloud = UN filesystem éphémère partagé)
  ┌─────────────────────────────────────────────────────────────┐
  │ 1. ingest (market/news/macro)   tsx dispatch.ts <job>        │  supabase-js → snapshots
  │ 2. engines (technical/fundamental/news)                      │  (service_role bypass RLS)
  │ 3. combine-engine  → snapshot kind='combined'                │
  │ 4. ANALYZE agent-native : lit combined, ÉCRIT FICHIERS       │  ← raisonnement vétéran
  │      run-artifacts/<RUN_ID>/<instrument>_<style>.json        │     (pas d'écriture DB ici)
  │ 5. RUN_ID=<session>-<YYYYMMDD>T<HHmm>Z tsx dispatch.ts persist│
  └─────────────────────────────────────────────────────────────┘
        │                                   │
        ▼ persist.ts (FRONTIÈRE D-43)        ▼ runJob → job_runs
  Zod §3 → guardrails(MIN_RR=1.2,            status running→success/error
  cohérence, structure) → scoreSetup         stats {written,rejected,reasons[]}
  → expirePriorSetups(session_day) → insert        │
        │                                          ▼
        ▼                                   /admin/sante lit job_runs + v_data_freshness
  trade_setups (status='active')            → flag `stale` si pas de MAJ dans la fenêtre
```

**Point critique de l'enchaînement (handoff artefacts) :** l'ANALYZE écrit des **fichiers** dans `run-artifacts/<RUN_ID>/`, `persist` les **relit** (`readRunArtifacts(RUN_ID)`). Cela impose que les étapes 4 et 5 tournent dans **le MÊME run cloud** (filesystem éphémère partagé au sein d'une session ; un nouveau run = clone frais qui perd les fichiers). → la routine doit orchestrer toute la séquence en un seul run, pas une routine par étape. [VERIFIED: docs « files created in step 2 are available in step 3 » au sein d'une session ; « each fresh run starts with a clean repository clone »]

### Pattern 1 : Run cloud unique orchestré par prompt de routine
**What :** Le prompt de la Remote routine instruit l'agent d'exécuter, dans l'ordre, les commandes `tsx dispatch.ts` (ingest→engines→combine), puis de faire l'ANALYZE agent-native (lire les snapshots combined, écrire les artefacts), puis `RUN_ID=… tsx dispatch.ts persist`.
**When to use :** Toujours pour P12 — c'est le seul moyen de garder l'ANALYZE agent-native (Anti-Pattern 1) tout en gardant le handoff fichier intact.
**Note RUN_ID :** export en variable d'env de la **commande shell** de l'étape persist (`RUN_ID=newyork-20260622T1730Z tsx ...`). L'agent dérive `RUN_ID` du nom de session + timestamp UTC de la fenêtre (format §veteran.md `<session>-<YYYYMMDD>T<HHmm>Z`).

### Pattern 2 : Mapping crons UTC ↔ routines (sessions.ts = source de vérité)
**What :** Une routine = une (ou deux) fenêtre(s) d'une session. Crons UTC déjà esquissés dans `sessions.ts` :
```
asia      00 23 * * 0-4   (day)
london    00 07 * * 1-5   (day, swing)
newyork   30 12 * * 1-5   (day)        ← rollout #1
eod-swing 00 21 * * 1-5   (swing)      ← rollout #1
```
**Contrainte vérifiée :** min interval 1h (OK, fenêtres ≥ horaires). Heure saisie convertie local→UTC → **saisir directement en UTC** (régler le fuseau de saisie sur UTC, ou compenser) pour que la fenêtre tombe juste. Vérifier au 1er run que l'heure effective = l'heure UTC voulue.

### Anti-Patterns to Avoid
- **`analyze.ts` job (Anti-Pattern 1) :** NE PAS coder un job d'analyse. L'ANALYZE est agent-native (raisonnement Claude). Le code ne fait que ingest/combine/persist.
- **Routine par étape :** NE PAS créer une routine « combine » + une routine « persist » séparées — le clone frais entre runs perd les artefacts. Une routine = un run complet.
- **MCP pour la DB :** NE PAS utiliser le MCP Supabase en cloud (le MCP stdio local n'existe pas en Remote ; un MCP cloud-hosted contournerait la frontière). `supabase-js` service_role uniquement (ROUTINE-05).
- **Supposer Trusted ⊇ supabase.co :** NE PAS planifier sur l'hypothèse D-12-10 « pas d'allowlist custom » — c'est faux (P-NET).
- **Plancher de score :** NE PAS ajouter de seuil d'`opportunity_score` (D-12-05 ; la barre = guardrails + discipline prompt).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Validation sortie agent | Parseur/validateur maison | `persist.ts` (Zod §3 + guardrails, D-43) | Frontière unique déjà testée ; dupliquer = trou de sécurité. |
| Idempotence multi-run | Logique de dédup maison | `expirePriorSetups(session_day)` (D-45) | Re-run sûr déjà garanti par clé `session_day`. |
| Scoring | Faire confiance au score de l'agent | `scoreSetup` (recalcul code, D-43) | Le score agent est ignoré/écrasé (P10 anti-hallucination). |
| Versionnage prompt | Hash/version maison | `computePromptVersion()` (semver+sha256, D-51) | Builtin `node:crypto`, infalsifiable. |
| Scheduling cron | Daemon/cron maison | Remote routine (cloud) + Windows Task Scheduler (fallback ingestion) | PC éteint OK en cloud ; pas d'infra à maintenir. |
| Monitoring | Table/heartbeat maison | `job_runs` + `v_data_freshness` (flag `stale`) | Déjà la source du dashboard `/admin/sante`. |

**Key insight :** Phase 12 ne doit écrire quasiment AUCUN code applicatif — c'est de la **configuration cloud** + au plus de petits ajustements de prompt/glue. Tout hand-roll ici signale une dérive hors scope.

## Runtime State Inventory

> Phase d'activation (config cloud + 1 run), pas de rename/refactor. Inventaire des états runtime touchés par l'activation :

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `snapshots`, `analyses`, `trade_setups`, `job_runs` (Supabase cloud) — le 1er run réel y écrit de vraies lignes de production. | Aucune migration. Vérifier que le 1er run réel produit des lignes cohérentes (≥1 `trade_setups` actif). Idempotence `session_day` rend les re-runs sûrs. |
| Live service config | **Cloud Environment + Remote routines vivent HORS git (dashboard Anthropic).** Crons, env vars, network allowlist NE sont PAS versionnés. | Documenter la config (env vars, allowlist `*.supabase.co`, crons) dans `docs/routines-claude.md` (mise à jour) pour reproductibilité — la config elle-même n'est pas committable. |
| OS-registered state | Windows Task Scheduler (`run-job.cmd`) = fallback ingestion déterministe, hors ANALYZE. Inchangé en P12. | Aucune. Le fallback reste un backup d'ingestion ; il ne couvre pas l'ANALYZE (exige l'agent). |
| Secrets/env vars | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` doivent être saisis **dans le Cloud Environment** (pas le `.env` local, ignoré en cloud). ⚠️ Visibles par tout éditeur de l'Environment (pas de secrets store). | Saisir dans l'Environment dashboard. Limiter qui peut éditer l'Environment. `RUN_ID`/`PROMPT_VERSION` = exportés par la commande shell de la routine (pas un secret). |
| Build artifacts | `run-artifacts/<RUN_ID>/` = fichiers éphémères du run cloud (perdus au run suivant — clone frais). `.gitignore` à vérifier pour ne pas committer des artefacts. | Vérifier que `run-artifacts/` est gitignoré (sinon clone frais + artefacts committés = pollution). |

**Nothing found in category :** OS-registered state = aucune modification (fallback Task Scheduler inchangé, vérifié `windows/run-job.cmd`).

## Common Pitfalls

### Pitfall P-NET (réseau) : `*.supabase.co` PAS dans le profil Trusted [CRITICAL]
**What goes wrong :** Avec l'Environment par défaut (Trusted), `getServiceClient()` → premier appel `supabase-js` vers `https://<ref>.supabase.co` → **`403 x-deny-reason: host_not_allowed`** → `runJob` écrit `job_runs.status='error'` → ROUTINE-01/03 échouent au 1er run.
**Why it happens :** La liste par défaut vérifiée = `api.anthropic.com`, `github.com`, `npmjs.org/registry.npmjs.org`, `pypi.org/pythonhosted.org`, `crates.io`, `yarnpkg.com`, `archive.ubuntu.com`. **Aucun supabase.** Trusted ajoute des cloud *SDKs* nommés (AWS/GCP) mais bloque tout domaine arbitraire. [VERIFIED: gist allowlist monperrus + docs routines « blocks everything else »]
**How to avoid :** Environment → **Network access = Custom** → ajouter `*.supabase.co` (couvre `<ref>.supabase.co`) + cocher « inclure les package managers par défaut » (pour npm/pnpm dans le setup). Confirmer au 1er run via une lecture triviale (`heartbeat` ou un `select 1`). Alternative : `Full` (moins sûr).
**Warning signs :** `403`, `host_not_allowed`, `ENOTFOUND`/`EAI_AGAIN`, `fetch failed` dans `job_runs.error`.
**Note bug connue :** plusieurs issues GitHub (#19087, #30112, #38984, #34690) signalent que l'allowlist custom **ne s'applique pas toujours** sur certaines surfaces (Cowork Desktop notamment). À **valider empiriquement au 1er run** ; si l'allowlist custom est non fonctionnelle sur les Remote routines, fallback = `Full`. [VERIFIED: issues GitHub anthropics/claude-code, état: open]

### Pitfall P-EMPTY (vrai-vide vs WR-04) : `persist()` peut throw à tort
**What goes wrong :** Marché calme → l'agent n'écrit aucun artefact (discipline du prompt) → `persist` lit 0 artefact → `written=0`, `rejected=0` → **ne throw PAS** (la garde WR-04 est `written===0 && rejected>0`). ✅ **Le vrai-vide est bien un succès.** MAIS si l'agent écrit des setups qui sont TOUS rejetés (ex. tous sous `MIN_RR=1.2`) → `written=0 && rejected>0` → **throw** → `job_runs.status='error'`.
**Why it happens :** WR-04 distingue « rien produit » (calme, OK) de « tout rejeté » (signal de problème/hallucination). Confirmé ligne `persist.ts:369` : `if (stats.written === 0 && stats.rejected > 0) throw`.
**How to avoid :** Sémantique correcte — un vrai-vide ne déclenche pas le throw (D-12-02 satisfait). En planification, **vérifier par test** : (a) 0 artefact → `persist` retourne `{written:0,rejected:0}` succès ; (b) N artefacts tous rejetés → throw (comportement voulu, pas un bug). NE PAS affaiblir WR-04 pour « éviter les erreurs » — un run all-rejected DOIT être visible.
**Warning signs :** `job_runs.error = "persist: 0 setup écrit sur N rejet(s)"` avec N>0 = signal légitime (prompt à revoir / données dégradées), pas un faux positif.

### Pitfall P-MCP : MCP cloud absent / contournement frontière
**What goes wrong :** Tenter d'utiliser le MCP Supabase (connecté en stdio local via `.mcp.json`) depuis la routine Remote → indisponible (le clone cloud n'a pas le MCP stdio local). Ou pire, brancher un MCP Supabase cloud-hosted qui écrirait en DB → contourne `persist.ts` (D-43).
**Why it happens :** Les connecteurs MCP d'une routine Remote sont cloud-hosted (configurés dashboard), pas le stdio local. Le routage MCP passe par les serveurs Anthropic.
**How to avoid :** ROUTINE-05 — **aucun MCP DB**. Toute écriture passe par `supabase-js` service_role dans `apps/jobs`. Retirer tout connecteur Supabase de la routine (« remove any connectors you don't need »). [CITED: docs routines + docs/routines-claude.md §4]
**Warning signs :** appels MCP dans les logs du run ; écritures DB hors `persist`.

### Pitfall P-QUOTA : épuisement du quota partagé
**What goes wrong :** Le quota Remote (~15/j Max) est **partagé avec les sessions interactives** (routines « consume your plan's regular subscription usage like any other session »). Une journée de dev intensif + 4 routines pourrait théoriquement saturer.
**Why it happens :** Pas de pool séparé. 4 fenêtres/j (newyork, eod-swing, asia, london) ≪ 15, mais l'interactif partage le même compteur.
**How to avoid :** Rollout minimal (2 routines, D-12-01) ; règle de dégradation D-12-03 (sacrifier asia/london d'abord). Surveiller la conso sur `claude.ai/code/routines` / `claude.ai/settings/usage`. Pas un goulot attendu en pratique.
**Warning signs :** routine non exécutée dans sa fenêtre → flag `stale` sur `/admin/sante` (D-12-04 le rend visible).

### Pitfall P-HALLUC (P10) : score/valeurs hallucinés par l'agent
**What goes wrong :** L'agent invente un `opportunity_score`, un R:R favorable, ou des niveaux incohérents.
**Why it happens :** Sortie qualitative non fiable d'un LLM.
**How to avoid :** **Déjà mitigé par design** — `persist.ts` ignore le score agent (`scoreSetup` recalcule), recalcule le R:R sur le bord conservateur, rejette les incohérences (`sl_coherence`, `tp_bounds`, `structure_against`, `rr_below_min`). Le prompt `veteran.md` dit explicitement « le code recalcule et écrasera ». Défense anti-injection `<market_data>` déjà dans le prompt. Aucune action P12 sauf la revue fondateur (D-12-08).
**Warning signs :** taux de rejet élevé (`stats.reasons`) → revoir le prompt (bump `prompt_version`).

### Pitfall P-SECRET : SERVICE_ROLE_KEY exposée dans la config Environment
**What goes wrong :** Pas de secrets store ; `SUPABASE_SERVICE_ROLE_KEY` (bypass RLS, full DB) stockée en clair dans la config de l'Environment, visible par tout éditeur de l'Environment.
**How to avoid :** Limiter strictement qui peut éditer l'Environment. Ne jamais committer la clé (rester hors git, déjà la règle). Au lancement payant, envisager une clé service_role dédiée aux routines (rotation possible). [VERIFIED: docs « visible to anyone who can edit that environment »]

## Code Examples

### Création routine (workflow hybride D-12-09)
```bash
# 1. CLI : créer la routine planifiée (cron) conversationnellement
/schedule daily newyork analysis run at 17:30 UTC weekdays
# puis fixer le cron exact si besoin :
/schedule update            # → régler l'expression cron (min interval 1h)

# 2. Dashboard (claude.ai/code/routines) — OBLIGATOIRE pour :
#    - Cloud Environment : Network access = Custom + "*.supabase.co" (+ defaults)
#    - Environment variables : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
#    - Retirer tout connecteur MCP Supabase (ROUTINE-05)
```

### Séquence du run (prompt de la routine, orchestration agent-native)
```bash
# (exécuté par l'agent dans UN seul run cloud — filesystem partagé)
pnpm install                                            # network defaults (npm)
pnpm --filter jobs exec tsx src/dispatch.ts market-ingest
pnpm --filter jobs exec tsx src/dispatch.ts news-ingest
pnpm --filter jobs exec tsx src/dispatch.ts macro-ingest
pnpm --filter jobs exec tsx src/dispatch.ts technical-engine
pnpm --filter jobs exec tsx src/dispatch.ts fundamental-engine
pnpm --filter jobs exec tsx src/dispatch.ts news-engine
pnpm --filter jobs exec tsx src/dispatch.ts combine-engine
# --- ANALYZE agent-native : l'agent lit les snapshots 'combined', applique veteran.md,
#     écrit run-artifacts/<RUN_ID>/<instrument>_<style>.json (1 objet JSON §3 par fichier) ---
RUN_ID=newyork-20260622T1730Z \
  pnpm --filter jobs exec tsx src/dispatch.ts persist     # frontière D-43
```

### Garde WR-04 (vrai-vide vs all-rejected) — `persist.ts:369` [VERIFIED: lecture code]
```typescript
// 0 artefact (marché calme)  → written=0, rejected=0 → PAS de throw → succès D-12-02
// N artefacts tous rejetés    → written=0, rejected>0 → throw → job_runs='error' (voulu)
if (stats.written === 0 && stats.rejected > 0) {
  throw new Error(`persist: 0 setup écrit sur ${stats.rejected} rejet(s)`)
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers` | `@supabase/ssr` (front) — non concerné ici | — | Jobs utilisent `supabase-js` service_role direct, pas SSR. |
| Cron* tasks session-scoped (expirent ~7j) | Remote routines persistantes | Routines GA (cloud) | D-12-11 : utiliser Remote routines. |
| Hypothèse « Trusted couvre supabase.co » (D-12-10) | Trusted = package mgrs + cloud SDKs nommés, **bloque le reste** → Custom requis | Recherche P12 (ce doc) | **Corrige D-12-10** : allowlist Custom obligatoire. |

**Deprecated/outdated :**
- L'affirmation de `docs/routines-claude.md` §4/§7 « accessible sans configuration spéciale a priori » et de D-12-10 « pas d'allowlist custom nécessaire » : **invalidées** par la liste d'allowlist par défaut vérifiée. À corriger dans `docs/routines-claude.md` en P12.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Le quota daily Remote Max ≈ 15/j (chiffre du projet, non re-confirmé officiellement numériquement). | Standard Stack | Faible — 4 fenêtres ≪ tout plafond raisonnable ; D-12-03 gère la dégradation. |
| A2 | L'allowlist Custom `*.supabase.co` s'applique bien aux **Remote routines** (vs bugs documentés sur Cowork Desktop). | Pitfall P-NET | Moyen — si non fonctionnelle, fallback `Full`. À valider au 1er run (gate ROUTINE-01). |
| A3 | `run-artifacts/<RUN_ID>/` est gitignoré (handoff éphémère intra-run). | Runtime State Inventory | Faible — à vérifier ; sinon pollution de commits. |
| A4 | L'agent peut exécuter `pnpm install` + la séquence `tsx` puis l'ANALYZE dans un même run cloud avec filesystem partagé. | Architecture Pattern 1 | Moyen — c'est le modèle d'exécution documenté ; à confirmer au 1er run réel. |
| A5 | La saisie d'horaire convertie local→UTC peut être réglée pour cibler exactement les fenêtres UTC de `sessions.ts`. | Pattern 2 | Faible — vérifiable au 1er run (heure effective vs voulue). |

## Open Questions

1. **day = « ouverture + clôture H1/H4 » : un run ou deux ?**
   - What we know : ROUTINE-02 demande « ouverture de session + clôture H1/H4 ». `sessions.ts` n'esquisse qu'UN cron par session (`newyork 30 12 * * 1-5`).
   - What's unclear : faut-il 2 routines newyork (ouverture ~12:30, clôture ~21:00) ou une seule fenêtre suffit pour P1 ?
   - Recommendation : **rollout minimal = 1 run newyork (clôture, H1/H4/D actifs, la plus riche — cf. D-12-03)**. Ajouter la fenêtre d'ouverture en élargissement si valeur prouvée. Décision planner (Claude's Discretion).

2. **Allowlist Custom fonctionnelle sur Remote routines ? (A2)**
   - What we know : bugs documentés (#30112 open) sur surfaces Cowork ; docs disent que Custom marche pour les routines.
   - Recommendation : **gate ROUTINE-01 = 1 run de fumée** (lecture triviale Supabase) confirmant l'egress AVANT de planifier les fenêtres. Fallback `Full` si Custom KO.

3. **Format exact d'export `RUN_ID` à l'ANALYZE agent-native**
   - What we know : `persist` exige `RUN_ID` en env (`<session>-<YYYYMMDD>T<HHmm>Z`). `PROMPT_VERSION` optionnel (sinon calculé).
   - Recommendation : l'agent dérive `RUN_ID` du nom de session + timestamp UTC de la fenêtre et l'exporte sur la ligne de commande `persist` (cf. Code Examples). Format déjà documenté dans `veteran.md`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Cloud Environment custom allowlist | ROUTINE-01 (egress Supabase) | À configurer (Custom) | — | `Full` si Custom non fonctionnel |
| Supabase cloud (`*.supabase.co`) | ROUTINE-03/05 | ✓ (projet MCP connecté) | Postgres 15+ | — |
| `pnpm`/`tsx`/Node ≥20 dans le runtime cloud | séquence run | ✓ (network defaults npm) | pnpm 9 / tsx 4.22 | setup script si absent |
| Quota Remote Max | ROUTINE-04 | ✓ (~15/j partagé) | — | dégradation D-12-03 |
| Clé API Anthropic | — (interdite P1) | ✗ (volontaire) | — | agent Max (par design) |

**Missing dependencies with no fallback :** aucune bloquante — l'egress Supabase a un fallback (`Full`).
**Missing dependencies with fallback :** allowlist Custom → `Full` si bug ; setup script pnpm si runtime sans pnpm préinstallé.

## Validation Architecture

> `nyquist_validation: true` (config.json). Cette section alimente VALIDATION.md.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.8 (+ Playwright 1.60 pour `/admin/sante`) |
| Config file | `apps/jobs` vitest config (existant) |
| Quick run command | `pnpm --filter jobs exec vitest run <fichier>` |
| Full suite command | `pnpm --filter jobs exec vitest run` |

### Phase Requirements → Test/Validation Map
| Req ID | Behavior | Test Type | Automated Command / Méthode | File Exists? |
|--------|----------|-----------|------------------------------|--------------|
| ROUTINE-01 | Egress Supabase depuis Remote confirmé | manual-gate (1 run de fumée) | Run routine → lecture triviale Supabase ; absence de `403 host_not_allowed` dans `job_runs.error` | ❌ Wave 0 (run réel, non automatisable hors cloud) |
| ROUTINE-02 | Fenêtres day+swing alignées `sessions.ts` | unit + config-review | Test : crons des routines ⊆ crons `sessions.ts` ; revue manuelle des fenêtres dashboard | ⚠️ partiel (`sessions.ts` testable ; routines hors git) |
| ROUTINE-03 | ≥1 setup persisté via `persist.ts`, frontière intacte | integration + manual-gate | Après 1 run réel : `select count(*) from trade_setups where session='newyork' and session_day=<jour>` ≥1 ; `persist.test.ts` couvre Zod/guardrails/score | ✅ (`persist.ts` tests existants) + ❌ Wave 0 (run réel) |
| ROUTINE-03 (vrai-vide) | 0 artefact → succès, N tous rejetés → throw | unit | `pnpm --filter jobs exec vitest run` ciblant `persist` : (a) 0 artefact → `{written:0,rejected:0}` ; (b) all-rejected → throw | ❌ Wave 0 (ajouter cas vrai-vide si absent) |
| ROUTINE-04 | Idempotence + `stale` visible | unit + e2e | Re-run même `session_day` → pas de doublon (`expirePriorSetups`) ; Playwright `/admin/sante` affiche `stale` ; `fault-isolation.test.ts` couvre `v_data_freshness.is_stale` | ✅ (`fault-isolation.test.ts`) + ❌ Wave 0 (e2e sante + test idempotence run) |
| ROUTINE-05 | supabase-js only, pas de MCP, pas de clé API | static-check | Grep : aucun import MCP dans `apps/jobs` ; aucune `ANTHROPIC_API_KEY` ; `runJob`/`persist` utilisent `createClient` | ✅ vérifiable par test statique |

### Sampling Rate
- **Per task commit :** `pnpm --filter jobs exec vitest run` (jobs) — < 30 s.
- **Per wave merge :** suite complète jobs + Playwright `/admin/sante`.
- **Phase gate :** 1 run réel `newyork` end-to-end vert (≥1 setup) + egress confirmé AVANT élargissement asia/london, AVANT `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] Test idempotence run : re-run même `session_day` ne crée pas de doublon (`expirePriorSetups`) — vérifier qu'un test couvre ce contrat au niveau run (pas seulement unitaire).
- [ ] Test cas « vrai-vide » de `persist` : 0 artefact → `{written:0,rejected:0}` succès (confirme D-12-02 ne déclenche pas WR-04) — ajouter si absent.
- [ ] Test statique ROUTINE-05 : grep automatisé « aucun MCP / aucune clé Anthropic dans `apps/jobs` ».
- [ ] E2E Playwright `/admin/sante` : flag `stale` rendu quand `job_runs` non mis à jour dans la fenêtre.
- [ ] Procédure manuelle documentée du « run de fumée » ROUTINE-01 (gate egress) — non automatisable hors cloud.

## Security Domain

> `security_enforcement` absent → enabled. Stack : jobs ESM (supabase-js service_role), routine cloud, secrets en Environment.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Jobs = service_role (machine-to-machine), pas d'auth utilisateur. |
| V3 Session Management | no | Pas de session utilisateur côté jobs. |
| V4 Access Control | yes | RLS stricte (journal privé) ; service_role bypass RLS réservé aux jobs (jamais exposé au front). |
| V5 Input Validation | yes | `persist.ts` : Zod §3 sur la sortie agent (frontière D-43) ; défense anti-injection `<market_data>` dans `veteran.md`. |
| V6 Cryptography | yes | `node:crypto` sha256 pour `prompt_version` (D-51) ; jamais de hash maison. |
| V7 Secrets | yes | `SERVICE_ROLE_KEY` en Environment cloud (pas de secrets store → accès Environment restreint, P-SECRET). |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection via headlines news (`<market_data>`) | Tampering | Balises `<market_data>` = données jamais instructions (prompt) + score recalculé code (P-HALLUC). |
| Score/levels hallucinés | Spoofing/Tampering | `persist.ts` ignore le score agent, recalcule R:R/score, rejette incohérences (guardrails). |
| Fuite SERVICE_ROLE_KEY (config Environment visible) | Information Disclosure | Restreindre l'édition de l'Environment ; rotation possible ; jamais committée. |
| Contournement frontière via MCP DB cloud | Elevation of Privilege | ROUTINE-05 : aucun MCP DB ; écriture uniquement via `persist` service_role. |
| Egress vers domaine non prévu | — | Network Custom minimal (`*.supabase.co` + defaults), pas `Full` si évitable. |

## Sources

### Primary (HIGH confidence)
- `code.claude.com/docs/en/routines` — Remote vs Local, Environments, `/schedule`, min interval 1h, usage = subscription partagé, fresh clone, network Trusted/Custom/Full. [scrapé]
- `code.claude.com/docs/en/claude-code-on-the-web` — access levels (None/Trusted/Full/Custom), « no .env », « no dedicated secrets store… visible to anyone who can edit that environment », `host_not_allowed`. [scrapé]
- gist `monperrus/507c044e40aa9014a33afb6c712df128` — **liste d'allowlist par défaut vérifiée** : aucun supabase (api.anthropic.com, github.com, npm, pypi, crates, yarn, ubuntu). [fetch direct]
- Code projet lu : `persist.ts` (WR-04 ligne 369, RUN_ID requis), `dispatch.ts`, `runJob.ts`, `combine-engine.ts`, `sessionUniverse.ts`, `sessions.ts`, `veteran.md`, `fault-isolation.test.ts`, `run-artifacts/`. [VERIFIED]

### Secondary (MEDIUM confidence)
- GitHub issues anthropics/claude-code #30112 (open), #19087, #38984, #34690 — custom allowlist parfois non appliquée (Cowork) → valider empiriquement (A2). [API GitHub]
- WebSearch (Brave off) — quota ~15/j Max, fresh clone, MCP cloud-hosted vs stdio. Recoupé docs.
- `docs/routines-claude.md` (projet) — base ; §4/§7 « A1 à confirmer » et D-12-10 corrigés par cette recherche.

### Tertiary (LOW confidence)
- Chiffre exact « 15 runs/j » : non publié numériquement dans les docs officielles consultées — repris du projet (RESEARCH 01-03).

## Metadata

**Confidence breakdown:**
- Mécanique routines (création, Environment, network, quota) : HIGH — docs officielles scrapées + gist allowlist + code lu.
- Réseau `*.supabase.co` (correction D-12-10) : HIGH sur le fait (Custom requis) / MEDIUM sur la fiabilité de Custom pour Remote (A2, bugs Cowork).
- Frontière persist / WR-04 / idempotence : HIGH — code lu directement.
- Quota numérique : MEDIUM — non re-confirmé officiellement.

**Research date :** 2026-06-21
**Valid until :** 2026-07-21 (mécanique cloud Anthropic évolue vite — re-vérifier l'allowlist et le secrets store avant tout go-live ultérieur).
