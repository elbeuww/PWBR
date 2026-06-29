---
phase: 19-dashboard-utilisateur
reviewed: 2026-06-26T00:00:00Z
depth: standard
files_reviewed: 21
files_reviewed_list:
  - apps/web/src/components/dash/WatchlistToggle.tsx
  - apps/web/src/components/dash/KeysetList.tsx
  - apps/web/src/components/dash/DashShell.tsx
  - apps/web/src/components/dash/AffiliateSummaryCard.tsx
  - apps/web/src/components/dash/PasswordChangeForm.tsx
  - apps/web/src/components/dash/NotificationPreferences.tsx
  - apps/web/src/lib/watchlist/queries.ts
  - apps/web/src/lib/keyset/cursor.ts
  - apps/web/src/lib/signals/searchParams.ts
  - apps/web/src/app/[locale]/(dash)/layout.tsx
  - apps/web/src/app/[locale]/(dash)/dashboard/page.tsx
  - apps/web/src/app/[locale]/(dash)/dashboard/abonnement/page.tsx
  - apps/web/src/app/[locale]/(dash)/dashboard/parametres/page.tsx
  - apps/web/src/app/[locale]/(dash)/dashboard/suivis/page.tsx
  - apps/web/src/app/[locale]/(dash)/dashboard/historique/page.tsx
  - apps/web/src/app/[locale]/(dash)/dashboard/watchlist/page.tsx
  - apps/web/src/app/[locale]/(member)/signaux/page.tsx
  - apps/web/src/app/[locale]/(member)/signaux/[id]/page.tsx
  - apps/web/src/components/signals/SignalCard.tsx
  - apps/web/src/components/signals/SignalDetail.tsx
  - supabase/migrations/0020_user_followed_setups.sql
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: warnings_resolved
resolved:
  fixed_at: 2026-06-26T00:00:00Z
  warnings_fixed: 5
  warnings_skipped: 0
  fix_report: .planning/phases/19-dashboard-utilisateur/19-REVIEW-FIX.md
---

# Phase 19: Code Review Report

**Reviewed:** 2026-06-26
**Depth:** standard
**Files Reviewed:** 21
**Status:** issues_found

## Summary

Phase 19 delivers the `(dash)` route group (requireUser gate), the `user_followed_setups` table with RLS, keyset cursor pagination, and WatchlistToggle. The security-critical path — anti-IDOR insert, anon-client reads, cursor sanitization before PostgREST interpolation — is implemented correctly. No critical security vulnerabilities found.

Five quality/correctness bugs were found: the most impactful is a logic error in both Suivis and Historique pages where an RPC failure cannot be distinguished from a false result, causing active subscribers with 0 follows to see the renewal CTA. A second notable issue is a broken nav link — the `affiliation` item in DashShell points to `/dashboard/affiliation` which has no corresponding page in the (dash) route group.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: `has_active_subscription` RPC null treated as `false` — active subscriber sees renewal banner on empty list

**File:** `apps/web/src/app/[locale]/(dash)/dashboard/suivis/page.tsx:85-101` and `apps/web/src/app/[locale]/(dash)/dashboard/historique/page.tsx:76-100`

**Issue:** When `data.length === 0`, both pages make a secondary RPC call and check `if (!hasActive)`. The destructured `{ data: hasActive }` is `null` when the RPC errors (network failure, DB error, policy bug). `!null === true`, so an active subscriber with zero followed setups sees the renewal banner + "Renouveler" CTA instead of the correct empty-follows state. The `error` field from the RPC is silently ignored.

**Fix:**
```typescript
// Replace:
const { data: hasActive } = await supabase.rpc('has_active_subscription')
if (!hasActive) { return <renewal> }

// With:
const { data: hasActive, error: rpcError } = await supabase.rpc('has_active_subscription')
// On RPC error, fall through to empty state — better UX than false renewal banner.
if (!rpcError && hasActive === false) { return <renewal> }
```

---

### WR-02: `isActive` in DashShell doesn't match `/dashboard/historique` to the "suivis" nav item

**File:** `apps/web/src/components/dash/DashShell.tsx:57-60`

**Issue:** `isActive('/dashboard/historique', '/dashboard/suivis')` evaluates to `false` — the pathname neither equals `/dashboard/suivis` nor starts with `/dashboard/suivis/`. Users navigating to historique via the KeysetTabs within Suivis see no active nav item in either sidebar or bottom-nav. Historique is a sub-view of Suivis (D-19-02-A), not a top-level route.

**Fix:**
```typescript
function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === href
  // Historique is a sub-view of Suivis — treat as active when on either.
  if (href === '/dashboard/suivis') {
    return pathname === href || pathname.startsWith(`${href}/`) || pathname === '/dashboard/historique'
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}
```

---

### WR-03: Missing `/dashboard/affiliation` page — nav link 404s for all users

**File:** `apps/web/src/components/dash/DashShell.tsx:49`

**Issue:** `NAV_ITEMS` includes `{ key: 'affiliation', href: '/dashboard/affiliation' }`, but no `(dash)/dashboard/affiliation/page.tsx` exists in the reviewed file set. The existing affiliate dashboard lives at `/affiliation/dashboard` (separate route group, gate `requireRole('affiliate')`). D-10 specifies "carte résumé uniquement... avec lien vers le dashboard affilié dédié (route existante affiliation/dashboard)". The nav link either points to the wrong URL or a page was left unimplemented.

**Fix (option A — redirect page):**
Create `apps/web/src/app/[locale]/(dash)/dashboard/affiliation/page.tsx`:
```typescript
import { redirect } from '@/i18n/navigation'
import { getLocale } from 'next-intl/server'

export default async function DashAffiliationPage() {
  const locale = await getLocale()
  redirect({ href: '/affiliation/dashboard', locale })
}
```

**Fix (option B — fix the href):**
```typescript
{ key: 'affiliation', href: '/affiliation/dashboard', Icon: Share2 },
```
Note: option B changes which route group handles the nav; option A keeps the user in the dash shell.

---

### WR-04: `BigInt(data.revenue_total_atomic ?? '0')` throws on empty string

**File:** `apps/web/src/components/dash/AffiliateSummaryCard.tsx:56`

**Issue:** `??` nullish-coalesces `null`/`undefined` but NOT empty string `''`. If the `affiliate_dashboard` view returns `revenue_total_atomic = ''` (e.g., malformed view or edge case aggregate), `BigInt('')` throws a `SyntaxError`, crashing the RSC render. The error propagates to the nearest error boundary, breaking the overview page for affiliates.

**Fix:**
```typescript
// Replace:
const revenue = `${formatAtomic(BigInt(data.revenue_total_atomic ?? '0'))} ${unit}`

// With:
const rawAtomic = data.revenue_total_atomic || '0'  // covers null, undefined, ''
const revenue = `${formatAtomic(BigInt(rawAtomic))} ${unit}`
```

---

### WR-05: Two `<nav>` landmarks share identical `aria-label` in DashShell

**File:** `apps/web/src/components/dash/DashShell.tsx:70` and `apps/web/src/components/dash/DashShell.tsx:101`

**Issue:** Both the sidebar `<nav>` and the mobile bottom `<nav>` receive `aria-label={t('overview')}`. Screen reader users navigating by landmarks (NVDA/JAWS "list of landmarks") see two navigation regions with the same name and cannot distinguish between them. WCAG 2.1 success criterion 2.4.6 (Headings and Labels) and the ARIA spec both require landmark labels to be unique when multiple instances of the same role exist.

**Fix:**
```tsx
// Sidebar nav — line 70
<nav aria-label={t('nav.sidebarLabel')} className="flex flex-col gap-1 p-4">

// Bottom nav — line 101
<nav aria-label={t('nav.bottomLabel')} className="fixed inset-inline-0 bottom-0 ...">
```
Add `nav.sidebarLabel` and `nav.bottomLabel` keys to all locale namespaces (`dash.nav.*`).

---

## Info

### IN-01: Dead `sr-only` locale span in KeysetList

**File:** `apps/web/src/components/dash/KeysetList.tsx:145`

**Issue:** `<span className="sr-only">{locale}</span>` renders the locale string ("fr", "ar", "en") into the accessibility tree without any context. Screen reader users hear the locale code announced as content. The `locale` prop is declared in `KeysetListProps` and used only here — it has no other purpose in this component (no date formatting, no link prefix).

**Fix:** Remove the span and the `locale` prop from `KeysetListProps` if unused, or use it for actual purpose (e.g., `Intl` formatting of dates in list items).

---

### IN-02: Duplicate `capitalize` function in SignalCard and KeysetList

**File:** `apps/web/src/components/signals/SignalCard.tsx:152-154` and `apps/web/src/components/dash/KeysetList.tsx:36-38`

**Issue:** Identical function defined twice. If the logic ever needs to change (e.g., locale-aware capitalization), both copies must be updated.

**Fix:** Extract to `apps/web/src/lib/utils/string.ts` and import from both callers.

---

### IN-03: Dead `tab` field in `WatchlistParamsSchema`

**File:** `apps/web/src/lib/signals/searchParams.ts:96-99`

**Issue:** `WatchlistParamsSchema` and `parseWatchlistParams` include a `tab` field (`TabEnum`), but neither `SuivisPage` nor `HistoriquePage` consume it — each page determines its own tab by route path, not query param. The destructuring in both pages is `const { cursor } = parseWatchlistParams(...)`. The `tab` field is dead schema weight that could mislead future maintainers.

**Fix:** Remove `tab` / `TabEnum` from `WatchlistParamsSchema` and `parseWatchlistParams`, or document explicitly why it is kept for future use.

---

### IN-04: Unsafe `JSON.parse` cast in `NotificationPreferences`

**File:** `apps/web/src/components/dash/NotificationPreferences.tsx:32`

**Issue:** `JSON.parse(raw) as Partial<Prefs>` is an unchecked cast. If localStorage contains `{"newSignals":"true","expiry":1}` (malformed — strings/numbers instead of booleans), the `?? DEFAULT_PREFS.*` fallback only triggers on `null`/`undefined`, not on wrong types. The checkbox `checked` prop would receive a string or number, producing a React controlled-component type mismatch warning in development.

**Fix:** Validate with a Zod schema instead of casting:
```typescript
const PrefsSchema = z.object({
  newSignals: z.boolean().optional(),
  expiry: z.boolean().optional(),
})
// ...
const result = PrefsSchema.safeParse(JSON.parse(raw))
const p = result.success ? result.data : {}
return {
  newSignals: p.newSignals ?? DEFAULT_PREFS.newSignals,
  expiry: p.expiry ?? DEFAULT_PREFS.expiry,
}
```

---

_Reviewed: 2026-06-26_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
