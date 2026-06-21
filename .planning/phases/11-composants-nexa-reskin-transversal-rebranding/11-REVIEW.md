---
phase: 11-composants-nexa-reskin-transversal-rebranding
reviewed: 2026-06-21T00:00:00Z
depth: standard
files_reviewed: 32
files_reviewed_list:
  - apps/web/src/app/(admin)/page.tsx
  - apps/web/src/app/[locale]/(account)/abonnement/page.tsx
  - apps/web/src/app/[locale]/(auth)/login/page.tsx
  - apps/web/src/app/[locale]/(auth)/signup/page.tsx
  - apps/web/src/app/[locale]/(marketing)/academie/page.tsx
  - apps/web/src/app/[locale]/(marketing)/methodologie/page.tsx
  - apps/web/src/app/[locale]/(marketing)/page.tsx
  - apps/web/src/app/[locale]/(marketing)/tarifs/page.tsx
  - apps/web/src/app/[locale]/(member)/signaux/[id]/page.tsx
  - apps/web/src/app/[locale]/(member)/signaux/page.tsx
  - apps/web/src/app/[locale]/layout.tsx
  - apps/web/src/app/apple-icon.tsx
  - apps/web/src/app/icon.tsx
  - apps/web/src/app/layout.tsx
  - apps/web/src/app/opengraph-image.tsx
  - apps/web/src/components/Footer.tsx
  - apps/web/src/components/hero/DataRain.tsx
  - apps/web/src/components/hero/FloatingCards.tsx
  - apps/web/src/components/hero/Hero.tsx
  - apps/web/src/components/hero/HeroTilt.tsx
  - apps/web/src/components/hero/WireframeGlobe.tsx
  - apps/web/src/components/member/ExpiryBanner.tsx
  - apps/web/src/components/nexa/ConfidenceStat.tsx
  - apps/web/src/components/nexa/Eyebrow.tsx
  - apps/web/src/components/nexa/Logo.tsx
  - apps/web/src/components/nexa/Marquee.tsx
  - apps/web/src/components/nexa/ScoreRing.tsx
  - apps/web/src/components/signals/CandleChart.tsx
  - apps/web/src/components/signals/SignalCard.tsx
  - apps/web/src/components/signals/SignalDetail.tsx
  - apps/web/src/components/ui/alert.tsx
  - apps/web/src/styles/globals.css
findings:
  critical: 0
  warning: 6
  info: 5
  total: 11
status: issues_found
---

# Phase 11: Code Review Report

**Reviewed:** 2026-06-21
**Depth:** standard
**Files Reviewed:** 32
**Status:** issues_found

## Summary

Phase 11 reskin (NEXA rebranding across pages + new `nexa/*` and `hero/*` components). Reviewed adversarially: traced color-token consumption, RTL correctness (the codebase claims "logical properties only / RTL-safe" repeatedly), variable scoping, payload validation, and untrusted-data rendering paths.

No BLOCKER-class correctness or security defect found: the security-sensitive surfaces (signal detail Zod-validates the untrusted JSONB payload before access; auth/member gates are delegated to layouts; the OG/icon generators render only static authored content; SVGs are inline-authored not injected). However the reskin **broke two of its own stated invariants** — flip-safe color tokens and RTL-safe layout — in three components, plus a variable-shadowing smell and several consistency gaps. These are WARNING-class: they degrade the exact properties (theme-flip correctness, RTL correctness) the phase explicitly committed to.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: SignalDetail hardcodes hex colors and manual `dark:` variants — breaks the flip-safe token invariant the rest of the reskin adopted

**File:** `apps/web/src/components/signals/SignalDetail.tsx:72-74`, `112`, `121`
**Issue:** The whole phase moved direction/signal colors onto flip-safe component tokens (`--signal-bullish` / `--signal-bearish`). `SignalCard.tsx:59-61` does exactly that and its own comment says *"plus de variantes dark: manuelles"*. `SignalDetail` — edited in this same diff — does the opposite: it hardcodes `text-[#15803D] dark:text-[#22C55E]` (long), `text-[#B91C1C] dark:text-[#EF4444]` (short / SL), `text-[#15803D] dark:text-[#22C55E]` (TP). This is:
- A direct violation of the design-system rule stated in `globals.css` and `ScoreRing.tsx`/`Eyebrow.tsx` ("AUCUN littéral HEX", "var()-only").
- A correctness drift: these literals are *not* the same OKLCH values the tokens resolve to (`--nexa-signal-bull` = `oklch(0.6271 0.1699 149.21)` ≈ `#16a34a`, not `#15803D`/`#22C55E`). So LONG direction renders a different green in the card vs. the detail of the same signal.
- A maintenance trap: any future palette change to `--signal-*` silently skips this file.

**Fix:** Use the same tokens as `SignalCard`:
```tsx
const directionClass = isLong
  ? 'text-[var(--signal-bullish)]'
  : 'text-[var(--signal-bearish)]'
// SL:
<dd className="font-semibold tabular-nums text-[var(--signal-bearish)]">
// TP:
<dd className="font-semibold tabular-nums text-[var(--signal-bullish)]">
```

### WR-02: `alert.tsx` action uses physical `right-2` / `pr-18` / `text-left` — ExpiryBanner overlaps text in RTL (Arabic)

**File:** `apps/web/src/components/ui/alert.tsx:7`, `72`
**Issue:** `AlertAction` is positioned `absolute top-2 right-2`, the base variant reserves space with `has-data-[slot=alert-action]:pr-18`, and the alert text is `text-left`. These are physical (LTR) properties. `ExpiryBanner` (member surface, rendered in `ar` locale where `dir="rtl"`) puts the "Renouveler" button in `AlertAction`. In Arabic the button sits at the physical right while the reserved padding (`pr-18`) and `text-left` are also physical-right/left → the renew button overlaps the description text instead of clearing it. This contradicts the phase's repeated "RTL-safe / propriétés logiques" claim and the ExpiryBanner header comment ("RTL : hérite du `dir` du document").

**Fix:** Use logical properties:
```tsx
// alertVariants base: text-start, and has-data-[slot=alert-action]:pe-18
"... text-start ... has-data-[slot=alert-action]:pe-18 ..."
// AlertAction:
className={cn("absolute top-2 end-2", className)}
```
(Confirm `pe-18`/`end-2` resolve under the Tailwind v4 logical-property config; otherwise use `ltr:right-2 rtl:left-2` + `ltr:pr-18 rtl:pl-18`.)

### WR-03: `FloatingCards` shadows its own `ariaLabel` prop inside the map

**File:** `apps/web/src/components/hero/FloatingCards.tsx:26-39`
**Issue:** The component takes a prop `ariaLabel` (used at line 37 on the `<ul>`). Inside `cards.map(...)` a new `const ariaLabel = tScore('ariaTemplate', …)` (line 39) shadows the prop. It works today only because the prop is read before the map body executes, but the shadow is a latent bug: any later edit referencing `ariaLabel` inside the map will silently get the per-card score label, not the list label. Lint (`no-shadow`) would flag it.

**Fix:** Rename the inner variable:
```tsx
const cardLabel = tScore('ariaTemplate', { score: card.score, risk: card.riskLabel })
// ...
<ScoreRing score={card.score} risk={card.risk} size={44} label={cardLabel} />
```

### WR-04: `[locale]/layout.tsx` header layout — Académie link placement is fragile and likely visually wrong

**File:** `apps/web/src/app/[locale]/layout.tsx:58-77`
**Issue:** The header is `flex justify-between`. Children: (1) the logo/baseline block, (2) the Académie `<Link>` with `ms-6`, (3) a `<div className="ms-auto …">` for theme/lang. With `justify-between` AND an `ms-auto` on the third child, the spacing distribution is ambiguous: `justify-between` already pushes children apart, and `ms-auto` then collapses the gap between the link and the toggles inconsistently. The Académie link will not sit where intended across the three locales/widths. This is a layout-correctness smell, not a crash.

**Fix:** Pick one model. Drop `justify-between`, keep `ms-auto` on the controls group:
```tsx
<header className="flex h-14 items-center gap-4 bg-secondary px-4 md:px-6">
  <div className="flex flex-col">…</div>
  <Link href="/academie" className="text-sm …">…</Link>
  <div className="ms-auto flex items-center gap-2">…</div>
</header>
```

### WR-05: Untranslated `notFound()` swallows malformed-payload signals silently with no observability

**File:** `apps/web/src/app/[locale]/(member)/signaux/[id]/page.tsx:134-137`
**Issue:** When the JSONB payload fails `SignalPayloadSchema.safeParse`, the page returns `notFound()`. Security-wise correct (no 500, no leak). But a signal that exists and is `active` yet has a malformed IA payload becomes invisible to members **and to operators** — there is no log/metric. Given the project's core value is "traçabilité de l'analyse d'un trade", a published-but-broken setup vanishing without a trace is a real operational risk (members may have seen it in the list, then it 404s on click). The list query (`signaux/page.tsx`) does not validate payload, so the setup still appears in the list → click → 404, a confusing dead end.

**Fix:** Keep `notFound()` for the user, but log the parse failure server-side for observability:
```tsx
if (!payloadResult.success) {
  console.error(`[signal ${id}] invalid payload`, payloadResult.error.flatten())
  notFound()
}
```
(Or pipe to the structured logger.) Optionally filter malformed setups out of the list so they never render as clickable.

### WR-06: `ConfidenceStat` accepts `expectancy`/`avg_r` props that are computed but never rendered — dead inputs

**File:** `apps/web/src/components/nexa/ConfidenceStat.tsx:36-55`
**Issue:** Props `expectancy` and `avg_r` are declared, defaulted, and passed into `applyThreshold({ n, win_rate, expectancy, avg_r })`, but the rendered output only ever shows `result.winRatePct`, `result.n`, and provenance. If `applyThreshold` does not depend on `expectancy`/`avg_r` for the `sufficient` decision, these are dead inputs threading through a public component API — callers may believe they affect output. If `applyThreshold` *does* use them, then the values are consumed but their result is never surfaced, which is a silent information loss for a "track record mesuré" component.

**Fix:** Either render the expectancy / avg_r when `sufficient` (likely the intent), or drop the props from the public interface and the `applyThreshold` call if they are genuinely unused. Confirm against `@/lib/track-record/threshold`.

## Info

### IN-01: ScoreRing/ConfidenceStat — verify `%` glyph sits inside `<bdi>` for RTL

**File:** `apps/web/src/components/nexa/ConfidenceStat.tsx:68`
**Issue:** `<bdi>{result.winRatePct}%</bdi>` correctly wraps both number and `%` (good). Noted only because the adjacent design rule is strict about numeric/RTL isolation and several sibling components wrap numbers but place punctuation outside `<bdi>`. No change needed here; flagged for consistency audit elsewhere.
**Fix:** None — already correct. Audit siblings for the same pattern.

### IN-02: `(admin)/page.tsx` health is `red` when freshness view is empty — verify intended

**File:** `apps/web/src/app/(admin)/page.tsx:92-94`
**Issue:** Empty `v_data_freshness` → `health = 'red'`. On a fresh/empty environment (no candles yet) the dashboard shows red "stale" health, which may be alarming during onboarding rather than indicating a real fault. Likely intentional (no data = unhealthy), but worth confirming the desired bootstrap UX.
**Fix:** If empty-on-bootstrap should read amber/neutral, branch on a "no sources configured" sentinel.

### IN-03: Repeated `mapRiskToScoreRisk` / `capitalize` duplicated across files

**File:** `apps/web/src/components/signals/SignalCard.tsx:40-50`, `apps/web/src/app/[locale]/(member)/signaux/[id]/page.tsx:34-44`, `apps/web/src/components/signals/SignalDetail.tsx:59-61`
**Issue:** `mapRiskToScoreRisk` is copy-pasted verbatim in `SignalCard` and the `[id]` page; `capitalize` is duplicated in `SignalCard` and `SignalDetail`. Divergence risk if the risk mapping changes in one place only.
**Fix:** Extract to `lib/signals/format.ts` (where `formatPrice`/`formatRelativeAge` already live) and import.

### IN-04: `timeframeHours` (admin) and `mapTimeframe` ([id] page) duplicate timeframe-token parsing

**File:** `apps/web/src/app/(admin)/page.tsx:31-44`, `apps/web/src/app/[locale]/(member)/signaux/[id]/page.tsx:91-108`
**Issue:** Two near-identical whitelisted switch tables for timeframe tokens (`H4/4H`, `D/1D/DAY/DAILY`, default). They can drift apart.
**Fix:** Single shared `parseTimeframe` util in a shared package.

### IN-05: `Footer` comment says "mark seul" but renders `variant="full"`

**File:** `apps/web/src/components/Footer.tsx:31-33`
**Issue:** Comment: *"Marque NEXA (mark seul, densité footer — BRAND-01)"* but the code renders `<Logo variant="full" />` (mark + wordmark). Stale comment; misleads future readers about the intended footer density.
**Fix:** Update the comment to "full" or switch to `variant="mark"` if the original intent was the mark only.

---

_Reviewed: 2026-06-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
