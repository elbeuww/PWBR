# Phase 3: Moteur d'analyse déterministe - Research

**Researched:** 2026-06-13
**Domain:** Deterministic technical/fundamental/news analysis engine (zero-AI, pure code) over OHLCV + macro + news already in Postgres
**Confidence:** HIGH (stack + conventions verified in codebase & npm); MEDIUM on numeric defaults (N/k/decay — to be pinned by golden tests, as decided)

## Summary

Phase 3 builds a pure-code engine in a new `packages/indicators` workspace (with submodule `packages/indicators/structure`) plus three "engine" jobs in `apps/jobs` that read `candles`/`macro_series`/`news`/`economic_calendar` and write a new `snapshots` table. No Claude, no arithmetic delegated to AI. The hard part is NOT the classic indicators (wrapping `technicalindicators 3.1.0` is mechanical) — it is the **home-grown market-structure module** (fractal-pivot swings + ATR filter, BOS/CHoCH on body close, S/R clustering, volume-by-price POC). The ecosystem (TradingView/LuxAlgo/MQL5 implementations) uses exactly the algorithms locked in CONTEXT.md, which validates D-32..D-35; the open questions are only the numeric parameters, and the decided answer is "pin them with golden tests."

The output shapes are non-negotiable: `ARCHITECTURE.md §3` locks `technical_snapshot` / `fundamental_context` / `news_context` field-by-field, and the new `snapshots` table (D-41) must follow the established §4 conventions (snake_case, uuid PK, RLS read=authenticated / write=service_role-bypass, content hash = `raw_indicators_ref`). The codebase already has battle-tested patterns to copy verbatim: golden-value Vitest tests with offline JSON fixtures, idempotent upsert repositories, the `runJob`/`dispatch` job harness, and ESM source-consumed packages.

**Primary recommendation:** Build `packages/indicators` (wrappers + `structure/` submodule, all golden-tested offline), add a migration `0005_snapshots.sql` with a unique idempotency key + content hash, expose typed repositories in `packages/supabase`, and slice the work as **three vertical engines** (technical → fundamental → news), each producing its part of a snapshot end-to-end before moving on. Pin all numeric parameters (N, k, S/R tolerance, decay half-life, macro thresholds) as named constants in `packages/core` or `packages/indicators`, locked by golden tests so determinism is provable.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Classic indicators (RSI/MACD/EMA/ATR/Bollinger) | `packages/indicators` (wrappers) | — | Pure functions over OHLCV arrays; wrap `technicalindicators` |
| Market structure (swings/BOS/CHoCH/S-R/POC) | `packages/indicators/structure` (home-grown) | `packages/core` (candle/time constants) | Lib has none; deterministic home-grown code is the "vétéran" differentiator |
| Snapshot assembly (technical/fundamental/news) | `apps/jobs` engine jobs | `packages/indicators` + repositories | Jobs orchestrate read→compute→hash→write; engines are the §2 modules |
| Macro/news derivation rules | `apps/jobs` (fundamental/news engine) | data-driver table (SQL data) | Deterministic rules + extensible-by-UPDATE driver table (D-38) |
| Persistence (`snapshots`) | `packages/supabase` repository | migration SQL | Same typed-repo + RLS + upsert pattern as Phase 2 |
| Determinism proof | Vitest golden tests | offline JSON fixtures | Same `__fixtures__` + golden pattern as `data-sources`/`core` |

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-32:** Swing highs/lows = **fractal pivot + ATR filter** — pivot on N symmetric candles, kept only if amplitude > k×ATR. Rejected: ZigZag ATR%, pure fractal. N and k pinned by golden tests.
- **D-33:** BOS/CHoCH confirmed by **BODY CLOSE** beyond the swing (wick alone does not validate). Coherent with the closed-candle convention in `packages/core`.
- **D-34:** S/R = **clusters of swings** within an ATR tolerance. Strength = multi-factor (touches + age + recency of last test).
- **D-35:** Volume by source — crypto Binance = real volume → POC computed; forex/commodities OANDA = tick volume only → `volume_state` + POC tagged **`proxy`**. Each `poc` key_level carries its volume source (real/tick). Honesty flag non-negotiable.
- **D-36:** TF→role: **Day = HTF H4 / LTF H1**; **Swing = HTF Daily / LTF H4**. Matches the 3 ingested TFs (H1/H4/D).
- **D-37:** Standard indicator periods, identical across TFs: RSI 14, MACD 12/26/9, EMA 20/50/200, ATR 14, Bollinger 20/2. EMA200 justifies the 2-year backfill (D-21).
- **D-38:** `macro_bias` + `rate_environment` from **deterministic rules on FRED series** (DFF, CPIAUCSL, DTWEXBGS≈DXY, DFII10≈real yields) + **home-grown asset-driver table** (data-not-code, extensible by SQL UPDATE).
- **D-39:** `net_sentiment` = **weighted average per instrument, window aligned to style** (~24h day / 7j swing) **with temporal decay** (recent news weighs more). `recent_catalysts` = top items of the window. Window bounds + decay function pinned in planning.
- **D-40:** `news_risk` = high-impact economic events imminent **< 2h (day) / < 24h (swing)** — LOCKED by `ARCHITECTURE.md §3`. Consumes `economic_calendar` (P2/D-31).
- **D-41:** **Dedicated `snapshots` table** — one dated snapshot per (instrument, style, timeframe-set) with a content HASH as `raw_indicators_ref`; Phase 4 references the exact snapshot by hash. Makes P3 testable in isolation.

### Claude's Discretion
- Exact API of `packages/indicators` wrappers (signatures, OHLCV input formats).
- Internal structure of `packages/indicators/structure` (files: swings / BOS-CHoCH / S-R / volume).
- Precise SQL schema of `snapshots` (columns, indexes, jsonb shape, idempotency key) respecting §4 + P1/P2 conventions (snake_case, RLS read auth / write service_role, regenerated types).
- Numeric values pinned by golden tests: N (pivot lookback) and k (ATR multiplier) of D-32, S/R clustering ATR tolerance (D-34), sentiment window bounds + decay function (D-39), macro rule thresholds (D-38).
- Job/engine decomposition (one global snapshot job vs one per engine) and name(s) in `apps/jobs` dispatcher.
- Handling instruments without enough history for EMA200 (skip indicator vs partial flagged snapshot) — arbitrate in planning.

### Deferred Ideas (OUT OF SCOPE)
- Chart pattern catalog (PATT-01) + measured success rate (PATT-02) — v1.1, after structure engine proven.
- Adaptive indicator periods by style/volatility — premature optimization; reopen at P9 calibration.
- Home-recomputed sentiment (vs provider) — provider suffices; P3 only aggregates.
- Additional indicators (Stochastic, ADX, Ichimoku) — not required by TECH-01; addable later via the wrapper.
- RSI/MACD-vs-structure divergence detection — out of scope, post-MVP enrichment candidate.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TECH-01 | Calcule indicateurs (RSI/MACD/EMA/ATR/Bollinger) en code déterministe | Wrap `technicalindicators 3.1.0`; golden-test the wrapper against pinned outputs |
| TECH-02 | Détecte structure de marché (HH/HL, swings, BOS/CHoCH) déterministe | Home-grown `structure/` module — fractal pivot + ATR filter (D-32), body-close BOS/CHoCH (D-33) |
| TECH-03 | Niveaux clés (S/R, POC volume) avec mesure de force | S/R clustering (D-34) + volume-by-price POC with source flag (D-35) |
| TECH-04 | Produit `technical_snapshot` structuré par instrument/style | Engine assembles HTF/LTF trend, momentum, volatility, key_levels, structure, volume_state per ARCHITECTURE §3 |
| FUND-01 | Produit `fundamental_context` (macro bias, rate env, drivers) | Deterministic FRED rules (D-38) + asset-driver table |
| FUND-02 | Produit `news_context` (net sentiment, catalysts, upcoming) | Weighted-decay aggregation (D-39) over `news` + `economic_calendar` |
| FUND-03 | Flag `news_risk` events imminents par instrument/style | Calendar window thresholds <2h/<24h (D-40) |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| technicalindicators | 3.1.0 | RSI/MACD/EMA/ATR/Bollinger | LOCKED (CLAUDE.md). Ships ESM (`module: lib/index.js`) + TS types (`declarations/index.d.ts`). `[VERIFIED: npm registry]` |
| luxon | 3.7.2 | UTC, session/TZ windows, sentiment window bounds | Already in `packages/core`/jobs. `[VERIFIED: npm registry]` |
| zod | 4.4.3 | Validate snapshot shapes before persist; engine boundaries | Locked v4 across repo. `[VERIFIED: npm registry]` |
| vitest | 4.1.8 | Golden-value tests (indicators + structure), 80% target | Installed, config at root with `@app/*` aliases. `[VERIFIED: node_modules]` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none new for structure) | — | Home-grown structure detection | D-32..D-35 are home-grown; no npm dep — see "Don't Hand-Roll" caveat below |
| node:crypto | builtin | Deterministic content hash (`raw_indicators_ref`) | `createHash('sha256')` over canonical-JSON of indicator values (D-41) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| technicalindicators 3.1.0 | `fast-technical-indicators` (100% API-compatible, zero-dep, maintained) | LOCKED on 3.1.0 by CLAUDE.md; do NOT swap. Noted only as a future drop-in if 3.1.0's `@types/node ^6` dep ever bites. `[ASSUMED]` API-compat claim |
| Home-grown POC | a volume-profile npm lib | No maintained, typed, OHLCV-approximation lib exists; ARCHITECTURE wants POC in key_levels → home-grown proportional-overlap is the honest path |
| sha256 content hash | crc32 / object-hash lib | builtin crypto is zero-dep and deterministic; just canonicalize key order first |

**Installation:**
```bash
pnpm --filter @app/indicators add technicalindicators@3.1.0
# zod/luxon already present; structure + hashing use builtins
```

**Version verification:** `npm view technicalindicators version time.modified` → `3.1.0`, last modified `2023-07-12` (stale, as CLAUDE.md warns — wrap + golden-test to freeze behavior). `main=dist/index.js`, `module=lib/index.js`, `types=./declarations/index.d.ts`. Single dependency `@types/node ^6` (harmless dev type, very old — pin and ignore).

## Package Legitimacy Audit

> slopcheck not available in this sandbox (no pip/network for install). All packages below are LOCKED by the project CLAUDE.md stack table and already vetted in Phase 0/2; no NEW unvetted package is introduced in Phase 3.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| technicalindicators | npm | last pub 2023-07 (stale) | high (established) | github.com/anandanand84/technicalindicators | n/a (unavailable) | Approved — LOCKED by CLAUDE.md; wrap + golden-test |
| luxon | npm | mature | very high | github.com/moment/luxon | n/a | Approved — already in repo |
| zod | npm | mature | very high | github.com/colinhacks/zod | n/a | Approved — already in repo |
| vitest | npm | mature | very high | github.com/vitest-dev/vitest | n/a | Approved — already installed |

**Packages removed due to slopcheck [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none. No new third-party package is added beyond `technicalindicators` (already locked). The `@types/node ^6` transitive of technicalindicators is an obsolete but inert dev-type and does not affect runtime.

## Architecture Patterns

### System Architecture Diagram

```
                         ┌─────────────────── SUPABASE (read) ───────────────────┐
                         │ candles(H1/H4/D)  macro_series  news  economic_calendar│
                         └───────┬───────────────┬──────────┬──────────┬─────────┘
                                 │               │          │          │
        apps/jobs/dispatch.ts  ──┤               │          │          │
              │ (tsx, runJob → job_runs)         │          │          │
              ▼                                  ▼          ▼          ▼
   ┌─────────────────────┐        ┌──────────────────┐ ┌──────────────────────────┐
   │  technical-engine   │        │ fundamental-     │ │  news-engine             │
   │  (job)              │        │ engine (job)     │ │  (job)                   │
   │                     │        │                  │ │                          │
   │ candles → packages/ │        │ macro_series +   │ │ news (window+decay) +    │
   │ indicators:         │        │ asset-driver     │ │ economic_calendar        │
   │  • wrappers (RSI..) │        │ table → rules    │ │  → net_sentiment,        │
   │  • structure/:      │        │  → macro_bias,   │ │    recent_catalysts,     │
   │    swings(D32)→     │        │    rate_env,     │ │    upcoming_events,      │
   │    BOS/CHoCH(D33)→  │        │    drivers       │ │    news_risk (D40)       │
   │    S/R cluster(D34)→│        │                  │ │                          │
   │    POC vol(D35)     │        └────────┬─────────┘ └────────────┬─────────────┘
   │  → technical_       │                 │                        │
   │    snapshot (§3)    │      fundamental_context (§3)    news_context (§3)
   └──────────┬──────────┘                 │                        │
              └───────────────┬────────────┴────────────────────────┘
                              ▼
                   assemble snapshot row + sha256 content hash (raw_indicators_ref)
                              │  (Zod-validate against §3 shape)
                              ▼
              packages/supabase: upsertSnapshot (idempotent on content key)
                              ▼
                   SUPABASE  snapshots  (RLS read=auth, write=service_role)
                              ▼
                   Phase 4 veteran-analyzer reads snapshot BY HASH
```

### Recommended Project Structure
```
packages/indicators/
├── package.json              # @app/indicators, type:module, dep technicalindicators 3.1.0
├── src/
│   ├── index.ts              # barrel: wrappers + structure + types
│   ├── ohlcv.ts              # Candle[] → typed input arrays (open/high/low/close/volume)
│   ├── wrappers/
│   │   ├── rsi.ts  macd.ts  ema.ts  atr.ts  bollinger.ts   # thin deterministic wrappers
│   │   └── *.test.ts         # golden values (pinned numeric outputs)
│   └── structure/
│       ├── swings.ts         # fractal pivot + ATR filter (D-32), N/k = named const
│       ├── structure.ts      # HH/HL classification + BOS/CHoCH on body close (D-33)
│       ├── levels.ts         # S/R clustering + multi-factor strength (D-34)
│       ├── volume.ts         # volume-by-price POC + source flag + volume_state (D-35)
│       └── *.test.ts         # golden values on known fixtures

packages/supabase/src/repositories/snapshots.ts   # upsertSnapshot, getSnapshotByHash
supabase/migrations/0005_snapshots.sql            # table + RLS + indexes
apps/jobs/src/jobs/
│   ├── technical-engine.ts   # registered in dispatch.ts
│   ├── fundamental-engine.ts
│   └── news-engine.ts
apps/jobs/src/engines/asset-drivers.ts  (or seed in migration as data table)
```

### Pattern 1: Thin deterministic indicator wrapper
**What:** Wrap `technicalindicators` static `.calculate({ period, values })` API; never expose the lib type outside the wrapper.
**When to use:** Every classic indicator (TECH-01).
**Example:**
```typescript
// Source: technicalindicators README / npmjs (API: X.calculate({ period, values }))  [CITED: npmjs.com/package/technicalindicators]
import { RSI, MACD, EMA, ATR, BollingerBands } from 'technicalindicators'

// RSI.calculate({ period: 14, values: closes }) → number[] (length = closes.length - period)
// MACD.calculate({ values, fastPeriod:12, slowPeriod:26, signalPeriod:9, SimpleMAOscillator:false, SimpleMASignal:false })
//   → { MACD, signal, histogram }[]
// ATR.calculate({ period:14, high, low, close }) → number[]
// BollingerBands.calculate({ period:20, stdDev:2, values: closes }) → { middle, upper, lower, pb }[]
// EMA.calculate({ period, values }) → number[]
```
**Determinism gotcha (HIGH):** outputs are **shorter** than inputs — there is a warmup offset (e.g. RSI length = N − period). The wrapper MUST return the *last aligned value* (e.g. `at(-1)`) keyed to the last closed candle, not assume index alignment with the candle array. Golden tests must pin both the value AND the expected output length for a fixed input.

### Pattern 2: Fractal pivot + ATR filter (D-32)
**What:** A bar i is a swing high if `high[i] >= high[j]` for all j in `[i-N, i+N]` (and symmetric for lows); kept only if `(high[i] - max(neighbor lows)) > k * ATR[i]`.
**When to use:** TECH-02 foundation; S/R and BOS/CHoCH both consume swings.
**Example:**
```typescript
// Source: TradingView/LuxAlgo fractal market-structure convention (window = 2N+1)  [CITED: luxalgo.com market-structure-choch-bos-fractal]
// N (lookback) and k (ATR multiplier) are NAMED CONSTANTS, pinned by golden tests.
// Ecosystem-typical starting points to validate by test: N ∈ {2,3,5}, k ∈ {0.5,1.0,1.5}.
// Use packages/core closed-candle convention — never include the in-progress candle.
```

### Pattern 3: BOS/CHoCH on body close (D-33)
**What:** BOS = body close beyond the last same-direction swing (trend continuation). CHoCH = body close beyond the last opposite swing (trend flip / early warning).
**Confirmation mode = "Close"** (cleanest, ecosystem default) — wick beyond level does NOT confirm.
```typescript
// BOS up: close > lastSwingHigh (body close, not high). CHoCH down in uptrend: close < lastSwingLow.
// Anti stop-hunt: a wick that pierces but a body that closes back inside = NO signal.
```

### Pattern 4: S/R clustering + multi-factor strength (D-34)
**What:** Cluster swing points whose prices fall within an ATR-scaled tolerance into one zone; strength = weighted(touches, age, recency).
```typescript
// 1. Sort swing prices. 2. Greedy/agglomerative merge within tolerance = c * ATR (c pinned by test).
// 3. zone.price = volume- or count-weighted mean of members.
// 4. strength = w1*normalize(touches) + w2*recency(last_test) + w3*age(persistence).
//    Weights are named constants, pinned by golden tests. Higher touches + recent retest + longer life = stronger.
```

### Pattern 5: Volume-by-price POC with honest source flag (D-35)
**What:** Proportional-overlap volume profile over OHLCV (no intrabar data): for each candle, distribute its volume across price bins proportionally to how much of `[low, high]` overlaps each bin; POC = highest-volume bin.
```typescript
// Source: proportional-overlap is the best OHLCV-only approximation vs "all volume at close"  [CITED: tradingview volume-profile basics + trading-strategies.academy]
// Crypto (Binance real volume): POC source='real'.
// FX/commodities (OANDA tick volume only): POC source='proxy' (tick), plus volume_state expanding|contracting.
// EVERY poc key_level carries its volume source — non-negotiable honesty flag (D-35).
```

### Pattern 6: Deterministic content hash (D-41)
**What:** `raw_indicators_ref = sha256(canonicalJson(indicatorPayload))`. Canonicalize: sort object keys, fixed numeric precision (round to a decided decimal count) so floating noise doesn't change the hash.
```typescript
import { createHash } from 'node:crypto'
const hash = createHash('sha256').update(canonicalJson(payload)).digest('hex')
// Same candles + same code ⇒ same hash ⇒ idempotent snapshot (testable in isolation).
```

### Pattern 7: Engine job (copy Phase 2 harness verbatim)
**What:** Each engine = a `() => Promise<Json>` registered in `dispatch.ts`, wrapped by `runJob` (writes `job_runs`), lazy service_role client, fault-isolated per instrument.
**Example:** copy the structure of `apps/jobs/src/jobs/macro-ingest.ts` (lazy client, per-item try/catch, `stats` accumulator, throw on total failure WR-04).

### Anti-Patterns to Avoid
- **Index-aligning indicator output with candle array** (off-by-warmup-period). Align on the last closed candle explicitly.
- **Including the in-progress candle** — always consume `packages/core` closed-candle convention (D-10), never recompute time logic.
- **Presenting a tick-volume POC as a real POC** — the `source` flag is mandatory (D-35).
- **Confirming BOS/CHoCH on a wick** — body close only (D-33).
- **Hard-coding asset drivers in TS** — they live in a data table, extensible by SQL UPDATE (D-38, like D-17).
- **Hashing raw floats** — canonicalize + fix precision first, else the hash is non-deterministic across platforms.
- **Importing `service-client` from the barrel** — import via exact path under ESLint guard (D-07).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| RSI/MACD/EMA/ATR/Bollinger math | Custom indicator math | `technicalindicators 3.1.0` (LOCKED) | Battle-tested; CLAUDE.md forbids re-rolling these |
| Content hashing | Custom hash | `node:crypto` sha256 | builtin, deterministic |
| UTC/session/closed-candle | New time logic | `packages/core` (D-10, tested 16/16) | Already proven; CONTEXT says consume, never redefine |
| Idempotent persistence | Custom upsert | `packages/supabase` repo pattern (onConflict) | Established Phase 2 pattern |
| Job lifecycle / monitoring | New runner | `runJob` + `dispatch.ts` + `job_runs` | Established Phase 1/2 harness |

**Key insight:** The ONE thing you MUST hand-roll is **market structure** (swings/BOS/CHoCH/S-R/POC) — `technicalindicators` provides none of it (confirmed: CLAUDE.md "What NOT to Use" + the lib's indicator-only README). This is deliberate and is the "vétéran" differentiator. Everything else is wired from existing libraries/patterns.

## Common Pitfalls

### Pitfall 1: Indicator warmup offset breaks alignment
**What goes wrong:** `RSI.calculate` returns `closes.length - 14` values; naive `result[i]` pairs the wrong candle with the wrong value.
**Why it happens:** The lib drops the warmup window silently.
**How to avoid:** Wrapper returns the value aligned to the LAST closed candle (`result.at(-1)`); golden-test asserts both value and output length for a fixed fixture.
**Warning signs:** RSI value "looks shifted by N bars."

### Pitfall 2: Insufficient history for EMA200
**What goes wrong:** An instrument with < ~200 closed candles on a TF yields empty/short EMA200 output.
**Why it happens:** 2-year backfill (D-21) covers it for established instruments, but new/illiquid ones or OANDA-pending instruments may not have enough H4/Daily bars yet.
**How to avoid:** Decision needed in planning (Claude's discretion item): either skip the indicator and mark the field null, OR emit a **partial snapshot flagged** (e.g. `partial: true`, `missing: ['ema200']`). Recommendation: **partial flagged snapshot** — never silently zero a missing indicator; Phase 4 must see the gap.
**Warning signs:** EMA200 = NaN/undefined for a fresh instrument.

### Pitfall 3: Non-deterministic content hash
**What goes wrong:** Same candles → different hash across runs/platforms.
**Why it happens:** Unordered JSON keys + raw float formatting (`0.1+0.2`).
**How to avoid:** Canonical JSON (sorted keys) + fixed decimal rounding before hashing. Golden-test the hash on a fixed fixture.

### Pitfall 4: FX tick-volume mistaken for real volume in POC
**What goes wrong:** Presenting an OANDA tick-volume POC as a genuine traded-volume POC misleads the vétéran.
**How to avoid:** `source` field on every `poc` key_level; `proxy` tag for tick (D-35).

### Pitfall 5: OANDA instruments empty in DB at P3 time
**What goes wrong:** Only ~30,935 crypto candles exist; OANDA forex/commodities pending demo account. Engine run over an instrument with zero candles must not crash.
**How to avoid:** Fault-isolate per instrument (per-item try/catch like `macro-ingest`), skip with a `stats.skipped` entry; build/golden-test the engine on crypto data first (vertical slice), wire FX when candles land.
**Warning signs:** Engine job fails entirely because one instrument has no data.

### Pitfall 6: Re-rolling time/session logic
**What goes wrong:** Duplicating daily-anchor / closed-candle logic inside the engine.
**How to avoid:** Import from `packages/core` (`lastClosedCandleStart`, `DAILY_ANCHOR`).

## Code Examples

### Map DB candles → indicator inputs
```typescript
// CandleRow[] (from repository, ascending ts) → typed arrays for technicalindicators
const closes = rows.map(r => r.close)
const highs  = rows.map(r => r.high)
const lows   = rows.map(r => r.low)
const vols   = rows.map(r => r.volume ?? 0)   // null volume → 0 (FX before tick-volume confirmed)
```

### Golden test shape (copy data-sources pattern)
```typescript
// Source: packages/data-sources/src/fred/schema.test.ts (established offline golden pattern)
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const fixture = require('../__fixtures__/btcusdt-h4.json') as unknown
// it('RSI14 last value == 47.32 ± 0.01 for fixture', ...) — pin the number
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| All volume at close for profile | Proportional-overlap distribution across price bins | standard since OHLCV-only profiling | Honest POC approximation without tick data |
| Wick-break market structure | Body-close confirmation (default "Close" mode) | TradingView/LuxAlgo convention | Matches D-33; fewer false breaks |
| `technicalindicators` (stale 2023) | `fast-technical-indicators` (zero-dep, API-compatible) exists | 2024+ | NOT adopted — locked on 3.1.0; noted only as future fallback |

**Deprecated/outdated:**
- `technicalindicators 3.1.0` is unmaintained since 2023-07 — mitigated by wrapping + golden tests (CLAUDE.md decision), not by upgrading.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `technicalindicators` API is `X.calculate({ period, values })` with MACD/ATR/Bollinger object outputs as described | Standard Stack / Pattern 1 | Wrapper signatures differ — caught immediately by first golden test against the installed lib; low risk |
| A2 | `fast-technical-indicators` is 100% API-compatible | Alternatives | Only matters if future fallback; not used in P3 |
| A3 | Ecosystem-typical N∈{2,3,5}, k∈{0.5,1.0,1.5} are reasonable starting points | Pattern 2 | These are starting candidates only; final values pinned by golden tests per decision — by design not a locked fact |
| A4 | Sentiment decay half-life ~7 days (swing) / shorter for day is a standard choice | Validation/D-39 | Window/decay explicitly left to planning; golden-tested once chosen |
| A5 | Proportional-overlap is the best OHLCV-only POC approximation | Pattern 5 | Multiple sources agree; alternative (close-only) is strictly worse |

**These are starting parameters, not facts.** Per CONTEXT.md, N, k, S/R tolerance, decay function, and macro thresholds are deliberately pinned by golden tests in planning — research provides candidate ranges, not final values.

## Open Questions

1. **EMA200 with insufficient history**
   - What we know: 2-year backfill covers established instruments; OANDA pending.
   - What's unclear: skip-field vs partial-flagged snapshot.
   - Recommendation: partial-flagged snapshot (`partial:true`, `missing:[...]`); decide explicitly in planning (Claude's-discretion item).
2. **Job decomposition: one snapshot job vs three engine jobs**
   - Recommendation: **three engine jobs** (technical/fundamental/news) for vertical slicing + isolated golden tests, assembled into one snapshot row; OR a single `snapshot` job calling three pure engine functions. Either keeps engines pure and testable. Decide in planning.
3. **Exact `snapshots` idempotency key**
   - Candidate: unique `(instrument_id, style, timeframe_set, computed_for_ts)` where `computed_for_ts` = last closed candle of the LTF; `content_hash` stored separately as `raw_indicators_ref`. Confirm in planning.
4. **Asset-driver table: dedicated table vs seed-in-migration JSON**
   - Recommendation: a small `asset_drivers` table (instrument_id, driver_code, weight/direction) seeded in the migration, UPDATE-extensible (D-38). Confirm shape in planning.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| technicalindicators | TECH-01 wrappers | ✗ (not yet installed) | 3.1.0 (on npm) | none — must `pnpm add` into `packages/indicators` |
| node:crypto | content hash | ✓ builtin | Node ≥20 | — |
| Vitest | golden tests | ✓ | 4.1.8 | — |
| Crypto candles in DB | technical-engine vertical slice | ✓ | ~30,935 rows (BTC/ETH/SOL/BNB/XRP) | — |
| OANDA FX/commodity candles | full TECH coverage | ✗ (demo account pending) | — | Build+test on crypto first; fault-isolate empty FX instruments |
| FRED macro_series | FUND-01 | ✓ (Phase 2 ingested DFF/CPIAUCSL/DTWEXBGS/DFII10) | — | — |
| news / economic_calendar | FUND-02/03 | ✓ (Phase 2 tables populated) | — | — |

**Missing dependencies with no fallback:** `technicalindicators` must be installed (trivial).
**Missing dependencies with fallback:** OANDA candles — slice technical-engine on crypto, wire FX when data lands.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.8 |
| Config file | `vitest.config.ts` (root; aliases `@app/core|supabase|data-sources`; add `@app/indicators`) |
| Quick run command | `pnpm vitest run packages/indicators` |
| Full suite command | `pnpm vitest run` |

> NB: `vitest.config.ts` `include` is `['packages/**/*.test.ts', 'apps/**/__tests__/**/*.test.ts']` — new `packages/indicators/**/*.test.ts` is auto-covered. Add a `@app/indicators` alias when the package is created. Engine job tests go under `apps/jobs/__tests__/`.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TECH-01 | RSI/MACD/EMA/ATR/Bollinger pinned outputs | unit (golden) | `pnpm vitest run packages/indicators/src/wrappers` | ❌ Wave 0 |
| TECH-02 | swings (D-32), BOS/CHoCH body-close (D-33) on known cases | unit (golden) | `pnpm vitest run packages/indicators/src/structure` | ❌ Wave 0 |
| TECH-03 | S/R clusters + strength, POC + source flag | unit (golden) | `pnpm vitest run packages/indicators/src/structure` | ❌ Wave 0 |
| TECH-04 | `technical_snapshot` matches §3 shape; deterministic hash | unit + Zod | `pnpm vitest run apps/jobs/__tests__/technical-engine.test.ts` | ❌ Wave 0 |
| FUND-01 | macro_bias/rate_env rules + asset drivers | unit (golden) | `pnpm vitest run apps/jobs/__tests__/fundamental-engine.test.ts` | ❌ Wave 0 |
| FUND-02 | net_sentiment weighted-decay window | unit (golden) | `pnpm vitest run apps/jobs/__tests__/news-engine.test.ts` | ❌ Wave 0 |
| FUND-03 | news_risk window thresholds <2h/<24h | unit (golden) | `pnpm vitest run apps/jobs/__tests__/news-engine.test.ts` | ❌ Wave 0 |
| (D-41) | snapshots upsert idempotent + RLS | integration | `pnpm vitest run packages/supabase` (RLS pattern from P1/P2) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm vitest run packages/indicators` (sub-30s, offline fixtures)
- **Per wave merge:** `pnpm vitest run`
- **Phase gate:** full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/indicators/package.json` + `@app/indicators` alias in `vitest.config.ts` — install `technicalindicators@3.1.0`
- [ ] `packages/indicators/src/__fixtures__/*.json` — offline OHLCV fixtures (derive a small slice from real BTC candles; pin expected outputs)
- [ ] `packages/indicators/src/wrappers/*.test.ts` — golden values for RSI/MACD/EMA/ATR/Bollinger (value + output length)
- [ ] `packages/indicators/src/structure/*.test.ts` — golden cases for swings/BOS/CHoCH/S-R/POC with hand-verified known fixtures
- [ ] `apps/jobs/__tests__/{technical,fundamental,news}-engine.test.ts` — snapshot-shape + deterministic-hash tests
- [ ] `supabase/migrations/0005_snapshots.sql` + regenerated `database.types.ts` + `snapshots` repo + RLS integration test

## Security Domain

> `security_enforcement` not set false in config → included.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Phase 3 is server-side jobs; no new auth surface |
| V3 Session Management | no | — |
| V4 Access Control | yes | RLS on `snapshots`: read=authenticated, write=service_role-bypass (no write policy) — identical to candles/news (§4) |
| V5 Input Validation | yes | Zod-validate snapshot payload against §3 shape before persist; engines read trusted DB data but still validate boundaries |
| V6 Cryptography | yes (hashing only) | `node:crypto` sha256 for content hash — not a security secret, just integrity/idempotency. Never hand-roll |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| service_role key leak to frontend | Information disclosure | Engines run in `apps/jobs` only; `service-client` never re-exported from barrel (D-07, ESLint guard) — established |
| RLS missing on new table | Elevation of privilege | `enable row level security` + read-only policy in `0005_snapshots.sql` from creation (Phase 2 pattern) |
| Non-deterministic/forgeable snapshot ref | Tampering | Content sha256 over canonical payload; Phase 4 references by hash → immutable traceability |
| Secret/key in `job_runs.stats` | Information disclosure | Phase 2 rule (T-02-13): stats carry normalized messages only, never key values — reuse |

## Sources

### Primary (HIGH confidence)
- Codebase: `ARCHITECTURE.md` §2/§3/§4/§250, `CLAUDE.md` stack table, `packages/core`, `packages/supabase`, `packages/data-sources`, `apps/jobs`, `supabase/migrations/0003`, `vitest.config.ts` — conventions, locked output shapes, established patterns.
- npm registry (`npm view technicalindicators`, verified 2026-06-13): version 3.1.0, modified 2023-07-12, `module=lib/index.js` (ESM), `types=declarations/index.d.ts`, dep `@types/node ^6`.

### Secondary (MEDIUM confidence)
- npmjs.com/package/technicalindicators — `.calculate({ period, values })` API, MACD/Bollinger object outputs.
- TradingView / LuxAlgo / MQL5 market-structure references — fractal pivot (window 2N+1), BOS/CHoCH on close, ATR filter, EQ-merge tolerance for clustering.
- TradingView volume-profile basics + trading-strategies.academy — proportional-overlap POC from OHLCV.
- arXiv sentiment-decay papers + EWMA primer — exponential time-decay weighted sentiment, ~7-day half-life convention.

### Tertiary (LOW confidence)
- `fast-technical-indicators` "100% API-compatible" claim — not used in P3, future-fallback note only.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified in repo/npm; locked by CLAUDE.md.
- Architecture/conventions: HIGH — extracted directly from existing code (migrations, repos, jobs, golden tests).
- Structure algorithms: MEDIUM-HIGH — algorithm shapes match locked decisions across multiple ecosystem sources; numeric params deliberately deferred to golden tests.
- Numeric defaults (N/k/decay/thresholds): MEDIUM by design — candidate ranges only; pinned in planning per D-32/34/38/39.

**Research date:** 2026-06-13
**Valid until:** 2026-07-13 (stable stack; technicalindicators already frozen since 2023)
