# Phase 4 : Moteur IA "vétéran" & scoring — Research

**Researched:** 2026-06-13
**Domain:** Génération de setups de trade par agent Claude planifié + scoring/validation déterministe (Zod + garde-fous) + persistance immuable Supabase
**Confidence:** HIGH (codebase + décisions verrouillées), MEDIUM (techniques prompt robustness — vérifiées multi-sources mais non testées sur ce projet)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (D-42 → D-52, non négociables)

- **D-42:** `opportunity_score` /100 calculé par le **code** (déterministe : `snapshot` + barème §3, poids day/swing distincts). L'agent fournit direction, niveaux, raisons, `veteran_note`, **sélectionne** les setups — il n'émet **jamais** le chiffre.
- **D-46:** `risk_level ∈ {low,medium,high,extreme}` dérivé par le **code** des facteurs §3 (distance SL en ATR, `atr_percentile`, news imminente, liquidité de session, contre-tendance HTF). L'agent n'émet pas le niveau.
- **D-48:** `confidence ∈ {low,moderate,high}` dérivé par **règle code** (mapping depuis `opportunity_score` + nombre de confluences alignées + flag `news_risk`).
- **D-43:** Frontière unique = **script Node `apps/jobs/persist.ts`** : Zod §3 + garde-fous (recalcul R:R, cohérence SL/entry/TP par direction, règles dures, seuil de rejet) + **upsert service_role**. L'agent ne fait **JAMAIS** d'insert MCP direct. JSON rejeté → **log `job_runs.stats` + skip** ; **pas de retry auto en P1**.
- **D-52:** La logique de scoring vit dans **`packages/core`** (pur, déterministe, réutilisable web+jobs) ; `persist.ts` l'appelle. Verrouillée par **golden tests** (fixtures `snapshot → {score, risk_level, confidence}`).
- **D-44:** Run = **boucle instrument×style** ; **1 run couvre la session entière** (JOB-02). Échecs isolés par instrument. On écrit **tous** les setups passant les règles dures (R:R ≥ 1.2) ; **aucun seuil de score à l'écriture**.
- **D-49:** Univers session→instruments dans **config versionnée** (`apps/jobs/config/sessions.ts`) : `session → asset_classes + styles`, intersectée avec `instruments` WHERE `active`. Crypto incluse dans **chaque** session.
- **D-45:** Clé de version = `(instrument, style, session, jour)`. Ré-analyse = **nouvelle ligne** `analyses`+`trade_setups` ; **à l'insert, le code marque les antérieurs `expired`**. `valid_until` : day ≈ 24h, swing = quelques jours. `invalidated`/réalisé posé par P6. Jamais de mutation (SCORE-05).
- **D-50:** `take_profits[]` : l'**agent propose 1–3 TP** + `alloc_pct` ; le **code borne** (1–3, somme alloc = 100), recalcule `rr` par TP + R:R global. Entrée en **zone [min,max]** → R:R sur le **bord conservateur** (pire prix dans le sens du trade).
- **D-51:** Colonnes dédiées sur `analyses` : `model`, `prompt_version` (semver/hash de `veteran.md`), `schema_version`, `run_id`. Indexables → calibration par version de prompt.
- **D-47:** Prompt/runbook vétéran dans **fichier versionné** (`apps/jobs/prompts/veteran.md`) : rôle, philosophie confluence §3, champs à produire, **format JSON strict + exemple**. Un bloc JSON par instrument ; `persist.ts` parse + Zod.

### Claude's Discretion

Forme exacte des colonnes/index des migrations `analyses`/`trade_setups` (suivre §4 + conventions P3), format précis du `run_id`, structure interne de `packages/core/scoring`, ergonomie du fichier config sessions.

### Deferred Ideas (OUT OF SCOPE)

- `outcome-eval`/`prediction_outcomes`/calibration win-rate/backtests → **Phase 6**.
- Dashboard de lecture/tri/filtre → **Phase 5**.
- Retry auto de l'agent sur JSON rejeté → écarté P1 (mesurer le taux d'abord).
- `confidence` en jugement agent → écarté (D-48 = règle code).
- Clé API Anthropic / analyses live → post-pivot.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCORE-01 | Routine planifiée (agent Claude) produit par instrument/style un setup JSON (direction, entrée, SL, TP multiples, R:R, raisons, invalidation, veteran_note) | §Prompt vétéran + §Schéma JSON sortie §3 + §Architecture Patterns (boucle instrument×style D-44) |
| SCORE-02 | Note /100 dérivée d'une pondération explicite et décomposable | §Méthode de scoring déterministe (barème §3 → fonction pure `packages/core/scoring`) + breakdown traçable |
| SCORE-03 | Niveau de risque séparé (low/medium/high/extreme) | §Dérivation risk_level (facteurs §3, code) |
| SCORE-04 | `scoring-aggregator` valide via Zod + garde-fous (recalcul R:R, cohérence SL/TP, seuil de rejet) ; rejets loggés | §Frontière de confiance unique `persist.ts` + §Zod reject rate |
| SCORE-05 | Stocke le snapshot exact + jamais mutée (versions immuables, ancien expired/invalidated) | §Immuabilité & cycle de vie (D-45) + §Migration 0006 DDL |
| JOB-01 | Routines planifiées aux ouvertures de session (Asie/Londres/NY) + EOD swing en UTC | §Scheduling (crons §5 + dispatch jobs de session + Croner/Task Scheduler backup) |
| JOB-02 | Un run traite une session entière en batch | §Boucle instrument×style (D-44) + §Config univers (D-49) |
</phase_requirements>

## Summary

La Phase 4 a un découpage de risque déjà tranché et déterminant : **l'agent Claude ne produit qu'un jugement qualitatif borné** (direction, niveaux entry/SL/TP, raisons, `veteran_note`, sélection 1–3 TP) ; **tout ce qui est chiffré/classé/validé est du code pur golden-testé**. Cette séparation est ce qui rend la phase faisable à coût quasi nul et calibrable. Le "moteur IA" se réduit à de la narration + choix de niveaux ; les trois unités à construire sont (1) un **prompt-runbook versionné** robuste, (2) une **fonction de scoring pure** dans `packages/core`, (3) une **frontière de confiance unique** `apps/jobs/src/jobs/persist.ts`.

Aucun nouveau package n'est nécessaire : `packages/core` a déjà `zod@4.4.3` + `luxon@3.7.2`, et `apps/jobs` a déjà le client `@supabase/supabase-js` service_role + pino + le wrapper `runJob`/`job_runs`. L'agent **n'utilise pas de clé API** (forfait Max — l'agent *est* le modèle). La recommandation centrale de robustesse : **l'agent écrit un fichier JSON par instrument (ou un NDJSON par run) sur le disque ; `persist.ts` lit ces fichiers, parse + Zod + garde-fous, puis upsert service_role.** Faire transiter le JSON par fichiers (et non par parsing de stdout/markdown) supprime la classe entière de bugs "fence markdown / prose parasite" et aligne sur D-43 (l'agent n'insère jamais directement).

**Primary recommendation:** Construire 3 unités — `packages/core/scoring` (pur, golden-testé), `apps/jobs/prompts/veteran.md` (runbook versionné, schéma-in-prompt + 1 exemple, JSON par fichier), `apps/jobs/src/jobs/persist.ts` (frontière Zod + garde-fous + immuabilité + upsert) — plus la migration `0006_analyses_trade_setups.sql` (DDL §4 + RLS select-only/service_role-write, calquée sur 0005). Le scoring **lit le snapshot** (déjà §3-validé en P3), pas les candles — donc **pas de dépendance `technicalindicators`** ici.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Raisonnement vétéran → JSON (direction, niveaux, raisons, veteran_note, sélection TP) | Agent Claude (scheduled, jobs) | — | Jugement qualitatif borné ; seul l'agent produit la narration (D-42/47). Pas d'API. |
| Calcul `opportunity_score` /100 | `packages/core/scoring` (pur) | appelé par `persist.ts` | Déterministe/reproductible/golden-testé, calibration §6 (D-42/52). |
| Dérivation `risk_level` + `confidence` | `packages/core/scoring` (pur) | `persist.ts` | Règles code, cohérentes avec score (D-46/48). |
| Garde-fous (recalcul R:R, cohérence SL/TP/entry, règles dures, seuil) | `apps/jobs/src/jobs/persist.ts` | `packages/core` (helpers purs R:R) | Frontière de confiance unique ; service_role (D-43). |
| Validation forme JSON IA (Zod §3) | `packages/core` (schéma) | `persist.ts` (.parse) | Source de vérité unique du contrat de sortie ; réutilisable web+jobs (D-43/52). |
| Immuabilité / expiry / versionnement | `persist.ts` + migration 0006 (DDL/index) | repos `analyses`/`trade_setups` | `expired` posé au code à l'insert ; jamais de mutation (D-45/SCORE-05). |
| Univers session→instruments | `apps/jobs/config/sessions.ts` (code versionné) | `instruments.active` (DB) | Couverture = un commit, pas une migration (D-49). |
| Scheduling (crons UTC par session) | Claude Code scheduled agent (primaire) | Croner / Windows Task Scheduler (backup ingestion) | §5 ; l'ANALYZE exige l'agent (JOB-01/02). |
| Persistance (upsert immuable) | repos `analyses`/`trade_setups` (service_role) | migration RLS | Patron P3 (D-05/D-07). |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | `4.4.3` | Schéma JSON sortie §3 + `.parse` à la frontière | Déjà LOCKED + déjà dans `packages/core` ; garde-fou central anti-dérive (T-03-08 étendu) `[VERIFIED: packages/core/package.json]` |
| luxon | `3.7.2` | `valid_until`, fenêtres de session/DST, news_risk window | Déjà LOCKED + utilisé en P3 (news-engine, sessions.ts) `[VERIFIED: packages/core/package.json]` |
| @supabase/supabase-js | `2.108.0` | Client service_role pour upsert `analyses`/`trade_setups` | Déjà devDep `apps/jobs` ; patron `getServiceClient` en place `[VERIFIED: apps/jobs/package.json]` |
| pino | `10.3.1` | Logs structurés du run de session | Déjà dans `apps/jobs` ; `runJob` pipe stats → `job_runs` `[VERIFIED: apps/jobs/package.json]` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:crypto | builtin | `prompt_version` = sha256 du fichier `veteran.md` (si choix hash plutôt que semver) | À l'init du run, pour tracer la version exacte du prompt (D-51) — même builtin que `hash.ts` (T-03-07) |
| tsx | `4.22.x` | Exécution `persist.ts` + jobs de session (ESM) | Déjà le runtime des jobs (`dispatch`) `[VERIFIED: CLAUDE.md stack]` |
| vitest | `4.1.8` | Golden tests scoring + tests garde-fous + fixtures Zod | Déjà le framework de test P3 `[VERIFIED: CLAUDE.md stack]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Agent écrit JSON dans fichiers, persist.ts lit | Agent fait insert MCP Supabase direct | **INTERDIT (D-43)** — contourne la frontière de confiance ; aucun garde-fou appliqué. |
| Agent écrit fichiers, persist.ts lit | Parser le stdout de l'agent (`claude -p ... --output-format json`) | Possible mais fragile (prose/fence markdown) ; les fichiers découplent agent et validation, persistent pour debug, et survivent à un crash partiel. `[CITED: docs.claude.com headless]` |
| `prompt_version` = sha256(veteran.md) | semver manuel dans le front-matter de `veteran.md` | Hash = automatique, infalsifiable ; semver = lisible mais demande discipline humaine. D-51 autorise les deux — **recommandation : les deux** (semver lisible + hash de contrôle). |
| Pas de retry | Retry auto agent sur rejet Zod | Écarté P1 (D-43) ; mesurer le taux de rejet d'abord. |

**Installation:** Aucune. Tous les paquets requis sont déjà installés (zod, luxon dans `packages/core` ; supabase-js, pino, tsx dans `apps/jobs`). Le scoring **ne dépend PAS** de `technicalindicators` (il consomme le `snapshot` §3 déjà calculé, pas les candles).

## Package Legitimacy Audit

> Aucun nouveau package installé en Phase 4 — tout réutilise la stack LOCKED auditée en P3 (`03-RESEARCH.md` Package Legitimacy, aucun [SUS]). slopcheck non requis : zéro nouvelle dépendance.

| Package | Registry | Statut | Disposition |
|---------|----------|--------|-------------|
| zod 4.4.3 | npm | LOCKED P0/P3 (audité) | Réutilisé |
| luxon 3.7.2 | npm | LOCKED (audité) | Réutilisé |
| @supabase/supabase-js 2.108.0 | npm | LOCKED (audité) | Réutilisé |
| pino 10.3.1 | npm | LOCKED (audité) | Réutilisé |
| node:crypto | builtin | — | Réutilisé (hash.ts P3) |

**Packages retirés (slopcheck [SLOP]) :** aucun.
**Packages suspects ([SUS]) :** aucun.

## Architecture Patterns

### System Architecture Diagram

```
SCHEDULER (Claude Code scheduled agent, forfait Max — PAS de clé API)
  └─ cron UTC par session (asia/london/newyork/eod-swing, §5)
        │
        ▼
RUN DE SESSION (1 run = 1 session entière, batch, JOB-02 / D-44)
  1. (ingest + snapshot = jobs P2/P3 déjà existants, lancés avant)
  2. config sessions.ts → univers = asset_classes(session) ∩ instruments WHERE active   (D-49)
  3. POUR CHAQUE (instrument × style) de l'univers :
        agent LIT le snapshot §3 (getSnapshotByHash / dernier snapshot)
        agent RAISONNE comme trader 50 ans (confluence §3)
        agent ÉCRIT un bloc JSON §3  ──►  fichier  run-artifacts/<run_id>/<instrument>_<style>.json
                                          (un fichier par instrument×style — échec isolé)
        │
        ▼
FRONTIÈRE DE CONFIANCE UNIQUE — apps/jobs/src/jobs/persist.ts (service_role)   (D-43 / SCORE-04)
  POUR CHAQUE fichier JSON :
    a. JSON.parse défensif (strip fence ``` si présent)        ──► rejet+log si invalide
    b. OutputSchema(§3).parse (Zod v4)                          ──► rejet+log si dérive de forme
    c. résoudre le snapshot exact (raw_indicators_ref → getSnapshotByHash)  ──► rejet si introuvable
    d. GARDE-FOUS déterministes :
         - recompute R:R par TP + R:R global sur bord conservateur de la zone d'entrée (D-50)
         - cohérence SL/entry/TP selon direction (long: SL<entry<TP ; short: inverse)
         - règles dures §3 : R:R<1.2 → REJET ; HTF contredit + pas de catalyseur → cap 45 ; news_risk → flag
         - borne TP (1–3, somme alloc_pct=100)
    e. SCORING déterministe (packages/core/scoring) :            (D-42/46/48 / SCORE-02/03)
         scoreSetup(snapshot, agentOutput, style) → { opportunity_score, breakdown, risk_level, confidence }
    f. IMMUABILITÉ (D-45 / SCORE-05) :
         clé = (instrument, style, session, jour) → marquer setups antérieurs `expired`
         insérer nouvelle ligne analyses (snapshot, model, prompt_version, schema_version, run_id)
         insérer trade_setups (status='active', valid_until)
    g. compteurs → job_runs.stats { written, rejected, reasons[normalisés] }   (T-02-13)
        │
        ▼
SUPABASE : analyses + trade_setups (RLS select-only authenticated / write service_role)
```

### Recommended Project Structure
```
packages/core/src/
├── scoring/
│   ├── score.ts          # scoreSetup(snapshot, output, style) → {opportunity_score, breakdown, risk_level, confidence} (pur)
│   ├── weights.ts         # barèmes day/swing §3 (constantes, data-not-magic-numbers)
│   ├── rr.ts              # recompute R:R par TP + global, bord conservateur de zone (pur) — réutilisable web
│   ├── risk.ts            # dérivation risk_level (facteurs §3) (pur)
│   ├── confidence.ts      # mapping confidence (score + confluences + news_risk) (pur)
│   └── index.ts
└── index.ts               # re-export scoring (barrel @app/core)

packages/core/__tests__/scoring/   # golden fixtures snapshot+output → {score,risk,confidence} attendus

packages/supabase/src/repositories/
├── analyses.ts            # insertAnalysis (service_role) ; getLatestActiveSetups (P5 lira)
└── tradeSetups.ts         # insertTradeSetups + expirePriorSetups(key) (service_role)
packages/supabase/src/schemas/
└── output.ts              # OutputSchema §3 (Zod v4) — le contrat JSON IA  (OU dans packages/core)

apps/jobs/
├── prompts/veteran.md     # runbook versionné (D-47)
├── config/sessions.ts     # univers session→asset_classes+styles (D-49)
└── src/jobs/persist.ts    # frontière de confiance unique (D-43)  → enregistré dans dispatch.ts JOB_REGISTRY

supabase/migrations/
└── 0006_analyses_trade_setups.sql   # DDL §4 + RLS + index (appliqué via MCP apply_migration, D-17)
```

### Pattern 1 : Frontière de confiance unique (`persist.ts`)
**What:** Un seul point d'entrée valide+score+persiste. Calque la structure de `technical-engine.ts` (boucle isolée par item, Zod `.parse` avant upsert, stats normalisées, throw si 0 produit + erreurs).
**When to use:** Toute sortie de l'agent. L'agent n'insère jamais directement.
**Example (squelette, dérivé de technical-engine.ts):**
```typescript
// Source: apps/jobs/src/jobs/technical-engine.ts (patron P3) + D-43
import { OutputSchema } from '@app/supabase'        // ou @app/core
import { scoreSetup } from '@app/core'              // pur, golden-testé
import { getSnapshotByHash, insertAnalysis, insertTradeSetups, expirePriorSetups } from '@app/supabase'

export async function persist(): Promise<Json> {
  const stats = { written: 0, rejected: 0, reasons: [] as string[] }
  const client = getServiceClient()
  for (const file of readRunArtifacts(runId)) {
    try {
      const raw = stripFence(readFileSync(file, 'utf8'))
      const output = OutputSchema.parse(JSON.parse(raw))        // (a)(b) — rejet → catch
      const snapshot = await getSnapshotByHash(client, output.raw_indicators_ref)
      if (!snapshot) { reject(stats, 'snapshot_not_found'); continue }   // (c)
      const guard = runGuardrails(output, snapshot)             // (d) recompute R:R, coherence, hard rules
      if (guard.rejected) { reject(stats, guard.reason); continue }
      const scored = scoreSetup(snapshot.payload, output, output.style)  // (e) D-42/46/48
      const key = { instrument_id, style: output.style, session: output.session, day: dayKey(output.generated_at) }
      await expirePriorSetups(client, key)                      // (f) D-45
      const analysis = await insertAnalysis(client, { snapshot, model, prompt_version, schema_version, run_id })
      await insertTradeSetups(client, buildSetups(analysis.id, output, scored, guard))
      stats.written++
    } catch (err) {
      stats.rejected++
      stats.reasons.push(normalize(err))   // T-02-13 : message normalisé, jamais de valeur de clé
    }
  }
  return stats as Json
}
```

### Pattern 2 : Scoring pur (`packages/core/scoring`)
**What:** Fonction pure `scoreSetup(snapshot, agentOutput, style) → {opportunity_score, breakdown, risk_level, confidence}`. Aucun IO, aucun `Date.now()` (déterminisme). Le barème §3 vit dans `weights.ts` comme constantes nommées (pas de magic numbers).
**When to use:** Appelée par `persist.ts` ; réutilisable côté web (P5 affiche le breakdown). Golden-testée comme les indicateurs P3.
**Example (forme du barème §3, day):**
```typescript
// Source: ARCHITECTURE.md §3 (barème pondération)
export const WEIGHTS = {
  day:   { trendAlign: 25, keyLevel: 20, momentum: 15, fundamental: 15, news: 10, rr: 15 },
  swing: { trendAlign: 30, keyLevel: 20, momentum: 10, fundamental: 20, news: 10, rr: 10 },
} as const
export const PENALTIES = { newsHighImpact: -15, extremeVol: -10 } as const  // structure cassée contre = rejet (règle dure)
// scoreSetup retourne aussi `breakdown` (chaque bloc → points) pour SCORE-02 "décomposable" + traçabilité dashboard
```

### Pattern 3 : Immuabilité par expiry à l'insert (`expirePriorSetups`)
**What:** Avant d'insérer la nouvelle analyse, marquer `expired` les `trade_setups` antérieurs de la même clé `(instrument, style, session, jour)`. Jamais de UPDATE des champs d'analyse eux-mêmes — seul `status` transitionne (active→expired), ce qui n'est pas une mutation de la prédiction (SCORE-05).
**When to use:** À chaque insert dans persist.ts (D-45).

### Pattern 4 : Univers session via config versionnée
**What:** `sessions.ts` mappe `session → { asset_classes, styles }` ; le run intersecte avec `listActiveInstruments(client)` (repo P3 existant) filtré par `asset_class`. Crypto dans **chaque** session.
**Example:**
```typescript
// Source: D-49 + ARCHITECTURE §5
export const SESSIONS = {
  asia:    { asset_classes: ['forex','metal','crypto'], styles: ['day'] },
  london:  { asset_classes: ['forex','metal','energy','crypto'], styles: ['day','swing'] },
  newyork: { asset_classes: ['forex','metal','energy','crypto'], styles: ['day'] },
  'eod-swing': { asset_classes: ['forex','metal','energy','crypto'], styles: ['swing'] },
} as const
```

### Anti-Patterns to Avoid
- **Agent calcule les chiffres (score/R:R/sizing).** Source d'hallucination (Out of Scope explicite). Tout chiffre = code. L'agent propose des *niveaux de prix* (jugement), le code recompute les *ratios*.
- **Parser le stdout/markdown de l'agent.** Fragile (fences ```, prose). Préférer : agent écrit des fichiers JSON, persist.ts les lit. Strip défensif des fences quand même.
- **Insert MCP direct par l'agent.** Contourne D-43 — interdit.
- **Seuil de score à l'écriture.** D-44 : on écrit tout setup R:R≥1.2 ; le filtrage par score est au dashboard P5 (tout conservé pour calibration §6).
- **Mutation d'une analyse existante.** Versions immuables ; nouvelle ligne + expiry de l'ancienne (SCORE-05).
- **`Date.now()` dans le scoring.** Casse le déterminisme golden ; injecter `now`/`generated_at` (patron D-23 de P3, `deriveNewsContext(now)`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Validation forme JSON IA | Parsing/checks manuels champ par champ | `OutputSchema` Zod v4 `.parse` | Source de vérité unique, messages d'erreur, types via `z.infer` (patron §3 P3) |
| Hash du prompt (`prompt_version`) | Hash maison | `node:crypto` `createHash('sha256')` | Déjà le patron `hash.ts` (T-03-07), builtin déterministe |
| Fenêtres de session / `valid_until` / DST | `Date` + arithmétique manuelle | `luxon` (`DateTime`, `setZone`, `plus/minus`) | DST géré, patron `sessions.ts`/`news-engine.ts` P3 (T-03-17) |
| Client service_role | Nouveau client/config | `getServiceClient()` (patron en place) ou `serviceClient` (chemin exact) | Double barrière D-07 (server-only + ESLint) |
| Monitoring du run + log rejets | console.log / table maison | `runJob` + `job_runs.stats` (pino) | Déjà câblé (JOB-04), stats normalisées T-02-13 |
| Upsert idempotent / RLS | SQL inline ad hoc | repos typés + migration RLS calquée sur 0005 | Patron P3 (D-05) |

**Key insight:** Tout le risque "IA" est confiné à la *narration* et au *choix des niveaux*. Le reste est du code déjà patronné en P3 — la phase est essentiellement une extension disciplinée des patrons existants (engine job → persist job ; snapshots migration → analyses/trade_setups migration ; indicators golden tests → scoring golden tests).

## Runtime State Inventory

> Phase greenfield additive (nouvelles tables + nouveaux fichiers). Pas de rename/refactor. Section abrégée — un seul point d'état runtime réel :

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Aucune donnée existante renommée. Nouvelles tables `analyses`/`trade_setups` créées par 0006. | Migration data-only (DDL), pas de migration de données. |
| Live service config | **Scheduled agent Claude Code** doit être (re)configuré avec les nouveaux crons de session (asia/london/newyork/eod-swing) — cette config vit dans l'app Claude Code, **pas dans git**. | Checkpoint human-action : enregistrer/mettre à jour les routines planifiées. |
| OS-registered state | Windows Task Scheduler : backup **ingestion** déjà en place (P1/P3) ; P4 n'ajoute PAS de tâche OS pour l'ANALYZE (exige l'agent). | Aucune nouvelle tâche OS. |
| Secrets/env vars | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` déjà requis (apps/jobs/.env). Aucun nouveau secret (pas de clé API Anthropic). | Aucune. |
| Build artifacts | Aucun (pas de rename de package). | Aucune. |

## Common Pitfalls

### Pitfall 1 : R:R surestimé sur entrée en zone
**What goes wrong:** Calculer le R:R au prix médian de la zone `[min,max]` gonfle le ratio.
**Why it happens:** La zone d'entrée a deux bords ; le sens du trade détermine lequel est "pire".
**How to avoid:** D-50 — R:R calculé sur le **bord conservateur** (long : entrée = `zone.max` ; short : entrée = `zone.min`). Fonction `rr.ts` pure golden-testée sur les deux directions.
**Warning signs:** R:R global > somme des R:R par TP pondérés ; R:R qui change si on swap min/max.

### Pitfall 2 : Cohérence SL/entry/TP non vérifiée par direction
**What goes wrong:** Un long avec SL > entry, ou TP du mauvais côté, passe inaperçu.
**How to avoid:** Garde-fou explicite : long ⇒ `SL < entry_conservateur < tous les TP` ; short ⇒ inverse. Rejet + log sinon (SCORE-04).
**Warning signs:** R:R négatif, distance SL nulle.

### Pitfall 3 : Taux de rejet Zod non mesuré → prompt non itérable
**What goes wrong:** On ne sait pas si le prompt est fiable.
**How to avoid:** `persist.ts` écrit `job_runs.stats = { written, rejected, reasons[] }` à **chaque** run (raisons normalisées : `zod_shape`, `rr_below_min`, `sl_coherence`, `snapshot_not_found`, `json_parse`). Itérer `veteran.md`, comparer le taux par `prompt_version` (D-51). **Cible P1 indicative : < 10–15 % de rejet** (baseline sans contrainte schéma ≈ 8–15 % de JSON malformé `[CITED: tokenmix.ai/blog/structured-output-json-guide]`) ; viser plus bas via schéma-in-prompt + 1 exemple. Pas de seuil bloquant en P1 — c'est une métrique d'itération.
**Warning signs:** `rejected` non décroissant entre versions de prompt.

### Pitfall 4 : Fuite de valeurs dans les logs de rejet
**What goes wrong:** Logger le JSON brut rejeté expose des données.
**How to avoid:** T-02-13 — `reasons` = **messages normalisés uniquement**, jamais le payload ni de valeurs de clé. Patron déjà appliqué (technical-engine `stats.errors`).

### Pitfall 5 : Non-déterminisme du scoring
**What goes wrong:** Un golden test devient flaky.
**How to avoid:** `scoreSetup` pur, pas de `Date.now()`/`Math.random()`, nombres arrondis à précision fixe (patron `HASH_DECIMALS` de `hash.ts`). `now`/`generated_at` injectés.

### Pitfall 6 : Crash d'un instrument tue le run de session
**What goes wrong:** Un fichier JSON corrompu fait échouer toute la session.
**How to avoid:** try/catch **par fichier** (patron `technical-engine.ts` per-instrument) ; throw seulement si `written===0 && rejected>0` (WR-04). Un fichier par instrument×style isole les échecs.

## Code Examples

### Schéma Zod §3 de sortie (contrat IA — à créer)
```typescript
// Source: ARCHITECTURE.md §3 (schéma JSON sortie) + patron schema.ts P3 (Zod v4, z.infer)
import { z } from 'zod'
export const OutputSchema = z.object({
  schema_version: z.literal('1.0'),
  generated_at: z.iso.datetime(),          // Zod v4 (CLAUDE.md : z.iso.datetime)
  session: z.enum(['asia','london','newyork','eod-swing']),
  style: z.enum(['day','swing']),
  instrument: z.string(),
  direction: z.enum(['long','short']),
  // opportunity_score / risk_level / confidence : NON dans le schéma IA — dérivés par code (D-42/46/48).
  timeframe_analysis: z.string(),
  entry: z.object({ type: z.enum(['limit','market','stop']), price: z.number(), zone: z.tuple([z.number(), z.number()]) }),
  stop_loss: z.number(),
  take_profits: z.array(z.object({ price: z.number(), alloc_pct: z.number() })).min(1).max(3),  // rr recomputé par code (D-50)
  technical_reasons: z.array(z.string()),
  fundamental_reasons: z.array(z.string()),
  news_catalysts: z.array(z.object({ headline: z.string(), impact: z.string(), direction: z.string(), ts: z.iso.datetime() })),
  upcoming_risk_events: z.array(z.object({ event: z.string(), ts: z.iso.datetime(), note: z.string() })),
  invalidation: z.string(),
  veteran_note: z.string(),
  raw_indicators_ref: z.string(),          // = content_hash du snapshot (D-41) → getSnapshotByHash
})
export type Output = z.infer<typeof OutputSchema>
```
> **Décision discrétionnaire à trancher au plan :** `opportunity_score`/`risk_level`/`confidence` peuvent figurer dans l'exemple de `veteran.md` (lisibilité) mais le **code les recalcule et écrase** toute valeur émise par l'agent — le schéma Zod du contrat IA ne doit PAS les exiger, sinon on couple le rejet à un chiffre que l'agent ne devrait pas produire. **Recommandation : les exclure du `OutputSchema` ; le code seul les produit.** `[ASSUMED]` (cohérent avec D-42/46/48 mais le contrat §3 d'ARCHITECTURE les liste — à confirmer au plan).

### Veteran prompt — techniques de robustesse (pour `veteran.md`)
```
Source: docs.claude.com prompt-engineering + dev.to few-shot + cloudsquid structured-prompting (MEDIUM, multi-sources)
1. Rôle explicite : "trader 50 ans, philosophie de confluence §3".
2. Schéma-EN-prompt comme JSON (pas en prose) + 1 exemple complet (XAU_USD §3). Embed schema as JSON cuts mismatch.
3. Discipline de sortie : "Pour CHAQUE instrument, écris UN fichier <instrument>_<style>.json contenant UNIQUEMENT
   l'objet JSON. Pas de prose, pas de fence markdown, pas de commentaire."
4. Boucle batch : "Traite les instruments un par un ; un échec sur un instrument ne bloque pas les autres."
5. Bornes : "Propose 1 à 3 TP avec alloc_pct ; NE calcule PAS le score ni le R:R (le code s'en charge)."
6. Versionnement : front-matter `version: 1.0.0` + le code calcule sha256(veteran.md) → prompt_version (D-51).
```

### Migration 0006 (DDL §4 — forme, calquée sur 0005)
```sql
-- Source: ARCHITECTURE.md §4 + patron 0005_snapshots.sql (RLS D-05). Appliquée via MCP apply_migration (D-17).
create table public.analyses (
  id              uuid primary key default gen_random_uuid(),
  run_id          text not null,
  session         text not null check (session in ('asia','london','newyork','eod-swing')),
  style           text not null check (style in ('day','swing')),
  instrument_id   uuid not null references public.instruments(id) on delete cascade,
  snapshot        jsonb not null,                 -- traçabilité : snapshot exact (SCORE-05)
  model           text not null,                  -- D-51
  prompt_version  text not null,                  -- D-51 (semver + hash)
  schema_version  text not null,                  -- D-51
  created_at      timestamptz not null default now()
);
create table public.trade_setups (
  id                uuid primary key default gen_random_uuid(),
  analysis_id       uuid not null references public.analyses(id) on delete cascade,
  instrument_id     uuid not null references public.instruments(id) on delete cascade,
  direction         text not null check (direction in ('long','short')),
  opportunity_score int  not null,                -- code (D-42)
  risk_level        text not null check (risk_level in ('low','medium','high','extreme')),  -- code (D-46)
  confidence        text not null check (confidence in ('low','moderate','high')),          -- code (D-48)
  entry_price       numeric not null,
  stop_loss         numeric not null,
  take_profits      jsonb not null,               -- [{price,alloc_pct,rr}] borné code (D-50)
  risk_reward       numeric not null,             -- global, bord conservateur (D-50)
  payload           jsonb not null,               -- JSON §3 complet (veteran_note préservé)
  status            text not null default 'active' check (status in ('active','invalidated','expired')),
  valid_until       timestamptz not null,
  created_at        timestamptz not null default now()
);
alter table public.analyses enable row level security;
alter table public.trade_setups enable row level security;
create policy "analyses: lecture authentifiés"     on public.analyses     for select to authenticated using (true);
create policy "trade_setups: lecture authentifiés"  on public.trade_setups for select to authenticated using (true);
-- AUCUNE policy write → service_role bypass (D-05)
create index trade_setups_score_idx on public.trade_setups (opportunity_score desc, created_at desc);  -- §4
-- clé d'expiry/version (D-45) : index pour retrouver les setups antérieurs de la même clé
create index trade_setups_versionkey_idx on public.trade_setups (instrument_id, style, session, status)
  where status = 'active';
```
> **Note discrétionnaire :** `trade_setups` n'a pas de `session`/`style` dans le §4 d'origine (ils sont sur `analyses`). Pour l'expiry par clé `(instrument, style, session, jour)` (D-45), soit **dénormaliser `style`/`session` sur `trade_setups`** (index direct, recommandé), soit joindre sur `analyses`. À trancher au plan. `[ASSUMED]`

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| LLM calcule scores/ratios | Jugement qualitatif IA + chiffres déterministes code | Décision projet (D-42) | Reproductibilité, calibration, anti-hallucination |
| Parser stdout/markdown de l'agent | Agent écrit fichiers JSON, code les lit + valide | Recommandation research | Supprime bugs fence/prose ; échecs isolés ; debuggable `[CITED: docs.claude.com headless]` |
| JSON mode / structured outputs API | **N/A en P1** (scheduled agent, pas d'API) | Contrainte projet | Pas de garantie de schéma côté modèle → Zod + garde-fous côté code obligatoires |

**Deprecated/outdated:** N/A — phase greenfield.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `opportunity_score`/`risk_level`/`confidence` exclus du `OutputSchema` Zod du contrat IA (code seul les produit) | Code Examples / Schéma Zod | Si le planner les laisse requis dans le schéma, le rejet Zod se couple à un chiffre que l'agent ne devrait pas émettre — incohérent avec D-42. Confirmer au plan. |
| A2 | Dénormaliser `style`/`session` sur `trade_setups` pour l'index d'expiry D-45 | Migration 0006 | Sans ça, l'expiry exige une jointure ; choix discrétionnaire (D-49 colonnes laissées au planner). |
| A3 | Cible de taux de rejet Zod P1 ≈ <10–15 % (indicatif, non bloquant) | Pitfall 3 | Baseline générique de la littérature, pas mesurée sur ce projet ni ce prompt. À mesurer dès le premier run. |
| A4 | `prompt_version` = semver front-matter + sha256(veteran.md) | Supporting / Code Examples | D-51 autorise semver OU hash ; recommander les deux est un choix, pas une contrainte. |
| A5 | Le scheduling P4 ne crée AUCUNE tâche Windows pour l'ANALYZE (exige l'agent) | Runtime State / Scheduling | Confirmé par §5 + 04-CONTEXT (l'IA exige l'agent) ; si on voulait un fallback déterministe sans IA, faux. |

## Open Questions

1. **Format du `run_id` (discrétionnaire D-51)**
   - Ce qu'on sait : doit être indexable, lier analyses d'un même run, tracer dans `job_runs`.
   - Ce qui manque : convention exacte (ULID ? `<session>-<YYYYMMDD>-<uuid>` ?).
   - Recommandation : `<session>_<YYYYMMDD>T<HHmm>Z` lisible + corrélé au `job_runs.id`. À trancher au plan.

2. **Où vit `OutputSchema` : `packages/core` ou `packages/supabase` ?**
   - Ce qu'on sait : `persist.ts` (apps/jobs) le consomme ; P5 (web) lira `payload` mais pas forcément le schéma de sortie.
   - Recommandation : `packages/core` (réutilisable, déjà l'emplacement du scoring D-52 et des schémas Zod partagés). Les schémas §3 d'entrée sont dans `packages/indicators` — cohérence à arbitrer au plan.

3. **Le `model` (D-51) : quelle valeur écrire ?**
   - Ce qu'on sait : l'agent *est* le modèle (pas d'API → pas de nom de modèle exposé programmatiquement).
   - Recommandation : valeur fournie par le runbook / variable d'env (`MODEL_LABEL=claude-code-max`) ou écrite par l'agent dans le JSON et copiée par persist.ts. À trancher au plan.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Claude Code scheduled agents (Max) | ANALYZE (cœur IA, JOB-01) | ✓ (forfait Max, déjà utilisé P1/P3) | — | Aucun pour l'IA ; ingestion déterministe a Task Scheduler |
| Supabase (Postgres + MCP apply_migration) | Migration 0006 + upsert | ✓ (MCP connecté, P3 a appliqué 0005) | Postgres 15+ | Aucun |
| node:crypto, tsx, vitest | hash prompt, exécution, golden tests | ✓ (builtin / déjà installés) | — | Aucun requis |
| Clé API Anthropic | — | ✗ (volontairement absente P1) | — | L'agent EST le modèle (pas un fallback, un design) |

**Missing dependencies with no fallback:** aucune (toutes présentes).
**Missing dependencies with fallback:** N/A.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.8 (ESM, déjà config P3) |
| Config file | `apps/jobs/vitest.setup.ts` + config workspace (existant) ; `packages/core` testé en workspace |
| Quick run command | `pnpm vitest run packages/core/__tests__/scoring` |
| Full suite command | `pnpm vitest run` (racine workspace) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCORE-02 | Barème §3 day/swing → score reproductible | golden | `pnpm vitest run packages/core/__tests__/scoring/score.test.ts` | ❌ Wave 0 |
| SCORE-02 | Règle dure cap 45 (HTF contredit + pas de catalyseur) | unit | idem `score.test.ts` | ❌ Wave 0 |
| SCORE-02/SCORE-04 | R:R par TP + global sur bord conservateur de zone (long & short) | unit | `pnpm vitest run packages/core/__tests__/scoring/rr.test.ts` | ❌ Wave 0 |
| SCORE-03 | Dérivation risk_level (ATR distance, percentile, news, contre-tendance) | golden | `pnpm vitest run packages/core/__tests__/scoring/risk.test.ts` | ❌ Wave 0 |
| SCORE-04 | Garde-fou : R:R<1.2 → rejet | unit | `pnpm vitest run apps/jobs/__tests__/persist.test.ts` | ❌ Wave 0 |
| SCORE-04 | Garde-fou : cohérence SL/entry/TP par direction → rejet | unit | idem `persist.test.ts` | ❌ Wave 0 |
| SCORE-04 | Zod : JSON dérivé de §3 → rejet + raison normalisée loggée | unit | `pnpm vitest run apps/jobs/__tests__/output-schema.test.ts` | ❌ Wave 0 |
| SCORE-05 | Insert marque les setups antérieurs `expired` (même clé) | integration | `pnpm vitest run apps/jobs/__tests__/persist.test.ts` (client mocké) | ❌ Wave 0 |
| SCORE-05 | snapshot exact stocké + jamais muté | integration | idem | ❌ Wave 0 |
| SCORE-01 | Output complet (direction, niveaux, raisons, veteran_note) passe Zod | unit | `output-schema.test.ts` (fixture exemple §3 XAU_USD) | ❌ Wave 0 |
| JOB-02 | Univers session→instruments = config ∩ active | unit | `pnpm vitest run apps/jobs/__tests__/sessions-config.test.ts` | ❌ Wave 0 |
| JOB-01 | Crons UTC corrects (manuel : config agent + Croner) | manual-only | checkpoint human-action (enregistrement routines) | — |

### Sampling Rate
- **Per task commit:** `pnpm vitest run packages/core/__tests__/scoring` (golden scoring — feedback < 5 s)
- **Per wave merge:** `pnpm vitest run` (suite complète : scoring + persist + Zod + config)
- **Phase gate:** Suite verte + migration 0006 appliquée (MCP) + au moins 1 run de session réel produisant ≥1 setup persisté avant `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `packages/core/__tests__/scoring/score.test.ts` — golden fixtures barème §3 (SCORE-02)
- [ ] `packages/core/__tests__/scoring/rr.test.ts` — R:R bord conservateur long/short (SCORE-04/D-50)
- [ ] `packages/core/__tests__/scoring/risk.test.ts` — golden risk_level (SCORE-03)
- [ ] `packages/core/__tests__/scoring/confidence.test.ts` — mapping confidence (D-48)
- [ ] `apps/jobs/__tests__/persist.test.ts` — garde-fous + expiry + immuabilité (client mocké) (SCORE-04/05)
- [ ] `apps/jobs/__tests__/output-schema.test.ts` — fixtures valides/invalides du contrat §3 (SCORE-01/04)
- [ ] `apps/jobs/__tests__/sessions-config.test.ts` — univers = config ∩ active (JOB-02)
- [ ] Fixtures golden : `snapshot §3 + output IA → {score, risk_level, confidence, rr}` attendus (patron golden values indicateurs P3)

## Security Domain

> `security_enforcement` non `false` dans config.json → activé. Prolonge le modèle de menace P3 (03-SECURITY.md) sur `analyses`/`trade_setups`.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | non | Auth déjà P1 ; P4 = jobs service_role, pas d'auth utilisateur |
| V3 Session Management | non | — |
| V4 Access Control | yes | RLS select-only `to authenticated` sur `analyses`/`trade_setups` ; AUCUNE write policy → service_role bypass (D-05, calque T-03-01/02) |
| V5 Input Validation | yes | `OutputSchema` Zod v4 `.parse` à la frontière `persist.ts` AVANT tout upsert (calque T-03-08/10/14) |
| V6 Cryptography | yes | `prompt_version` via `node:crypto` sha256 — jamais de hash maison (calque T-03-07) |
| V7 Logging | yes | `job_runs.stats.reasons` = messages normalisés only, jamais payload/valeur de clé (calque T-02-13/T-03-11) |
| V14 Config (secrets) | yes | service_role via `process.env` jobs-only ; double barrière `server-only` + ESLint (calque T-03-09/13) ; pas de clé API Anthropic |

### Known Threat Patterns for cette stack (jobs Node + Supabase + agent)

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Agent insère directement (contourne garde-fous) | Elevation of Privilege | D-43 : l'agent écrit des fichiers ; SEUL `persist.ts` (service_role) insère après Zod+garde-fous |
| JSON IA dérive de forme / valeurs hors borne | Tampering / Input Validation | `OutputSchema.parse` + garde-fous (R:R, cohérence SL/TP, règles dures) → rejet+log |
| service_role exposé au web | Information Disclosure | `server-only` + ESLint `no-restricted-imports` + barrel ne ré-exporte pas service-client (D-07) |
| Mutation d'une prédiction historique (fausse la calibration) | Tampering | Immuabilité : nouvelle ligne + `expired` ; AUCUNE write policy RLS ; jamais d'UPDATE des champs d'analyse (SCORE-05) |
| Fuite de données dans les logs de rejet | Information Disclosure | reasons normalisées only (T-02-13) |
| RLS oubliée sur nouvelles tables | Elevation of Privilege | `enable row level security` + policy select-only dans 0006 ; vérifier via `get_advisors` Supabase après migration |

## Sources

### Primary (HIGH confidence)
- Codebase : `ARCHITECTURE.md` §3/§4/§5/§6, `apps/jobs/src/jobs/technical-engine.ts` (patron persist), `apps/jobs/src/runJob.ts`, `supabase/migrations/0005_snapshots.sql`, `packages/indicators/src/snapshots/schema.ts` + `hash.ts`, `packages/supabase/src/repositories/snapshots.ts` + `service-client.ts` + `index.ts`, `packages/core/src/time/sessions.ts`, `apps/jobs/src/jobs/news-engine.ts`
- Décisions : `04-CONTEXT.md` (D-42→D-52), `03-SECURITY.md` (T-03-*), `.planning/REQUIREMENTS.md`, `.planning/config.json`
- `CLAUDE.md` (stack LOCKED, "What NOT to Use")

### Secondary (MEDIUM confidence — vérifié multi-sources)
- [docs.claude.com — prompt engineering / headless](https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/prefill-claudes-response) — discipline de sortie, prefill, output formats
- [tokenmix.ai — structured output JSON guide](https://tokenmix.ai/blog/structured-output-json-guide) — taux de JSON malformé sans contrainte (8–15 %)
- [dev.to — reliable LLM JSON output few-shot](https://dev.to/maanu07/reliable-llm-json-output-few-shot-prompting-robust-parsing-2f11) — few-shot + parsing robuste
- [cloudsquid.io — prompting guide structured outputs](https://www.cloudsquid.io/blog/structured-prompting) — schéma-in-prompt, forbid fences, strip défensif
- [dev.to — markdown-fenced JSON](https://dev.to/mukundakatta/my-hermes-agent-kept-returning-json-in-a-markdown-code-block-i-kept-writing-the-same-regex-then-i-5dbc) — forbid fences + strip côté parsing
- [galileo.ai — unit-test deterministic parts of AI](https://galileo.ai/blog/unit-testing-ai-systems) + [shaped.ai — golden tests](https://www.shaped.ai/blog/golden-tests-in-ai) — golden/déterminisme

### Tertiary (LOW — indicatif)
- Cible de taux de rejet < 10–15 % : extrapolation de baselines génériques, à mesurer sur ce projet.

## Metadata

**Confidence breakdown:**
- Standard stack : HIGH — zéro nouvelle dépendance, tout vérifié dans les package.json existants.
- Architecture (persist/scoring/migration) : HIGH — calque direct des patrons P3 vérifiés + décisions verrouillées.
- Robustesse prompt / taux de rejet : MEDIUM — techniques solides multi-sources, mais non mesurées sur ce prompt précis (à itérer via job_runs.stats).
- Pitfalls : HIGH — dérivés des garde-fous §3 explicites + threats P3.

**Research date:** 2026-06-13
**Valid until:** ~2026-07-13 (stack stable, verrouillée ; revérifier si bump Zod/luxon ou changement du modèle d'agent scheduled Claude Code)
