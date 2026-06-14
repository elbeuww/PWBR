# Phase 4 : Moteur IA "vétéran" & scoring - Pattern Map

**Mapped:** 2026-06-13
**Files analyzed:** 12 (nouveaux/modifiés)
**Analogs found:** 11 / 12 (1 sans analog exact — prompt markdown)

> Tous les analogs ci-dessous ont été lus dans le code réel et ancrés à des `file:line` vérifiés.
> Aucune nouvelle dépendance npm — extension disciplinée des patrons P3.

## File Classification

| Nouveau/Modifié | Rôle | Data Flow | Closest Analog | Match Quality |
|------------------|------|-----------|----------------|---------------|
| `apps/jobs/src/jobs/persist.ts` | job (frontier) | file-I/O → transform → CRUD | `apps/jobs/src/jobs/technical-engine.ts` | exact (job engine pattern) |
| `packages/core/src/scoring/score.ts` | service (pure) | transform | `packages/indicators/src/snapshots/schema.ts` + logique pure `technical-engine.ts:100-158` | role-match (pure fn) |
| `packages/core/src/scoring/weights.ts` | config (constantes) | — | `packages/core/src/time/sessions.ts:17-22` (`DAILY_ANCHOR as const`) | exact (data-not-magic) |
| `packages/core/src/scoring/rr.ts` | service (pure) | transform | logique pure `technical-engine.ts:63-92` | role-match |
| `packages/core/src/scoring/risk.ts` | service (pure) | transform | `technical-engine.ts:75-81` (`atrPercentile`) | role-match |
| `packages/core/src/scoring/confidence.ts` | service (pure) | transform | idem scoring purs | role-match |
| `packages/core/src/scoring/index.ts` | barrel | — | `packages/core/src/index.ts` | exact |
| `packages/core/__tests__/scoring/*.test.ts` | test (golden) | — | `packages/indicators/src/snapshots/snapshots.test.ts` | exact |
| `packages/core/src/schemas/output.ts` (OU `packages/supabase`) | model (Zod) | — | `packages/indicators/src/snapshots/schema.ts` | exact |
| `packages/supabase/src/repositories/analyses.ts` | repository | CRUD | `packages/supabase/src/repositories/snapshots.ts` | exact |
| `packages/supabase/src/repositories/tradeSetups.ts` | repository | CRUD | `packages/supabase/src/repositories/snapshots.ts` | exact |
| `supabase/migrations/0006_analyses_trade_setups.sql` | migration | DDL | `supabase/migrations/0005_snapshots.sql` | exact |
| `apps/jobs/config/sessions.ts` | config | — | `packages/core/src/time/sessions.ts` (`as const` config) | role-match |
| `apps/jobs/prompts/veteran.md` | prompt (runbook) | — | — | **no analog** (markdown, pas de code) |
| `apps/jobs/src/dispatch.ts` (modifié) | route (registry) | — | `apps/jobs/src/dispatch.ts:33-42` (self) | exact (ajout 1 entrée) |
| `packages/supabase/src/index.ts` (modifié) | barrel | — | `packages/supabase/src/index.ts:50-61` (self) | exact (ajout exports) |

---

## Pattern Assignments

### `apps/jobs/src/jobs/persist.ts` (job, file-I/O → transform → CRUD)

**Analog principal :** `apps/jobs/src/jobs/technical-engine.ts` (vérifié, 284 lignes)
**Wrapper d'exécution :** `apps/jobs/src/runJob.ts` (le job est appelé via `runJob`, pas standalone)

C'est le patron exact à reproduire : fonction `async (): Promise<Json>`, boucle isolée par item, `.parse` Zod avant upsert, stats normalisées, throw si 0 produit + erreurs.

**Header docstring + imports** (`technical-engine.ts:19-40`) — conventions à copier :
```typescript
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { DateTime } from 'luxon'
import { /* schémas + types */ } from '@app/indicators'
import { upsertSnapshot, listActiveInstruments } from '@app/supabase'
import type { Json, Database, /* Row/Insert types */ } from '@app/supabase'
import { lastClosedCandleStart, TIMEFRAMES } from '@app/core'
```
Pour P4 : importer `OutputSchema` + `scoreSetup` depuis `@app/core`, `getSnapshotByHash, insertAnalysis, insertTradeSetups, expirePriorSetups` depuis `@app/supabase`.

**Client service_role lazy** (`technical-engine.ts:162-175`) — copier tel quel :
```typescript
type ServiceClient = ReturnType<typeof createClient<Database>>
function getServiceClient(): ServiceClient {
  const url = process.env['SUPABASE_URL']
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!url || !key) {
    throw new Error(
      'persist: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in apps/jobs/.env',
    )
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
```
> Note : `technical-engine.ts` redéfinit son propre `getServiceClient` (pas importé depuis `runJob.ts`) — chaque job le redéfinit localement. Suivre ce patron pour `persist.ts`.

**Boucle isolée par item + stats + Zod.parse avant écriture** (`technical-engine.ts:214-273`) — squelette structurel :
```typescript
export async function technicalEngine(): Promise<Json> {
  const stats = {
    inserted: 0,
    skipped: 0,
    errors: [] as Array<{ instrument: string; msg: string }>,
  }
  const client = getServiceClient()
  const instruments = await listActiveInstruments(client)

  for (const instrument of instruments) {
    try {
      // ...
      const validated = TechnicalSnapshotSchema.parse(snapshot)   // T-03-10 : Zod AVANT upsert
      // ...
      await upsertSnapshot(client, row)
      stats.inserted++
    } catch (err) {
      // T-02-13 : message normalisé uniquement, jamais la valeur de clé
      stats.errors.push({
        instrument: instrument.symbol,
        msg: err instanceof Error ? err.message : String(err),
      })
    }
  }
  // WR-04 : 0 produit total + erreurs → throw, pas de succès silencieux
  if (stats.inserted === 0 && stats.errors.length > 0) {
    throw new Error(`...0 produit sur ${stats.errors.length} erreur(s)...`)
  }
  return stats as Json
}
```
**Pour persist.ts :** la boucle itère sur `readRunArtifacts(runId)` (fichiers JSON) au lieu d'instruments ; `stats = { written, rejected, reasons: string[] }` (D-43) ; `try/catch` par fichier (Pitfall 6) ; throw si `written===0 && rejected>0`. Les étapes (a)→(g) du diagramme RESEARCH s'insèrent dans le `try`.

**Garde-fous (étape d) :** logique pure réutilisable, placée dans `packages/core/scoring/rr.ts` (recompute R:R bord conservateur D-50), appelée par persist.ts. Le pattern "logique pure séparée de l'IO" est explicite dans `technical-engine.ts:60` (commentaire D-23, `buildTechnicalSnapshot` pur testé hors-ligne).

---

### `packages/core/src/scoring/*.ts` (service pur, transform)

**Analog conventions Zod/types :** `packages/indicators/src/snapshots/schema.ts` (vérifié, 64 lignes)
**Analog logique pure déterministe :** `apps/jobs/src/jobs/technical-engine.ts:60-158` (section "Logique pure (D-23, testable hors-ligne)")
**Analog config `as const` (weights.ts) :** `packages/core/src/time/sessions.ts:17-22`

**Patron déterminisme (anti-float, anti-Date.now) — `technical-engine.ts:136-153`** — arrondis à précision fixe partout :
```typescript
rsi: Math.round(rsiVal * 100) / 100,
macd_hist: Math.round(macdVal.histogram * 1e6) / 1e6,
slope: Math.round((macdVal.macd - macdVal.signal) * 1e6) / 1e6,
```
Et `packages/indicators/src/snapshots/hash.ts:13` : `export const HASH_DECIMALS = 6` + `Number(value.toFixed(HASH_DECIMALS))`. **Le scoring DOIT arrondir ses sorties** (golden tests stables, Pitfall 5). Injecter `now`/`generated_at` — jamais `Date.now()` dans le scoring.

**Patron percentile (réutilisable pour risk.ts ATR distance)** — `technical-engine.ts:75-81` :
```typescript
function atrPercentile(rows: readonly CandleRow[]): number {
  const series = atrSeries(rows)
  const last = series.at(-1)
  if (last === undefined || series.length === 0) return 0
  const below = series.filter((v) => v <= last).length
  return Math.round((below / series.length) * 1000) / 1000
}
```

**Patron constantes nommées `as const` (weights.ts)** — `packages/core/src/time/sessions.ts:17-22` :
```typescript
export const DAILY_ANCHOR = {
  oanda: { zone: 'America/New_York', hour: 17 },
  binance: { zone: 'UTC', hour: 0 },
} as const
export type DataSource = keyof typeof DAILY_ANCHOR
```
→ `WEIGHTS = { day: {...}, swing: {...} } as const` (barème §3, data-not-magic-numbers).

**Barrel** — `packages/core/src/index.ts` (vérifié) utilise des imports `./...js` explicites :
```typescript
export { lastClosedCandleStart } from './time/candle.js'
export { DAILY_ANCHOR, dailyAnchorStart } from './time/sessions.js'
export type { DataSource } from './time/sessions.js'
```
→ ajouter `export { scoreSetup } from './scoring/index.js'` (extension ESM `.js` obligatoire).

---

### `packages/core/__tests__/scoring/*.test.ts` (test golden)

**Analog :** `packages/indicators/src/snapshots/snapshots.test.ts` (vérifié, golden values §3)

**Structure golden à copier** (`snapshots.test.ts:9-49`) :
```typescript
import { describe, it, expect } from 'vitest'
import { TechnicalSnapshotSchema, /* ... */ } from './schema.js'

const validTechnical = { /* fixture figée */ }

describe('TechnicalSnapshotSchema — §3 LOCKED', () => {
  it('parse un payload conforme', () => {
    expect(() => TechnicalSnapshotSchema.parse(validTechnical)).not.toThrow()
  })
  it('rejette un enum trend hors §3', () => {
    const bad = { ...validTechnical, trend_htf: 'sideways' }
    expect(() => TechnicalSnapshotSchema.parse(bad)).toThrow()
  })
})
```
**Pour scoring :** fixtures figées `snapshot + output → { opportunity_score, risk_level, confidence, rr }` attendus ; tester `scoreSetup` (golden), `rr.ts` bord conservateur long ET short (D-50), cap 45 (règle dure), R:R<1.2 rejet. Imports `.js` extension. Même pattern `valid… / bad = { ...valid, champ: mauvais }`.

---

### `packages/core/src/schemas/output.ts` — `OutputSchema` Zod §3 (model)

**Analog :** `packages/indicators/src/snapshots/schema.ts` (vérifié)
> Open Question RESEARCH #2 : `packages/core` (recommandé) vs `packages/supabase`. À trancher au plan.

**Conventions Zod v4 à copier** (`schema.ts:9-64`) :
```typescript
import { z } from 'zod'

export const KeyLevelSchema = z.object({
  price: z.number(),
  type: z.enum(['support', 'resistance', 'poc']),
  strength: z.number(),
  volume_source: z.enum(['real', 'proxy']).optional(),
})
// ... bornes : z.number().min(-1).max(1) (NewsContextSchema:54)
export type TechnicalSnapshot = z.infer<typeof TechnicalSnapshotSchema>   // type via z.infer
```
**Pour OutputSchema (cf. RESEARCH Code Examples lignes 318-342) :** `z.iso.datetime()` (Zod v4), `z.array(...).min(1).max(3)` pour `take_profits`, `z.tuple([z.number(), z.number()])` pour `entry.zone`, `type Output = z.infer<typeof OutputSchema>`. **A1 (RESEARCH) :** exclure `opportunity_score`/`risk_level`/`confidence` du schéma (code seul les produit, D-42/46/48).

---

### `packages/supabase/src/repositories/analyses.ts` + `tradeSetups.ts` (repository, CRUD)

**Analog :** `packages/supabase/src/repositories/snapshots.ts` (vérifié, 56 lignes)

**Patron repository service_role complet** (`snapshots.ts:14-56`) :
```typescript
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, SnapshotInsert, SnapshotRow } from '../database.types'

type ServiceClient = SupabaseClient<Database>

export async function upsertSnapshot(client: ServiceClient, row: SnapshotInsert): Promise<void> {
  const { error } = await client
    .from('snapshots')
    .upsert([row], { onConflict: '...', ignoreDuplicates: false })
  if (error) throw new Error(`upsertSnapshot failed: ${error.message}`)
}

export async function getSnapshotByHash(
  client: ServiceClient, hash: string,
): Promise<SnapshotRow | null> {
  const { data, error } = await client
    .from('snapshots').select('*').eq('content_hash', hash).maybeSingle()
  if (error) throw new Error(`getSnapshotByHash failed: ${error.message}`)
  return data ?? null
}
```
**Pour analyses.ts :** `insertAnalysis(client, row): Promise<{ id: string }>` (retourne l'id pour lier trade_setups — utiliser `.insert([row]).select('id').single()`). Conventions à copier : `type ServiceClient = SupabaseClient<Database>`, `if (error) throw new Error(\`x failed: ${error.message}\`)`, types `AnalysisInsert`/`AnalysisRow` depuis `../database.types`, docstring "JAMAIS importé depuis apps/web".

**Pour tradeSetups.ts :** `insertTradeSetups(client, rows)` + `expirePriorSetups(client, key)` (D-45 : UPDATE `status='expired'` sur la clé `(instrument, style, session, jour)` active — seul `status` transitionne, pas de mutation des champs de prédiction, SCORE-05).

**Barrel à modifier** — `packages/supabase/src/index.ts:58-61` (la zone "Phase 3" montre exactement où ajouter) :
```typescript
// Phase 3 — moteur déterministe repositories
export { upsertSnapshot, getSnapshotByHash } from './repositories/snapshots'
export { getAssetDrivers } from './repositories/assetDrivers'
// + Phase 4 : export { insertAnalysis } from './repositories/analyses'
//             export { insertTradeSetups, expirePriorSetups } from './repositories/tradeSetups'
```
Ajouter aussi les types `AnalysisRow/Insert`, `TradeSetupRow/Insert` au bloc `export type` (lignes 18-47). **D-07 :** ne JAMAIS exporter de service-client ici.

---

### `supabase/migrations/0006_analyses_trade_setups.sql` (migration, DDL)

**Analog :** `supabase/migrations/0005_snapshots.sql` (vérifié, 113 lignes)
**Application :** via MCP `apply_migration` (D-17), PAS `supabase db push`. Prochaine = `0006_*`.

**Patron RLS select-only / service_role write — AUCUNE write policy** (`0005_snapshots.sql:31-39`) — copier exactement :
```sql
alter table public.snapshots enable row level security;

create policy "snapshots: lecture authentifiés"
  on public.snapshots
  for select
  to authenticated
  using (true);

-- AUCUNE policy insert/update/delete → écriture service_role bypass (T-03-01, D-05)
```
→ reproduire pour `analyses` ET `trade_setups` (D-05, RESEARCH V4 ASVS).

**Patron table + FK cascade + check enums** (`0005_snapshots.sql:18-29`) :
```sql
create table public.snapshots (
  id              uuid        primary key default gen_random_uuid(),
  instrument_id   uuid        not null references public.instruments(id) on delete cascade,
  style           text        not null check (style in ('day','swing')),
  ...
  created_at      timestamptz not null default now()
);
```

**Patron index nommé** (`0005_snapshots.sql:42-47`) — noms référencés par les repos :
```sql
create unique index snapshots_uniq on public.snapshots (instrument_id, style, kind, computed_for_ts);
create index snapshots_read_idx on public.snapshots (instrument_id, style, kind, computed_for_ts desc);
```
**DDL exact §4 :** voir RESEARCH lignes 358-398 (colonnes `analyses` : run_id, session, style, instrument_id, snapshot jsonb, model, prompt_version, schema_version ; `trade_setups` : analysis_id, direction, opportunity_score int, risk_level, confidence, entry_price, stop_loss, take_profits jsonb, risk_reward, payload jsonb, status, valid_until ; index `(opportunity_score desc, created_at desc)` §4). **A2 (RESEARCH) :** dénormaliser `style`/`session` sur `trade_setups` pour l'index d'expiry D-45 — à trancher au plan.

---

### `apps/jobs/config/sessions.ts` (config)

**Analog :** `packages/core/src/time/sessions.ts:17-24` (objet `as const` + `keyof typeof`)

```typescript
export const SESSIONS = {
  asia:    { asset_classes: ['forex','metal','crypto'], styles: ['day'] },
  london:  { asset_classes: ['forex','metal','energy','crypto'], styles: ['day','swing'] },
  newyork: { asset_classes: ['forex','metal','energy','crypto'], styles: ['day'] },
  'eod-swing': { asset_classes: ['forex','metal','energy','crypto'], styles: ['swing'] },
} as const
```
Univers = `SESSIONS[session]` ∩ `listActiveInstruments(client)` filtré par `asset_class` (D-49 ; `listActiveInstruments` existe déjà, importé dans `technical-engine.ts:38`). Crypto dans chaque session.

---

### `apps/jobs/src/dispatch.ts` (modification — registry)

**Analog :** lui-même, `dispatch.ts:18-42`. Ajouter import + 1 entrée au `JOB_REGISTRY` :
```typescript
import { persist } from './jobs/persist'
// ...
const JOB_REGISTRY: Record<string, () => Promise<Json | undefined>> = {
  // ... jobs existants
  persist,
}
```
Le run de session (boucle instrument×style côté agent) n'est PAS un job dispatch — c'est l'agent. `persist` est le seul nouveau job dispatch (lit les artefacts, valide, persiste).

---

### `apps/jobs/prompts/veteran.md` (prompt runbook) — **NO CODE ANALOG**

Markdown versionné, pas de patron code dans le repo. Suivre RESEARCH "Veteran prompt — techniques de robustesse" (lignes 345-355) : rôle 50 ans, schéma-EN-prompt (JSON, pas prose) + 1 exemple complet XAU_USD §3, discipline "un fichier `<instrument>_<style>.json`, JSON pur, pas de fence", bornes "1–3 TP, NE calcule PAS score/R:R". Front-matter `version: 1.0.0` ; `prompt_version` = `node:crypto` sha256 du fichier (patron `hash.ts:10` `createHash('sha256')`, D-51).

---

## Shared Patterns

### Frontière de confiance : Zod `.parse` AVANT toute écriture
**Source :** `apps/jobs/src/jobs/technical-engine.ts:244-245` (`TechnicalSnapshotSchema.parse(snapshot)` avant `upsertSnapshot`)
**Apply to :** `persist.ts` (parse `OutputSchema` avant tout upsert ; T-03-08/10/14, SCORE-04, V5 ASVS).

### Stats normalisées — jamais de valeur de clé dans les logs
**Source :** `apps/jobs/src/jobs/technical-engine.ts:267-272` (`msg: err instanceof Error ? err.message : String(err)`)
**Apply to :** `persist.ts` `stats.reasons` (messages normalisés : `zod_shape`, `rr_below_min`, `sl_coherence`, `snapshot_not_found`, `json_parse` ; T-02-13, V7 ASVS, Pitfall 4).

### Wrapper d'exécution `runJob` + `job_runs`
**Source :** `apps/jobs/src/runJob.ts:50-70` (insère `job_runs` running → exécute fn → success/error + stats, re-throw)
**Apply to :** `persist` (et le run de session) appelés via `runJob` ; pas de monitoring maison (JOB-04). Le `runId` côté `startRun` corrèle `job_runs.id` (cf. RESEARCH Open Question #1 format `run_id`).

### Client service_role lazy depuis env (jamais MCP, jamais barrel)
**Source :** `apps/jobs/src/jobs/technical-engine.ts:164-175` + `runJob.ts:30-41` (chacun redéfinit localement `getServiceClient`)
**Apply to :** `persist.ts`. D-07 : service-client jamais importé du barrel `@app/supabase` ; SDK direct, pas MCP (D-43 : l'agent n'insère jamais).

### Déterminisme golden : arrondi à précision fixe, `now` injecté
**Source :** `packages/indicators/src/snapshots/hash.ts:13,23` (`HASH_DECIMALS = 6`, `toFixed`) + `technical-engine.ts:136-153`
**Apply to :** tout `packages/core/scoring/*` (score/rr/risk/confidence) — sorties arrondies, pas de `Date.now()`/`Math.random()`, `now`/`generated_at` injectés (Pitfall 5).

### Immuabilité par expiry à l'insert (pas de mutation de prédiction)
**Source :** patron repository `snapshots.ts:24-35` (écriture service_role) ; nouveau comportement `expirePriorSetups`
**Apply to :** `tradeSetups.ts` + `persist.ts` (D-45 : marquer antérieurs `expired` avant insert ; seul `status` transitionne, SCORE-05).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `apps/jobs/prompts/veteran.md` | prompt (runbook) | — | Markdown prompt, pas de patron code dans le repo. Suivre RESEARCH §"Veteran prompt" + format JSON §3. Premier artefact de ce type. |

---

## Metadata

**Analog search scope:** `apps/jobs/src/{jobs,}/`, `packages/supabase/src/{repositories,}/`, `packages/core/src/`, `packages/indicators/src/snapshots/`, `supabase/migrations/`
**Files scanned (read in full or targeted):** technical-engine.ts, snapshots.ts (repo), 0005_snapshots.sql, schema.ts, hash.ts, runJob.ts, dispatch.ts, supabase/index.ts, core/index.ts, sessions.ts, snapshots.test.ts
**Pattern extraction date:** 2026-06-13
```