---
phase: 16-reskin-transversal-de-toutes-les-pages
reviewed: 2026-06-23T00:00:00Z
depth: standard
files_reviewed: 27
files_reviewed_list:
  - apps/web/src/app/(admin)/affiliation/affilies/page.tsx
  - apps/web/src/app/(admin)/membres/page.tsx
  - apps/web/src/app/(admin)/page.tsx
  - apps/web/src/app/(admin)/sante/page.tsx
  - apps/web/src/app/[locale]/(account)/abonnement/page.tsx
  - apps/web/src/app/[locale]/(auth)/login/page.tsx
  - apps/web/src/app/[locale]/(auth)/signup/page.tsx
  - apps/web/src/app/[locale]/(marketing)/legal/[doc]/page.tsx
  - apps/web/src/app/[locale]/(marketing)/methodologie/page.tsx
  - apps/web/src/app/[locale]/(marketing)/paiement-bientot/page.tsx
  - apps/web/src/app/[locale]/(marketing)/tarifs/page.tsx
  - apps/web/src/app/[locale]/(member)/signaux/[id]/page.tsx
  - apps/web/src/app/[locale]/affiliation/page.tsx
  - apps/web/src/app/[locale]/dashboard/page.tsx
  - apps/web/src/components/academie/ContentCard.tsx
  - apps/web/src/components/landing/nexa-landing.css
  - apps/web/src/components/landing/NexaLanding.tsx
  - apps/web/src/components/landing/NexaLandingEffects.tsx
  - apps/web/src/components/signals/SignalCard.tsx
  - apps/web/src/components/ui/data-rain.tsx
  - apps/web/src/components/ui/glow.tsx
  - apps/web/src/styles/__tests__/lwc-recolor-intact.test.ts
  - apps/web/src/styles/__tests__/rls-unchanged.test.ts
  - apps/web/src/styles/__tests__/theme-scan.test.ts
  - apps/web/src/styles/__tests__/volt-orphan-free.test.ts
  - apps/web/src/styles/globals.css
findings:
  critical: 1
  warning: 4
  info: 4
  total: 9
status: issues_found
---

# Phase 16: Code Review Report

**Reviewed:** 2026-06-23
**Depth:** standard
**Files Reviewed:** 27
**Status:** issues_found

## Summary

UI reskin (DS v3 dark néon). Critical invariants largely hold:

- **RLS unchanged** — verified. Non-admin pages (`signaux/[id]`, `abonnement`, `dashboard`, `affiliation`, marketing, auth) all read via `lib/supabase/server` (anon client) or pre-existing allowlisted server actions. No fetch migrated to the browser client, no `service_role` leaked onto a non-admin page. Admin pages legitimately use `createAdminServiceClient` server-only.
- **CandleChart recolor** — not in this file set; the guard test (`lwc-recolor-intact.test.ts`) is intact.
- **No "MERA" brand** — none found. Brand is "NEXA" throughout.
- **Volt orphan removal** — landing migrated from `data-theme="volt"` to `data-theme="green"`; `nxl-theme-toggle` / `nexa-landing-theme` removed. The orphan guard passes.
- **RTL logical properties / ARIA / bdi** — preserved across pages.

The headline defect is a **token-binding syntax bug** that the phase's own theme-scan guard does not catch: admin pages bind CSS custom-property colors with the Tailwind v3 bracket form `bg-[--signal-bullish]`, which is invalid under the locked Tailwind v4 (CSS-first) stack. Working components in the same codebase use the correct `bg-[var(--signal-bullish)]` form. The freshness dots and status badges on admin dashboards will render uncolored.

## Critical Issues

### CR-01: Tailwind v4 custom-property color syntax is broken on admin surfaces — status colors do not render

**File:** `apps/web/src/app/(admin)/sante/page.tsx:66-70,219` and `apps/web/src/app/(admin)/page.tsx:55-59`

**Issue:** Color tokens are bound with the bracket-only form `bg-[--signal-bullish]` / `text-[--signal-bullish]` / `border-[--risk-moderate]`. Under the project's locked stack (Tailwind v4 CSS-first, see CLAUDE.md), this arbitrary-value form emits a literal `background-color: --signal-bullish`, which is **invalid CSS and is dropped by the browser** — the var is never resolved. Tailwind v4 requires either the `var()` wrapper `bg-[var(--signal-bullish)]` or the parenthesis shorthand `bg-(--signal-bullish)`. The rest of the codebase already uses the correct form (`SignalCard.tsx:61-62`, `SignalDetail.tsx:75-76,114,123`, `SignalDemo.tsx:18-19,42` all use `[var(--signal-bullish)]`), proving this is a regression, not a convention.

Consequence: the health "feux" dots (`DOT_CLASS` green/amber in `sante/page.tsx` and `page.tsx`) and the job-status "OK" badge (`sante/page.tsx:219`) render with **no fill color** — the core readability signal of the health dashboard silently breaks. `red` rows still work because they use the named token `bg-destructive`, masking the bug in casual testing.

The phase theme-scan (`theme-scan.test.ts`) does NOT catch this: it only forbids raw palette utilities (`amber/emerald/red`), so a broken token reference passes the guard while producing no color.

Note: the same broken form appears in sibling admin files outside this review's scope (`(admin)/file/page.tsx:121`, `(admin)/signaux/page.tsx:197`, `(admin)/affiliation/page.tsx:101`, `(admin)/affiliation/payouts/page.tsx:130`) — fix all occurrences together.

**Fix:**
```tsx
// sante/page.tsx + (admin)/page.tsx
const DOT_CLASS: Record<FreshnessColor, string> = {
  green: 'bg-[var(--signal-bullish)]',
  amber: 'bg-[var(--risk-moderate)]',
  red: 'bg-destructive',
}

// sante/page.tsx:219 status badge
<Badge className="border-[var(--signal-bullish)]/30 bg-[var(--signal-bullish)]/10 text-[var(--signal-bullish)]">
```
Add a guard to `theme-scan.test.ts` forbidding the `*-[--…]` bracket-only form so this class of regression surfaces.

## Warnings

### WR-01: `DataRain` injects markup via `innerHTML` (fragile pattern, latent XSS surface)

**File:** `apps/web/src/components/ui/data-rain.tsx:55-61` (also `NexaLandingEffects.tsx:38-44`)

**Issue:** Columns are built by string concatenation and assigned with `col.innerHTML = html`. The interpolated values come from the module-local `RAIN_POOL` const, so this is **not currently exploitable** — but it establishes an `innerHTML` sink in a reusable, exported primitive. If a future caller ever parameterizes the pool (the component already accepts props), an untrusted value would flow straight into the DOM as HTML. Building DOM nodes is safe and barely more code.

**Fix:**
```tsx
for (let j = 0; j < 18; j++) {
  const p = RAIN_POOL[(i * 7 + j * 3) % RAIN_POOL.length]
  const span = document.createElement('span')
  span.className = p.charAt(0) === '+' ? 'u' : p.charAt(0) === '−' ? 'd' : ''
  span.textContent = p
  col.appendChild(span)
}
```

### WR-02: `DataRain` reduced-motion / resize state is captured once and never reconciled

**File:** `apps/web/src/components/ui/data-rain.tsx:39-68`

**Issue:** The effect early-returns when `host.childElementCount` is truthy and only depends on `[columns]`. The column count derived from `window.innerWidth < 700` is computed once at mount. After a resize across the 700px breakpoint, columns are never recomputed. More importantly, `reduce` is read once: a user toggling OS reduced-motion mid-session is not honored, and because the cleanup runs `host.replaceChildren()` only on unmount/`columns` change, the stale composition persists. For a purely decorative `aria-hidden` element the impact is cosmetic, but the "double-guard reduced-motion" claim in the file header overstates the runtime behavior (the CSS media query is the real guard; the JS guard is mount-time only).

**Fix:** Either document that the JS branch is mount-time best-effort and the CSS `@media (prefers-reduced-motion)` is the authoritative guard, or add a `matchMedia` change listener and a resize listener that rebuild columns.

### WR-03: `NexaLanding` indexes `cards[0]` / `cards[1]` without bounds checks on i18n-sourced data

**File:** `apps/web/src/components/landing/NexaLanding.tsx:53,108-121`

**Issue:** `cards` comes from `tH.raw('cards')` (translation messages) and is consumed via `cards[0].instrument`, `cards[1].direction`, etc. If a locale's `hero.cards` array is empty or has fewer than 2 entries (a translation-file mistake, which is exactly the kind of external/structural data that should not be trusted), the hero scene throws `Cannot read properties of undefined` and the whole RSC page 500s. The `.raw()` payload is cast to `Card[]` with no validation. Given the project's Zod-everywhere boundary convention, an unvalidated `.raw()` cast feeding direct index access is a robustness gap.

**Fix:** Validate the shape (Zod, consistent with project convention) or guard:
```tsx
const cards = (tH.raw('cards') as Card[]) ?? []
// ...render the scene only when cards.length >= 2, else fall back gracefully
```

### WR-04: Inconsistent heading font token across reskinned pages

**File:** `apps/web/src/app/[locale]/(auth)/login/page.tsx:32`, `signup/page.tsx:29`, `(marketing)/tarifs/page.tsx:41`, `methodologie/page.tsx:41` (`font-display`) vs `(member)/signaux/[id]/page.tsx:180` and `(account)/abonnement/page.tsx:59` (`font-heading`)

**Issue:** Page `<h1>`s mix two font utilities for the same visual role. `globals.css` `@theme` defines `--font-display` but there is no `--font-heading` token declared in the reviewed CSS, so `font-heading` likely resolves to nothing (falls back to the inherited body sans) — a silent inconsistency where some titles render in the display face and others do not. This is a reskin-correctness defect (the phase goal is a uniform DS), not pure style.

**Fix:** Pick one heading utility for `<h1>` across all reskinned pages. If `font-heading` is intended, declare `--font-heading` in `@theme`; otherwise replace `font-heading` with `font-display`.

## Info

### IN-01: Landing still scopes itself under `data-theme="green"` rather than the global DS tokens

**File:** `apps/web/src/components/landing/NexaLanding.tsx:59`, `nexa-landing.css:20-38`

**Issue:** The volt branch was removed (good), but the landing keeps a self-contained `.nxl[data-theme="green"]` token block duplicating values that now also live in `globals.css :root` (`--bg`/`--background`, `--glow`, `--primary`, etc.). Two sources of truth for the same frozen GREEN palette risk drift on the next palette change. The orphan guard is satisfied, but the duplication is a maintainability cost the reskin could have collapsed.

**Fix:** Optional follow-up — map `.nxl` custom props to the global tokens (`--primary: var(--primary)` etc. via the cascade) instead of re-declaring literals, so the landing inherits one palette.

### IN-02: `worstColor` helper duplicated across two admin pages

**File:** `apps/web/src/app/(admin)/page.tsx:46-51` and `apps/web/src/app/(admin)/sante/page.tsx:157-162`

**Issue:** Identical `worstColor` (and near-identical `timeframeHours`, `DOT_CLASS`) are copy-pasted. `DOT_CLASS` duplication is how CR-01's broken syntax propagated to two files. Extracting into `lib/admin/freshness` (where `candleColor`/`ageColor` already live) would have made the token fix one-line.

**Fix:** Move `worstColor`, `timeframeHours`, and `DOT_CLASS` into `lib/admin/freshness.ts` and import.

### IN-03: `role="marquee"` is not a valid ARIA role

**File:** `apps/web/src/components/landing/NexaLanding.tsx:127`

**Issue:** `<div className="marquee" role="marquee" …>` — `marquee` is not a defined ARIA role and will be ignored / flagged by validators. The `aria-label` is useful but the role adds nothing.

**Fix:** Drop `role="marquee"` (keep `aria-label`), or use a valid role such as `role="region"` if a landmark is intended.

### IN-04: `risk` keys ('faible'/'modere'/'eleve') are a magic-string contract duplicated in two files

**File:** `apps/web/src/components/signals/SignalCard.tsx:41-51` and `apps/web/src/app/[locale]/(member)/signaux/[id]/page.tsx:35-45`

**Issue:** `mapRiskToScoreRisk` is duplicated verbatim. The DB→ScoreRisk mapping is a single contract; two copies can drift (e.g., if a new `risk_level` enum value is added). Not a bug today.

**Fix:** Export one `mapRiskToScoreRisk` from a shared module and import in both.

---

_Reviewed: 2026-06-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
