# Deferred Items — Phase 15

> **STATUS UPDATE (orchestrator, 2026-06-22):** The item below was RESOLVED **within Phase 15 by Plan 15-03**, not deferred to Phase 16. 15-03 tokenized `LanguageSwitcher.tsx` (`ring-[#2563EB]`→`ring-ring`) and all admin/affiliation palette utilities; `theme-scan.test.ts` is now GREEN (5/5). The note below is kept for historical context only — no Phase 16 action required for THEME-02.

## From Plan 15-02 (executor, 2026-06-22)

### theme-scan.test.ts (THEME-02 RED gate) — ~~RESOLVED BY PHASE 16, not 15-02~~ (superseded: resolved by Plan 15-03)

`apps/web/src/styles/__tests__/theme-scan.test.ts` (authored RED in 15-01, commit 29d3e46)
fails 2 of its assertions. The offending files are NOT in plan 15-02's `files_modified`
scope — they belong to the Phase 16 transversal reskin (RESKIN-01..06):

- **Test 1** `ring-[#2563EB]` residual in `components/LanguageSwitcher.tsx` → must become
  `ring-ring` (focus-ring tokenisation). 15-02 deleted ThemeToggle (the other `#2563EB`
  source) but LanguageSwitcher is a reskin-surface file, not a DS-freeze file.
- **Test 2** raw palette utilities (`text-amber-*`, `text-emerald-*`, `bg-red-*`,
  `border-emerald-*/*` etc.) in admin + affiliation pages:
  - `app/[locale]/affiliation/dashboard/page.tsx`
  - `app/(admin)/signaux/page.tsx`, `app/(admin)/page.tsx`, `app/(admin)/sante/page.tsx`,
    `app/(admin)/affiliation/page.tsx`, `app/(admin)/affiliation/payouts/page.tsx`,
    `app/(admin)/file/page.tsx` (and others)

These must be tokenised during the Phase 16 reskin. Out of scope for 15-02 (DS freeze only:
globals.css :root/.dark, layout forcedTheme, theme i18n purge). Per SCOPE BOUNDARY, not fixed
here. The plan's own verification list (contrast-aa, design-tokens, rtl-logical-props,
theme-parity) is fully green.
