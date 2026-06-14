---
phase: 04-moteur-ia-v-t-ran-scoring
verified: 2026-06-14T03:30:00Z
status: human_needed
score: 6/7 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Exécuter un run réel avec une session planifiée (ex. london) et des snapshots combined réels en base"
    expected: "La routine ANALYZE produit des fichiers run-artifacts/<run_id>/*.json valides, puis `tsx src/dispatch.ts persist` s'exécute sans rejet, et on trouve des analyses + trade_setups en base (opportunity_score codé, risk_level codé, prompt_version traçable)"
    why_human: "Le run de validation E2E documenté a utilisé kind='technical' + payload combiné comme contournement du check snapshots_kind_check. Le path réel (snapshot kind='combined') ne peut pas être exercé sans migration ou changement de persist, et les routines planifiées (scheduled agents Claude Code) ne sont pas encore configurées en ops. Aucun test automatisé ne peut simuler le slice complet avec des données de marché live."
  - test: "Vérifier que les routines planifiées sont configurées dans l'app Claude Code (scheduled agents)"
    expected: "Quatre crons enregistrés : asia 00 23 * * 0-4, london 00 07 * * 1-5, newyork 30 12 * * 1-5, eod-swing 00 21 * * 1-5. Chaque routine exécute INGEST+PREP → ANALYZE → `tsx src/dispatch.ts persist`"
    why_human: "Configuration hors-git (app Claude Code). Non vérifiable programmatiquement."
---

# Phase 04 : Moteur IA vétéran & Scoring — Rapport de Vérification

**Phase Goal:** Une routine produit, pour chaque opportunité, une analyse fiable et explicable — score /100 + niveau de risque + plan de trade (entrée/SL/TP/R:R) — validée par une frontière de confiance unique déterministe et persistée immuablement + traçable. L'agent ne fait QUE du jugement qualitatif borné ; tout ce qui est scoré/classé/validé est code-déterministe et golden-testé.

**Verified:** 2026-06-14T03:30:00Z
**Status:** HUMAN_NEEDED
**Re-verification:** Non — vérification initiale

---

## Résultat global

**Suite de tests : 261/261 VERTS** (pnpm vitest run — aucune régression).

Le code livré atteint le goal technique : frontière unique, scoring déterministe, immuabilité, traçabilité, anti-injection. Deux éléments ne peuvent pas être vérifiés programmatiquement : le gap `snapshots_kind_check` (voir section Gaps connus) et la configuration des routines planifiées (hors-git).

---

## Vérités observables

| # | Vérité | Statut | Preuve dans le code |
|---|--------|--------|---------------------|
| 1 | L'agent ne peut pas insérer directement — seul `persist()` (service_role) écrit | ✓ VERIFIED | `persist.ts:257` — seul chemin d'écriture. Barrel `@app/supabase/src/index.ts` ne réexporte PAS `serviceClient`. `getServiceClient()` est une fonction lazy locale dans persist.ts (D-07 respecté). |
| 2 | OutputSchema EXCLUT opportunity_score/risk_level/confidence (produits par le code) et est PERMISSIF (pas de .strict()) | ✓ VERIFIED | `packages/core/src/schemas/output.ts:51-71` — z.object() sans .strict(), ces 3 champs absents. Test « clés en trop ne rejettent pas » dans 04-01 (35/35 verts). |
| 3 | Score/risk_level/confidence/R:R calculés par code déterministe, golden-testé, jamais Date.now() | ✓ VERIFIED | `packages/core/src/scoring/score.ts` — fonctions pures, `_opts.now` injecté. 32/32 golden tests (rr 6 + risk 7 + confidence 8 + score 11). Valeurs figées : score=98, R:R long=1.566667, cap=45. |
| 4 | Migration 0006 live : RLS select-only authenticated, AUCUNE write policy, session_day dans index unique partiel ET expirePriorSetups | ✓ VERIFIED | `supabase/migrations/0006_analyses_trade_setups.sql:38-43 / 79-83 / 93-95`. L'index `trade_setups_versionkey_idx` inclut `session_day`. `expirePriorSetups` dans `tradeSetups.ts:53-63` filtre sur les 4 dimensions dont `session_day`. |
| 5 | Les 4 concerns consensus (revue cross-AI) intégrés dans le code | ✓ VERIFIED | Voir section dédiée ci-dessous. |
| 6 | CLAUDE.md compliance : Zod v4, pas de clé API Anthropic P1, service_role isolé | ✓ VERIFIED | output.ts importe depuis 'zod' (v4 confirmé par pnpm). Aucune clé Anthropic dans le code. Barrel n'exporte pas serviceClient. |
| 7 | Routines planifiées configurées et un run réel validé sans contournement kind='combined' | ? UNCERTAIN | Run de validation E2E documenté en 04-04 a utilisé `kind='technical'` + payload combiné comme contournement du check `snapshots_kind_check`. Routines planifiées = ops hors-git non vérifiables. |

**Score : 6/7**

---

## Les 4 Concerns Consensus (04-REVIEWS.md) — présents dans le code

### Concern #1 — Clé d'immuabilité `session_day` (HIGH consensus)

**Exigence :** `session_day` présent dans BOTH l'index unique partiel SQL ET la signature `expirePriorSetups`.

**Vérifié :**
- `0006_analyses_trade_setups.sql:61` — `session_day date not null`
- `0006_analyses_trade_setups.sql:93-95` — `create unique index ... (instrument_id, style, session, session_day) where status = 'active'`
- `tradeSetups.ts:26-31` — `ImmutabilityKey` inclut `session_day: string`
- `tradeSetups.ts:53-63` — `expirePriorSetups` filtre `.eq('session_day', key.session_day)`
- `persist.ts:318-324` — `sessionDay = sessionDayOf(generated_at)` puis passé à `expirePriorSetups`

Test : `persist.test.ts:275-290` — vérifie l'ordre expire→insert et que la clé inclut `session_day`.

**STATUS : VERIFIED**

### Concern #2 — `readRunArtifacts` anti path traversal (HIGH security)

**Exigence :** `run_id` validé par regex allow-list + `path.resolve` + `startsWith(BASE)` + liste vide → throw.

**Vérifié :**
- `runArtifacts.ts:26` — `RUN_ID_RE = /^[a-z]+-\d{8}T\d{4}Z$/`
- `runArtifacts.ts:47-54` — couche 1 (regex) + couche 2 (path.resolve + startsWith(RUN_ARTIFACTS_DIR + path.sep))
- `runArtifacts.ts:63-65` — couche 3 (basename sans séparateur)
- `runArtifacts.ts:80-82` — liste vide → throw 'no_artifacts'

Tests `runArtifacts.test.ts` : traversal `../../etc/passwd`, `.../../..`, vide (8 tests dans suite 261).

**STATUS : VERIFIED**

### Concern #3 — `SWING_VALID_HOURS=72` / `DAY_VALID_HOURS=24` constantes nommées (HIGH quality)

**Exigence :** constantes nommées dans le code (pas de valeurs magic), golden-testées.

**Vérifié :**
- `persist.ts:60-64` — `export const DAY_VALID_HOURS = 24` et `export const SWING_VALID_HOURS = 72`
- `persist.test.ts:254-263` — tests `validUntilOf` : day→+24h, swing→+72h avec valeurs ISO figées

**STATUS : VERIFIED**

### Concern #4 — Bornes numériques inputs scoring + `snapshot.partial` (MEDIUM security / HIGH quality)

**Exigence :** clamp RSI/atr_percentile/sentiment, throw si ATR<0, snapshot.partial → risk relevé.

**Vérifié :**
- `score.ts:107` — `clamp(t.momentum.rsi, INPUT_BOUNDS.rsi[0], INPUT_BOUNDS.rsi[1])`
- `score.ts:137` — `clamp(n.net_sentiment, ...)`
- `score.ts:180-182` — `if (t.volatility.atr < 0) throw new Error('invalid_atr')`
- `persist.ts:315` — `const riskLevel = snapshot.partial ? raiseRisk(scored.risk_level) : scored.risk_level`
- `persist.ts:202-210` — `raiseRisk` : low→medium, medium→high, high→extreme, extreme→extreme

Tests : `score.test.ts:75-113` — RSI=150 clampé, RSI=-10 clampé, ATR<0 throw. `persist.test.ts:265-272` — raiseRisk golden.

**STATUS : VERIFIED**

---

## HIGH Single-reviewer (intégrés)

### `reject('structure_against')` — quality [HIGH]

**Vérifié :**
- `persist.ts:125-137` — `structureDirection()` : BOS continue trend_ltf, CHoCH retourne
- `persist.ts:189-191` — `if (structDir !== null && structDir !== output.direction) → reject('structure_against')`
- `persist.test.ts:189-201` — test "structure cassée CONTRE la direction → reject structure_against"

**STATUS : VERIFIED**

### `reject('tp_bounds')` alloc≠100 — quality [HIGH]

**Vérifié :**
- `persist.ts:171-175` — `if (allocSum !== 100) return { rejected: true, reason: 'tp_bounds', ...base }`
- `persist.test.ts:176-187` — test somme alloc 90 → tp_bounds

**STATUS : VERIFIED**

### `sanitizeMarketText` + `<market_data>` anti prompt-injection — security [HIGH]

**Vérifié :**
- `sanitizeMarketText.ts:20,27` — strip `/[\x00-\x1f\x7f]/g` + slice(maxLen=280)
- `veteran.md:22-29` — balises `<market_data>…</market_data>` + instruction explicite
- `veteran.md:46-50` — interdiction de calculer score/risk/confidence/rr

Tests : `sanitize-market-text.test.ts` — ANSI, null, tab, troncature (14/14 dans 04-04).

**STATUS : VERIFIED**

---

## Artefacts requis

| Artefact | Statut | Détails |
|----------|--------|---------|
| `supabase/migrations/0006_analyses_trade_setups.sql` | ✓ VERIFIED | DDL complet, RLS, index, session_day |
| `packages/core/src/schemas/output.ts` | ✓ VERIFIED | OutputSchema PERMISSIF, pas de .strict(), champs codés exclus |
| `packages/core/src/scoring/score.ts` | ✓ VERIFIED | scoreSetup pur, ordre figé, no Date.now() |
| `packages/core/src/scoring/rr.ts` | ✓ VERIFIED | computeRiskReward bord conservateur D-50 |
| `packages/core/src/scoring/risk.ts` | ✓ VERIFIED | deriveRiskLevel 4 niveaux |
| `packages/core/src/scoring/confidence.ts` | ✓ VERIFIED | deriveConfidence 3 niveaux |
| `packages/core/src/scoring/weights.ts` | ✓ VERIFIED | WEIGHTS day/swing, PENALTIES, INPUT_BOUNDS, HTF_CONTRADICT_CAP=45, hasStrongCatalyst |
| `apps/jobs/src/jobs/persist.ts` | ✓ VERIFIED | Frontière unique, pipeline complet, computePromptVersion, constantes nommées |
| `apps/jobs/src/jobs/runArtifacts.ts` | ✓ VERIFIED | Anti path traversal 3 couches, throw si vide |
| `apps/jobs/src/jobs/sanitizeMarketText.ts` | ✓ VERIFIED | Strip C0+DEL, troncature 280 |
| `apps/jobs/src/jobs/sessionUniverse.ts` | ✓ VERIFIED | resolveSessionUniverse pur |
| `apps/jobs/config/sessions.ts` | ✓ VERIFIED | SESSIONS as const satisfies, D-49, crypto partout, energy hors asia |
| `apps/jobs/prompts/veteran.md` | ✓ VERIFIED | version: 1.0.0, <market_data>, interdiction calcul score, exemple XAU_USD |
| `apps/jobs/src/dispatch.ts` | ✓ VERIFIED | persist enregistré dans JOB_REGISTRY |
| `packages/supabase/src/repositories/analyses.ts` | ✓ VERIFIED | insertAnalysis retourne id |
| `packages/supabase/src/repositories/tradeSetups.ts` | ✓ VERIFIED | insertTradeSetups + expirePriorSetups clé 4D |
| `packages/supabase/src/index.ts` | ✓ VERIFIED | serviceClient NON ré-exporté (D-07) |

---

## Liens critiques

| De | Vers | Via | Statut |
|----|------|-----|--------|
| `persist.ts` | `OutputSchema.parse` | `outputResult = OutputSchema.safeParse(parsed)` `persist.ts:287` | ✓ WIRED |
| `persist.ts` | `scoreSetup` depuis `@app/core` | `persist.ts:310` | ✓ WIRED |
| `persist.ts` | `expirePriorSetups` AVANT insert | `persist.ts:319-337` — ordre garanti | ✓ WIRED |
| `persist.ts` | `insertAnalysis` → `insertTradeSetups` | `persist.ts:336-357` | ✓ WIRED |
| `dispatch.ts` | `persist` dans JOB_REGISTRY | `dispatch.ts:27,45` | ✓ WIRED |
| `scoreSetup` | `computeRiskReward` (bord conservateur) | `score.ts:189` | ✓ WIRED |
| `runGuardrails` | `structureDirection` → reject structure_against | `persist.ts:189-191` | ✓ WIRED |
| barrel `@app/supabase` | serviceClient | NON exporté (`index.ts` vérifié) | ✓ ISOLÉ |

---

## Couverture des requirements

| Requirement | Description | Statut | Preuve |
|-------------|-------------|--------|--------|
| SCORE-01 | Routine planifiée produit setup JSON (direction, entrée, SL, TP, R:R, raisons, note vétéran) | UNCERTAIN | Code en place (veteran.md, sessionUniverse, persist). Routines planifiées = ops hors-git non configurées. Run E2E réussi avec contournement kind. |
| SCORE-02 | Note /100 décomposable et pondérée | ✓ SATISFIED | `scoreSetup` 6 blocs + `breakdown`, barème day/swing. 32 golden tests. |
| SCORE-03 | Niveau de risque (low/medium/high/extreme) séparé | ✓ SATISFIED | `deriveRiskLevel` 4 facteurs §3. Golden testé. |
| SCORE-04 | scoring-aggregator Zod + garde-fous déterministes + rejets loggés | ✓ SATISFIED | `persist.ts` pipeline complet : json_parse/zod_shape/snapshot_not_found/rr_below_min/sl_coherence/tp_bounds/structure_against. 26+ tests. |
| SCORE-05 | Snapshot exact lié, jamais muté, ancien marqué expired | ✓ SATISFIED | `raw_indicators_ref` → `getSnapshotByHash`, `expirePriorSetups` seul STATUS transite. Test ordre expire→insert. |
| JOB-01 | Routines planifiées aux ouvertures de sessions (asia/london/newyork/eod-swing) en UTC | PENDING | Config `sessions.ts` D-49 + crons UTC documentés. Routines scheduled agents = hors-git (checkpoint human-action en attente). |
| JOB-02 | Un run traite la session entière en batch (tous instruments/styles) | PENDING | `resolveSessionUniverse` + `SESSIONS` config = logique batch. Run réel = dépend des routines planifiées. |

---

## Trace de données (Level 4)

| Artefact | Variable | Source | Donnée réelle | Statut |
|----------|----------|--------|---------------|--------|
| `persist.ts` | `scored.opportunity_score` | `scoreSetup(combined, output, style)` — calcul pur depuis snapshot | Snapshot Supabase via `getSnapshotByHash` | ✓ FLOWING |
| `persist.ts` | `riskLevel` | `deriveRiskLevel` + `raiseRisk` si partial | Snapshot payload | ✓ FLOWING |
| `persist.ts` | `promptVersion` | `computePromptVersion()` = semver+sha256(veteran.md) | Fichier versionné sur disque | ✓ FLOWING |
| `scoreSetup` | inputs §3 | `snapshot.technical / .fundamental / .news` | Payload JSONB Supabase | ✓ FLOWING (conditionnel au kind='combined' — voir gap) |

---

## Spot-checks comportementaux

| Comportement | Commande | Résultat | Statut |
|-------------|----------|----------|--------|
| Suite tests complète | `pnpm vitest run` | 261/261 verts en 1.58s | ✓ PASS |
| Typecheck jobs | `pnpm --filter jobs exec tsc --noEmit` | exit 0 (per SUMMARY 04-04) | ✓ PASS |
| Typecheck core | `pnpm --filter @app/core exec tsc --noEmit` | exit 0 (per SUMMARY 04-02) | ✓ PASS |
| Barrel supabase sans serviceClient | `grep 'serviceClient' packages/supabase/src/index.ts` | 0 résultat | ✓ PASS |
| persist.ts n'importe pas depuis service-client.ts | `grep 'service-client' apps/jobs/src/jobs/persist.ts` | 0 résultat (lazy local createClient) | ✓ PASS |

---

## Anti-patterns

| Fichier | Ligne | Pattern | Sévérité | Impact |
|---------|-------|---------|----------|--------|
| `persist.ts:244` | 244 | Caractère unicode `──────` dans un commentaire (cosmétique) | Info | Aucun |

Aucun TBD/FIXME/XXX/placeholder détecté dans les fichiers modifiés par la phase.
Aucun `return null` / `return []` stub trouvé dans les chemins critiques.
Le cast `snapshot.payload as unknown as CombinedSnapshot` dans persist.ts:159,309 est un cast conscient documenté (D-04-03-B) — pas un stub.

---

## Gaps connus (non-bloquants — reportés au backlog)

### Gap 1 — `snapshots_kind_check` n'autorise pas `kind='combined'`

**Sévérité : WARNING (non-bloquant pour le code Phase 4, bloquant pour les routines live)**

Le check de migration 0005 sur la table `snapshots` autorise `kind IN ('technical', 'fundamental', 'news')` mais pas `'combined'`. Or `persist.ts:309` caste `snapshot.payload` comme `CombinedSnapshot` (payload technique + fondamental + news). Le run de validation E2E (04-04) a contourné en insérant un snapshot avec `kind='technical'` mais payload combiné.

**Impact concret :** les routines planifiées réelles ne pourront pas insérer un snapshot kind='combined' avant qu'une migration ajoute ce type (ou que persist assemble lui-même 3 snapshots séparés). Le code P4 est correct ; c'est un gap de migration.

**Recommandation :** migration `0007` ajoutant `'combined'` au check + écrire les snapshots combinés correctement. À traiter avant activation des routines live.

### Gap 2 — Numéro de décision D-49 potentiellement collisionné

**Sévérité : Info (cosmétique, pas de risque fonctionnel)**

04-02 SUMMARY enregistre « D-49 : miroir structurel local snapshot-input.ts » alors que 04-CONTEXT D-49 = « config sessions versionnée ». Collision de numérotation dans les décisions. Les deux décisions sont implémentées correctement dans le code ; seul le tracking documentaire est ambigu.

**Recommandation :** renommer la décision 04-02 en D-04-02-A dans 04-02 SUMMARY (déjà nommée D-04-02-A implicitement dans certains commentaires). Impact nul sur le code.

---

## Vérification humaine requise

### 1. Run réel avec snapshot kind='combined'

**Test :** Créer une migration `0007` ajoutant `'combined'` au check `snapshots_kind_check`, puis insérer un snapshot combiné (technical + fundamental + news) et exécuter `RUN_ID=london-<date>T<heure>Z MODEL_LABEL=claude-opus-4-8 tsx src/dispatch.ts persist` avec des artefacts JSON produits par l'agent.

**Attendu :** exit 0, 1 ligne `analyses` + 1 ligne `trade_setups` status='active' avec opportunity_score calculé par le code (≠ valeur dans le JSON agent), risk_level, confidence, prompt_version = `1.0.0+<sha256>`.

**Pourquoi humain :** le gap `snapshots_kind_check` nécessite une migration et des données de marché live. Aucun test automatisé ne peut simuler le path complet sans ce prérequis.

### 2. Configuration des routines planifiées

**Test :** Vérifier dans l'app Claude Code (scheduled agents, forfait Max) que 4 routines sont configurées avec les crons UTC documentés dans `sessions.ts`.

**Attendu :** asia `00 23 * * 0-4`, london `00 07 * * 1-5`, newyork `30 12 * * 1-5`, eod-swing `00 21 * * 1-5`. Chaque routine : INGEST+PREP → ANALYZE (écrit run-artifacts) → `tsx src/dispatch.ts persist`.

**Pourquoi humain :** configuration hors-git dans l'interface de l'app Claude Code. Non vérifiable programmatiquement.

---

## Jugement de l'objectif de phase

Le goal de phase est **techniquement atteint dans le code** :

- La frontière de confiance unique (`persist.ts`) est la seule voie d'écriture — l'agent ne peut pas insérer.
- Le score /100, le risk_level, la confidence, et le R:R sont tous produits par code déterministe (`packages/core/scoring`), golden-testés avec des valeurs figées, sans `Date.now()`.
- L'immuabilité est garantie par le code (`expirePriorSetups` AVANT insert, index unique partiel DB, seul `status` transite).
- La traçabilité est complète (`model`, `prompt_version` semver+sha256, `schema_version`, `run_id` sur `analyses`).
- Les 4 concerns consensus de revue sont tous intégrés et testés.
- 261/261 tests verts.

Ce qui reste : le **gap `snapshots_kind_check`** doit être résolu avant que les routines live puissent fonctionner sans contournement, et les **routines planifiées** doivent être configurées (ops hors-git). Ces deux éléments relèvent de la vérification humaine, non d'un défaut du code livré.

---

_Vérifié : 2026-06-14T03:30:00Z_
_Vérificateur : Claude (gsd-verifier)_
