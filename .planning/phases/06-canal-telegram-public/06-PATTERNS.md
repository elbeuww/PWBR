# Phase 6: Canal Telegram public - Pattern Map

**Mapped:** 2026-06-17
**Files analyzed:** 8 new/modified files
**Analogs found:** 7 / 8 (1 with no analog: bilingual format module)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/jobs/src/jobs/telegram-publish.ts` (NEW) | job | batch / event-driven (pub) | `apps/jobs/src/jobs/outcome-tracker.ts` | exact (structural clone) |
| `apps/jobs/src/dispatch.ts` (MODIFIED) | config / registry | request-response | `apps/jobs/src/dispatch.ts` l.29/52 (self, prior entries) | exact |
| `supabase/migrations/0015_telegram_posts.sql` (NEW) | migration | CRUD (DDL) | `supabase/migrations/0012_payments.sql` (UNIQUE global idempotence) | role + dataflow match |
| `packages/supabase/src/repositories/telegramPosts.ts` (NEW) | repository | CRUD (insert onConflict) | `packages/supabase/src/repositories/predictionOutcomes.ts` | exact |
| grammY client wrapper (inline in `telegram-publish.ts` or `apps/jobs/src/telegram/bot.ts`) (NEW) | utility / external client | request-response (egress) | env-throw pattern from `getServiceClient` + p-retry from `finnhub/client.ts` | partial (env+retry only; API new) |
| win-rate read (reuse `patternStats.ts` + `threshold.ts`, or extract repo) | utility | request-response (read) | `apps/web/src/lib/track-record/patternStats.ts` + `threshold.ts` | exact (reuse as-is) |
| `packages/core/src/telegram/format.ts` (NEW) | utility (pure) | transform | (none — new integration) | NO ANALOG |
| `apps/jobs/src/jobs/__tests__/telegram-publish.test.ts` (NEW) | test | — | `apps/jobs/src/jobs/__tests__/outcome-tracker.test.ts` (referenced by RESEARCH; verify on disk) | role match |

## Pattern Assignments

### `apps/jobs/src/jobs/telegram-publish.ts` (job, batch/pub)

**Analog:** `apps/jobs/src/jobs/outcome-tracker.ts` (structural clone). Secondary: `subscription-expiry.ts` (minimal shape).

**Imports + lazy service client pattern** (`outcome-tracker.ts` lines 20-44) — copy verbatim, rename error prefix to `telegram-publish:`:
```typescript
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import type { Json, Database } from '@app/supabase'

function getServiceClient() {
  const url = process.env['SUPABASE_URL']
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!url || !key) {
    throw new Error(
      'telegram-publish: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in apps/jobs/.env',
    )
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
```

**Core job shape — `async (): Promise<Json>` returning stats** (`outcome-tracker.ts` lines 68-118; `subscription-expiry.ts` lines 44-51). Do NOT touch `job_runs` — `runJob` wraps it. Return a `Json` stats object only:
```typescript
export async function telegramPublish(): Promise<Json> {
  const client = getServiceClient()
  // 1. win rate: getPatternStats(client) → find overall/all/all_time → applyThreshold
  // 2. closed trades: select prediction_outcomes JOIN trade_setups JOIN instruments (bornes resolved_at)
  // 3. already-posted keys: getPostedKeys(client) (idempotence level 1)
  // 4. decide format(s): notable (each run) / recap (~21h UTC) / winrate-only (Friday)
  // 5. formatMessage → sendPost (grammy) → insertPost onConflict (idempotence level 2)
  return { posted, skipped } as Json
}
```

**Idempotence two-level model** — copy mental model from `outcome-tracker.ts` lines 86-88 + 114-115: SELECT existing keys (level 1, `getPostedKeys`) filters before send; UNIQUE constraint + onConflict (level 2) is the inviolable DB net.

**Error throwing on Supabase calls** (`outcome-tracker.ts` lines 80-82) — every `client.from(...)` error must throw with a prefixed message, never silently swallowed.

---

### `apps/jobs/src/dispatch.ts` (MODIFIED — registry, request-response)

**Analog:** the file itself, mirroring the two most recent entries.

**Import + registry entry pattern** (`dispatch.ts` lines 28-29 import block, lines 50-52 registry entries):
```typescript
// add to import block (after line 29):
import { telegramPublish } from './jobs/telegram-publish'

// add to JOB_REGISTRY (after line 52), with a one-line comment mirroring l.51:
// TG-01/02/03 — publication Telegram horaire (après outcome-tracker). run-job.cmd telegram-publish.
'telegram-publish': telegramPublish,
```
The registry type is `Record<string, () => Promise<Json | undefined>>` (line 36) — `telegramPublish` returning `Promise<Json>` satisfies it. No other change needed; `runJob` (line 72) auto-traces.

---

### `supabase/migrations/0015_telegram_posts.sql` (NEW — migration, DDL)

**Analog:** `supabase/migrations/0012_payments.sql` (global UNIQUE idempotence net + producer-only RLS).

**Critical convention** (`0012_payments.sql` lines 4-7): apply via **MCP `apply_migration`**, NOT `supabase db push`. Project not `link`ed → `database.types.ts` edited by hand after apply (see Pitfall 6 in RESEARCH).

**Global UNIQUE idempotence net** — mirror `0012_payments.sql` lines 63-64 (`payments_tx_hash_global_idx`). The `dedupe_key text not null unique` column is the exact analog of `UNIQUE(tx_hash)`: the single inviolable guard against double-post even under concurrent inserts.

**RLS producer-only** — mirror `0012_payments.sql` lines 85-95: `enable row level security` + NO update/delete/write policy (service_role bypass writes). RESEARCH §Pattern 4 gives the full recommended DDL (table `telegram_posts(id, dedupe_key text unique, post_type check in (recap/notable/winrate), posted_at, tg_message_id bigint, run_id uuid references job_runs)`).

**text + check(... in (...)) over native enum** — mirror `0012_payments.sql` line 41/44-45 (`plan`/`status` columns) — consistent with 0001/0006/0009. Use for `post_type`.

---

### `packages/supabase/src/repositories/telegramPosts.ts` (NEW — repository, CRUD)

**Analog:** `packages/supabase/src/repositories/predictionOutcomes.ts` (exact — insert onConflict ignoreDuplicates + read set of existing keys).

**Insert idempotent pattern** (`predictionOutcomes.ts` lines 20-33) — port `insertOutcomes` → `insertPost`, changing `onConflict: 'setup_id'` to `onConflict: 'dedupe_key'`:
```typescript
export async function insertPost(
  client: ServiceClient,
  row: TelegramPostInsert,
): Promise<void> {
  const { error } = await client
    .from('telegram_posts')
    .upsert([row], { onConflict: 'dedupe_key', ignoreDuplicates: true })
  if (error) throw new Error(`insertPost failed: ${error.message}`)
}
```

**Read existing keys (idempotence level 1)** (`predictionOutcomes.ts` lines 38-46) — port `getResolvedSetupIds` → `getPostedKeys` returning `Set<string>` of `dedupe_key`:
```typescript
export async function getPostedKeys(client: ServiceClient): Promise<Set<string>> {
  const { data, error } = await client.from('telegram_posts').select('dedupe_key')
  if (error) throw new Error(`getPostedKeys failed: ${error.message}`)
  return new Set((data ?? []).map((r) => r.dedupe_key))
}
```

**Producer-boundary doc header** (`predictionOutcomes.ts` lines 1-10) — copy the header convention: only the job (service_role) writes; never imported from `apps/web`.

**Types:** `ServiceClient = SupabaseClient<Database>` (line 15) and `TelegramPost{Row,Insert}` aliases must be added to `packages/supabase/src/database.types.ts` after gen types (Pitfall 6 — re-append custom aliases).

---

### grammY client wrapper (NEW — external client, egress)

**Analog:** env-throw shape from `getServiceClient` (`outcome-tracker.ts` lines 33-44); retry from `packages/data-sources/src/finnhub/client.ts` lines 13, 39-68.

**No analog for the Telegram API call itself** (new external integration). Map only the secrets/env-throw discipline:
```typescript
import { Bot } from 'grammy'
function getBot(): Bot {
  const token = process.env['TELEGRAM_BOT_TOKEN']
  if (!token) throw new Error('telegram-publish: TELEGRAM_BOT_TOKEN must be set in apps/jobs/.env')
  return new Bot(token) // publication-only: never bot.start()
}
function getChannelId(): string {
  const id = process.env['TELEGRAM_CHANNEL_ID']
  if (!id) throw new Error('telegram-publish: TELEGRAM_CHANNEL_ID must be set in apps/jobs/.env')
  return id // numeric -100… form recommended
}
```

**Retry on 429** — mirror `finnhub/client.ts` lines 39-68 (`pRetry(() => ..., { retries: 3 })`):
```typescript
import pRetry from 'p-retry'
async function sendPost(bot: Bot, chatId: string, html: string): Promise<number> {
  const msg = await pRetry(
    () => bot.api.sendMessage(chatId, html, { parse_mode: 'HTML', disable_web_page_preview: true }),
    { retries: 3 },
  )
  return msg.message_id
}
```

---

### win-rate read (reuse P5 — read)

**Analog:** `apps/web/src/lib/track-record/patternStats.ts` + `threshold.ts` — **reuse as-is, do NOT reinvent** (D-11 cohérence vitrine ↔ Telegram).

**`getPatternStats` signature** (`patternStats.ts` lines 40-52): takes `SupabaseClient<Database>` (typed `AnonClient` but service_role consumes it too — `pattern_stats` grant is anon+authenticated, service bypasses). Returns `{ rows: PatternStatRow[]; error: string | null }`.

**Target row** — `(dimension='overall', bucket='all', period='all_time')` confirmed in `0014_prediction_outcomes_pattern_stats.sql` lines 85-92:
```typescript
const { rows } = await getPatternStats(client)
const overall = rows.find((r) => r.dimension === 'overall' && r.period === 'all_time')
```

**Threshold** (`threshold.ts` lines 15, 48-59): `applyThreshold(row)` returns discriminated union `{ sufficient:true, winRatePct, n }` or `{ sufficient:false, n }`. `MIN_SAMPLE=30`. N always present.
```typescript
const res = applyThreshold({ n: overall?.n ?? 0, win_rate: overall?.win_rate ?? null,
  expectancy: overall?.expectancy ?? null, avg_r: overall?.avg_r ?? null })
// res.sufficient ? `${res.winRatePct}% (N=${res.n})` : `échantillon insuffisant, N=${res.n}`
```

**PLANNER DECISION (RESEARCH Open Q2):** import `getPatternStats` cross-app (jobs → apps/web/lib) OR extract a minimal read repo into `packages/supabase` that both web and jobs import. RESEARCH recommends extraction for a clean package graph (D-49). The function is currently in `apps/web/src/lib/`, NOT in `packages/`, so a direct jobs→web import crosses the app boundary — favor extraction. `threshold.ts` is pure (no I/O) and could move to `packages/core` or `packages/supabase` alongside.

---

### `packages/core/src/telegram/format.ts` (NEW — pure transform)

**NO ANALOG.** New bilingual FR+AR (RTL bidi) message formatter. Build per RESEARCH §Pattern 2 + §Pattern 3 + §Code Examples (lines 220-251, 439-448). Pure, golden-testable, zero I/O.

Key constraints (no existing pattern to copy — these are the spec):
- `escapeHtml(s)`: `&`→`&amp;`, `<`→`&lt;`, `>`→`&gt;` applied to ALL dynamic data (Pitfall 5).
- bidi isolates `LRI=U+2066` / `PDI=U+2069` around LTR segments (ticker, R, %); `RLM=U+200F` prefix on AR lines (Pattern 3).
- result mapping (D-03) from `replayOutcome` enum (`packages/core/src/replay/outcome.ts` line 42): `hit_tp`→« ✅ TP1 atteint », `hit_sl`→« ❌ SL touché », `flat`→« ➖ clôture neutre (flat) ».
- disclaimer FR+AR on every post (D-06) — reuse exact P2 legal copy if available.
- cap at < ~3500 chars (4096 hard limit, Pitfall 3).

---

### `apps/jobs/src/jobs/__tests__/telegram-publish.test.ts` (NEW — test)

**Analog:** `outcome-tracker.test.ts` (referenced by RESEARCH §Wave 0 — verify exact path on disk before citing). Mock in-memory client + `vi.mock('grammy')` on `bot.api.sendMessage`. Covers TG-01/TG-03 (idempotent 2nd run = 0 post, distinct dedupe_key per type, empty-day D-10, notable ≥2.0R gate).

## Shared Patterns

### Lazy service_role client (env-throw)
**Source:** `apps/jobs/src/jobs/outcome-tracker.ts` lines 33-44 (also `subscription-expiry.ts` 25-36, `runJob.ts` 30-41)
**Apply to:** `telegram-publish.ts` + grammY env reads
**Pattern:** read env, throw with `'<job>: ... must be set in apps/jobs/.env'` if missing, `createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } })`. Lazy (call-time, not import-time) so `dotenv/config` loads first.

### Job execution tracing (TG-03 — already built)
**Source:** `apps/jobs/src/runJob.ts` lines 50-70 + `dispatch.ts` line 72
**Apply to:** all jobs — do NOT re-code `job_runs`. Job returns `Json` stats; `runJob` writes running→success/error with `{ stats }`. RESEARCH anti-pattern: never hand-roll job_runs.

### DB idempotence (UNIQUE + onConflict ignoreDuplicates)
**Source:** `0012_payments.sql` lines 63-64 (`UNIQUE(tx_hash)`) + `predictionOutcomes.ts` lines 26-28 (`upsert onConflict ignoreDuplicates`)
**Apply to:** `0015` migration (`dedupe_key unique`) + `telegramPosts.ts` (`onConflict: 'dedupe_key'`)
**Insight:** DB constraint is the inviolable net; the application-level pre-select (`getPostedKeys`) only optimizes. RESEARCH Pitfall 2: send THEN insert; if insert fails, next run re-posts (accepted at this volume, log loudly).

### Producer-boundary RLS (service_role-only writes)
**Source:** `0012_payments.sql` lines 85-95 (RLS on, no write policy) + `predictionOutcomes.ts` header lines 8-9
**Apply to:** `0015` `telegram_posts` (enable RLS, no write policy) + `telegramPosts.ts` (never imported from apps/web)

### Reuse P5 win-rate (no reinvention)
**Source:** `patternStats.ts` 40-52 + `threshold.ts` 15/48-59 + `0014` view 85-92
**Apply to:** win-rate read in `telegram-publish.ts` — single source of truth, MIN_SAMPLE=30, N always shown (D-11)

### luxon time/UTC (window, Friday, recap hour)
**Source:** `packages/core/src/time/constants.ts` (`UTC_ZONE='UTC'` line 18); luxon usage norm in jobs (RESEARCH §Stack)
**Apply to:** `telegram-publish.ts` cadence logic — `DateTime.now().setZone('UTC')`, `.weekday===5` (Friday), `RECAP_HOUR_UTC` constant near `constants.ts`. RESEARCH anti-pattern: never native `Date` for TZ.

### p-retry on external 429
**Source:** `packages/data-sources/src/finnhub/client.ts` lines 13, 39, 62-68 (`pRetry(fn, { retries: 3 })`)
**Apply to:** grammY `sendMessage` wrapper

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `packages/core/src/telegram/format.ts` | utility (pure) | transform | No existing bilingual/RTL/HTML-escape/bidi formatting in codebase. Build from RESEARCH §Pattern 2+3 spec. Only genuinely new testable code in the phase. |
| grammY `bot.api.sendMessage` call | external client | egress | First Telegram integration. Only the env-throw + p-retry wrappers have analogs; the API surface is new (grammy 1.43.0, to `pnpm --filter jobs add`). |

## Metadata

**Analog search scope:** `apps/jobs/src/jobs/`, `apps/jobs/src/` (runJob, dispatch), `packages/supabase/src/repositories/`, `apps/web/src/lib/track-record/`, `supabase/migrations/`, `packages/core/src/{replay,time}/`, `packages/data-sources/src/finnhub/`
**Files scanned:** ~14 jobs, 15 repos, 13 migrations, 3 track-record libs (read in detail: outcome-tracker, subscription-expiry, predictionOutcomes, dispatch, runJob, patternStats, threshold, 0012, 0014 view, time/constants, replay/outcome, finnhub/client)
**Migration numbering:** confirmed via glob — 0001..0012 + 0014 present; **0013 absent** (reserved P4 deferred); next free = **0015**.
**Pattern extraction date:** 2026-06-17
