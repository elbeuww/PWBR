# Phase 16: Reskin transversal de toutes les pages - Pattern Map

**Mapped:** 2026-06-23
**Files analyzed:** ~45 surfaces (grouped into 3 tier buckets) + 3 guardrail/primitive sources
**Analogs found:** all surfaces map to 1 of 5 in-repo analog families (exact or role-match) / 0 with no analog

> **Nature of this phase:** mechanical reskin, design FROZEN (15-UI-SPEC + 16-UI-SPEC). There is no new component to design. Every file copies one of 5 established patterns below. The codebase is ~80% primed: 9 Phase-15 foundation surfaces are already tokenized, the 20 `ui/` components already inherit GREEN, CandleChart is already D-11 compliant, and the raw-palette grep across `apps/web/src` returns only **3 residual offender files** + the volt orphans.

---

## Inviolable Constraints (inherited by EVERY plan)

These are encoded once here so each plan action inherits them. A plan that violates any of these FAILS the DoD (16-UI-SPEC §"Reskin Definition of Done").

| # | Constraint | Mechanical check |
|---|------------|------------------|
| C-1 | **Reskin = className/markup token swap ONLY.** Never touch the server fetch / RLS code. | diff must NOT touch `createClient`, `from('…')`, `.select(`, `requireUser/requireActiveSub/requireRole`, or move a fetch under `'use client'` |
| C-2 | **service_role never reaches a member/marketing/auth page.** `createAdminServiceClient()` (`lib/supabase/admin-service.ts`) is **admin-only** (mono-FR `(admin)` RSC). | no `admin-service` import outside `app/(admin)/**` |
| C-3 | **Component-layer tokens only** (`var()` via Tailwind utilities). Zero color literal, zero raw palette, zero `ring-[#…]`, zero bespoke per-page CSS. | `theme-scan.test.ts` (extend `FOUNDATION_FILES` + `FORBIDDEN_PALETTE`) |
| C-4 | **CandleChart already D-11 compliant — preserve, do not rebuild.** Recolor via lwc JS API (`getComputedStyle` → `applyOptions`), re-applied on `.dark` mutation. Candle colors via `--signal-bullish`/`--signal-bearish` (≠ `--primary`). | grep: zero candle color in CSS; `readChartColors`/`applyOptions`/`MutationObserver` intact |
| C-5 | **Volt orphans removed — green-only.** `data-theme="green"` hardcoded; toggle markup, theme-persistence logic, and `.nxl[data-theme="volt"]` CSS block deleted/neutralized. | grep: zero `data-theme="volt"`, `nxl-theme-toggle`, `nexa-landing-theme` under `apps/web/src` |
| C-6 | **Tier accent applied (not "tokenized but fade").** Each surface declares its tier and applies the matching accent (Tier 1 full / Tier 2 discreet glow / Tier 3 minimal border). | design-review grid (D-09.2); token-purity alone does NOT pass |
| C-7 | **Guardrails preserved:** `<Disclaimer />`, RTL logical props, `data-testid`/ARIA roles, `applyThreshold` for any %, `forcedTheme="dark"`. | `no-perf-claims` + `no-mera-brand` + `rtl-logical-props` + `lint:i18n` green; E2E diff gate |

---

## File Classification (by tier bucket)

### Bucket 1 — Vitrine (Tier 1, full neon) — SC#1

| Surface / file | Role | Data flow | Closest analog | Match |
|----------------|------|-----------|----------------|-------|
| `components/landing/NexaLanding.tsx` | landing component (RSC `.nxl`) | static i18n SSR | **self** (volt→green reconcile) — see Pattern E | exact (cleanup) |
| `components/landing/NexaLandingEffects.tsx` | client effects | event/DOM | **self** (strip volt logic) — Pattern E | exact (cleanup) |
| `components/landing/nexa-landing.css` | scoped CSS | — | **self** (neutralize volt block) — Pattern E | exact (cleanup) |
| `app/[locale]/(marketing)/tarifs/page.tsx` | page (RSC) | request-response | `(admin)/signaux/page.tsx` (token-pure RSC) — Pattern A | role-match |
| `app/[locale]/(marketing)/methodologie/page.tsx` | page (RSC) | request-response | `(admin)/signaux/page.tsx` — Pattern A | role-match |
| `app/[locale]/(marketing)/legal/[doc]/page.tsx` | page (RSC) | request-response | `(admin)/signaux/page.tsx` — Pattern A | role-match |
| `components/landing/{BigGauge,HowItWorks,ScoreFeature,SignalDemo,TelegramBand,PricingTiers}.tsx`, `components/hero/*`, `components/nexa/*`, `components/Footer.tsx` | components | static | already tokenized P11 — **verify-only** | exact |

### Bucket 2 — App: auth + compte + membre + funnel + Académie (Tier 2) — SC#2/#3

| Surface / file | Role | Data flow | Closest analog | Match |
|----------------|------|-----------|----------------|-------|
| `app/[locale]/(auth)/login/page.tsx` | page (RSC, calm) | server-action form | `login` self + ExpiryBanner glow — Pattern B + D | role-match (1 literal to fix) |
| `app/[locale]/(auth)/signup/page.tsx` | page (RSC, calm) | server-action form | login — Pattern B + D | role-match |
| `app/[locale]/(account)/abonnement/page.tsx` | page (RSC) | request-response (`requireUser`) | `(admin)/signaux/page.tsx` + ExpiryBanner — Pattern A + D | role-match |
| `app/[locale]/(member)/signaux/page.tsx` | page (RSC, dense) | **RLS anon read** | **already tokenized** — verify, glow on cards only, NO data-rain — Pattern A (C-1 zone) | exact (verify) |
| `app/[locale]/(member)/signaux/[id]/page.tsx` | page (RSC, dense) | RLS anon read + hosts CandleChart | member list — Pattern A + C-4 | role-match |
| `app/[locale]/(member)/layout.tsx` | layout | `requireActiveSub()` RLS read | **C-1 zone — do not touch fetch** | n/a (gate) |
| `app/[locale]/(account)/layout.tsx` | layout | `requireUser()` | C-1 zone | n/a (gate) |
| `app/[locale]/affiliation/page.tsx` | page (RSC) | request-response | `affiliation/dashboard` (already tokenized) — Pattern A | role-match |
| `app/[locale]/dashboard/page.tsx` | stub page | — | **residual offender** `text-red-600` (line 58) → `text-destructive` — Pattern A | exact (1 fix) |
| `app/[locale]/(marketing)/academie/page.tsx` + `[slug]/` + `[slug]/[lesson]/` | pages (RSC) | request-response + MDX | `(admin)/signaux/page.tsx` — Pattern A; preserve `FallbackBanner` + FR fallback | role-match |
| `components/academie/*`, `components/signals/{FilterBar,SignalList,SignalCard,SignalDetail,…}.tsx` | components | mixed | ExpiryBanner (Tier 2 glow) — Pattern D | role-match |
| `components/signals/CandleChart.tsx` | client chart | canvas | **preserve verbatim (C-4)** — Pattern C | exact (no-op) |
| `app/[locale]/(marketing)/paiement-bientot/page.tsx` | page (RSC) | request-response | Tier 2 funnel (A3 assumption) — Pattern A + D | role-match |

### Bucket 3 — Admin (Tier 3, sober) — SC#3

| Surface / file | Role | Data flow | Closest analog | Match |
|----------------|------|-----------|----------------|-------|
| `app/(admin)/sante/page.tsx` | page (RSC, mono-FR) | service_role read | **residual offender** `bg-emerald-500`/`bg-amber-500` (lines 65-66) — Pattern A | exact (2 fixes) |
| `app/(admin)/page.tsx` | page (RSC) | service_role read | residual offender (raw palette) — Pattern A | exact |
| `app/(admin)/membres/page.tsx` | page (RSC) | service_role read | `(admin)/signaux/page.tsx` — Pattern A | exact |
| `app/(admin)/signaux/[id]/page.tsx` | page (RSC) | service_role read | `(admin)/signaux/page.tsx` — Pattern A | exact |
| `app/(admin)/affiliation/affilies/page.tsx` | page (RSC) | service_role read | `(admin)/affiliation/page.tsx` (tokenized) — Pattern A | role-match |
| `app/(admin)/{signaux,sante,file,affiliation,affiliation/payouts}/page.tsx` | pages | service_role read | **already tokenized P15** — verify-only | exact |
| `app/(admin)/layout.tsx` (+ `_components/AdminSidebar`) | layout | `requireRole('superadmin')` | C-1 zone; Tier 3 sober, zero effect | n/a (gate) |
| `components/admin/{MemberRowActions,QueueRowActions,…}.tsx` | components | dialogs | `(admin)/signaux/page.tsx` Badge usage — Pattern A | role-match |

---

## Pattern Assignments

### Pattern A — Token-pure RSC page (Tier 1/2/3 page reskin)

**Analog:** `apps/web/src/app/(admin)/signaux/page.tsx` (Phase 15 output, exemplary token purity).

**Component-layer token usage to copy** (already correct in analog):
```tsx
// page shell
<main className="mx-auto max-w-6xl px-4 py-8">
  <h1 className="text-2xl font-semibold">{t('signals.title')}</h1>
// form controls
<label className="text-sm text-muted-foreground">…</label>
<select className="h-9 rounded-md border bg-background px-3 text-sm">
// empty state
<div className="rounded-lg border border-dashed p-10 text-center">
  <p className="font-medium">{t('signals.emptyHeading')}</p>
  <p className="mt-1 text-sm text-muted-foreground">{t('signals.emptyBody')}</p>
// links + tabular
<Link className="text-primary underline-offset-2 hover:underline">…</Link>
<bdi>{s.instrument}</bdi>  {/* numeric/symbol always <bdi> for RTL */}
```

**Signal/risk Badge token pattern** (analog lines 196-204 — copy verbatim for any status pill):
```tsx
// posted/bullish → signal namespace via arbitrary-value token utility (NOT raw emerald)
<Badge className="border-[--signal-bullish]/30 bg-[--signal-bullish]/10 text-[--signal-bullish]">
  {label}
</Badge>
// neutral → secondary variant, muted text (never a raw palette)
<Badge variant="secondary" className="text-muted-foreground">{label}</Badge>
```

**Before→after token swap law** (the entire reskin operation, from RESEARCH §Code Examples):
```tsx
// BEFORE (raw palette — fails theme-scan)
className="text-emerald-400 border-emerald-600/30 bg-emerald-500/10"
className="text-red-600"                    // dashboard/page.tsx:58
className="bg-emerald-500" / "bg-amber-500"  // (admin)/sante/page.tsx:65-66 DOT_CLASS
className="text-[var(--accent-brand)]"       // (auth)/login/page.tsx:44 (legacy var literal)
// AFTER (DS v3 component-layer tokens)
className="text-[--signal-bullish] border-border bg-muted"
className="text-destructive"
className="bg-[--signal-bullish]" / "bg-[--risk-moderate]"   // status dots → semantic
className="text-primary"
// focus ring: ring-[#2563EB] → ring-ring ; glow stays box-shadow, never ring-*
```

**Tier accent (C-6):** Tier 1 pages = full neon (glow + gradient titles + section aura, landing-only treatment available); Tier 2 pages = discreet card/CTA/focus glow (Pattern D); Tier 3 admin = minimal neon border only, **zero effect** (Phase 11 D-18).

---

### Pattern B — Calm auth surface (Tier 2 + optional ambient data-rain)

**Analog:** `apps/web/src/app/[locale]/(auth)/login/page.tsx`.

**Current state** (already mostly tokenized — one residual literal):
```tsx
<main className="mx-auto max-w-sm px-4 py-20 text-start">
  <Eyebrow>{t('eyebrow')}</Eyebrow>
  <h1 className="mt-2 font-display text-2xl font-semibold">{t('loginTitle')}</h1>
  <Input … /> <Button type="submit" className="mt-2 w-full">…</Button>
  // BEFORE: <Link className="text-[var(--accent-brand)] hover:underline">
  // AFTER:  <Link className="text-primary hover:underline">
```

**Reskin actions:**
1. Swap `text-[var(--accent-brand)]` → `text-primary` (C-3).
2. Add discreet glow on the primary `Button` / card (Pattern D) — otherwise "tokenized but fade" (C-6).
3. **Calm surface ⇒ eligible for ambient data-rain** (Pattern F) — auth/empty-states/member-overview only, very subtle, reduced-motion guarded. NEVER on signal lists/tables/trade detail.
4. Preserve `font-display` heading is allowed on vitrine; app titles stay flat tokens (no gradient, D-07).

---

### Pattern C — CandleChart (preserve verbatim, C-4)

**Analog / target:** `apps/web/src/components/signals/CandleChart.tsx` — **already D-11 compliant. Do NOT rebuild.**

**The correct pattern already present** (resolves tokens via getComputedStyle, re-applies on theme flip):
```ts
function readChartColors(el: HTMLElement): ChartColors {
  const cs = getComputedStyle(el)
  const read = (name: string) => cs.getPropertyValue(name).trim()
  return { up: read('--signal-bullish'), down: read('--signal-bearish'), entry: read('--foreground') }
}
// addSeries(CandlestickSeries, { upColor: colors.up, downColor: colors.down, … })  // lwc JS API, NOT CSS
const recolor = () => series.applyOptions({ upColor: colors.up, downColor: colors.down, … })
themeObserver = new MutationObserver(recolor)
themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
```
**Reskin action:** none on the chart logic. If palette must change, change the **token** in `globals.css`, never the chart. Wrapper container className (`ring-1 ring-foreground/10`) is already token-pure.

---

### Pattern D — Tier 2 glow primitive (already-wired component analog)

**Analog:** `apps/web/src/components/member/ExpiryBanner.tsx` — Tier 2 member component, already token-bound via `ui/` (Alert/Button), RTL-safe, reduced-motion-safe.

**Pattern to copy** (token-bound shadcn primitives, logical props, no literal):
```tsx
<div className="mx-auto max-w-screen-xl px-4 pt-6 text-start md:px-6 lg:px-8">
  <Alert variant="warning">
    <AlertDescription>{t('expiryBanner', { n: remaining })}</AlertDescription>
    <AlertAction>
      <Button asChild size="sm" variant="outline"><Link href="/tarifs">{t('renew')}</Link></Button>
    </AlertAction>
  </Alert>
</div>
```

**Glow accent (D-06, the only "new code"):** extract the landing's `--glow` box-shadow into a **tokenized reusable utility/component** (discretion D-06). Source values from `nexa-landing.css`:
```css
/* landing source — glow is box-shadow on --glow, NEVER a ring-* utility (C-3 anti-collision) */
.nxl .btn-primary { box-shadow: 0 8px 30px -10px var(--glow); }
.nxl .mark-tile   { box-shadow: 0 0 22px -4px var(--glow); }
.nxl .nxl-progress{ box-shadow: 0 0 12px var(--glow); }
```
Apply on Tier 2 cards / primary buttons / focus states via `box-shadow: … var(--glow)` referencing the component layer; double-guard under `@media (prefers-reduced-motion: no-preference)` only where animated.

---

### Pattern E — Landing volt→green reconcile + orphan cleanup (C-5)

**Targets:** `NexaLanding.tsx`, `NexaLandingEffects.tsx`, `nexa-landing.css` (all under `components/landing/`).

**E.1 — `NexaLanding.tsx`:**
```tsx
// BEFORE: <div className="nxl" data-theme="volt">     (line 58)
// AFTER:  <div className="nxl" data-theme="green">
// DELETE entirely the toggle block (lines 83-87):
//   <div className="nxl-theme-toggle" aria-label="Green / Volt"> … two <button> … </div>
```

**E.2 — `NexaLandingEffects.tsx` — strip theme logic (lines 25-40):**
```ts
// DELETE: setTheme(), localStorage('nexa-landing-theme') read/write,
//         querySelectorAll('.nxl-theme-toggle button') listeners + cleanups,
//         `let savedTheme = 'volt'` default.
// KEEP:   data-rain injection, parallax, tilt, reveal/counters/gauge, progress/nav —
//         all reduced-motion guarded, none reference the theme.
```

**E.3 — `nexa-landing.css` — neutralize volt CSS (3 blocks):**
```css
/* DELETE the whole .nxl[data-theme="volt"] { … } rule (lines 40-58) */
/* DELETE volt-specific overrides:
   .nxl[data-theme="volt"] .mark-tile { … }       (line 83)
   .nxl[data-theme="volt"] .mark-tile svg { … }   (line 85) */
/* KEEP .nxl[data-theme="green"] (lines 19-37) as the only live branch (D-03) */
```
**Verification (C-5):** grep `data-theme="volt"`, `nxl-theme-toggle`, `nexa-landing-theme` → must return **zero** under `apps/web/src`. `green` is the only live branch.

---

### Pattern F — Ambient data-rain light primitive (D-06, calm surfaces only)

**Source:** `NexaLandingEffects.tsx` data-rain injection (`#dataRain` host, `.data-col` columns, `RAIN_POOL`) + `nexa-landing.css` `.data-rain`/`.data-col` (`.u`/`.d` color-mix from `--buy`/`--sell`).

**Generalize into a light tokenized primitive** referencing the component layer (`--signal-bullish`/`--signal-bearish` for `.u`/`.d`, not `--buy`/`--sell` literals). Apply **ambient + very subtle ONLY** on **calm surfaces**: auth (login/signup), empty states, member overview header. **NEVER** on signal lists / tables / trade detail (C-6, D-05/D-07). Reduced-motion ⇒ `animation: none`, static composition preserved (D-14).

---

## Shared Patterns

### Disclaimer (single source — preserve on every concerned page)
**Source:** `apps/web/src/components/Disclaimer.tsx`
**Apply to:** every reskinned page in the concerned set.
```tsx
import { getTranslations } from 'next-intl/server'
export async function Disclaimer() {
  const t = await getTranslations('disclaimer')
  return <p className="text-sm text-muted-foreground ps-4 pe-4">{t('footer')}</p>  // logical props, i18n key
}
```
Do NOT inline disclaimer copy anywhere — render `<Disclaimer />` / `<SignalsDisclaimerBanner />`.

### RLS gate (read-only zone — C-1/C-2)
**Source:** `app/[locale]/(member)/signaux/page.tsx` (anon RLS) vs `app/(admin)/signaux/page.tsx` (service_role, admin-only).
```ts
// MEMBER/ACCOUNT — anon client + RLS is the barrier. DO NOT EDIT, DO NOT client-migrate.
const supabase = await createClient()                         // lib/supabase/server.ts
const { data, error } = await fetchActiveSignals(supabase, filters)
// ADMIN ONLY — service_role, RSC server-only, never bundled, never outside app/(admin)/**
const client = createAdminServiceClient()                     // lib/supabase/admin-service.ts
```
Reskin touches className/markup in these files; the fetch block is untouchable.

### Guardrail extension (extend, don't reinvent — D-09 discretion)
**Source:** `apps/web/src/styles/__tests__/theme-scan.test.ts`
**Apply to:** Wave 0.
- Add newly-reskinned surfaces to `FOUNDATION_FILES` (line 32-42).
- Add any new raw-palette token to `FORBIDDEN_PALETTE` (line 48-62) — keep the SANITY fixture in sync so the detector stays non-trivial (line 144-165).
- Test 3 already guards the `ring-*`/`--glow` collision (glow must stay box-shadow) — Pattern D depends on this staying green.
- Sibling guards to keep green: `no-perf-claims`, `no-mera-brand`, `rtl-logical-props`, `contrast-aa`, `lint:i18n`.

---

## No Analog Found

None. Every surface maps to one of Patterns A–F. The only "new code" is the extraction of glow (Pattern D) and light data-rain (Pattern F) into tokenized primitives, both **derived from existing landing source**, not invented.

---

## Residual offenders (the precise net-new tokenization work)

Raw-palette grep across `apps/web/src` (excluding the test's own fixtures) returns exactly:

| File | Line(s) | Before | After | Pattern |
|------|---------|--------|-------|---------|
| `app/(admin)/sante/page.tsx` | 65-66 | `bg-emerald-500`, `bg-amber-500` (status dots) | `bg-[--signal-bullish]`, `bg-[--risk-moderate]` (or `bg-primary`/amber risk token) | A |
| `app/[locale]/dashboard/page.tsx` | 58 | `text-red-600` | `text-destructive` | A |
| `app/[locale]/(auth)/login/page.tsx` | 44 | `text-[var(--accent-brand)]` | `text-primary` | B |

> All other `(marketing)/(member)/(account)/academie` pages are already substantially token-pure (e.g. member signaux uses `bg-card`, `ring-foreground/10`, `bg-primary`); their P16 work is **(a) confirm zero residual literal, (b) apply the tier accent (C-6)**. Per RESEARCH Open-Question 1, the planner should re-run the `theme-scan` raw-palette regex across each bucket before wave-splitting to confirm this precise residual list.

---

## Metadata

**Analog search scope:** `apps/web/src/{app,components,styles}` (RSC pages, layouts, landing, signals, member, ui, guardrail tests).
**Files scanned this pass:** theme-scan.test.ts, NexaLanding.tsx, NexaLandingEffects.tsx, CandleChart.tsx, (admin)/signaux/page.tsx, ExpiryBanner.tsx, Disclaimer.tsx, nexa-landing.css, (member)/signaux/page.tsx, (auth)/login/page.tsx, (admin)/sante/page.tsx + repo-wide raw-palette grep.
**Pattern extraction date:** 2026-06-23
