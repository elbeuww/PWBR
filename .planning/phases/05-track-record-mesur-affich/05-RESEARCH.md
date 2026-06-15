# Phase 5 : Track record mesuré & % affiché — Research

**Researched:** 2026-06-15
**Domain:** Replay déterministe de trades (outcome simulation) + agrégats statistiques DB + affichage public RLS (Next 15 RSC)
**Confidence:** HIGH (tout ancré dans le repo réel inspecté ; zéro nouvelle dépendance npm)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 :** Résultat = binaire « TP1 atteint avant SL ». `realized_r` mesuré jusqu'à TP1. Pas de simulation de TP partiels au MVP.
- **D-02 :** Trade « flat » (ni TP ni SL avant `valid_until`) = valorisé au prix de clôture à `valid_until` (R>0 si dans le sens, R<0 sinon). Compte avec son R, jamais exclu/neutre.
- **D-03 :** Granularité de mesure = bougies **H1** (`candles.timeframe='H1'`, déjà en base). Pas d'ingestion M5.
- **D-04 :** Cas ambigu (même bougie H1 touche TP **et** SL) = règle **« le niveau le plus proche du prix d'entrée est touché en premier »**.
- **D-05 :** Job idempotent par `setup_id` (re-run = même résultat, pas de double comptage). Tracé `job_runs`. Indépendant de toute exécution user. Réutilise `packages/core/src/time/constants.ts`.
- **D-06 :** Catégories : par actif/classe d'actif, par style (day/swing), par tranche de score, par niveau de risque. Toutes dispo sur `trade_setups`.
- **D-07 :** Chiffre vedette = % de **tous les signaux publiés**. Catégories = même ensemble découpé. **Un seul pipeline** — pas de backtest synthétique.
- **D-08 :** Au MVP on collapse « par pattern (backtest) » et « réel agrégé » : tout vient de trades réels publiés. **À signaler au verifier** : pas de dataset backtest distinct.
- **D-09 :** Seuil minimal = **30 trades terminés** (global ET chaque catégorie). En dessous → « échantillon insuffisant, N trades », jamais de %.
- **D-10 :** Métriques affichées = **win rate + R moyen + expectancy**.
- **D-11 :** Périodes = **all-time + fenêtre glissante 90 jours** (les deux affichés).
- **D-12 :** N (taille d'échantillon) TOUJOURS affiché à côté de chaque chiffre.
- **D-13 :** Surface publique = vitrine (slot P2/D-08 à débloquer). Détail par catégorie affiché **sur la vitrine** (public). % aussi dans la plateforme payante.
- **D-14 :** Méthode = tooltip court + page méthodologie dédiée.
- **D-15 :** Le bloc % cohabite avec disclaimers LEGAL-01.

### Claude's Discretion
- Cadence/déclenchement du job `outcome-tracker` (quotidien, ou après sweep d'expiry) — contrainte : idempotent + tracé `job_runs`.
- Schéma exact `prediction_outcomes` / `pattern_stats` et matérialisation (table vs vue) — contrainte : écriture service_role, lecture publique des stats agrégées, migration via MCP `apply_migration` (PAS `db push`).
- Format RTL/arabe des nombres/% (réutiliser `<bdi>`/`Intl` posés en P1).

### Deferred Ideas (OUT OF SCOPE)
- Ingestion bougies M5 pour first-touch ultra-précis.
- Backtest moteur sur historique non publié.
- Simulation TP partiels complète (alloc_pct + break-even + equity curve).
- Publication Telegram du win rate (Phase 6, TG-02).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (REQUIREMENTS.md) | Research Support |
|----|------------------------------|------------------|
| TRACK-01 | Rejoue setups expirés depuis snapshot/candles → enregistre hit_tp/hit_sl/realized_r dans `prediction_outcomes`, indépendant de toute exécution user. | §Replay Engine + §Architecture Patterns Pattern 1 (job `outcome-tracker` miroir `subscription-expiry`), §Code Examples (algo first-touch H1 + règle distance D-04). Source candles : repo `candles` (lecture service_role). |
| TRACK-02 | Calcule taux de réussite par catégorie ET track record réel agrégé. | §Schéma DB (`prediction_outcomes` table + `pattern_stats` vue/table) + §Code Examples (agrégat SQL win rate/R moyen/expectancy par dimension). D-07/D-08 : un seul pipeline. |
| TRACK-03 | Vitrine + espace membre affichent % TOUJOURS mesuré, méthode + N ; « échantillon insuffisant » sous seuil. | §Affichage (RSC anon-client + RLS publique `pattern_stats`), §Pitfalls (seuil N≥30 appliqué en DB), 05-UI-SPEC.md (contrat figé). |
</phase_requirements>

## Summary

Phase 5 ajoute **un job de replay déterministe** (`outcome-tracker`) et **une couche d'agrégats statistiques publiquement lisible**. Tout le socle existe : le pattern de job idempotent (`subscription-expiry.ts`), le wrapper `runJob`+`job_runs`, les repositories service_role (`candles`, `tradeSetups`), les constantes temps (`packages/core/src/time/constants.ts`, `candle.ts`), et le slot vitrine masqué (`SHOW_PROOF=false` dans la page marketing). **Il n'y a presque rien à inventer** côté infra — le travail neuf est : (1) l'algorithme de replay first-touch sur candles H1 avec la règle de distance D-04, (2) le schéma `prediction_outcomes`/`pattern_stats`, (3) **la première policy RLS `anon`/public du projet** (toutes les tables existantes sont `to authenticated` uniquement).

**Trois décisions structurantes pour le planner :**
1. **Numéro de migration — COLLISION RÉELLE.** Le prochain numéro de fichier libre est `0013`, MAIS le cluster de re-soumission Phase 4 (différé) a déjà réservé `0013` pour `tx_hash nullable` (voir `04-DEFERRED-resubmission-cluster.md`). **Recommandation : Phase 5 prend `0014`** et laisse `0013` au correctif paiement différé. À arbitrer explicitement avec le fondateur.
2. **`pattern_stats` = vue SQL (pas table matérialisée) au MVP.** L'agrégation sur des milliers de lignes `prediction_outcomes` est triviale pour Postgres ; une vue garantit fraîcheur immédiate + zéro job de refresh + zéro divergence. Le seuil N≥30 (D-09) s'applique **en couche applicative** (TS), pas en DB — la vue retourne N brut, le front décide d'afficher % ou « échantillon insuffisant ». Cela évite de coder le seuil deux fois et garde la vue réutilisable.
3. **Replay : lire le snapshot OU les candles ?** Le `realized_r`/first-touch se calcule **uniquement sur `candles` H1** (entre `created_at` du setup et `valid_until`). Le `snapshots` n'est PAS nécessaire au replay du résultat (il sert la traçabilité de génération, pas l'évolution future du prix). Réutiliser `candles` repo en lecture.

**Primary recommendation :** Job `outcome-tracker` (miroir `subscription-expiry`) qui sélectionne les setups `status IN (expired, invalidated)` AND `valid_until < now()` absents de `prediction_outcomes`, rejoue chacun contre les candles H1 ordonnées par `ts`, applique l'algo first-touch (avec règle distance D-04 sur bougie ambiguë), persiste `{setup_id UNIQUE, outcome, realized_r, ...}`. Migration `0014` : table `prediction_outcomes` (RLS authenticated read + service_role write, comme toutes les autres) + vue `pattern_stats` avec **policy/grant SELECT pour `anon`** (nouveauté). Front RSC lit `pattern_stats` en anon-client, applique le seuil N≥30 en TS, affiche via composants UI-SPEC déjà figés.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Replay déterministe d'un setup expiré | API/Backend (`apps/jobs`) | Database (`candles` lecture) | Logique de simulation = code TS testable (golden tests Vitest). Service_role, hors requête user (D-05). |
| Calcul first-touch + règle distance D-04 | `packages/core` (pur, testable) | — | Logique déterministe pure → vit dans `core`, golden-testée, réutilise constantes temps existantes. |
| Persistance résultat par setup | Database (`prediction_outcomes`) | API/Backend (écriture service_role) | `UNIQUE(setup_id)` = filet idempotence DB (D-05). |
| Agrégation win rate/R/expectancy par catégorie | Database (vue `pattern_stats`) | — | SQL `GROUP BY` natif, fraîcheur immédiate, pas de job refresh. |
| Seuil N≥30 (afficher % ou « insuffisant ») | Frontend Server (RSC TS) | — | Décision d'affichage, pas de stockage. Évite de coder le seuil en DB ET en TS. |
| Lecture publique des agrégats | Frontend Server (anon-client) | Database (RLS `anon`) | Vitrine = sans compte → exige policy `anon` (PREMIÈRE du projet). |
| Affichage % + N + méthode + tooltip | Browser/Client + RSC | — | Contrat figé par 05-UI-SPEC.md (réutilise primitives shadcn existantes). |

## Standard Stack

**Aucune nouvelle dépendance npm.** Tout est verrouillé dans CLAUDE.md et déjà installé. Le travail de Phase 5 réutilise l'existant.

### Core (réutilisé, déjà présent)
| Library | Version | Purpose | Pourquoi |
|---------|---------|---------|----------|
| `@supabase/supabase-js` | 2.108.0 | Client service_role (job) + lecture | Déjà utilisé par tous les jobs (`runJob.ts`). [VERIFIED: repo] |
| `@supabase/ssr` | 0.12.0 | anon-client RSC pour lecture vitrine | `createServerSupabaseClient` existe déjà (`anon-client.ts`). [VERIFIED: repo] |
| `luxon` | 3.7.2 | Bornes temporelles UTC du replay (`created_at`→`valid_until`) | `candle.ts` l'utilise déjà ; `UTC_ZONE` dans constants. [VERIFIED: repo] |
| `pino` | 10.3.1 | Logs structurés du job | `runJob.ts` l'utilise. [VERIFIED: repo] |
| `tsx` | 4.22.4 | Exécution du job | `dispatch.ts` dispatch tsx. [VERIFIED: repo] |
| `zod` | 4.4.3 | (Optionnel) valider la forme des candles lues / payload | Garde-fou frontière. [VERIFIED: repo] |
| Supabase CLI / MCP `apply_migration` | — | Migration 0014 (PAS `db push`, D-17) | Pattern établi 0006/0009/0012. [VERIFIED: repo] |

### Affichage (réutilisé — voir 05-UI-SPEC.md)
| Library | Version | Purpose |
|---------|---------|---------|
| Next.js | 15.x | RSC pour lecture `pattern_stats` |
| `@tanstack/react-query` | 5.101.0 | (Optionnel) si bascule period/category côté client |
| shadcn/ui (card, tabs, table, tooltip, badge) | existant | Composants déjà présents, aucun ajout (UI-SPEC §Registry Safety) |
| `recharts` | 3.6.1 | Optionnel : barres comparatives neutres |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vue SQL `pattern_stats` | Table matérialisée recalculée par le job | Table = perf O(1) à très grand volume MAIS exige un job de refresh + fenêtre de staleness + divergence possible. Au MVP (centaines/milliers de setups), la vue est instantanée et toujours fraîche. **Recommandé : vue.** Migration vers table matérialisée = extension future si le volume explose. |
| Seuil N≥30 en couche applicative | Seuil dans la vue (CASE WHEN n<30 THEN NULL) | Le mettre en DB masquerait N (or D-12 exige N TOUJOURS visible, même < 30). La vue DOIT retourner N brut ; le seuil est une décision d'affichage → TS. |
| Replay sur `candles` H1 | Replay sur `snapshots` | snapshots = état au moment de la génération (traçabilité amont), ne contient pas l'évolution future du prix. Le résultat se mesure sur les candles postérieures → `candles`. |
| Job dédié `outcome-tracker` | Étendre `subscription-expiry` | Séparation des responsabilités : expiry = lifecycle abonnement ; outcome = mesure trade. Jobs distincts, dispatch distinct. **Recommandé : job dédié.** |

**Installation :** néant — aucune dépendance à ajouter.

## Package Legitimacy Audit

> **N/A — aucun package externe installé en Phase 5.** Tout le travail réutilise des dépendances déjà verrouillées (CLAUDE.md) et présentes dans le repo. Pas de surface slopsquatting. UI-SPEC §Registry Safety confirme : « no new npm dependency, no new shadcn block ».

## Architecture Patterns

### System Architecture Diagram

```
   ┌─────────────────────────────────────────────────────────────────────┐
   │  DÉCLENCHEMENT (Claude scheduled routine | Windows Task Scheduler)    │
   │   tsx src/dispatch.ts outcome-tracker                                 │
   └───────────────────────────────┬─────────────────────────────────────┘
                                    │ runJob() → job_runs (running)
                                    ▼
   ┌─────────────────────────────────────────────────────────────────────┐
   │  outcome-tracker.ts (service_role, idempotent par setup_id)          │
   │                                                                       │
   │  1. SELECT trade_setups WHERE status IN ('expired','invalidated')    │
   │       AND valid_until < now()                                         │
   │       AND id NOT IN (SELECT setup_id FROM prediction_outcomes)  ◄──┐  │
   │                                                                   │  │
   │  2. pour chaque setup :                                           │  │
   │       SELECT candles WHERE instrument_id=? AND timeframe='H1'     │  │
   │            AND ts >= created_at AND ts <= valid_until  ORDER ts   │  │
   │            (anti look-ahead : ts < valid_until, cf. candle.ts)    │  │
   │       ▼                                                           │  │
   │     packages/core/scoring(ou replay)/  replayOutcome(setup, candles)│ │
   │       → first-touch : pour chaque bougie, TP1/SL dans [low,high]? │  │
   │       → règle distance D-04 si TP+SL même bougie                  │  │
   │       → flat D-02 : R au close(valid_until) si rien touché        │  │
   │       → { outcome:'hit_tp'|'hit_sl'|'flat', realized_r }          │  │
   │       ▼                                                           │  │
   │  3. INSERT prediction_outcomes (UNIQUE setup_id) ─────────────────┘  │
   │       (filet DB : conflit setup_id = déjà traité, skip)              │
   └───────────────────────────────┬─────────────────────────────────────┘
                                    │ finishRun() → job_runs (success+stats)
                                    ▼
   ┌─────────────────────────────────────────────────────────────────────┐
   │  VUE pattern_stats (GROUP BY dimension × période)                    │
   │   win_rate, avg_r, expectancy, n  — RLS: SELECT to anon + authenticated│
   └───────────────────────────────┬─────────────────────────────────────┘
                                    │ anon-client (RSC)
                                    ▼
   ┌─────────────────────────────────────────────────────────────────────┐
   │  VITRINE (page marketing, SHOW_PROOF→true) + ESPACE MEMBRE           │
   │   TrackRecordBlock : seuil N≥30 appliqué en TS                       │
   │   → % + N + tooltip  OU  « échantillon insuffisant — N trades »      │
   └─────────────────────────────────────────────────────────────────────┘
```

### Pattern 1 : Job idempotent miroir `subscription-expiry`
**What :** Copier la structure de `apps/jobs/src/jobs/subscription-expiry.ts` : client service_role lazy, fonction async retournant des stats `Json`, enregistrée dans `JOB_REGISTRY` de `dispatch.ts`, wrappée par `runJob` (qui trace `job_runs`).
**When :** TRACK-01.
**Idempotence à deux niveaux :**
1. **Sélection bornée** : ne traiter que les setups absents de `prediction_outcomes` (re-run = 0 ligne nouvelle).
2. **Filet DB** : `UNIQUE(setup_id)` sur `prediction_outcomes` + insert qui ignore le conflit (`onConflict: 'setup_id', ignoreDuplicates: true`) — même pattern que `upsertCandles` (onConflict `candles_uniq`).

### Pattern 2 : Logique de replay pure dans `packages/core`
**What :** La fonction `replayOutcome(setup, candlesH1)` est **pure et déterministe** → vit dans `packages/core` (ex. `packages/core/src/replay/outcome.ts`), golden-testée Vitest. Le job (`apps/jobs`) ne fait que l'I/O (lire candles, écrire outcome).
**When :** TRACK-01, exigence de déterminisme (Core Value « jamais inventé »).
**Réutilise :** `UTC_ZONE`, `TIMEFRAMES.H1` de `constants.ts` ; convention anti look-ahead de `candle.ts` (ne jamais inclure une bougie dont `ts >= valid_until` non clôturée).

### Pattern 3 : Vue agrégat + première policy RLS `anon`
**What :** `pattern_stats` = vue SQL `GROUP BY` sur `prediction_outcomes ⋈ trade_setups`, une ligne par (dimension, valeur, période). **Première lecture publique du projet** → exige `GRANT SELECT ... TO anon` + (si vue sur tables RLS) `security_invoker=false` ou une vue `SECURITY DEFINER`-équivalente. Voir Pitfall 1.
**When :** TRACK-02 + TRACK-03 (vitrine publique sans compte).

### Anti-Patterns to Avoid
- **Recalculer le R avec le moteur de scoring v1.0.** Le replay mesure le PRIX réalisé, pas le score de génération. `realized_r = (exit - entry) / (entry - stop_loss)` (long) sur les prix de candles, jamais via `packages/core/scoring`.
- **Inclure la bougie de `valid_until` non clôturée.** Respecter `candle.ts` : borne `ts < valid_until` pour le first-touch ; le flat D-02 utilise le `close` de la dernière bougie H1 clôturée ≤ `valid_until`.
- **Masquer N en DB.** D-12 exige N toujours visible. La vue retourne `n` brut ; le seuil 30 est un `if` TS.
- **Importer un repo service_role dans `apps/web`.** Interdit (frontière D-07). La vitrine lit `pattern_stats` via anon-client uniquement.
- **`supabase db push`.** Interdit (D-17). Migration via MCP `apply_migration`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tracer l'exécution du job | Logique job_runs custom | `runJob()` wrapper existant | Gère startRun/finishRun/erreur déjà. |
| Idempotence ingestion | Dédup manuelle en mémoire | `UNIQUE(setup_id)` + `onConflict ignoreDuplicates` | Pattern `candles_uniq`/`snapshots_uniq` éprouvé. |
| Lecture candles H1 | Query SQL ad hoc | Étendre `candles` repo (nouvelle fn `getCandlesForReplay`) | Cohérence service_role + types. |
| Agrégat win rate/expectancy | Boucle TS sur toutes les lignes | Vue SQL `GROUP BY` | Postgres calcule AVG/COUNT/SUM nativement, fraîcheur immédiate. |
| Client anon RSC | Nouveau client | `createServerSupabaseClient` existant | Pattern cookies getAll/setAll déjà correct. |
| Format %/R en AR/EN/FR | Formatage string maison | `<bdi>` + `Intl.NumberFormat` (helpers P1) | RTL-safe, déjà posé (UI-SPEC). |

**Key insight :** Phase 5 est à ~80% de l'assemblage de pièces existantes. Le seul code véritablement neuf et délicat est `replayOutcome` (golden-testé) et la **policy RLS `anon`** (jamais faite avant dans ce projet).

## Runtime State Inventory

> Phase 5 est principalement additive (nouveau job + nouvelle table/vue + déblocage d'un slot). Pas un rename/refactor. Inventaire ciblé sur les états runtime impactés par le nouveau job.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `prediction_outcomes` : nouvelle table, vide au départ. Backfill = le premier run du job traite TOUS les setups expirés historiques (idempotent). | Aucune migration de données ; le job backfill au 1er run. |
| Live service config | Nouveau job `outcome-tracker` à enregistrer dans la routine Claude scheduled ET un `.cmd` Windows Task Scheduler (cohérent avec `subscription-expiry`). Ces enregistrements vivent HORS git (Task Scheduler) / dans la config routine. | Enregistrer le déclencheur (planner doit prévoir la tâche). |
| OS-registered state | Windows Task Scheduler : ajouter une tâche `run-job.cmd outcome-tracker` (miroir des jobs existants). | Re-register tâche (manuel/script). |
| Secrets/env vars | Aucun nouveau secret. Réutilise `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (job) et `NEXT_PUBLIC_SUPABASE_*` (front anon). | Aucune. |
| Build artifacts | `database.types.ts` à régénérer après migration 0014 (`supabase gen types`). Le slot vitrine `SHOW_PROOF=false` → `true`. | Régénérer types ; activer slot. |

## Common Pitfalls

### Pitfall 1 : RLS publique — PREMIÈRE du projet, vue sur tables RLS
**What goes wrong :** Une vue Postgres standard s'exécute par défaut avec les droits du créateur, MAIS depuis Postgres 15 le comportement `security_invoker` change le contexte. Si `pattern_stats` est une vue sur `prediction_outcomes`/`trade_setups` (toutes deux RLS `to authenticated`), un lecteur `anon` se verra refuser l'accès aux tables sous-jacentes → la vue renverra 0 ligne ou une erreur.
**Why :** Aucune table du projet n'a jamais eu de policy `to anon` — toutes sont `to authenticated` (vérifié : `grep "to anon"` = 0 résultat). C'est un terrain neuf.
**How to avoid :** Deux options propres (planner tranche) :
- (a) Vue avec `security_invoker = false` (défaut pré-PG15 ; la vue lit avec les droits owner qui bypass RLS) + `GRANT SELECT ON pattern_stats TO anon, authenticated`. Simple, mais expose la vue agrégée publiquement — ce qui est exactement voulu (agrégats anonymes, jamais les lignes par setup).
- (b) Une table matérialisée `pattern_stats` peuplée par le job (service_role) avec sa propre policy `for select to anon using (true)` — comme les tables existantes mais ciblant `anon`. Plus de contrôle RLS, mais réintroduit le job de refresh écarté plus haut.
**Recommandé :** option (a) vue + GRANT anon, en VÉRIFIANT explicitement avec `get_advisors` Supabase (security lints) que `prediction_outcomes` reste inaccessible à `anon` (seuls les agrégats fuient, jamais le détail par setup — minimisation données, fondateur).
**Warning signs :** `pattern_stats` renvoie 0 ligne en anon alors que peuplée en service_role → RLS bloque la vue.

### Pitfall 2 : Cas ambigu D-04 sur bougie H1 mal implémenté
**What goes wrong :** Quand une bougie H1 a `low ≤ SL` ET `high ≥ TP1`, choisir naïvement TP (optimiste) ou SL (pessimiste) biaise le track record.
**How to avoid :** Règle de distance D-04 : `dist_tp = |TP1 - entry|`, `dist_sl = |entry - SL|`. Si `dist_tp ≤ dist_sl` → hit_tp ; sinon → hit_sl. Documenter le tie-break `≤` (égalité = TP, défendable car TP1 multi-TP est proche par construction — Specific Ideas). Golden test obligatoire sur ce cas.
**Warning signs :** Un win rate suspicieusement haut → vérifier la branche ambiguë.

### Pitfall 3 : Double comptage / non-idempotence
**What goes wrong :** Re-run du job recompte un setup → fausse les agrégats.
**How to avoid :** Sélection `NOT IN (SELECT setup_id FROM prediction_outcomes)` + `UNIQUE(setup_id)` DB + insert `ignoreDuplicates`. Test : run deux fois → 2e run insère 0 ligne.

### Pitfall 4 : Quels setups sont « expirés à traiter »
**What goes wrong :** Traiter des setups `active` (encore en cours) → résultat prématuré ; ou rater des `invalidated`.
**How to avoid :** Critère = `status IN ('expired','invalidated')` AND `valid_until < now()`. Un setup `invalidated` (SL touché avant fin de validité, transition de status) a aussi un outcome mesurable. Confirmer avec le fondateur si `invalidated` doit compter comme `hit_sl` ou être rejoué pleinement. [ASSUMED] — voir Assumptions A1.

### Pitfall 5 : Expectancy mal calculée
**What goes wrong :** Confondre expectancy avec win rate × R.
**How to avoid :** `expectancy = AVG(realized_r)` sur tous les trades de l'ensemble (gagnants ET perdants, en R). C'est l'espérance en R par trade (D-10). `R moyen` = la même chose, donc clarifier avec le fondateur si « R moyen » ≠ « expectancy » (souvent : R moyen = AVG(realized_r) des GAGNANTS seulement, expectancy = AVG sur TOUS). [ASSUMED] — voir A2.

### Pitfall 6 : Trade flat D-02 — sens du R
**What goes wrong :** Signe du R inversé selon long/short au close.
**How to avoid :** long : `realized_r = (close_vu - entry) / (entry - SL)` ; short : `realized_r = (entry - close_vu) / (SL - entry)`. `close_vu` = close de la dernière bougie H1 clôturée ≤ valid_until. R>0 si prix dans le sens, R<0 sinon (D-02).

## Code Examples

### Sélection des setups à traiter (idempotent)
```typescript
// apps/jobs/src/jobs/outcome-tracker.ts — miroir subscription-expiry.ts
// service_role client lazy (copier getServiceClient de subscription-expiry.ts)
const { data: pending } = await client
  .from('trade_setups')
  .select('id, instrument_id, direction, entry_price, stop_loss, take_profits, valid_until, created_at, style, opportunity_score, risk_level')
  .in('status', ['expired', 'invalidated'])
  .lt('valid_until', new Date().toISOString())
  // anti double-comptage : exclure ceux déjà dans prediction_outcomes
  // (faire via NOT IN sous-requête RPC, ou filtrer côté TS après lecture des setup_id existants)
```

### Replay first-touch pur (packages/core/src/replay/outcome.ts)
```typescript
// Source: logique dérivée du contrat §3 (output.ts) + candle.ts (anti look-ahead)
type Candle = { ts: string; open: number; high: number; low: number; close: number }
type Setup = {
  direction: 'long' | 'short'
  entry_price: number
  stop_loss: number
  take_profits: { price: number; alloc_pct: number }[] // TP1 = [0]
  valid_until: string
}
type Outcome = { outcome: 'hit_tp' | 'hit_sl' | 'flat'; realized_r: number }

export function replayOutcome(setup: Setup, candlesH1: Candle[]): Outcome {
  const tp1 = setup.take_profits[0]!.price
  const sl = setup.stop_loss
  const entry = setup.entry_price
  const isLong = setup.direction === 'long'
  const denom = isLong ? entry - sl : sl - entry // > 0 par construction

  for (const c of candlesH1) {
    const hitTp = isLong ? c.high >= tp1 : c.low <= tp1
    const hitSl = isLong ? c.low <= sl : c.high >= sl
    if (hitTp && hitSl) {
      // D-04 : règle de distance — le niveau le plus proche de l'entrée est touché en premier
      const distTp = Math.abs(tp1 - entry)
      const distSl = Math.abs(entry - sl)
      return distTp <= distSl
        ? { outcome: 'hit_tp', realized_r: Math.abs(tp1 - entry) / denom }
        : { outcome: 'hit_sl', realized_r: -1 }
    }
    if (hitTp) return { outcome: 'hit_tp', realized_r: Math.abs(tp1 - entry) / denom }
    if (hitSl) return { outcome: 'hit_sl', realized_r: -1 }
  }
  // D-02 flat : R au close de la dernière bougie clôturée ≤ valid_until
  const last = candlesH1[candlesH1.length - 1]
  if (!last) return { outcome: 'flat', realized_r: 0 } // aucune candle → R neutre (edge à arbitrer, A3)
  const r = isLong ? (last.close - entry) / denom : (entry - last.close) / denom
  return { outcome: 'flat', realized_r: r }
}
```

### Vue agrégat (esquisse SQL — migration 0014)
```sql
-- prediction_outcomes : RLS authenticated read + service_role write (miroir 0006)
create table public.prediction_outcomes (
  setup_id     uuid primary key references public.trade_setups(id) on delete cascade,
  outcome      text not null check (outcome in ('hit_tp','hit_sl','flat')),
  realized_r   numeric not null,
  resolved_at  timestamptz not null default now(),
  candle_count int  -- traçabilité minimale (minimisation données : pas plus)
);
alter table public.prediction_outcomes enable row level security;
create policy "prediction_outcomes: lecture authentifiés"
  on public.prediction_outcomes for select to authenticated using (true);
-- AUCUNE policy write → service_role bypass (frontière producteur-unique)

-- pattern_stats : vue agrégée, lecture PUBLIQUE (anon) — NOUVEAUTÉ projet
-- une ligne par (dimension, valeur, période). Le seuil N≥30 est appliqué côté front (D-12 : n toujours exposé).
create view public.pattern_stats
with (security_invoker = false) as          -- bypass RLS sous-jacente → agrégats publics OK
select 'overall'::text as dimension, 'all'::text as bucket, 'all_time'::text as period,
       count(*)::int as n,
       avg((o.outcome='hit_tp')::int)::numeric as win_rate,
       avg(o.realized_r) as expectancy
from public.prediction_outcomes o
union all
select 'style', ts.style, 'all_time', count(*)::int,
       avg((o.outcome='hit_tp')::int)::numeric, avg(o.realized_r)
from public.prediction_outcomes o join public.trade_setups ts on ts.id = o.setup_id
group by ts.style
-- … répéter par actif/classe, tranche de score, risk_level, + fenêtre 90j (resolved_at > now()-interval '90 days')
;
grant select on public.pattern_stats to anon, authenticated;  -- ⚠️ vérifier get_advisors
```

### Lecture vitrine (RSC anon-client)
```typescript
// apps/web — RSC : lecture publique via createServerSupabaseClient (anon)
const supabase = createServerSupabaseClient(await cookies())
const { data } = await supabase
  .from('pattern_stats')
  .select('dimension, bucket, period, n, win_rate, expectancy')
// Seuil D-09 appliqué EN TS (D-12 : n toujours affiché)
const display = (row) => row.n >= 30
  ? { pct: Math.round(row.win_rate * 100), n: row.n }   // afficher %
  : { insufficient: true, n: row.n }                    // « échantillon insuffisant — N trades »
```

## State of the Art

| Old Approach | Current Approach | When | Impact |
|--------------|------------------|------|--------|
| Toutes tables `to authenticated` | Première vue `to anon` pour agrégats publics | Phase 5 | Nouveau pattern RLS à valider via Supabase `get_advisors`. |
| Slot vitrine masqué (`SHOW_PROOF=false`) | Slot activé, branché sur `pattern_stats` | Phase 5 | `apps/web/.../(marketing)/page.tsx` ligne 18 → true. |

**Deprecated/outdated :** rien de nouveau ; stack figée CLAUDE.md.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Les setups `invalidated` doivent être rejoués comme un outcome (probablement `hit_sl`) et comptés dans le track record. | Pitfall 4 | Si `invalidated` ≠ trade perdant (ex. invalidé pour raison technique avant entrée), les compter fausserait le win rate. **À confirmer fondateur.** |
| A2 | « R moyen » (D-10) = AVG(realized_r) des trades GAGNANTS ; « expectancy » = AVG(realized_r) de TOUS. | Pitfall 5 | Si le fondateur entend autre chose, les 3 chiffres affichés sont mal définis. **À confirmer.** |
| A3 | Un setup expiré sans aucune candle H1 dans sa fenêtre → outcome `flat` R=0 (ou exclu). | Code Examples | Edge rare (gap de données) ; impact mineur mais à trancher (exclure vs flat). |
| A4 | Migration Phase 5 = `0014` (le `0013` est réservé au cluster paiement différé Phase 4). | §Migration / Summary | Collision réelle : si Phase 5 prend 0013, écrase/entre en conflit avec le correctif paiement planifié. **À arbitrer explicitement.** |
| A5 | `pattern_stats` en vue (pas table matérialisée) suffit au volume MVP. | §Schéma DB | Si volume très élevé un jour, latence vitrine ; migration vers table matérialisée = extension future. |
| A6 | `realized_r` du gagnant = distance TP1/risque (R simple), pas pondéré par alloc_pct. | Code Examples | Aligné D-01 (binaire, pas de TP partiels) ; cohérent. Risque faible. |

## Open Questions

1. **Numéro de migration — 0013 vs 0014 (collision réelle).**
   - Connu : fichiers vont jusqu'à `0012`. `04-DEFERRED-resubmission-cluster.md` réserve `0013` (tx_hash nullable, paiements), non encore appliqué.
   - Recommandation : Phase 5 = **0014**, laisser 0013 au correctif paiement. Trancher avec le fondateur avant la migration.

2. **`invalidated` compte-t-il, et comment ? (A1)**
   - Connu : `trade_setups.status` ∈ {active, invalidated, expired}. Un `invalidated` peut signifier SL touché OU invalidation amont.
   - Recommandation : rejouer pleinement comme un `expired` (laisser le replay décider hit_tp/hit_sl/flat) ; ne PAS présumer hit_sl. Confirmer.

3. **Définition exacte « R moyen » vs « expectancy » (A2).**
   - Recommandation : page méthodologie doit figer les deux formules ; aligner le code dessus.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase (Postgres 15+) | table + vue + RLS | ✓ (MCP connecté) | — | — |
| MCP `apply_migration` | migration 0014 | ✓ | — | jamais `db push` |
| Candles H1 en base | replay | ✓ (table `candles`, timeframe H1) | — | si gap → flat A3 |
| Setups expirés en base | replay | ✓ (`trade_setups`, status expired/invalidated) | — | si 0 → empty state vitrine (UI-SPEC) |
| `tsx` / Windows Task Scheduler | exécution job | ✓ (pattern existant) | — | routine Claude |

**Missing dependencies with no fallback :** aucune — tout le socle est en place.

## Validation Architecture

> nyquist_validation = true (config.json) → section incluse.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.8 (ESM natif, golden tests) |
| Config file | racine workspace (Vitest partagée) ; tests jobs sous `apps/jobs/src/jobs/__tests__/` |
| Quick run command | `pnpm vitest run packages/core/src/replay` |
| Full suite command | `pnpm vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TRACK-01 | first-touch hit_tp simple | unit (golden) | `pnpm vitest run packages/core/src/replay/outcome.test.ts` | ❌ Wave 0 |
| TRACK-01 | first-touch hit_sl simple | unit (golden) | idem | ❌ Wave 0 |
| TRACK-01 | cas ambigu D-04 (TP+SL même bougie, règle distance) | unit (golden) | idem | ❌ Wave 0 |
| TRACK-01 | flat D-02 (R au close valid_until, long ET short) | unit (golden) | idem | ❌ Wave 0 |
| TRACK-01 | idempotence (2e run = 0 insert) | integration | `pnpm vitest run apps/jobs/src/jobs/__tests__/outcome-tracker.test.ts` | ❌ Wave 0 |
| TRACK-02 | agrégat win_rate/expectancy par dimension | integration (SQL/vue) | test de la vue (fixtures) | ❌ Wave 0 |
| TRACK-03 | seuil N≥30 → % ; N<30 → « insuffisant » | unit (TS display) | test du helper d'affichage | ❌ Wave 0 |
| TRACK-03 | RLS anon lit pattern_stats, PAS prediction_outcomes | e2e/integration (RLS) | Playwright + `get_advisors` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit :** `pnpm vitest run packages/core/src/replay`
- **Per wave merge :** `pnpm vitest run`
- **Phase gate :** suite complète verte + `get_advisors` (security) sans alerte sur exposition `prediction_outcomes`, avant `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `packages/core/src/replay/outcome.test.ts` — golden tests first-touch (TRACK-01) — couvre les 5 cas (hit_tp, hit_sl, ambigu D-04, flat long, flat short)
- [ ] `apps/jobs/src/jobs/__tests__/outcome-tracker.test.ts` — idempotence + sélection bornée (miroir `subscription-expiry.test.ts` existant)
- [ ] Fixtures candles H1 synthétiques (séquences OHLC contrôlées) pour les golden tests
- [ ] Test RLS : un client `anon` peut SELECT `pattern_stats` mais reçoit 0 ligne / erreur sur `prediction_outcomes`
- [ ] Test du helper d'affichage seuil N≥30 (TRACK-03)

## Security Domain

> security_enforcement absent → enabled. Lecture seule côté front + écriture service_role ; surface réduite mais RLS publique = point sensible.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | non | Vitrine = publique sans compte (par design D-13). |
| V3 Session Management | non | RSC lecture anon. |
| V4 Access Control | **oui (CRITIQUE)** | RLS : `pattern_stats` lisible `anon` (agrégats) MAIS `prediction_outcomes` JAMAIS exposé à `anon`. Frontière producteur-unique : aucune écriture front. |
| V5 Input Validation | partiel | Candles lues = données internes (déjà validées à l'ingestion). Optionnel : Zod sur la forme des candles avant replay. |
| V6 Cryptography | non | Aucune crypto. |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Fuite des résultats par setup à un visiteur public | Information Disclosure | Vue agrégée seule exposée à `anon` ; `prediction_outcomes` reste `to authenticated`. Vérifier avec `get_advisors`. |
| Chiffre inventé / track record gonflé | Tampering / promesse trompeuse | Seul le job service_role écrit ; replay déterministe golden-testé ; seuil N≥30 ; disclaimers LEGAL-01 (D-15). Core Value « jamais inventé ». |
| Écriture front dans prediction_outcomes/pattern_stats | Elevation of Privilege | AUCUNE policy write → service_role bypass uniquement (pattern 0006/0009). |
| Double comptage faussant les stats | Integrity | `UNIQUE(setup_id)` + sélection bornée. |

## Sources

### Primary (HIGH confidence) — repo inspecté
- `supabase/migrations/0003,0006,0009` — schéma candles/trade_setups/RLS authenticated. [VERIFIED: repo]
- `packages/core/src/time/{constants,candle}.ts` — TIMEFRAMES, UTC_ZONE, anti look-ahead. [VERIFIED: repo]
- `packages/core/src/schemas/output.ts` — contrat §3 take_profits `{price, alloc_pct}`. [VERIFIED: repo]
- `apps/jobs/src/jobs/subscription-expiry.ts`, `runJob.ts`, `dispatch.ts` — pattern job idempotent. [VERIFIED: repo]
- `packages/supabase/src/repositories/{candles,tradeSetups,jobRuns,snapshots}.ts`, `anon-client.ts` — repos & client. [VERIFIED: repo]
- `apps/web/src/app/[locale]/(marketing)/page.tsx` — slot `SHOW_PROOF=false` (P2/D-08). [VERIFIED: repo]
- `.planning/phases/04-.../04-DEFERRED-resubmission-cluster.md` — collision migration 0013. [VERIFIED: repo]
- `grep "to anon" supabase/migrations/` = 0 résultat → aucune policy anon préexistante. [VERIFIED: repo]
- `.planning/config.json` — nyquist_validation=true. [VERIFIED: repo]
- `05-CONTEXT.md`, `05-UI-SPEC.md`, `REQUIREMENTS.md §TRACK`. [VERIFIED: repo]

### Secondary (MEDIUM)
- Comportement `security_invoker` des vues Postgres 15 + RLS (PG docs) — appliqué au cas `pattern_stats`/`anon`. [CITED: postgresql.org/docs view security] — à VÉRIFIER en pratique via Supabase `get_advisors`.

## Metadata

**Confidence breakdown :**
- Standard stack : HIGH — aucune nouvelle dépendance, tout dans le repo.
- Architecture (job + replay + vue) : HIGH — miroir direct de patterns existants golden-testés.
- RLS publique `anon` : MEDIUM — terrain neuf pour ce projet, à valider via `get_advisors`.
- Pitfalls : HIGH — ancrés sur le code réel (candle.ts, contrat §3, immuabilité).
- Définitions métriques (R moyen vs expectancy, invalidated) : MEDIUM — assumptions A1/A2 à confirmer.

**Research date :** 2026-06-15
**Valid until :** 2026-07-15 (stack figée ; revérifier si migrations Phase 4 différées appliquées entre-temps — impacte le n° 0013/0014).
