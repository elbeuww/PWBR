---
phase: 15-design-system-v3-dark-neon-unique
plan: 02
subsystem: design-system
tags: [theme, dark-mode, i18n, oklch, tailwind-v4, next-themes, rtl]
requires:
  - "15-01 (frozen GREEN target values, theme-scan RED gate, contrast-aa harness)"
provides:
  - "Frozen single GREEN dark theme: :root and .dark resolve to identical frozen GREEN values"
  - "forcedTheme=dark — no light path, ThemeToggle deleted"
  - "theme i18n namespace purged in strict trilingual parity"
affects:
  - "Phase 16 reskin builds on this frozen DS (no retrofit)"
tech-stack:
  added: []
  patterns:
    - "Semantic-layer promotion (D-03): .nxl[data-theme=green] literals copied verbatim into :root, NOT a mechanical .nxl de-scope (Pitfall #1)"
    - "Phase-15 exception to var()-only Layer 2 rule: frozen HEX/OKLCH literals live in :root/.dark because the layer no longer flips"
    - ".dark reconciled to == :root so forcedTheme=dark cannot surface inherited navy"
key-files:
  created: []
  modified:
    - "apps/web/src/styles/globals.css (frozen GREEN :root + .dark)"
    - "apps/web/src/app/[locale]/layout.tsx (forcedTheme=dark, ThemeToggle removed)"
    - "apps/web/src/messages/fr.json (top-level theme namespace removed)"
    - "apps/web/src/messages/en.json (top-level theme namespace removed)"
    - "apps/web/src/messages/ar.json (top-level theme namespace removed)"
    - "apps/web/src/messages/__tests__/theme-parity.test.ts (inverted: asserts absence)"
  deleted:
    - "apps/web/src/components/ThemeToggle.tsx"
decisions:
  - "D-15-02-A: theme-scan.test.ts (THEME-02 RED gate from 15-01) intentionally stays RED — its offending files (LanguageSwitcher + admin/affiliation pages) are Phase 16 reskin surface, out of 15-02 scope. Logged to deferred-items.md."
  - "D-15-02-B: extended custom props (--background-alt/--surface-translucent/--line-soft/--muted-tertiary/--glow) promoted alongside the shadcn-named tokens; signals (--signal-*) and brand accents (--accent-brand/--risk-moderate) kept distinct via primitives (D-05)."
metrics:
  duration: ~8min
  tasks: 3
  files: 7
  completed: 2026-06-22
---

# Phase 15 Plan 02: Frozen Single GREEN Dark Theme Summary

Froze the platform to a single GREEN dark theme by promoting the `.nxl[data-theme="green"]` semantic values verbatim into `:root`, reconciling `.dark` to identical frozen values, setting `forcedTheme="dark"`, deleting `ThemeToggle`, and purging the dead `theme` i18n namespace in strict trilingual parity — RTL untouched.

## What Was Built

- **Task 1 — globals.css (commit b9ff5b5):** Replaced the Layer-2 `:root` light values with frozen GREEN literals (`--background:#070b08`, `--primary:oklch(0.84 0.18 150)`, `--primary-foreground:#051009`, `--destructive:oklch(0.68 0.2 24)`, `--glow:oklch(0.84 0.18 150 / 0.55)`, etc.) and added the extended custom props. Reconciled `.dark` to the SAME frozen GREEN so the forced `.dark` class never flips to the legacy `--nexa-ink`/`--nexa-neutral-800` navy. `.dark` selector kept present (D-06). Layer 1 `@theme`, Layer 3 `@theme inline`, and `:lang(ar)` byte-unchanged.
- **Task 2 — layout.tsx + ThemeToggle (commit 09e4112):** `ThemeProvider` changed to `forcedTheme="dark"` (removed `defaultTheme`/`enableSystem`); deleted the import and the `<ThemeToggle />` render; deleted `apps/web/src/components/ThemeToggle.tsx`. `<html lang dir suppressHydrationWarning>` and the `dir=` ternary preserved verbatim (D-12). `LanguageSwitcher` remains the sole header control.
- **Task 3 — i18n purge + parity test (commit 5bd8f14):** Deleted the top-level `theme {toggleLabel,light,dark}` namespace in fr/en/ar in the same change; the unrelated admin-nested `theme` key preserved (1 `"theme":` occurrence remains per locale). Inverted `theme-parity.test.ts` to assert ABSENCE of the top-level namespace across all three locales.

## Verification

Plan verification suite — all green:
- `contrast-aa.test.ts`, `design-tokens.test.ts`, `rtl-logical-props.test.ts` — 15/15 pass (Task 1).
- `tsc -b --force` — 0 non-baseline errors, 0 ThemeToggle references (Task 2). Baseline = pre-existing `forbidden-service-import.ts` fixture + `packages/supabase/database.types.ts` (D-01-02-DEFER).
- `theme-parity.test.ts` (inverted) — 2/2 pass; all three JSON files valid (Task 3).

## Deviations from Plan

### None to the planned tasks

All three tasks executed as written. No Rule 1-4 auto-fixes were required inside plan scope.

### Out-of-scope discovery (logged, not fixed)

`theme-scan.test.ts` (THEME-02 RED gate authored in 15-01, commit 29d3e46) fails 2 assertions. Offending files (`components/LanguageSwitcher.tsx` `ring-[#2563EB]`; raw palette utilities in admin + affiliation pages) are **Phase 16 reskin surface**, NOT in this plan's `files_modified`. Per SCOPE BOUNDARY, not fixed here. Logged to `deferred-items.md`. This is the intended contract for the Phase 16 transversal reskin (RESKIN-01..06).

## Self-Check: PASSED

- globals.css frozen GREEN — FOUND
- layout.tsx forcedTheme + no ThemeToggle — FOUND
- ThemeToggle.tsx — DELETED (confirmed absent)
- fr/en/ar top-level theme namespace — REMOVED (parity)
- Commits b9ff5b5, 09e4112, 5bd8f14 — FOUND in git log
