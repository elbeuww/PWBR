---
phase: 19-dashboard-utilisateur
fixed_at: 2026-06-26T00:00:00Z
review_path: .planning/phases/19-dashboard-utilisateur/19-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 19: Code Review Fix Report

**Fixed at:** 2026-06-26
**Source review:** .planning/phases/19-dashboard-utilisateur/19-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5
- Fixed: 5
- Skipped: 0

## Fixed Issues

### WR-01: `has_active_subscription` RPC null treated as `false`

**Files modified:** `apps/web/src/app/[locale]/(dash)/dashboard/suivis/page.tsx`, `apps/web/src/app/[locale]/(dash)/dashboard/historique/page.tsx`
**Commit:** f534778
**Applied fix:** Destructure `error: rpcError` alongside `data: hasActive` from the RPC call; change condition from `if (!hasActive)` to `if (!rpcError && hasActive === false)`. On error, falls through to the empty-state branch instead of falsely showing the renewal banner.

### WR-02: `isActive` doesn't match `/dashboard/historique` to "suivis" nav item

**Files modified:** `apps/web/src/components/dash/DashShell.tsx`
**Commit:** 2c8f291
**Applied fix:** Added a special case in `isActive` for `href === '/dashboard/suivis'` that also returns `true` when `pathname === '/dashboard/historique'`, treating historique as a sub-view of suivis (D-19-02-A). The exact-match guard for `/dashboard` is unchanged.

### WR-03: Missing `/dashboard/affiliation` page — nav link 404s

**Files modified:** `apps/web/src/app/[locale]/(dash)/dashboard/affiliation/page.tsx` (new file)
**Commit:** 45369d3
**Applied fix:** Created server-redirect page using the exact same pattern as `watchlist/page.tsx` (`getLocale` + `redirect` from `@/i18n/navigation`). Redirects to `/affiliation/dashboard` while preserving the locale prefix. No change to the nav href in DashShell.

### WR-04: `BigInt(data.revenue_total_atomic ?? '0')` throws on empty string

**Files modified:** `apps/web/src/components/dash/AffiliateSummaryCard.tsx`
**Commit:** a8b19b4
**Applied fix:** Replaced `data.revenue_total_atomic ?? '0'` with `data.revenue_total_atomic || '0'`. The `||` operator coalesces null, undefined, and empty string `''`; `??` only coalesces null/undefined, leaving `BigInt('')` to throw a SyntaxError.

### WR-05: Two `<nav>` landmarks share identical `aria-label`

**Files modified:** `apps/web/src/components/dash/DashShell.tsx`, `apps/web/src/messages/fr.json`, `apps/web/src/messages/en.json`, `apps/web/src/messages/ar.json`
**Commit:** 9825df3
**Applied fix:** Changed sidebar `<nav>` to use `t('sidebarLabel')` and bottom `<nav>` to use `t('bottomLabel')`. Added both keys at strict 3-way parity in fr/en/ar message files:
- fr: "Navigation principale" / "Navigation rapide"
- en: "Primary navigation" / "Quick navigation"
- ar: "التنقل الرئيسي" / "التنقل السريع"

---

**Typecheck:** `pnpm typecheck` — exit 0, no errors.
**Tests:** `pnpm test` — 639 passed / 13 skipped (unchanged from baseline, messages-parity-dash and theme-scan still pass).

---

_Fixed: 2026-06-26_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
