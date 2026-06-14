# Phase 3: Moteur d'analyse déterministe - Pattern Map

**Mapped:** 2026-06-13
**Files analyzed:** 24 new / 2 modified
**Analogs found:** 24 / 24 (every new file has a concrete in-repo analog)

> Snapshot output shapes are LOCKED by `ARCHITECTURE.md` §3 (lines 82-100). Schema conventions LOCKED by §4 (lines 168-181). Planner: copy the analog code below, do not invent new conventions.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/indicators/package.json` | config | — | `packages/core/package.json` | exact |
| `packages/indicators/tsconfig.json` | config | — | `packages/data-sources/tsconfig.json` | exact |
| `packages/indicators/src/index.ts` | barrel | — | `packages/data-sources/src/index.ts` | exact |
| `packages/indicators/src/ohlcv.ts` | utility | transform | `packages/data-sources/src/binance/schema.ts` | role-match |
| `packages/indicators/src/wrappers/rsi.ts` (+macd/ema/atr/bollinger) | utility | transform | `packages/data-sources/src/binance/schema.ts` | role-match |
| `packages/indicators/src/wrappers/*.test.ts` | test | — | `packages/data-sources/src/fred/schema.test.ts` | exact (golden) |
| `packages/indicators/src/structure/swings.ts` | utility | transform | (home-grown — no analog; ohlcv input shape from binance/schema.ts) | no-analog |
| `packages/indicators/src/structure/structure.ts` (BOS/CHoCH) | utility | transform | (home-grown; consumes `packages/core` candle.ts) | no-analog |
| `packages/indicators/src/structure/levels.ts` (S/R) | utility | transform | (home-grown) | no-analog |
| `packages/indicators/src/structure/volume.ts` (POC) | utility | transform | (home-grown) | no-analog |
| `packages/indicators/src/structure/*.test.ts` | test | — | `packages/data-sources/src/fred/schema.test.ts` | exact (golden) |
| `packages/indicators/src/__fixtures__/*.json` | test fixture | — | `packages/data-sources/src/__fixtures__/binance-klines.json` | exact |
| `packages/indicators/src/snapshots/schema.ts` (Zod §3 shapes) | model | transform | `packages/data-sources/src/binance/schema.ts` | role-match |
| `packages/indicators/src/snapshots/hash.ts` (sha256) | utility | transform | (builtin `node:crypto`; canonicalize pattern) | no-analog |
| `supabase/migrations/0005_snapshots.sql` | migration | — | `supabase/migrations/0003_data_ingestion_tables.sql` | exact |
| `packages/supabase/src/repositories/snapshots.ts` | repository | CRUD | `packages/supabase/src/repositories/candles.ts` | exact |
| `packages/supabase/src/repositories/assetDrivers.ts` | repository | CRUD | `packages/supabase/src/repositories/macroSeries.ts` | exact |
| `packages/supabase/src/database.types.ts` (regen + type exports) | model | — | existing CandleRow/Insert exports | exact (modify) |
| `packages/supabase/src/index.ts` (barrel additions) | barrel | — | existing barrel (lines 36-52) | exact (modify) |
| `apps/jobs/src/jobs/technical-engine.ts` | service | event-driven | `apps/jobs/src/jobs/macro-ingest.ts` | exact |
| `apps/jobs/src/jobs/fundamental-engine.ts` | service | event-driven | `apps/jobs/src/jobs/macro-ingest.ts` | exact |
| `apps/jobs/src/jobs/news-engine.ts` | service | event-driven | `apps/jobs/src/jobs/macro-ingest.ts` | exact |
| `apps/jobs/src/dispatch.ts` (register engines) | route | — | existing dispatch (lines 30-36) | exact (modify) |
| `apps/jobs/__tests__/*-engine.test.ts` | test | — | `packages/data-sources/src/fred/schema.test.ts` + `packages/supabase/__tests__/idempotency.test.ts` | exact |
| `packages/supabase/__tests__/snapshots-rls.test.ts` (or idempotency) | test (integration) | — | `packages/supabase/__tests__/idempotency.test.ts` | exact |
| `vitest.config.ts` (add `@app/indicators` alias) | config | — | existing alias block (lines 23-25) | exact (modify) |

---

## Pattern Assignments

### `packages/indicators/package.json` (config)

**Analog:** `packages/core/package.json`

Copy verbatim, change `name` and add the one new dep. Note `exports` MUST expose `./*` for subpath imports (`@app/indicators/structure/...`) and `type:module`.

```jsonc
{
  "name": "@app/indicators",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./*": "./src/*.ts"
  },
  "dependencies": {
    "technicalindicators": "3.1.0",
    "luxon": "3.7.2",
    "zod": "4.4.3"
  },
  "devDependencies": {
    "@types/luxon": "^3.4.2"
  }
}
```
Install command (RESEARCH line 92): `pnpm --filter @app/indicators add technicalindicators@3.1.0`. Consumes `@app/core` (closed-candle) and `@app/supabase` types (CandleRow) — add as workspace deps if cross-imported.

---

### `packages/indicators/tsconfig.json` (config)

**Analog:** `packages/data-sources/tsconfig.json` (copy verbatim — same source-consumed package profile)

```jsonc
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "Preserve",
    "moduleResolution": "Bundler",
    "noEmit": true
  },
  "include": ["src/**/*.ts", "src/**/*.d.ts"],
  "exclude": ["node_modules", "dist"]
}
```
Rationale (load-bearing): package consumed in source by tsx/Vitest — `rootDir`/`composite` would break workspace `@app/*` resolution to sibling sources.

---

### `packages/indicators/src/index.ts` (barrel)

**Analog:** `packages/data-sources/src/index.ts` (lines 1-29)

Convention: **`.js` extension on every relative re-export** even though source is `.ts` (ESM + moduleResolution Bundler), grouped by module with a comment header per group.

```typescript
// Wrappers (TECH-01)
export { rsi } from './wrappers/rsi.js'
export { macd } from './wrappers/macd.js'
// ... ema, atr, bollinger
// Structure maison (TECH-02/03)
export { detectSwings } from './structure/swings.js'
export { detectBosChoch } from './structure/structure.js'
export { clusterLevels } from './structure/levels.js'
export { computePoc } from './structure/volume.js'
// Snapshots (TECH-04)
export { snapshotContentHash } from './snapshots/hash.js'
export { TechnicalSnapshotSchema, FundamentalContextSchema, NewsContextSchema } from './snapshots/schema.js'
```

---

### `packages/indicators/src/wrappers/rsi.ts` (utility, transform)

**Analog:** `packages/data-sources/src/binance/schema.ts` (pure transform fn over arrays, explicit return type, JSDoc with source citation)

**Imports + thin-wrapper pattern** (RESEARCH Pattern 1, lines 181-192):
```typescript
import { RSI } from 'technicalindicators'
// RSI.calculate({ period: 14, values: closes }) → number[] (length = closes.length - period)
```
**Determinism gotcha (HIGH, RESEARCH line 192 + Pitfall 1):** output array is SHORTER than input (warmup offset). Wrapper returns the value aligned to the LAST CLOSED candle (`result.at(-1)`), never index-aligned with the candle array. Golden test pins BOTH value AND output length.

**Module-doc-comment style** to copy from `binance/schema.ts` lines 1-9: file purpose + requirement ID (TECH-01) + source citation (`npmjs.com/package/technicalindicators`).

---

### `packages/indicators/src/wrappers/*.test.ts` and `structure/*.test.ts` (test — GOLDEN)

**Analog:** `packages/data-sources/src/fred/schema.test.ts` (THE golden-value reference — RESEARCH lines 307-315)

**Exact fixture-load pattern to replicate** (lines 8-14):
```typescript
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const rawFixture = require('../__fixtures__/btcusdt-h4.json') as unknown
```
**Assertion style** (lines 47-50): pin exact numbers with `toBeCloseTo(value, decimals)` for floats; `toHaveLength(n)` for output-length determinism. Offline, deterministic, zero network. Each `it()` title states the pinned number.

For structure tests: hand-verified known fixtures (swings/BOS/CHoCH on a small slice) — same load harness, assert exact swing indices / break flags.

---

### `packages/indicators/src/__fixtures__/*.json` (test fixture)

**Analog:** `packages/data-sources/src/__fixtures__/binance-klines.json`

Small offline OHLCV slice derived from real BTC candles already in DB (~30,935 rows). Pin expected indicator/structure outputs in the test, not the fixture.

---

### `packages/indicators/src/snapshots/schema.ts` (model — Zod §3 shapes)

**Analog:** `packages/data-sources/src/binance/schema.ts` (Zod-at-boundary, lines 10-23) — but here Zod validates the OUTPUT snapshot against LOCKED §3 shape before persist (V5 input-validation, RESEARCH Security §415).

**LOCKED shapes to encode field-by-field (ARCHITECTURE.md §3, lines 82-100):**
```typescript
import { z } from 'zod'
// technical_snapshot
const TechnicalSnapshotSchema = z.object({
  trend_htf: z.enum(['bullish', 'bearish', 'range']),
  trend_ltf: z.enum(['bullish', 'bearish', 'range']),
  momentum: z.object({ rsi: z.number(), macd_hist: z.number(), slope: z.number() }),
  volatility: z.object({ atr: z.number(), atr_percentile: z.number() }),
  key_levels: z.array(z.object({
    price: z.number(),
    type: z.enum(['support', 'resistance', 'poc']),
    strength: z.number(),
    // D-35 honesty flag — every poc carries its volume source
    volume_source: z.enum(['real', 'proxy']).optional(),
  })),
  structure: z.object({
    last_swing_high: z.number(),
    last_swing_low: z.number(),
    bos_choch: z.enum(['bos', 'choch']).nullable(),
  }),
  volume_state: z.enum(['expanding', 'contracting']),
})
// fundamental_context: macro_bias risk_on|risk_off|neutral, rate_environment hawkish|dovish|neutral,
//   dxy_trend, real_yields, asset_specific_drivers[]
// news_context: net_sentiment -1..+1, recent_catalysts[], upcoming_events[] (+ news_risk flag, D-40)
```
Use `z.infer<typeof ...>` for the TS type (typescript/coding-style rule). Zod v4 (`z.enum`, `z.iso.datetime` for ts fields).

---

### `packages/indicators/src/snapshots/hash.ts` (utility — D-41 content hash)

**Analog:** none (builtin) — RESEARCH Pattern 6 (lines 231-237) + Pitfall 3 (lines 278-281)

```typescript
import { createHash } from 'node:crypto'
// canonicalJson: sort keys + FIXED decimal rounding (else float noise → non-deterministic hash)
const hash = createHash('sha256').update(canonicalJson(payload)).digest('hex')
```
This hash = `raw_indicators_ref` (ARCHITECTURE line 161). Golden-test the hash on a fixed fixture. Anti-pattern (RESEARCH line 249): never hash raw floats.

---

### `supabase/migrations/0005_snapshots.sql` (migration)

**Analog:** `supabase/migrations/0003_data_ingestion_tables.sql` (THE migration reference — lines 70-103 candles table, lines 192-268 view for asset_drivers seed style)

**Mandatory conventions to copy (§4 line 168 + 0003 header lines 1-6):**
- snake_case, PK `id uuid primary key default gen_random_uuid()`, timestamptz UTC.
- `alter table ... enable row level security;`
- ONE select policy `to authenticated using (true)` — **NO insert/update/delete policy** → write = service_role bypass (D-05). Copy exact policy text style from 0003 lines 89-93.
- **Unique index = upsert key** (DATA-06), named `<table>_uniq` because repositories reference it by name (comment lines 97-99).
- Read index `(... ts desc)` for latest-lookup (lines 102-103).

**`snapshots` table (D-41, idempotency candidate RESEARCH line 349):**
```sql
create table public.snapshots (
  id                uuid        primary key default gen_random_uuid(),
  instrument_id     uuid        not null references public.instruments(id) on delete cascade,
  style             text        not null check (style in ('day','swing')),
  timeframe_set     text        not null,            -- e.g. 'H4/H1' (D-36)
  kind              text        not null check (kind in ('technical','fundamental','news')),
  computed_for_ts   timestamptz not null,            -- last closed LTF candle
  content_hash      text        not null,            -- = raw_indicators_ref (D-41)
  payload           jsonb       not null,            -- §3 shape, Zod-validated before insert
  partial           boolean     not null default false,  -- EMA200 gap handling (RESEARCH Pitfall 2)
  created_at        timestamptz not null default now()
);
alter table public.snapshots enable row level security;
create policy "snapshots: lecture authentifiés" on public.snapshots
  for select to authenticated using (true);
create unique index snapshots_uniq
  on public.snapshots (instrument_id, style, kind, computed_for_ts);
create index snapshots_read_idx
  on public.snapshots (instrument_id, style, kind, computed_for_ts desc);
```

**`asset_drivers` table (D-38, data-not-code, seed in migration like instruments lines 38-67):**
```sql
create table public.asset_drivers (
  id            uuid primary key default gen_random_uuid(),
  instrument_id uuid not null references public.instruments(id) on delete cascade,
  driver_code   text not null,        -- 'DXY','REAL_YIELDS','RATE_DIFF','RISK_SENTIMENT'
  direction     int  not null,        -- +1 / -1
  weight        numeric not null default 1
);
alter table public.asset_drivers enable row level security;
create policy "asset_drivers: lecture authentifiés" on public.asset_drivers
  for select to authenticated using (true);
create unique index asset_drivers_uniq on public.asset_drivers (instrument_id, driver_code);
-- seed: insert ... on conflict (instrument_id, driver_code) do update set ...  (copy 0003 lines 56-67 style)
```
After migration: regenerate `database.types.ts` (`supabase gen types typescript --linked`), then add `SnapshotRow/Insert`, `AssetDriverRow/Insert` type exports (pattern = database.types.ts lines 436-437).

---

### `packages/supabase/src/repositories/snapshots.ts` (repository, CRUD)

**Analog:** `packages/supabase/src/repositories/candles.ts` (exact — upsert + latest-lookup)

**Copy the upsert pattern verbatim** (candles.ts lines 20-30), change table + onConflict to match `snapshots_uniq`:
```typescript
import type { SupabaseClient } from '@supabase/supabase-js'
import type { SnapshotInsert, Database } from '../database.types'
type ServiceClient = SupabaseClient<Database>

export async function upsertSnapshot(client: ServiceClient, row: SnapshotInsert): Promise<void> {
  const { error } = await client
    .from('snapshots')
    .upsert([row], { onConflict: 'instrument_id,style,kind,computed_for_ts', ignoreDuplicates: false })
  if (error) throw new Error(`upsertSnapshot failed: ${error.message}`)
}
```
**Add `getSnapshotByHash`** (Phase 4 references by hash — D-41) using the `getLastCandleTs` select+maybeSingle pattern (candles.ts lines 36-55):
```typescript
export async function getSnapshotByHash(client: ServiceClient, hash: string) {
  const { data, error } = await client.from('snapshots')
    .select('*').eq('content_hash', hash).maybeSingle()
  if (error) throw new Error(`getSnapshotByHash failed: ${error.message}`)
  return data ?? null
}
```
Header comment (candles.ts lines 1-9): document idempotency key + "JAMAIS importé depuis apps/web". Early-return on empty if batch variant added.

---

### `packages/supabase/src/repositories/assetDrivers.ts` (repository, CRUD)

**Analog:** `packages/supabase/src/repositories/macroSeries.ts` (simplest upsert repo, lines 20-33) + read accessor.

Mostly READ in P3 (engine consumes drivers). Provide `getAssetDrivers(client, instrumentId)` (select + eq), upsert optional for seed maintenance. Same `ServiceClient` type alias, same error-wrap.

---

### `packages/supabase/src/index.ts` (barrel — MODIFY)

**Analog:** existing barrel (lines 18-52)

Add to the `export type {...}` block: `SnapshotRow, SnapshotInsert, AssetDriverRow, AssetDriverInsert`. Add repository exports following lines 49-52:
```typescript
export { upsertSnapshot, getSnapshotByHash } from './repositories/snapshots'
export { getAssetDrivers } from './repositories/assetDrivers'
```
Do NOT export `service-client` (D-07, header lines 6-9).

---

### `apps/jobs/src/jobs/technical-engine.ts` (+ fundamental / news) (service, event-driven)

**Analog:** `apps/jobs/src/jobs/macro-ingest.ts` (exact — RESEARCH Pattern 7, lines 239-241)

**Copy structure verbatim:**
1. Header doc-comment with decision IDs + requirement IDs (macro-ingest lines 1-12).
2. `'dotenv/config'` import first (line 13).
3. **Lazy `getServiceClient()`** (lines 24-35) — created at execution, not import, so dotenv loads first. Validates `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`.
4. Exported job fn `(): Promise<Json>` with a `stats = { inserted, skipped, errors: [] }` accumulator (lines 43-48).
5. **Per-instrument try/catch isolation** (lines 52-71) — one instrument failing (e.g. empty OANDA candles, RESEARCH Pitfall 5) does NOT abort others; push `{ instrument, msg: normalized }` to stats.errors (T-02-13: normalized message only, never key values).
6. **WR-04 total-failure throw** (lines 73-78): if 0 produced and errors exist → throw, no silent success.

**Engine-specific body (between client and stats return):**
- technical-engine: read `candles` per instrument×TF → `@app/indicators` wrappers + structure → assemble `technical_snapshot` (§3) → Zod-validate → `snapshotContentHash` → `upsertSnapshot`. Consume `@app/core` `lastClosedCandleStart` (never recompute time — RESEARCH Pitfall 6 + anti-pattern line 245).
- fundamental-engine: read `macro_series` + `getAssetDrivers` → deterministic FRED rules (D-38) → `fundamental_context`.
- news-engine: read `news` (window+decay D-39) + `economic_calendar` (news_risk D-40) → `news_context`.

Imports follow macro-ingest lines 14-17: `upsertSnapshot` from `@app/supabase`, `type { Json, Database }`, engine fns from `@app/indicators`.

---

### `apps/jobs/src/dispatch.ts` (route — MODIFY)

**Analog:** existing dispatch (lines 16-36)

Import the three engines, add to `JOB_REGISTRY` (lines 30-36) with kebab-case keys:
```typescript
import { technicalEngine } from './jobs/technical-engine'
// ...
const JOB_REGISTRY = {
  // existing...
  'technical-engine': technicalEngine,
  'fundamental-engine': fundamentalEngine,
  'news-engine': newsEngine,
}
```
`runJob` wrapping is automatic (line 55). No other change.

---

### `apps/jobs/__tests__/*-engine.test.ts` (test)

**Analog:** `packages/data-sources/src/fred/schema.test.ts` (golden, for the pure engine math) + `packages/supabase/__tests__/idempotency.test.ts` (integration, for DB upsert)

Snapshot-shape + deterministic-hash tests run pure engine functions over fixtures (offline). Path: `apps/jobs/__tests__/` (vitest include glob line 30). For DB-touching idempotency, copy idempotency.test.ts env-loading harness (lines 22-33: `process.loadEnvFile(apps/jobs/.env)`) and the upsert-x2-count-unchanged + WR-06 cleanup pattern (lines 106-166).

---

### `vitest.config.ts` (config — MODIFY)

**Analog:** existing alias block (lines 23-25)

Add one line so `@app/indicators` resolves to source:
```typescript
'@app/indicators': path.resolve(__dirname, 'packages/indicators/src/index.ts'),
```
`include` glob (line 30) already covers `packages/indicators/**/*.test.ts` and `apps/jobs/__tests__/**` — no change needed there.

---

## Shared Patterns

### Source-consumed package profile
**Source:** `packages/data-sources/{package.json,tsconfig.json}` + `vitest.config.ts` alias
**Apply to:** `packages/indicators`
- `type:module`, `exports {".":"./src/index.ts","./*":"./src/*.ts"}`, `module:Preserve` + `moduleResolution:Bundler` + `noEmit:true`, relative re-exports with `.js` extension, workspace alias in `vitest.config.ts`.

### Golden-value test harness
**Source:** `packages/data-sources/src/fred/schema.test.ts` (lines 8-14, 47-50)
**Apply to:** every wrapper, every structure file, every engine pure-fn
- `createRequire(import.meta.url)` → load `../__fixtures__/*.json` as `unknown`, pin exact numbers (`toBeCloseTo`) + output lengths (`toHaveLength`), offline, deterministic.

### Idempotent upsert repository
**Source:** `packages/supabase/src/repositories/candles.ts` (lines 11-30)
**Apply to:** `snapshots.ts`, `assetDrivers.ts`
- `ServiceClient = SupabaseClient<Database>` alias, `.upsert(rows, { onConflict: '<uniq cols>', ignoreDuplicates: false })`, throw on `error`, header documents the `<table>_uniq` index + "JAMAIS importé depuis apps/web".

### Migration: RLS + unique-index + seed
**Source:** `supabase/migrations/0003_data_ingestion_tables.sql` (lines 70-103, 38-67)
**Apply to:** `0005_snapshots.sql`
- `enable row level security` + single `to authenticated using(true)` select policy, NO write policy (service_role bypass, D-05), `<table>_uniq` unique index = upsert key, `_read_idx (... desc)`, seed via `insert ... on conflict do update`.

### Engine job harness
**Source:** `apps/jobs/src/jobs/macro-ingest.ts` (lines 13-81) + `apps/jobs/src/dispatch.ts` (lines 30-55) + `apps/jobs/src/runJob.ts`
**Apply to:** technical/fundamental/news engines
- `dotenv/config`, lazy `getServiceClient()`, `(): Promise<Json>` with stats accumulator, per-item try/catch isolation, normalized error messages only (T-02-13), WR-04 total-failure throw, register kebab-case in `JOB_REGISTRY`. `runJob` writes `job_runs` automatically.

### Closed-candle consumption (never redefine)
**Source:** `packages/core/src/index.ts` + `packages/core/src/time/candle.ts` (`lastClosedCandleStart`)
**Apply to:** technical-engine, structure module
- Import `lastClosedCandleStart`, `TIMEFRAMES`, `UTC_ZONE` from `@app/core`. Never recompute time/closed-candle logic (D-10, RESEARCH Pitfall 6 + anti-pattern line 245). Exclude in-progress candle always.

### Zod boundary validation
**Source:** `packages/data-sources/src/binance/schema.ts` (lines 10-23, Zod v4)
**Apply to:** `snapshots/schema.ts`
- Validate the assembled snapshot against the LOCKED §3 shape BEFORE persist; derive TS type via `z.infer`. Zod v4 enums for the locked literal unions.

---

## No Analog Found (home-grown — use RESEARCH patterns)

Market structure has NO in-repo or library analog by design (CLAUDE.md "What NOT to Use"; RESEARCH line 262). Planner uses RESEARCH algorithm patterns, golden-tested:

| File | Role | Data Flow | RESEARCH Pattern | Reason |
|------|------|-----------|------------------|--------|
| `structure/swings.ts` | utility | transform | Pattern 2 (lines 194-203): fractal pivot window 2N+1 + ATR filter k×ATR; N,k = named const pinned by golden test | `technicalindicators` has no structure |
| `structure/structure.ts` | utility | transform | Pattern 3 (lines 205-211): BOS/CHoCH on BODY CLOSE (D-33), wick does not confirm | home-grown vétéran differentiator |
| `structure/levels.ts` | utility | transform | Pattern 4 (lines 213-220): swing clustering within c×ATR, strength = w(touches,age,recency) | home-grown |
| `structure/volume.ts` | utility | transform | Pattern 5 (lines 222-229): proportional-overlap POC + `source: real\|proxy` flag (D-35) | no maintained OHLCV volume-profile lib |
| `snapshots/hash.ts` | utility | transform | Pattern 6 (lines 231-237): sha256 over canonical JSON, fixed precision | builtin `node:crypto`, no analog |

Input shape for structure fns: OHLCV arrays mapped from `CandleRow[]` (RESEARCH lines 299-305) — that mapping (`rows.map(r => r.close)`, `r.volume ?? 0`) lives in `ohlcv.ts`, analog `binance/schema.ts` array-transform style.

## Metadata

**Analog search scope:** `packages/{core,supabase,data-sources}`, `apps/jobs`, `supabase/migrations`, `vitest.config.ts`, `ARCHITECTURE.md §2/§3/§4`
**Files scanned:** ~30 (full read: 14 analogs + ARCHITECTURE §3/§4)
**Pattern extraction date:** 2026-06-13
