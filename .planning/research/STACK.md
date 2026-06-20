# Stack Research — v2.1 Additions (NEXA identity · routines live · backtest)

**Domain:** Trading-signals SaaS (Next.js 15 + Supabase), milestone v2.1 add-ons on an already-shipped v2.0 app
**Researched:** 2026-06-20
**Confidence:** HIGH (DESIGN, ROUTINES, BACKTEST)
**Scope rule:** Only NEW capabilities for the 3 axes. The v2.0 stack is locked and reused — do not re-add it. (Prior v2.0 stack research preserved at `.planning/milestones/` if archived.)

---

## TL;DR — the minimal set

**Net-new runtime dependencies for the whole milestone: ZERO required, ONE optional.**

| Axis | Verdict | New dep |
|------|---------|---------|
| DESIGN | CSS + `@theme` (Tailwind v4) + ~120 lines of vanilla TS (IntersectionObserver + rAF). Fonts via `next/font/local`. | **None required.** `motion` (12.x) only if scroll-reveal/tilt orchestration becomes painful across the whole app — defer until proven. |
| ROUTINES | A Claude Code **scheduled Remote routine** that invokes the existing `tsx` job. No package, no API key. | **None.** Pure config + one new job file. |
| BACKTEST | Pure TS replaying candles through existing `packages/indicators` + `replayOutcome` (already shipped v2.0 P5). Stats are trivial. | **None.** |

The reference mock (`Nexa - Landing.html`) ships its behaviour in a plain `landing.css` + `landing.js` — **no framework, no animation lib in the markup.** Everything it does (marquee, score rings, scroll-reveal, mouse-tilt, count-up, parallax hero, CSS globe) is reproducible with CSS + a tiny vanilla helper. **Reconstruct, do not import a heavy lib.**

---

## Recommended Stack

### Core Technologies (NEW for v2.1)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **`next/font/local`** | built into Next 15 — no install | Self-host the 5 brand fonts: Archivo, Chakra Petch, Space Grotesk, JetBrains Mono, Noto Sans Arabic | The mock loads them from Google Fonts CDN. Self-host instead: zero layout shift (auto fallback metrics), no third-party render-blocking `<link>` (privacy + MENA latency). Same mechanism already used for Inter/IBM Plex Sans Arabic in v2.0 P2 — extend it. Exposes CSS vars (`--font-archivo`, etc.) consumed by Tailwind `@theme`. |
| **Tailwind v4 `@theme` + OKLCH custom props** | `tailwindcss 4.3.1` (ALREADY installed) | Brand tokens, two themes `volt`/`green`, RTL | No new dep. The mock already speaks OKLCH (`oklch(0.74 0.16 147)`) — Tailwind v4 is OKLCH-native. Themes via `[data-theme="volt"]`/`[data-theme="green"]` attribute selectors overriding `@theme` custom properties (mirrors the mock's `data-theme` on `<html>`). RTL stays as v2.0: logical properties only, no `tailwindcss-rtl`. |
| **Vanilla TS animation helpers** | n/a (~120 LOC, client components in `apps/web`) | scroll-reveal, count-up, mouse-tilt, parallax depth | The mock's `.reveal`, `data-count`, `.tilt[data-tilt]`, `.layer[data-depth]` are driven by `landing.js`. Reconstruct with `IntersectionObserver` (reveal), `requestAnimationFrame` (count-up easing), `mousemove`+`transform` (tilt/parallax). Tree-shakeable, SSR-safe (guard in `useEffect`), `prefers-reduced-motion`-aware. Cheaper than any lib for this exact set. |
| **Claude Code scheduled Remote routine** | platform feature (Max plan) — no npm | Trigger `snapshot → analyze(veteran) → persist` at day/swing windows | Confirmed by `docs/routines-claude.md` + PROJECT.md: intelligence is the agent; backend only reads/writes Supabase via `supabase-js`. No Anthropic API key, no new dependency. The routine is dashboard config that runs the existing `tsx` dispatcher. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **`motion`** (successor to `framer-motion`) | `12.x` (latest 12.40.0, 2026) | Declarative scroll/enter animations IF vanilla orchestration proves unmaintainable across many app surfaces | **OPTIONAL — defer.** ESM, `motion/react` (React 19 compatible) + vanilla `animate()`. Hybrid engine (WAAPI + JS), GPU-accelerated. Only adopt if applying reveal/stagger to member + academy + admin becomes repetitive enough that hand-rolled IO is worse. For the landing page alone, NOT needed. Budget ~30–40 kB gzip with `LazyMotion`. |
| **`tw-animate-css`** | `1.4.0` (ALREADY installed) | Keyframe utilities (fade/slide) used by shadcn v4 | Already a dep. Covers simple entrance/exit (dialogs, toasts). Use it before reaching for `motion`. Marquee + rings are NOT here — those are bespoke CSS. |
| **`lightweight-charts`** | `5.2.0` (ALREADY installed) | Reused as-is if a "replay over history" preview UI is built for backtest | No change. Backtest engine is headless TS; reuse the existing v5 chart from member detail if a visual replay is wanted. |

### Development Tools (reused for v2.1)

| Tool | Purpose | Notes |
|------|---------|-------|
| **Vitest** (ALREADY `4.1.8`) | Golden tests for the backtest engine + Wilson-interval helper + count-up easing math | Same harness as `packages/indicators`. Fixed candle fixtures → fixed `pattern_stats`. Mirror existing golden-value discipline. |
| **Playwright** (ALREADY `1.60.0`) | Visual/RTL E2E for the rebrand across surfaces; theme-toggle no-flash; reduced-motion | Add specs: `data-theme` swap, AR-RTL intact, fonts loaded (no FOUT), reveal fires. Extends v2.0 E2E. |

---

## Installation

```bash
# DESIGN — NO new npm package required for the baseline reconstruction.
# Fonts: place the 5 .woff2 subsets in apps/web/app/fonts/ and wire next/font/local.
#   Archivo (600–900), Chakra Petch (600/700), Space Grotesk (300–700),
#   JetBrains Mono (500–700), Noto Sans Arabic (400–700).
# (No @fontsource needed for these — local files + next/font/local, like the Inter setup.)

# OPTIONAL, only if scroll/stagger orchestration across the whole app gets unwieldy:
pnpm --filter web add motion        # 12.x — import from "motion/react"

# ROUTINES — NO package. Configure a Claude Code Remote routine in the dashboard +
# add apps/jobs/src/jobs/analyze.ts that runs through the existing dispatch.ts/runJob.ts.

# BACKTEST — NO package. New code under packages/core (engine) reusing packages/indicators
# + the shipped replayOutcome. Optional Wilson-interval helper = ~15 lines, no dep.
```

---

## DESIGN — animation decision matrix (the core question)

Verdict per mock feature. **CSS/zero-dep wins for every one.**

| Mock feature (selector) | How the mock does it | Recommended reconstruction | Lib? |
|---|---|---|---|
| Ticker **marquee** (`.marquee-track`, duplicated ticks) | CSS `@keyframes` translateX loop on a duplicated track | Pure CSS keyframes + `will-change: transform`; pause on `prefers-reduced-motion`. RTL: reverse direction under `[dir=rtl]`. | **No** |
| **Score rings / gauges** (`.ring svg`, `.gauge-big`, `stroke-dasharray`) | SVG `stroke-dasharray`/offset + CSS transition; `data-score` sets final dash | SVG + CSS `transition: stroke-dashoffset`; set target via inline style or 1-line `useEffect`. Color is OKLCH per score band. | **No** |
| **Count-up numbers** (`data-count`, `data-suffix`) | `landing.js` rAF easing 0 → value when in view | `requestAnimationFrame` easing helper (~25 LOC), triggered by IntersectionObserver. | **No** (vanilla) |
| **Scroll-reveal** (`.reveal`, `.reveal.d1/d2`) | IntersectionObserver toggles a class; CSS transitions; `.d1/.d2` = stagger delays | `IntersectionObserver` adding `.is-visible`; CSS handles transition + delay classes. ~30 LOC, one observer reused app-wide. | **No** (vanilla) |
| **Mouse-tilt cards** (`.tilt[data-tilt]`, `.mock`, `.signal-demo`, `.price-card`) | `mousemove` → `rotateX/rotateY`, `data-tilt`=max deg | `mousemove`/`mouseleave` handler computing rotation from pointer offset; `transform-style: preserve-3d`. Disable on touch + reduced-motion. ~30 LOC. | **No** (vanilla) |
| **Parallax hero layers** (`.layer[data-depth]`, float-cards, `data-rain`) | `mousemove`/scroll translates layers by `data-depth` factor | Same pointer handler outputs per-layer `translate3d` scaled by depth. Data-rain = CSS animation on generated spans (or a tiny canvas if perf demands). | **No** (vanilla) |
| **3D globe** (`.globe`, `.atmo`, `.hero-aura`, `.hero-grid`) | Pure CSS: radial/conic gradients + `border-radius:50%` + blur; grid is a CSS background | Pure CSS gradients + `border-radius` + `filter: blur`. **No three.js / WebGL.** It is a stylised disc, not a textured sphere. | **No** |
| **Progress bar** (`#progress`) | scroll-linked width | CSS `animation-timeline: scroll()` (modern) or 3-line scroll listener fallback. | **No** |
| **Theme toggle** `volt`/`green` (`#theme-toggle`, `data-theme`) | sets `data-theme` on root | Reuse v2.0 `next-themes` but with `attribute="data-theme"` + `themes={['volt','green']}`; no-flash already solved in v2.0 P2. | **No** (reuse) |

**Why not a lib by default:** the entire set is CSS-transform + IntersectionObserver + rAF. A library buys declarative ergonomics, not capability. Bundle cost (motion ≈ 30–40 kB, GSAP ≈ 50 kB+) is unjustified for a MENA mobile audience when ~120 LOC of guarded vanilla does it. Keep helpers in `apps/web/lib/anim/` as small client modules, each `prefers-reduced-motion`-aware.

**When `motion` becomes justified:** if the rebrand mandates consistent staggered reveals + shared-layout transitions across *member + academy + admin* and the hand-rolled observer turns into copy-paste sprawl. Then adopt `motion` (not GSAP — see What NOT to Use) with `LazyMotion`. This is a Phase-level decision — flag it, don't pre-commit.

### Fonts — concrete wiring

- 5 families self-hosted via `next/font/local`, each exposing a CSS variable. Subset to mock weights (Archivo 600–900, Chakra Petch 600/700, Space Grotesk 300–700, JetBrains Mono 500–700, Noto Sans Arabic 400–700).
- **Noto Sans Arabic** = the AR (RTL) face. Decide in requirements whether it *replaces* v2.0's IBM Plex Sans Arabic or co-exists — prefer replace, to keep the weight budget lean. Don't ship both unless a fallback is required.
- Map vars in Tailwind v4 `@theme`: `--font-display: var(--font-archivo)`, `--font-mono: var(--font-jetbrains)`, etc. Latin display (Archivo/Chakra/Space Grotesk) for LTR; Noto Sans Arabic auto-applied under `[lang=ar]`/`[dir=rtl]`.
- `display: 'swap'` + `adjustFontFallback` to kill CLS.

### OKLCH multi-theme + RTL with Tailwind v4

- Tokens declared once in `@theme` as OKLCH (matches mock literals). `volt`/`green` are attribute-scoped overrides: `[data-theme=green] { --primary: oklch(...); --buy: ...; }`.
- The mock keys colour off semantic vars (`--primary`, `--buy`, `--sell`, `--surface`, `--surface-solid`, `--line`, `--line-soft`, `--sub`, `--mute`, `--bg2`, `--accent`, `--text`) — replicate that exact token list so both themes are pure var swaps.
- RTL unchanged from v2.0: logical properties + `dir` on `<html>` (next-intl ar→rtl). Marquee/tilt/parallax handlers must read `dir` to mirror direction.

---

## ROUTINES — what's actually required (no API key, no new dep)

**Confirmed from `docs/routines-claude.md` + PROJECT.md:** the analysis intelligence is the Claude Code *agent itself* running a scheduled **Remote routine**. There is **NO npm package** and **NO Anthropic API key**. The routine simply executes the existing `tsx` dispatcher; Claude provides the veteran reasoning during the run.

| Requirement | Mechanism | New dep? |
|---|---|---|
| Run reasoning without API key | Claude Code scheduled **Remote routine** (cloud), Max plan, ~15 runs/day **shared** with interactive sessions | None |
| Secrets in the cloud run | **Environments** (encrypted `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`); `dispatch.ts` already loads `dotenv/config` (no-op in cloud) | None |
| DB access | `supabase-js` over HTTPS (the `.mcp.json` stdio MCP is NOT available in Remote runs — documented) | None (reuse) |
| The job itself | NEW `apps/jobs/src/jobs/analyze.ts` = `snapshot → analyze → persist.ts`, idempotent, writes `job_runs` | None (new code) |
| Idempotency / monitoring | Existing `runJob.ts` (startRun/finishRun) + `job_runs` + stale flag | None (reuse) |

### Choosing day vs swing windows — "the engine picks the timing"

Two layers, neither needs a package:

1. **Schedule layer (when the routine fires):** define routine cron windows in the Claude dashboard aligned to `docs/routines-claude.md §6` UTC session times — e.g. `22:30` post-NY (swing / D & H4), `09:15` post-London open (day), `00:15` post-Binance close (crypto daily). This bounds the ~15 runs/day quota.
2. **Selection layer (which instruments/styles are opportune *within* a run):** a deterministic TS selector in `packages/core` scores candidate (instrument, style, timeframe) tuples by session activity + data freshness (`v_data_freshness`) + last-analysis recency; the agent reasons over the shortlist. Pure TS — `luxon` (ALREADY installed) handles session/DST math. **No scheduler lib.** `croner` (installed) stays as the local backup-daemon option; Windows Task Scheduler as deterministic-ingestion backup.

**Quota guardrail (design constraint, not a lib):** ingestion jobs keep running via Task Scheduler so they never burn the 15 agent runs. Only the `analyze` job consumes agent quota. This split is already documented — v2.1 just activates the analyze routine and lifts the v1.0 P4 debt ("configure routines + 1 real run").

---

## BACKTEST — pure TS, reuse what exists

**Verdict: no new package.** v2.0 P5 already shipped the outcome primitive (`replayOutcome`, first-touch, golden-tested: `hit_tp`/`hit_sl`/`flat` + R), plus `prediction_outcomes`, the `pattern_stats` view, and the public N≥30 gating. The backtest is the same machinery pointed at *historical* candles instead of live ones.

| Need | Solution | New dep? |
|---|---|---|
| Replay a pattern catalogue over history | NEW headless engine in `packages/core` (e.g. `backtest/`) iterating stored `candles`, detecting patterns via existing `packages/indicators` (incl. home-made market-structure: BOS/CHoCH/swings), generating setups, resolving with **the existing `replayOutcome`** | None |
| Compute win-rate per pattern | Count `hit_tp` vs resolved → proportion. Seed `pattern_stats` (same shape the live loop already feeds) | None |
| Confidence / honesty (N visible, N≥30) | **Wilson score interval** for the proportion — ~15 LOC pure math, golden-testable. Honest band, not a bare point estimate. No stats package. | None |
| Candle source | Already in Supabase `candles` (v2.0 P2 ingestion). Replay is read-only over history. | None |
| Determinism / no look-ahead | Anti look-ahead constants (v1.0 P1, 16 golden values) already enforce no future leak — reuse in the replay loop. | None |

**Statistical helpers:** resist `simple-statistics`/`jstat`. The only non-trivial stat is a binomial CI (Wilson) — write it, golden-test against known values (e.g. p̂=0.7, n=30 → known bounds). Everything else is counting. A stats lib would be dead weight for one formula and dilutes the "every number measured and traceable" guarantee.

**Integration point:** backtest writes into the *same* `pattern_stats`/`prediction_outcomes` surfaces the live `outcome-tracker` uses, so the public "% mesuré dès J1" block (already built) shows backtest numbers first, then live outcomes take over as N grows — exactly the PROJECT.md decision. Run it as a one-shot `tsx` job (Task Scheduler / manual) — deterministic, no reasoning → **no agent quota consumed**.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Vanilla CSS + IO/rAF helpers | `motion` 12.x | If staggered reveals + shared-layout transitions are needed consistently across member+academy+admin and hand-rolled IO becomes maintenance sprawl. Adopt with `LazyMotion`. |
| Vanilla CSS + IO/rAF helpers | `GSAP` 3.x | Essentially never here. GSAP shines for complex timelines/scrubbing; overkill + heavier than motion for reveal/tilt/marquee. Only for a future cinematic scrollytelling section. |
| Pure CSS globe (gradients) | `three.js` / R3F (WebGL) | Only if the brand later demands a real textured/interactive 3D globe. The mock globe is a stylised CSS disc — WebGL = large bundle + mobile battery cost for zero current benefit. |
| `next/font/local` (self-host) | `@fontsource/*` packages | If you prefer npm-managed font files. v2.0 uses `@fontsource/ibm-plex-sans-arabic` — acceptable, but `next/font/local` gives better CLS control + the CSS-var ergonomics Tailwind `@theme` wants. |
| Hand-written Wilson interval | `simple-statistics` / `jstat` | If the backtest later needs many stats (Sharpe, drawdown distributions, t-tests). For one CI formula, don't. |
| Claude scheduled routine (no key) | Anthropic API key + cloud cron | At paid public launch when 24/7 reliability for paying subscribers outweighs cost (already flagged in PROJECT.md as the post-launch migration). Out of scope for v2.1. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `framer-motion` (the old package name) | Renamed/superseded by `motion`; importing the old name invites version confusion | `motion` (`import { motion } from "motion/react"`) — and only if actually needed |
| `GSAP` for this milestone | 50 kB+, plugin licensing nuance, timeline power unused by reveal/tilt/marquee | CSS + vanilla, or `motion` |
| `three.js` / `@react-three/fiber` for the hero globe | Heavy WebGL bundle + mobile cost; the mock globe is pure CSS | CSS radial/conic gradients + blur |
| `react-fast-marquee` / `embla` for the ticker | A duplicated CSS-keyframe track is smaller and is the mock's own approach | CSS `@keyframes` translateX |
| Google Fonts CDN `<link>` (as in the raw mock) | Render-blocking, third-party request, CLS, privacy/latency for MENA | `next/font/local` self-host, `display:swap` |
| Any stats package for the backtest | Only one non-trivial formula (Wilson) needed; dilutes "every number measured" provenance | ~15 LOC hand-written + golden test |
| Anthropic API key / SDK in v2.1 | Out of scope; intelligence = scheduled agent on Max plan | Claude Code Remote routine running existing `tsx` job |
| `node-cron` / new scheduler dep for routine windows | TZ/DST handling weaker; routine timing lives in the Claude dashboard + luxon selector | Claude routine schedule + `luxon` (installed) + `croner` (installed) backup |
| `tailwindcss-rtl` plugin | Tailwind v4 logical properties already give RTL; v2.0 deliberately avoided it | Logical properties + `dir` (next-intl ar→rtl) |
| Burning agent quota on ingestion/backtest | 15 runs/day shared; deterministic jobs don't need reasoning | Windows Task Scheduler / plain `tsx` runs |

---

## Stack Patterns by Variant

**If the rebrand stays landing-page-centric (likely first):**
- Zero new deps. Vanilla helpers in `apps/web/lib/anim/`, Tailwind `@theme` tokens, `next/font/local`.
- Because the cost/benefit of an animation lib is negative for a single-surface reconstruction.

**If staggered motion must be uniform across member + academy + admin:**
- Add `motion` 12.x with `LazyMotion` + `domAnimation`; keep marquee/rings/globe in CSS regardless.
- Because declarative orchestration beats duplicated IO handlers at app scale — but only the reveal/stagger layer, not the bespoke SVG/CSS art.

**If a "replay over history" preview UI is requested for backtest:**
- Reuse `lightweight-charts` v5 (installed) to scrub historical candles + plotted setups; engine stays headless.
- Because no new charting dep is justified.

**If 24/7 reliability becomes mandatory at paid launch:**
- Migrate the analyze routine to an Anthropic API key + cloud cron (Vercel Cron / GitHub Actions), keeping `dispatch.ts`/`persist.ts` unchanged.
- Because Max-plan shared quota (15/day) is a launch-time risk already logged in PROJECT.md.

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `motion` 12.x (IF adopted) | React 19 / Next 15 | ESM, `motion/react` entry. Use `LazyMotion` to cap bundle. No conflict with existing deps. Verify peer `react@^19` at install. |
| `next/font/local` | Next 15 / React 19 | Built-in; no version pin. Generates fallback metrics for CLS. |
| Tailwind v4 `@theme` OKLCH | `tailwindcss 4.3.1` (installed) | OKLCH-native; `data-theme` attribute overrides for volt/green. shadcn v4 tokens must use the same OKLCH var set. |
| `next-themes 0.4.6` (installed) | `attribute="data-theme"`, `themes={['volt','green']}` | Reuse v2.0 no-flash pattern; switch class→data-attribute to match the mock. |
| Backtest engine (new TS) | `packages/indicators` + `replayOutcome` (v2.0 P5) | Same ESM/tsx runtime; golden-test with Vitest 4.1.8. |
| Claude Remote routine | `supabase-js 2.108.0` only (no MCP in cloud) | Documented constraint; `dispatch.ts` already `dotenv/config`-loads. |

---

## Sources

- `Nexa - Landing.html` (repo root) — full markup of every animation/feature; confirms vanilla `landing.css`+`landing.js`, no framework/anim-lib in the mock; OKLCH literals; `data-theme` volt/green; the 5 font families — **HIGH** (primary source)
- `docs/routines-claude.md` — Remote routine model, no API key, Environments secrets, supabase-js-only, 15 runs/day shared quota, UTC session windows — **HIGH** (project doc)
- `.planning/PROJECT.md` — v2.1 scope, locked stack, backtest→pattern_stats decision, fonts list, themes, rebrand MERA→NEXA — **HIGH** (project source)
- `apps/web/package.json` + root `package.json` — current installed deps (Tailwind 4.3.1, next-themes 0.4.6, tw-animate-css 1.4.0, lightweight-charts 5.2.0, luxon, croner, Vitest 4.1.8, Playwright 1.60.0) — **HIGH** (repo)
- WebSearch `motion` npm (2026) — latest 12.40.0, successor to framer-motion, `motion/react` + vanilla `animate`, React/Next compatible — **MEDIUM** (single search; verify peer at install) — https://www.npmjs.com/package/motion · https://motion.dev/docs/react-installation
- Wilson score interval — standard binomial CI for the N-visible honesty band — **HIGH** (established method)

---
*Stack research for: v2.1 — NEXA identity (design system reconstruction) · routines d'analyse Claude sans clé API · backtest + track record en prod*
*Researched: 2026-06-20*
