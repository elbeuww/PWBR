# Architecture Research

**Domain:** v2.1 integration into an existing pnpm monorepo (Next.js 15 + Supabase trading-analysis platform). Three axes: NEXA reskin · live AI routines · backtest seeding.
**Researched:** 2026-06-20
**Confidence:** HIGH (read against real source files; every integration point cites a real path)

> Scope: **integration only**. Build ON the existing architecture, do not redesign it. The single AI write boundary (`persist.ts`) stays sacred.

---

## Standard Architecture (existing, as-built — what we plug into)

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│  SCHEDULER LAYER (agnostic — D-08)                                     │
│  Claude Code Remote routine │ Windows Task Scheduler │ croner daemon   │
└───────────────┬──────────────────────────────────────────────────────┘
                │ argv[2] = job name   (+ env: RUN_ID, SUPABASE_*)
                ▼
┌──────────────────────────────────────────────────────────────────────┐
│  apps/jobs  (tsx ESM)                                                   │
│  dispatch.ts ── JOB_REGISTRY ──► runJob.ts (startRun/finishRun)        │
│       │                              │ service_role, lazy client        │
│       ▼                              ▼                                   │
│  ingest jobs        engine jobs      job_runs (monitoring)              │
│  market/news/macro  technical/       outcome-tracker, telegram-publish  │
│  /calendar          fundamental/news ─► combine-engine ─► [ANALYZE] ─►  │
│                                                            persist.ts    │
└───────────────┬───────────────────────────────────┬───────────────────┘
                │ supabase-js (HTTPS, NOT MCP)        │ reads run-artifacts/
                ▼                                     │
┌──────────────────────────────────────────────────────────────────────┐
│  Supabase (Postgres + RLS + Realtime)                                  │
│  candles · news · macro · snapshots · analyses · trade_setups          │
│  prediction_outcomes ─► pattern_stats (VIEW, anon-readable)            │
└───────────────┬──────────────────────────────────────────────────────┘
                │ anon client + RLS gates (has_active_subscription)
                ▼
┌──────────────────────────────────────────────────────────────────────┐
│  apps/web  (Next.js 15 App Router, RSC)                                │
│  [locale]/(marketing)/(member)/(account)/(auth) + (admin)             │
│  globals.css @theme tokens · shadcn/ui v4 · CandleChart (lwc v5)      │
└──────────────────────────────────────────────────────────────────────┘

shared packages:  core (replayOutcome, OutputSchema, scoring, threshold)
                  indicators (RSI/.../structure: swings, BOS/CHoCH, S/R, POC)
                  data-sources (Binance/OANDA/Finnhub/Marketaux/FRED/FairEconomy)
                  supabase (generated types + typed repositories)
```

### The single AI write boundary (do NOT bypass)

`apps/jobs/src/jobs/persist.ts` is the **only** path from agent output to DB. The agent
**never writes the DB**; it writes JSON files under `run-artifacts/<run_id>/<instrument>_<style>.json`.
`persist.ts` reads them (`readRunArtifacts`), then: stripFence → JSON.parse → `OutputSchema.safeParse`
(Zod) → `getSnapshotByHash(raw_indicators_ref)` → `runGuardrails` (R:R, SL/TP coherence, structure-against)
→ `scoreSetup` (deterministic /100, agent's score discarded) → `expirePriorSetups` → `insertAnalysis` +
`insertTradeSetups`. **All v2.1 routine work must keep this boundary intact.**

---

## Integration Map — NEW vs MODIFIED (by axis)

### AXIS 1 — NEXA Design System

**Decision: tokens live in `apps/web/src/styles/globals.css` `@theme` / `:root` / `.dark`. Do NOT create a shared design-token package.**

Rationale (HIGH): the existing system is already Tailwind v4 CSS-first — the entire token surface
(`--color-*` mapped via `@theme inline`, brand values in `:root`/`.dark`) lives in one file
(`globals.css`, 122 lines). Only `apps/web` consumes it (jobs render nothing). A shared package would
add a build step and a second source of truth for zero benefit. shadcn/ui components already consume the
mapped tokens (`bg-primary`, `text-foreground`, `border-border`), so re-skinning is mostly **swapping
the CSS variable values**, not touching components.

| Concern | Integration point | New / Modified |
|---------|-------------------|----------------|
| Token values (OKLCH NEXA palette) | `apps/web/src/styles/globals.css` `:root` + `.dark` | **MODIFIED** — replace blue `#1E5FBF`/`#3B82F6` hex with OKLCH NEXA tokens. Keep the `@theme inline` mapping table as-is. |
| Two brand themes `volt` / `green` | `globals.css` — add `[data-brand="volt"]` / `[data-brand="green"]` selectors layered on `:root`/`.dark` | **NEW** — a *second axis* orthogonal to light/dark. light/dark stays `.dark` class (next-themes); brand becomes a `data-brand` attribute on `<html>`. The two compose: `.dark[data-brand="green"]` overrides where needed. |
| Brand selection provider | `apps/web/src/components/ThemeProvider.tsx` (wraps next-themes) | **MODIFIED** — keep next-themes for light/dark; add a tiny `BrandProvider` setting `data-brand` with the same no-flash pre-paint script pattern already used for theme. |
| No-flash guarantee | `[locale]/layout.tsx` `<html suppressHydrationWarning>` + next-themes pre-paint | **MODIFIED (carefully)** — the brand attribute needs the SAME pre-paint inline-script treatment as `.dark`, or brand flashes on load. #1 reskin pitfall. |
| Fonts (Archivo / Chakra Petch / Space Grotesk / JetBrains Mono / Noto Sans Arabic) | `apps/web/src/lib/fonts.ts` + `src/fonts/*.woff2` | **MODIFIED** — extend the existing `next/font/local` + `next/font/google` pattern. Add font CSS vars; map in `@theme` (`--font-sans`, new `--font-display`, `--font-mono`). Keep `:lang(ar)` rule, swap IBM Plex Arabic → Noto Sans Arabic. |
| RTL preservation | next-intl `dir="rtl"` (`[locale]/layout.tsx`) + Tailwind v4 logical properties | **PRESERVE** — every NEW NEXA component (hero, marquee, gauges, scene) MUST use logical props (`ms`/`me`/`ps`/`pe`/`start`/`end`/`text-start`), NEVER physical (`ml`/`pl`/`left`/`text-left`). ThemeToggle is the reference pattern (already RTL-safe). |
| CandleChart (lightweight-charts v5) | `apps/web/src/components/signals/CandleChart.tsx` (+ `CandleChartLazy.tsx`, no-SSR) | **MODIFIED** — lwc colors are set via JS API (`layout`, `grid`, series colors), NOT CSS tokens. Reskin = read NEXA OKLCH values from CSS vars at runtime (`getComputedStyle(document.documentElement)`) or pass a resolved theme object. Must react to dark/light AND brand switch. Keep canvas; do not rebuild. |
| RLS-gated server components | `(member)/signaux` RSC (anon client + RLS) | **PRESERVE** — reskin is purely presentational. Do NOT move data fetching to client to "make styling easier" — that breaks the `has_active_subscription()` gate. Restyle inside the existing RSC → client-component boundary. |

**Component inventory — restyle (token-driven, no rebuild) vs rebuild (new NEXA primitives):**

| Restyle only (consume new tokens) | Rebuild / Build new (NEXA-specific) |
|-----------------------------------|-------------------------------------|
| All `components/ui/*` shadcn primitives (button, card, badge, table, tabs, dialog, select, input, progress…) — token swap | Hero / "scène" (landing) — **NEW** |
| `Footer.tsx`, `Disclaimer.tsx`, `LanguageSwitcher.tsx`, `ThemeToggle.tsx` | Marquee — **NEW** |
| `signals/SignalCard`, `SignalList`, `FilterBar`, `SignalDetail`, `ContributingFactors`, `RealtimeBadge`, `GlossaryTooltip` | Score gauges (/100 visual) — **NEW** (replaces/augments `ui/progress`) |
| `track-record/TrackRecordBlock`, `TrackRecordView` | Brand theme switcher (volt/green) — **NEW** |
| `academie/*` (Callout, ContentCard, Steps, Toc, Figure, TradeExample, mdx-components) | NEXA header/nav shell — **MODIFY** existing header in `[locale]/layout.tsx` |
| `member/ExpiryBanner`, `admin/*` row-action components | Animations layer — **NEW** (respect `prefers-reduced-motion`) |
| `CandleChart` — **MODIFY** (runtime theme injection, not rebuild) | |

**Rebranding MERA → NEXA:** the hardcoded `"Vétéran Trading"` string in `[locale]/layout.tsx` header
(marked `i18n-ignore: marque`) → `"NEXA"`. Audit i18n message files for any brand/slogan strings; the
"Make Everybody Rich Again" slogan is explicitly **excluded** (legal: no gain promise — already enforced
by the `no-perf-claims` test from v2.0 P2).

---

### AXIS 2 — Live AI Routines (Claude Code Remote, no API key)

**Key finding: there is NO `analyze` job and there should not be one. The ANALYZE step is agent-native reasoning, not a registered job.**

Verified: `dispatch.ts` `JOB_REGISTRY` has no `analyze` entry; `persist.ts` reads agent-produced FILES
via `runArtifacts.ts`; comments in `persist.ts`/`combine-engine.ts` call ANALYZE "04-04" and state
*"l'agent écrit des FICHIERS ; seul persist insère"*. `runArtifacts.ts` expects
`run-artifacts/<run_id>/<instrument>_<style>.json` with `RUN_ID_RE = /^[a-z]+-\d{8}T\d{4}Z$/`.

**The routine pipeline (per scheduled run):**

```
Claude Code Remote routine (15 runs/day, shared quota — docs/routines-claude.md §2)
  │  Environment injects SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (§3)
  │
  ├─1─ deterministic prep (job invocations, NO AI):
  │     tsx dispatch.ts technical-engine
  │     tsx dispatch.ts fundamental-engine
  │     tsx dispatch.ts news-engine
  │     tsx dispatch.ts combine-engine     ← assembles snapshot kind='combined'
  │
  ├─2─ ANALYZE (agent-native, NO job):
  │     agent reads combined snapshots for the session universe (sessionUniverse.ts),
  │     reasons per (instrument × style) using prompts/veteran.md,
  │     WRITES run-artifacts/<run_id>/<SYMBOL>_<style>.json  (raw §3 JSON each)
  │     exports RUN_ID=<session>-<YYYYMMDD>T<HHmm>Z
  │
  └─3─ persist (single boundary):
        RUN_ID=… tsx dispatch.ts persist     ← validates/scores/inserts immutably
```

| Concern | Integration point | New / Modified |
|---------|-------------------|----------------|
| Where the agent plugs in | Between `combine-engine` (job) and `persist` (job). The agent IS the analyze step; it produces files, not DB rows. | **NEW orchestration**, no new job module. |
| Should `analyze.ts` be a new job? | **NO.** A job runs deterministic code under `runJob`. Veteran reasoning is the agent itself (no API key → cannot call Claude from inside a job). Adding `apps/jobs/src/jobs/analyze.ts` would require an API key — out of scope. The artifact-file contract (`runArtifacts.ts`) is precisely the seam that lets the agent be the analyzer. | — |
| Snapshot building feeds the agent | `technical-engine` + `fundamental-engine` + `news-engine` → `combine-engine` → `snapshots` table (kind='combined', `content_hash`). Agent reads combined snapshots; `output.raw_indicators_ref` = that hash, resolved by `getSnapshotByHash` in persist. | **PRESERVE** (already built). The hash linkage is the integrity contract. |
| Session universe per run | `apps/jobs/config/sessions.ts` (`SESSIONS` map: asset_classes × styles) + `apps/jobs/src/jobs/sessionUniverse.ts` (`resolveSessionUniverse`). | **PRESERVE** — defines which instrument×style pairs the agent analyzes per session. |
| Schedule windows (day/swing triggers) | Cron declared in `sessions.ts` header: asia `00 23 * * 0-4`, london `00 07 * * 1-5`, newyork `30 12 * * 1-5`, eod-swing `00 21 * * 1-5`. Authoritative UTC table in `docs/routines-claude.md §6`. | **NEW (config in Claude dashboard)** — these windows become the actual Remote routine schedules. "The engine chooses the moment" = these pre-declared session windows, not free-form. Routine config lives **outside git** (ARCHITECTURE §5 note). |
| Secrets | Claude Code **Environments** inject `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. `dispatch.ts` loads `dotenv/config` (no-op in cloud). | **NEW (dashboard setup)** — see `docs/routines-claude.md §7 TODO` checklist. |
| Connectivity | supabase-js HTTPS only. **MCP Supabase is NOT available in Remote routines** (docs §4, Pitfall 5). Confirm `*.supabase.co` network access at setup. | **PRESERVE** — every job already uses supabase-js, never MCP. |
| Monitoring | `runJob` writes `job_runs` (running→success/error). Agent-native ANALYZE has no `runJob` wrapper → if the agent dies mid-run, `persist` throws `no_artifacts`, and the missing combined→setups chain shows as `stale` on `/admin/sante`. | **PRESERVE**. Optional: a thin `analyze-marker` heartbeat job to record the ANALYZE attempt in `job_runs` (LOW priority observability). |
| Quota (15 runs/day shared) | Deterministic ingestion must NOT consume Claude quota → stays on Windows Task Scheduler (docs §5). Only ANALYZE runs in routines. | **PRESERVE** — keep ingestion off the agent path. |

**This axis is mostly configuration + lifting the v1.0 P4 debt ("configurer routines + 1 run réel"),
not new code.** The seams already exist. New code, if any: a per-session orchestration wrapper the
routine calls (a `.cmd`/shell chaining the engine jobs, then the agent, then persist), and optional
observability glue.

---

### AXIS 3 — Backtest Engine (seed `pattern_stats`)

**Decision: new package `packages/backtest`. Do NOT put it in `packages/indicators`.**

Rationale (HIGH): `packages/indicators` is a pure deterministic *calculation* library (golden-tested:
same candles → same values + same hash). Backtesting is a *simulation/orchestration* concern that
**consumes** indicators + structure detection + `replayOutcome` (which lives in `@app/core`). Mixing
simulation into the indicators package would pollute its purity contract. A dedicated package keeps the
dependency direction clean: `backtest → core + indicators + supabase`.

| Concern | Integration point | New / Modified |
|---------|-------------------|----------------|
| Where it lives | `packages/backtest/` (new workspace) — pure detect/simulate/aggregate logic | **NEW** |
| Backtest runner job | `apps/jobs/src/jobs/backtest.ts` + register in `dispatch.ts` `JOB_REGISTRY` | **NEW** (job wraps the package, writes via service_role under `runJob`) |
| Reuse `replayOutcome` | `import { replayOutcome } from '@app/core'` — same first-touch TP1-vs-SL logic the live `outcome-tracker` uses (same `ReplaySetup`/`ReplayCandle` types). | **REUSE** — identical outcome semantics between backtest and live = honest, comparable %. |
| Reuse structure detection | `@app/indicators`: `detectSwings`, `detectBosChoch`, `clusterLevels`, `computePoc`, plus RSI/MACD/EMA/ATR/Bollinger wrappers. | **REUSE** — pattern detection over historical candles uses the EXACT same detectors as live → the catalogue % measures the same patterns the engine emits. |
| Data source | `candles` table (historical OHLCV, already ingested) via a backtest repository (or reuse the `getCandlesForReplay` pattern in `packages/supabase`). | **REUSE / extend** `packages/supabase` repositories. |
| Where backtest results land | **NEW source distinct from live `prediction_outcomes`.** New table `backtest_outcomes` (mirrors prediction_outcomes shape: pattern, outcome, realized_r, candle_count) + extend `pattern_stats` view with a `source` column ('backtest' \| 'live'), OR a sibling view `pattern_stats_seed`. | **NEW migration** (next number after 0016 → 0017). Keep live `prediction_outcomes` untouched (its frontière D-05 = producer-unique). |
| `pattern_stats` consumption | `packages/supabase/src/repositories/patternStats.ts` → re-exported by `apps/web/src/lib/track-record/patternStats.ts`. Front already reads it (TrackRecordBlock/View) with N≥30 threshold (`@app/core` `applyThreshold`, `MIN_SAMPLE`). | **MODIFIED** — repository/view gains `source` awareness so the front shows backtest-seeded % at J1, then progressively switches to live as N(live)≥30. N stays visible (D-12). |

**Backtest data flow:**

```
candles (historical, table)
   │
   ▼  packages/backtest/detect.ts
pattern detection  ── @app/indicators (swings, BOS/CHoCH, S/R, POC, RSI…)
   │  → "at bar T, pattern P fired with implied entry/SL/TP"
   ▼  packages/backtest/simulate.ts
simulate outcome  ── @app/core replayOutcome (first-touch TP1 vs SL, realized_r)
   │  → { pattern, outcome, realized_r } per detected instance
   ▼  packages/backtest/aggregate.ts (or SQL view)
aggregate by pattern → win_rate, avg_r(winners), expectancy, N
   │
   ▼  apps/jobs/src/jobs/backtest.ts  (service_role, runJob, job_runs)
backtest_outcomes table  ──►  pattern_stats (source='backtest')
   │
   ▼  apps/web track-record block — % MEASURED at J1 (N visible, ≥30 gate)
```

**Honesty invariant (PROJECT.md core value):** the displayed % must be measured, never asserted.
Backtest seeds the % *before* live N≥30 exists; the live `outcome-tracker` loop accumulates real
outcomes in parallel; the front transitions backtest→live as the live sample matures. Both use the
SAME `replayOutcome` so the two measurements are methodologically comparable.

---

## Recommended Build Order (dependency-respecting)

```
1. DESIGN tokens first        globals.css OKLCH NEXA + volt/green + fonts.ts + no-flash brand script
       → verify: light/dark/volt/green compose with no flash; RTL logical props intact
2. DESIGN reskin              shadcn token-driven restyle → signals/track-record/academie/admin
       → then NEW NEXA primitives (hero, marquee, gauges, scene, animations)
       → CandleChart runtime theme injection (dark/light/brand reactive)
       → verify: RLS-gated RSC untouched; CandleChart recolors; AR-RTL screens correct
3. ROUTINES — snapshot path   confirm technical/fundamental/news → combine-engine produces combined
       → verify: snapshots kind='combined' with content_hash for session universe
4. ROUTINES — agent + persist Environment secrets + Remote routine schedules (sessions.ts crons)
       → agent ANALYZE writes run-artifacts → RUN_ID=… persist → trade_setups
       → verify: 1 real run end-to-end (lifts v1.0 P4 debt); job_runs green; stale flag works
5. BACKTEST engine            packages/backtest (detect→simulate→aggregate) reusing core+indicators
       → migration 0017 backtest_outcomes + pattern_stats source column
       → apps/jobs backtest.ts job
       → verify: golden values; same replayOutcome as live; N visible
6. BACKTEST display           patternStats repo/view source-aware → front shows seeded % at J1
       → outcome-tracker live loop in prod → progressive backtest→live switch
       → verify: % always measured; N≥30 threshold; honest source labelling
```

**Why this order:** tokens before reskin (components consume tokens). Snapshot before analyze (agent
needs combined snapshots). Persist boundary before any setup display. Backtest engine before display
(can't show % without measured data). Design (Axis 1) is independent of Axes 2–3 and can run in
parallel by a separate workstream.

---

## Anti-Patterns (v2.1-specific)

### Anti-Pattern 1: Adding an `analyze.ts` job that calls Claude
**What people do:** create `apps/jobs/src/jobs/analyze.ts` invoking an Anthropic API.
**Why wrong:** no API key in scope (cost constraint); breaks the "agent reasons natively, writes files"
seam; duplicates the veteran prompt logic.
**Instead:** the Remote routine's agent IS the analyzer. It writes `run-artifacts/<run_id>/*.json`;
`persist.ts` reads them. The artifact-file contract is the integration point.

### Anti-Pattern 2: Writing trade_setups outside persist.ts
**What people do:** seed setups directly from backtest, or let the agent insert.
**Why wrong:** destroys the single confidence boundary (D-43) — Zod/guardrails/deterministic scoring/
immutability all live in persist. Backtest measures *outcomes of detected patterns*, not setups.
**Instead:** backtest writes `backtest_outcomes` (its own producer boundary), never `trade_setups`.

### Anti-Pattern 3: Moving RLS-gated data fetch to the client to ease reskin
**What people do:** convert `(member)/signaux` RSC to a client component for styling convenience.
**Why wrong:** the `has_active_subscription()` RLS gate depends on the server anon-client RSC pattern;
client fetch leaks the gate / exposes the anon key path.
**Instead:** restyle within the existing RSC→client boundary; presentational only.

### Anti-Pattern 4: Physical CSS direction utilities in NEW NEXA components
**What people do:** `ml-`, `pl-`, `left-`, `text-left`, fixed `transform: translateX`.
**Why wrong:** breaks Arabic RTL (the whole MENA audience). v2.0 went to lengths for logical-prop RTL.
**Instead:** logical props only (`ms`/`me`/`ps`/`pe`/`start`/`end`/`text-start`); mirror animations for RTL.

### Anti-Pattern 5: Theming CandleChart via CSS classes
**What people do:** expect Tailwind tokens to recolor the canvas.
**Why wrong:** lightweight-charts renders to canvas; CSS tokens don't reach it.
**Instead:** read resolved OKLCH values from CSS vars (or a theme object) and pass via the lwc JS API;
re-apply on dark/light AND brand change.

---

## Integration Points Summary

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| agent ANALYZE ↔ persist | files: `run-artifacts/<run_id>/<symbol>_<style>.json` | RUN_ID format strict, path-traversal-guarded (`runArtifacts.ts`) |
| combine-engine ↔ agent | `snapshots` (kind='combined', content_hash) | hash = `raw_indicators_ref` integrity link resolved in persist |
| persist ↔ DB | supabase-js service_role, single writer | D-43 sole AI write boundary — keep sacred |
| backtest ↔ pattern_stats | `backtest_outcomes` → view (source='backtest') | distinct from live `prediction_outcomes` (D-05) |
| backtest / outcome-tracker ↔ core | `replayOutcome` (shared) | identical outcome semantics = comparable % |
| web tokens ↔ components | `globals.css` `@theme` vars | reskin = token swap, not component rewrite |
| brand/theme ↔ html | next-themes `.dark` + `data-brand` attr | both need no-flash pre-paint scripts |

### External / Config

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Claude Code Remote routines | Environments (secrets) + cron schedules (sessions.ts windows) | NOT git; dashboard config; 15 runs/day shared quota |
| Supabase (Remote) | supabase-js HTTPS, NOT MCP | confirm `*.supabase.co` network access at setup |
| Windows Task Scheduler | `run-job.cmd <job>` | keeps deterministic ingestion off Claude quota |

---

## Sources

- `apps/jobs/src/{dispatch,runJob}.ts`, `apps/jobs/src/jobs/{persist,combine-engine,outcome-tracker,runArtifacts}.ts`, `apps/jobs/config/sessions.ts`, `apps/jobs/prompts/veteran.md` — as-built code — **HIGH**
- `apps/web/src/styles/globals.css`, `apps/web/src/lib/fonts.ts`, `apps/web/src/app/[locale]/layout.tsx`, `apps/web/src/components/ThemeToggle.tsx`, component inventory under `apps/web/src/components/*` — **HIGH**
- `packages/core/src/index.ts` + `replay/outcome.ts`, `packages/indicators/src/index.ts`, `packages/supabase/src/repositories/patternStats.ts` — shared package surfaces — **HIGH**
- `supabase/migrations/0014_prediction_outcomes_pattern_stats.sql` — pattern_stats view + D-05/D-12 — **HIGH**
- `docs/routines-claude.md` (routine model, quota, Environments, MCP-not-available, session UTC windows) — **HIGH** (project invariant doc)
- `.planning/PROJECT.md` (v2.1 scope, three axes, constraints, key decisions) — **HIGH**

---
*Architecture research for: v2.1 integration (NEXA reskin · live AI routines · backtest seeding)*
*Researched: 2026-06-20*
