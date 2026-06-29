---
phase: 15-design-system-v3-dark-neon-unique
plan: 03
subsystem: design-system
tags: [theme, tokens, palette, focus-ring, admin, affiliation, track-record]
requires:
  - "globals.css semantic tokens (--ring/--popover/--border/--signal-bullish/--risk-moderate/--destructive) — Plan 01/02"
provides:
  - "Token-pure foundation surface set (LanguageSwitcher + 8 admin/affiliation/track-record surfaces)"
  - "theme-scan.test.ts Test 1 (ring) + Test 2 (palette) GREEN for this plan's files"
affects:
  - "Phase 16 reskin (foundation surfaces now token-driven, no bespoke palette)"
tech-stack:
  added: []
  patterns:
    - "Tailwind v4 arbitrary-value token utilities: text-[--signal-bullish], bg-[--risk-moderate]/10, ring-ring, bg-popover, border-border"
key-files:
  created: []
  modified:
    - apps/web/src/components/LanguageSwitcher.tsx
    - apps/web/src/app/(admin)/signaux/page.tsx
    - apps/web/src/app/(admin)/page.tsx
    - apps/web/src/app/(admin)/sante/page.tsx
    - apps/web/src/app/(admin)/affiliation/page.tsx
    - apps/web/src/app/(admin)/file/page.tsx
    - apps/web/src/app/[locale]/affiliation/dashboard/page.tsx
    - apps/web/src/app/(admin)/affiliation/payouts/page.tsx
    - apps/web/src/components/track-record/TrackRecordView.tsx
decisions:
  - "D-15-03-A: TrackRecordView red branch (value<0) mapped to text-destructive (loss role), green branch (value>0) to text-[--signal-bullish] — both branches were raw palette, plan authorizes mapping the opposite branch."
  - "D-15-03-B: green/amber status dots (bg-emerald-500 / bg-amber-500) in (admin)/page.tsx + sante/page.tsx left untouched — NOT in theme-scan FORBIDDEN_PALETTE nor in plan scope (only standalone bg-red-500 is forbidden). Surgical-change discipline."
metrics:
  duration: ~6min
  completed: 2026-06-22
---

# Phase 15 Plan 03: Tokenize residual palette + hardcoded focus ring Summary

Eliminated the residual bespoke palette and the hardcoded institutional-blue focus ring (`ring-[#2563EB]`) across LanguageSwitcher and 8 admin/affiliation/track-record surfaces, routing every status color through the semantic token layer (`--ring`, `--popover`, `--border`, `--signal-bullish`, `--risk-moderate`, `--destructive`). theme-scan Test 1 (ring) and Test 2 (palette) are GREEN for this plan's files; no-perf-claims stays green (TrackRecordView measured-% logic untouched).

## What Was Built

- **Task 1** — LanguageSwitcher.tsx: `ring-[#2563EB]` → `ring-ring` (trigger + list item), `bg-white` → `bg-popover`, `border-black/10` → `border-border`. Touch targets (`min-h-11 min-w-11`) and logical-property classes (`end-0`, `text-start`) preserved. No ring/glow collision introduced (D-08).
- **Task 2** — 5 admin files: posted/ok badges → `--signal-bullish` triple, error badge → `destructive` triple, red status dots (admin KPI + sante) → `bg-destructive`, pending badges (affiliation + file) → `--risk-moderate` triple.
- **Task 3** — affiliation/dashboard commissions-due → `text-[--risk-moderate]`, payouts due badge → `--risk-moderate` triple, TrackRecordView tone conditional → `text-[--signal-bullish]` (gain) / `text-destructive` (loss). measured-% / provenance logic untouched.

## Verification

- `theme-scan.test.ts`: 5/5 PASS (Test 1 ring + Test 2 palette GREEN across the 8 foundation files of this plan; Test 3 anti-collision green).
- `no-perf-claims.test.ts`: PASS (TrackRecordView measured-% guardrail intact).
- No change to data-fetch, gating (`is_superadmin()`/RLS), or measured-% logic — only color class strings changed (T-15-04 / T-15-05 mitigations satisfied).

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as written.

### Notes

- **D-15-03-B**: The plan only enumerated the `red` status dot for tokenization. The sibling `green: 'bg-emerald-500'` and `amber: 'bg-amber-500'` dot values are NOT in the theme-scan FORBIDDEN_PALETTE list (only standalone `bg-red-500`, plus `bg-{color}-500/10` translucent variants and `text-*-700/400` are forbidden). Left untouched per surgical-change discipline and plan scope — the scan is GREEN.

## Threat Flags

None — presentation-only class swaps. Gating/RLS/data-fetch trust boundaries preserved verbatim.

## Self-Check: PASSED

- LanguageSwitcher.tsx contains `ring-ring` (x2), `bg-popover`, `border-border`; no `ring-[#2563EB]` / `bg-white` / `border-black/10`.
- 8 admin/affiliation/track-record files: zero forbidden raw palette utility (theme-scan Test 2 GREEN).
- Commits 9cc1717, 434f8c2 present; Task 3 staged in final commit.
