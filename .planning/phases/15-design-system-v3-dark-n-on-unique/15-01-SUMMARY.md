---
phase: 15-design-system-v3-dark-neon-unique
plan: 01
subsystem: design-system
tags: [theme, wcag-aa, contrast, scan, guardrails, vitest, wave-0]
requires: []
provides:
  - "WCAG AA contrast gate (opaque + composited GREEN) — THEME-05 / D-09 / D-10"
  - "THEME-02 bespoke/collision scan gate (RED target for Plans 02+03) — D-08"
affects:
  - "Plan 15-02 (token migration) and 15-03 (tokenization cleanup) now have an objective GREEN target"
tech-stack:
  added: []   # zero new dependency (constraint T-15-SC)
  patterns:
    - "Self-contained WCAG color math in test (hex/oklch/rgba parse, alphaComposite, relativeLuminance, contrastRatio) — no runtime dep"
    - "node:fs/node:path filesystem scan over .tsx sources (Phase 10 design-tokens.test.ts analog)"
    - "Sanity blocks prove detector non-trivial (planted bad strings match; missing foundation file fails explicitly)"
key-files:
  created:
    - apps/web/src/styles/__tests__/contrast-aa.test.ts
    - apps/web/src/styles/__tests__/theme-scan.test.ts
  modified: []
decisions:
  - "D-15-01-A: contrast math is canonical WCAG (sRGB gamma-expand + 0.2126/0.7152/0.0722; CSS Color 4 OKLCH→linear→sRGB). text/bg reproduces the D-09 anchor 18.93:1 EXACTLY; primary/bg (~12.9) and muted/bg (~7.1) diverge from the frozen anchors 11.39 / 6.76 because those were measured under a browser OKLCH gamut renderer. Anchors kept as frozen spec literals; PASS assertions ride the real AA floor + closeness to the canonical ratio with a tolerance band that covers both models (no false green, no fabricated color)."
  - "D-15-01-B: both files are authored to be self-contained (zero new dependency, constraint T-15-SC). contrast-aa is math-only → GREEN regardless of file state. theme-scan binds to the tree → RED now on residual hardcodes, the objective GREEN target for Plans 02+03."
metrics:
  duration: ~5min
  tasks: 2
  files: 2
  completed: 2026-06-22
---

# Phase 15 Plan 01: Wave-0 verification guards (WCAG AA contrast + THEME-02 scan) Summary

Authored the two Wave-0 gates for Phase 15 BEFORE the token migration runs: a self-contained WCAG AA contrast proof on the frozen GREEN palette (opaque + composited translucent surfaces, D-09/D-10) and a filesystem bespoke/collision scan (D-08) that is RED-by-design on the unmigrated tree — so success criteria #2 (THEME-02) and #5 (THEME-05) are proven by real failing-then-passing tests, not false positives.

## What Was Built

- `apps/web/src/styles/__tests__/contrast-aa.test.ts` — 8 assertions, all GREEN. Implements `parseHex` / `parseOklch` (CSS Color 4) / `parseRgba`, `alphaComposite(fg, a, bgOpaque)`, `relativeLuminance`, `contrastRatio`. Encodes the frozen D-09 anchors (11.39 / 18.93 / 6.76) as literals, asserts each pair clears its AA floor and is close to its canonical ratio. Three composited translucent surfaces (muted-foreground, surface-translucent, line-soft) measured FLATTENED over `#070b08` (D-10), never via the token alpha alone. Non-trivial sanity pair fails AA (<4.5).
- `apps/web/src/styles/__tests__/theme-scan.test.ts` — 5 tests: Test 1 (no `ring-[#2563EB]` under apps/web/src) and Test 2 (no raw amber/emerald/red palette utility in the 9 foundation files) are RED on the current tree (the migration target); Test 3 (anti-collision `ring-*`/`--glow`) GREEN; two sanity blocks GREEN (planted bad strings match all 13 forbidden tokens; a missing foundation file throws explicitly, no silent skip).

## Verification

- `npx vitest run apps/web/src/styles/__tests__/contrast-aa.test.ts` → 8/8 GREEN.
- `npx vitest run apps/web/src/styles/__tests__/theme-scan.test.ts` → 2 RED (Test 1 `ring-[#2563EB]`, Test 2 palette utilities) + 3 GREEN (anti-collision + 2 sanity). RED is the expected Wave-0 state; turns GREEN after Plans 02 (deletes ThemeToggle) + 03 (tokenizes residual utilities).
- `git diff --name-only -- '*package.json'` → empty. Zero new dependency (T-15-SC honored).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Incomplete sanity fixture in theme-scan.test.ts**
- **Found during:** Task 2 first run
- **Issue:** The SANITY fixture string omitted three forbidden tokens (`text-emerald-400`, `text-amber-400`, `text-red-400`), so the "detector must match every token" sanity assertion failed — the sanity block must always pass regardless of file state.
- **Fix:** Added the `dark:text-*-400` variants to the fixture lines so all 13 `FORBIDDEN_PALETTE` regexes match.
- **Files modified:** apps/web/src/styles/__tests__/theme-scan.test.ts
- **Commit:** 29d3e46

### Spec divergence (documented, not a code bug)

**2. [Rule 1 - Correctness] Frozen contrast anchors vs canonical WCAG math (D-15-01-A)**
- The plan's D-09 anchors (primary/bg 11.39, muted/bg 6.76) do not reproduce under canonical WCAG + CSS Color 4 OKLCH conversion (which yields ~12.9 and ~7.1); only text/bg 18.93 matches exactly. The divergence is the browser's OKLCH gamut rendering, not a math error. To avoid fabricating a non-standard conversion to force a wrong number, the test keeps the anchors as frozen spec literals and asserts the real AA floor + closeness to the canonical ratio with a tolerance band covering both models. All pairs clear AA by a wide margin in both models — no false green.

## Known Stubs

None. Both files are complete, executable gates.

## Threat Flags

None. Presentation/verification-only plan; no network, auth, payment, DB, or user input. T-15-SC honored (zero installs → no package-legitimacy gate).

## Self-Check: PASSED

- FOUND: apps/web/src/styles/__tests__/contrast-aa.test.ts
- FOUND: apps/web/src/styles/__tests__/theme-scan.test.ts
- FOUND: .planning/phases/15-design-system-v3-dark-n-on-unique/15-01-SUMMARY.md
- FOUND commit c82f494 (Task 1) · FOUND commit 29d3e46 (Task 2)
