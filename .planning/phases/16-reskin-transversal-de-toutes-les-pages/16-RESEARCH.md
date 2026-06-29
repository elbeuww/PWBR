# Phase 16: Reskin transversal de toutes les pages - Research

**Researched:** 2026-06-23
**Domain:** Transversal UI reskin (DS v3 dark néon) — Next.js 15 App Router + Tailwind v4 CSS-first + shadcn vendored + lightweight-charts v5
**Confidence:** HIGH (codebase-verified; design frozen upstream — light pass per ROADMAP)

## Summary

This is a **light** research pass: the design system (color, type, spacing, theme) is FROZEN by `15-UI-SPEC.md` and the per-tier neon contract + definition-of-done are FROZEN by `16-UI-SPEC.md`. There is nothing to *design*. The job is mechanical: **swap to DS v3 component-layer tokens, apply the per-tier neon accent, and preserve every guardrail**, across every existing surface, single pass.

The codebase is already 80% primed. Phase 11 reskinned NEXA components and wired tokens; Phase 15 froze GREEN at `:root`, removed the global `ThemeToggle`, forced `forcedTheme="dark"`, and **already tokenized 9 "foundation" surfaces** (LanguageSwitcher + all `(admin)` pages + affiliation dashboard + TrackRecordView) — verified by `theme-scan.test.ts`. The 20 vendored `ui/` components already reference the component token layer and inherit GREEN automatically. So Phase 16 = (1) finish tokenizing the *remaining* surfaces (mostly `(marketing)`, `(auth)`, `(member)`, `(account)`, `academie`), (2) reconcile the landing volt→green and clean orphans, (3) extract the landing's `.nxl`-scoped glow/data-rain into reusable tokenized primitives for Tier 2, and (4) keep three already-existing guardrail vitest suites green.

**Primary recommendation:** Plan by route-group / tier (vitrine // app+auth+paiement // académie // admin), files disjoint → parallelizable. Wire the **three existing vitest guardrail suites** (`no-perf-claims`, `no-mera-brand`, `theme-scan`) as blocking gates and *extend* `theme-scan`'s file list + raw-palette regex to cover the newly-touched surfaces rather than inventing a new scan. Touch zero RLS fetch code. Recolor CandleChart only via the lwc JS API (already done — preserve it).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Token swap (className → component-layer `var()`) | Frontend (RSC pages + client components) | — | Pure presentation; never touches data tier |
| Per-tier neon accent (glow/data-rain/gradient) | Frontend (CSS/utility + `.nxl` scope) | — | Visual treatment only; tokenized |
| RLS gating / data fetch | API/DB (Supabase RLS) via `lib/supabase/server.ts` anon client | — | MUST NOT move to client (D-12). Reskin never touches it |
| i18n strings | Frontend SSR (next-intl `getTranslations`) | — | No hardcoded text introduced; FR/EN/AR key parity |
| RTL direction | Frontend server (single `<html dir>` in `[locale]/layout.tsx`) | — | Orthogonal to reskin; logical props only |
| CandleChart recolor | Browser/client (lwc JS API via `getComputedStyle`) | — | Canvas can't read CSS vars (Anti-Pattern 5) |
| Guardrail enforcement | CI (vitest text/fs scans) | — | Blocking gates, not visual review |

## Standard Stack

No new dependencies. This phase ships **no new product capability** and adds **no shadcn block**. Everything below already exists in the repo.

### Core (already installed — verified `apps/web/package.json`)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | `15` | App Router + RSC | Locked (CLAUDE.md, do NOT jump to 16) |
| `tailwindcss` + `@tailwindcss/postcss` | `4.3.1` | CSS-first tokens, no `tailwind.config` | Locked. 3-layer tokens in `globals.css` |
| `next-themes` | `0.4.6` | `forcedTheme="dark"` provider | Phase 15; `.dark` retained for CandleChart/sonner observers |
| `next-intl` | `4.13.0` | trilingual fr/en/ar, `localePrefix:'always'` | RTL + key-parity enforced by `lint:i18n` |
| `lightweight-charts` | `5.2.0` | CandleChart (v5 unified `addSeries`) | Locked. Recolor via JS API only |
| `radix-ui` / shadcn vendored | `1.5.0` | 20 `ui/` components, already token-bound | Inherit GREEN automatically |
| `lucide-react` | `1.18.0` | icons | Locked |
| `vitest` | `4.1.8` | guardrail scans + unit | Test runner; config at repo root |
| `@playwright/test` | `1.60.0` | E2E (Phase 21) | data-testid/ARIA must be preserved this phase |

**Installation:** none. `pnpm install` already satisfies the tree.

## Package Legitimacy Audit

Not applicable — **zero new packages installed this phase**. The reskin recolors/accents existing vendored components and generalizes existing in-repo landing primitives. `components.json → registries: {}` (no third-party registries). No legitimacy gate triggered.

## Architecture Patterns

### Token layering (the one rule that governs every reskin edit)
`apps/web/src/styles/globals.css` carries 3 layers:
1. **Primitive** `--nexa-*` (theme-independent OKLCH ramps — never flip).
2. **Semantic** `:root` / `.dark` (carries frozen GREEN; the ONLY layer that holds color).
3. **Component** `@theme inline` (what components reference via `var()` / Tailwind utilities).

**Reskin edit law (D-08 / THEME-02):** a reskinned className references the **component layer only** — `text-foreground`, `bg-secondary`, `text-primary`, `ring-ring`, `text-[--signal-bullish]`, `bg-[--risk-moderate]/10`, `bg-popover`, `border-border`. **Zero color literal**, **zero `ring-[#2563EB]`**, **zero raw palette** (`text-amber-700`, `bg-red-500/10`, `border-emerald-600/30`…). This is exactly what Phase 15's `theme-scan.test.ts` proves on its 9 foundation files — Phase 16 extends the same pattern to the rest.

### Tailwind v4 arbitrary-value token utilities (established Phase 15)
Pattern from `15-03-SUMMARY.md`: `text-[--signal-bullish]`, `bg-[--risk-moderate]/10`, `ring-ring`, `bg-popover`, `border-border`. Use these to map any residual raw-palette utility to a semantic token. Loss/negative → `text-destructive`; gain/positive direction → `text-[--signal-bullish]`.

### Neon primitive extraction (D-06 — the only "new code")
The landing's glow/data-rain live as `.nxl`-scoped CSS in `apps/web/src/components/landing/nexa-landing.css`:
- Glow: `box-shadow: ... var(--glow)` (e.g. `.nxl .btn-primary`, `.price-card.popular`, `.eyebrow .dot`, `.mark-tile`).
- data-rain: `.nxl .data-rain` / `.nxl .data-col` (+ `.u`/`.d` color-mix from `--buy`/`--sell`), JS-injected by `NexaLandingEffects.tsx` (`#dataRain` host), reduced-motion guarded (`@media prefers-reduced-motion` → `animation:none`).
- Hero aura / gradient titles: `--hero-aura` radial-gradients, `.globe`, `.atmo` — **landing-only (D-07), do NOT generalize.**

Extract glow + a *light* data-rain into **tokenized, reusable** utilities/components (class util, component, or variant — discretion D-06) referencing `--glow` and the component token layer, double-guarded under `prefers-reduced-motion: no-preference`. Apply on Tier 2 calm surfaces only (auth, empty states, member overview header); NEVER on signal lists/tables/trade detail (D-05/D-07).

### Anti-Patterns to Avoid
- **Migrating the RLS fetch to the client** (D-12, Anti-Pattern 3) — the single biggest landmine. See Landmines.
- **Bespoke per-page CSS / color literals** — fails `theme-scan` + violates DoD condition 1.
- **CSS-recoloring the CandleChart** — canvas ignores CSS vars (Anti-Pattern 5); use the lwc JS API.
- **Tokenized-but-fade** — a page that swaps tokens but applies no tier accent FAILS DoD condition 2.
- **Gradient titles / section aura on app tiers** — landing-only (D-07).
- **Removing/renaming `data-testid` or ARIA roles** — breaks Phase 21 E2E.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bespoke/literal color scan | A new scan from scratch | **Extend** `apps/web/src/styles/__tests__/theme-scan.test.ts` (add files to `FOUNDATION_FILES`, extend `FORBIDDEN_PALETTE`) | Detector + sanity fixtures already proven non-trivial |
| % / gain-claim scan | New regex test | `apps/web/test/no-perf-claims.test.ts` (already scans home/pricing/paiement/hero/marquee/scoreRing namespaces) | Already wired, tolerant to missing namespaces |
| MERA brand scan | New fs walk | `apps/web/test/no-mera-brand.test.ts` (walks `apps/web/src/**`) | Already wired |
| Glow / data-rain | Per-page CSS | Extract existing `.nxl` glow/data-rain into tokenized primitive (D-06) | Avoids duplication + literal drift |
| CandleChart token resolution | New color plumbing | `readChartColors()` already reads `--signal-bullish`/`--signal-bearish`/`--foreground` via `getComputedStyle` + MutationObserver recolor | Already correct (D-11) — preserve, don't rebuild |

**Key insight:** Nearly everything Phase 16 needs already exists. The risk is *re-inventing* guardrails or *re-deciding* frozen design — both forbidden by CONTEXT.

## Page / Surface Inventory (complete — grouped by success-criterion bucket)

> Verified via `Glob apps/web/src/app/**/page.tsx` + layouts. Route groups `(x)` do NOT appear in URLs.

### Bucket 1 — Vitrine publique (Tier 1, full neon) — SC#1
| Surface | File | Notes |
|---------|------|-------|
| Accueil / landing | `app/[locale]/(marketing)/page.tsx` → `components/landing/NexaLanding.tsx` (+ `NexaLandingEffects.tsx`, `nexa-landing.css`) | volt→green reconcile + orphan cleanup (D-01/D-02) |
| Tarifs | `app/[locale]/(marketing)/tarifs/page.tsx` | Tier 1; `<Disclaimer />` + no-perf-claims |
| Méthodologie | `app/[locale]/(marketing)/methodologie/page.tsx` | Tier 1 |
| Légal | `app/[locale]/(marketing)/legal/[doc]/page.tsx` | Tier 1; legal/disclaimer namespace excluded from perf scan |
| Paiement-bientôt (funnel teaser) | `app/[locale]/(marketing)/paiement-bientot/page.tsx` | sits in marketing group; funnel CTA — treat as Tier 2 app/funnel per UI-SPEC |
| Landing-supporting components | `components/landing/{BigGauge,HowItWorks,ScoreFeature,SignalDemo,TelegramBand,PricingTiers}.tsx`, `components/hero/{Hero,WireframeGlobe,DataRain,HeroTilt,FloatingCards}.tsx`, `components/nexa/{Eyebrow,ScoreRing,ConfidenceStat,Logo,Marquee}.tsx`, `components/Footer.tsx` | Mostly already tokenized (Phase 11); verify no literals |

### Bucket 2 — Auth + compte/abonnement + espace membre + paiement/funnel (Tier 2, app intermediate) — SC#2
| Surface | File | RLS / landmine |
|---------|------|----------------|
| Login | `app/[locale]/(auth)/login/page.tsx` | calm surface → ambient data-rain OK |
| Signup | `app/[locale]/(auth)/signup/page.tsx` | calm surface → ambient data-rain OK |
| Abonnement / paiement funnel | `app/[locale]/(account)/abonnement/page.tsx` | layout = `requireUser()` only; Toaster mounted |
| Membre — liste signaux | `app/[locale]/(member)/signaux/page.tsx` | **RLS fetch via `createClient()` + `fetchActiveSignals` — DO NOT TOUCH.** Dense data → readability first, no heavy neon |
| Membre — détail trade + chart | `app/[locale]/(member)/signaux/[id]/page.tsx` | hosts `CandleChartLazy`/`CandleChart`; dense → no heavy neon |
| Member layout (ExpiryBanner) | `app/[locale]/(member)/layout.tsx` | `requireActiveSub()` + RLS read of `subscriptions` — DO NOT TOUCH fetch |
| Account layout | `app/[locale]/(account)/layout.tsx` | `requireUser()` only (purchase path) |
| Affiliation (member-facing) | `app/[locale]/affiliation/page.tsx`, `app/[locale]/affiliation/dashboard/page.tsx` | dashboard already tokenized Phase 15 (in `theme-scan` foundation list) |
| Dashboard stub | `app/[locale]/dashboard/page.tsx` | stub; full dashboards are Phases 19-20 (out of scope) |
| Member components | `components/signals/{FilterBar,SignalList,SignalCard,SignalDetail,RealtimeBadge,GlossaryTooltip,ContributingFactors,SignalsDisclaimerBanner,CandleChart,CandleChartLazy}.tsx`, `components/member/ExpiryBanner.tsx`, `components/track-record/{TrackRecordBlock,TrackRecordView}.tsx` | ExpiryBanner + TrackRecordView already tokenized (Phase 11/15) |

### Bucket 3 — Académie + back-office /admin (Tier 2 académie / Tier 3 admin) — SC#3
| Surface | File | Tier / notes |
|---------|------|-------------|
| Académie index | `app/[locale]/(marketing)/academie/page.tsx` | Tier 2; RTL + FR fallback (RESKIN-04) |
| Académie article/cours | `app/[locale]/(marketing)/academie/[slug]/page.tsx` | Tier 2; FallbackBanner |
| Académie leçon | `app/[locale]/(marketing)/academie/[slug]/[lesson]/page.tsx` | Tier 2 |
| Académie components | `components/academie/{Callout,Steps,Figure,TradeExample,mdx-components,Toc,ContentCard,FallbackBanner,FilterBar}.tsx` | MDX-rendered content |
| Admin home | `app/(admin)/page.tsx` | **Tier 3 sober.** Already tokenized (Phase 15) |
| Admin membres | `app/(admin)/membres/page.tsx` | Tier 3 |
| Admin signaux (list + detail) | `app/(admin)/signaux/page.tsx`, `app/(admin)/signaux/[id]/page.tsx` | list already tokenized (Phase 15) |
| Admin santé | `app/(admin)/sante/page.tsx` | already tokenized |
| Admin file (queue) | `app/(admin)/file/page.tsx` | already tokenized |
| Admin affiliation | `app/(admin)/affiliation/page.tsx`, `affilies/page.tsx`, `payouts/page.tsx` | page + payouts already tokenized; `affilies` likely NOT yet |
| Admin layout/sidebar | `app/(admin)/layout.tsx` (+ `_components/AdminSidebar`) | mono-FR, `requireRole('superadmin')` → notFound; no effects |
| Admin components | `components/admin/{MemberRowActions,QueueRowActions,ApplicationRowActions,PayoutRowAction}.tsx` | row actions / dialogs |

**Already-tokenized (Phase 15 foundation — verify only, low effort):** LanguageSwitcher, `(admin)/{signaux,page,sante,affiliation,file,affiliation/payouts}`, `affiliation/dashboard`, TrackRecordView. The reskin's net-new tokenization work concentrates on `(marketing)` non-landing, `(auth)`, `(member)`, `(account)`, `academie`, `admin/membres`, `admin/signaux/[id]`, `admin/affiliation/affilies`.

## Shared DS v3 Primitives, Tokens & Component Map

### Component token layer (reference these only)
Backgrounds: `bg-background` (`#070b08`), `bg-secondary` / surface (`#0f1611` + translucent `rgba(255,255,255,0.035)`), `bg-popover`, `bg-muted`. Text: `text-foreground` (`#eafff1`), `text-muted-foreground`, `text-primary` (accent green). Accent: `--primary` `oklch(0.84 0.18 150)` (CTA, focus `ring-ring`, active segmented, eyebrow). Borders: `border-border` (`rgba(255,255,255,0.10)`). Glow: `--glow` `oklch(0.84 0.18 150 / 0.55)` — **box-shadow only, never a `ring-*` utility**. Signals: `--signal-bullish` / `--signal-bearish` (distinct from `--primary`, D-11). Risk: `--risk-moderate` amber for ScoreRing only. Destructive: `--destructive`.

### Vendored shadcn components (already token-bound, inherit GREEN)
`components/ui/`: button, card, badge, input, label, separator, dropdown-menu, dialog, tooltip, select, collapsible, skeleton, table, textarea, tabs, progress, alert-dialog, form, sonner, alert (20). No re-tokenization needed — enrich with glow accent where the tier calls for it.

### Closest existing analogs to copy from
- Token-pure RSC page → `app/(admin)/signaux/page.tsx` or `affiliation/dashboard/page.tsx` (Phase 15 output).
- Glow/data-rain source → `components/landing/nexa-landing.css` (`--glow` box-shadows; `.data-rain`/`.data-col`).
- Already-wired Tier 2 member component → `components/member/ExpiryBanner.tsx`.
- Disclaimer (single source) → `components/Disclaimer.tsx` (i18n `disclaimer.footer`, logical props).

## Common Pitfalls

### Pitfall 1: Reskin accidentally migrates an RLS read to the client
**What goes wrong:** "Tidying" a member/account page moves a `createClient()` server fetch into a client component or to the browser anon client.
**Why:** Reskinning touches the same files that contain the gated fetch.
**How to avoid:** Treat `createClient()` from `lib/supabase/server.ts`, `requireUser/requireActiveSub/requireRole` (`lib/auth/gate.ts`), and `lib/signals/queries.ts` as **read-only, do-not-edit** zones. Never import `lib/supabase/admin-service.ts` (service_role) into a page. Reskin = className + structure only.
**Warning signs:** diff touches `from('...')`, `.select(`, `createClient`, `service_role`, or moves a fetch under `'use client'`.

### Pitfall 2: CandleChart recolored via CSS
**What goes wrong:** Someone adds CSS to recolor candles; canvas ignores it.
**How to avoid:** `CandleChart.tsx` already resolves tokens via `getComputedStyle` (`readChartColors`) and re-applies on `.dark` mutation. Preserve this; if palette changes, change the token, not the chart.
**Warning signs:** any candle color expressed in CSS/className instead of the lwc `applyOptions`.

### Pitfall 3: "Tokenized but fade" pages pass token scan yet fail DoD
**What goes wrong:** A surface swaps to tokens but applies no tier accent → fails DoD condition 2.
**How to avoid:** Each plan declares the surface's tier and applies the matching accent (Tier 1 full, Tier 2 discreet glow, Tier 3 minimal border). Verifier checks accent presence, not just token purity.

### Pitfall 4: Landing volt orphans left live
**What goes wrong:** Removing the toggle markup but leaving `data-theme="volt"` default (line 58), `NexaLandingEffects` theme-persistence logic (lines 26-40), and `.nxl[data-theme="volt"]` CSS (nexa-landing.css ~40-66, +83/85).
**How to avoid:** Hardcode `data-theme="green"`, delete toggle block (lines 84-87), strip theme listeners + `localStorage('nexa-landing-theme')`, neutralize the volt CSS block. `green` is the only live branch (D-03).
**Warning signs:** `no-mera`/`theme` scans won't catch this — needs explicit verification that no `data-theme="volt"` / `nxl-theme-toggle` / `nexa-landing-theme` strings remain.

### Pitfall 5: RTL / FR-fallback regression on Académie
**What goes wrong:** A physical-direction utility (`pl-`, `ml-`, `text-left`) slips in during reskin; or Académie FR fallback breaks.
**How to avoid:** Logical properties only (`ps/pe/ms/me/inset-inline-*/text-start`). Single `<html lang dir>` stays in `[locale]/layout.tsx`. Preserve `academie/FallbackBanner`. `rtl-logical-props.test.ts` exists as a guard.

## Code Examples

### Token-pure utility mapping (the reskin operation)
```tsx
// BEFORE (raw palette — fails theme-scan)
<span className="text-emerald-400 border-emerald-600/30 bg-emerald-500/10" />
// AFTER (semantic tokens — DS v3)
<span className="text-[--signal-bullish] border-border bg-muted" />
// focus ring: ring-[#2563EB] → ring-ring ; glow stays box-shadow, never ring-*
```

### CandleChart recolor (already correct — preserve verbatim)
```ts
// CandleChart.tsx — lwc JS API, NOT CSS (D-11, Anti-Pattern 5)
const read = (n: string) => getComputedStyle(el).getPropertyValue(n).trim()
series.applyOptions({ upColor: read('--signal-bullish'), downColor: read('--signal-bearish'), /* …wicks/borders */ })
// MutationObserver on documentElement.class re-runs recolor() on theme flip
```

### RLS read — DO NOT EDIT (member list)
```ts
// (member)/signaux/page.tsx — server anon client, RLS is the barrier
const supabase = await createClient()                  // lib/supabase/server.ts
const { data, error } = await fetchActiveSignals(supabase, filters)  // never service_role, never client-migrated
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Green/Volt landing toggle | green-only hardcoded | Phase 16 (D-01) | remove toggle + volt orphans |
| Global `ThemeToggle`, light/dark | `forcedTheme="dark"`, `:root` = GREEN | Phase 15 | no `setTheme('light')` path |
| Raw palette utilities on foundation surfaces | semantic token utilities | Phase 15 (9 files) | rest of surfaces follow same pattern in P16 |
| `@supabase/auth-helpers` | `@supabase/ssr 0.12.0` | earlier phase | unchanged; reskin doesn't touch auth wiring |

**Deprecated/outdated:** landing `data-theme="volt"`, `nxl-theme-toggle`, `localStorage('nexa-landing-theme')` — all become orphans to remove (D-02).

## Runtime State Inventory

> This phase is a reskin of in-repo source only. No data migration, no live-service config, no OS-registered state, no secret/env renames.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — verified: reskin changes className/markup, no DB keys/collections renamed | none |
| Live service config | None — verified: no external dashboard/service string renamed | none |
| OS-registered state | None — Task Scheduler jobs (apps/jobs) untouched by a UI reskin | none |
| Secrets/env vars | None — no env var renamed | none |
| Build artifacts | `localStorage('nexa-landing-theme')` is **client-side persisted state** that becomes stale after volt removal — harmless (read defensively, never written again once toggle removed) | confirm no code still reads it expecting volt |

## Validation Architecture

> Nyquist enabled. This is visual/reskin work: verification leans on **existing guardrail scans + design review + structural assertions**, not new unit tests. Framework: **vitest 4.1.8** (config at repo root `vitest.config.ts`; glob includes `apps/web/test/**`, `apps/web/src/**/__tests__/**`, `apps/web/src/lib/**/*.test.ts`). E2E: **Playwright 1.60.0** (`apps/web/e2e/*.spec.ts`) — assert preservation only, not run as P16 gate.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.8 (+ Playwright 1.60.0 for E2E preservation) |
| Config file | `vitest.config.ts` (repo root) |
| Quick run command | `pnpm test` (runs all vitest suites incl. guardrails) |
| Full suite command | `pnpm test && pnpm lint:i18n && pnpm typecheck` |

### Phase Requirements → Validation Map
| Req / SC | Behavior | Validation Type | Command / Mechanism | Exists? |
|----------|----------|-----------------|---------------------|---------|
| SC#4 / D-09.3 | No unmeasured % / gain promise | scan (vitest) | `pnpm vitest run apps/web/test/no-perf-claims.test.ts` | ✅ exists |
| SC#4 / D-09.3 | No "MERA" brand | scan (vitest) | `pnpm vitest run apps/web/test/no-mera-brand.test.ts` | ✅ exists |
| D-09.1 / THEME-02 | Zero bespoke CSS / color literal | scan (vitest) | `pnpm vitest run apps/web/src/styles/__tests__/theme-scan.test.ts` | ✅ exists — **extend `FOUNDATION_FILES` + `FORBIDDEN_PALETTE` to cover new surfaces** (Wave 0) |
| THEME-04 / RESKIN-04 | RTL logical props only | scan (vitest) | `apps/web/src/styles/__tests__/rtl-logical-props.test.ts` | ✅ exists |
| THEME-05 | Translucent-surface AA contrast | scan (vitest) | `apps/web/src/styles/__tests__/contrast-aa.test.ts` | ✅ exists |
| RESKIN-* / i18n | No hardcoded text, key parity | scan (node) | `pnpm lint:i18n` (`scripts/check-i18n-hardcoded.mjs`) | ✅ exists |
| SC#2 / D-12 | RLS fetch NOT client-migrated | structural assertion | grep/diff gate: no `service_role`/`admin-service` imported in pages; no `createClient` from `lib/supabase/client` in gated server pages; `from(`/`.select(` unchanged in member/account/admin reads | ❌ Wave 0 (add assertion) |
| SC#4 / D-11 | CandleChart recolored via lwc JS API | structural assertion | grep gate: `CandleChart.tsx` resolves `--signal-bullish`/`--signal-bearish` via `getComputedStyle`/`applyOptions`, zero candle color in CSS | ❌ Wave 0 (add assertion) |
| D-01/D-02 | Volt orphans removed, green-only | structural assertion | grep gate: zero `data-theme="volt"`, `nxl-theme-toggle`, `nexa-landing-theme` under `apps/web/src` | ❌ Wave 0 (add assertion) |
| D-09.2 | Tier accent applied (not fade) | design review | per-surface screenshot/visual check against tier table; verifier grid | manual (design-review) |
| D-09.4 | data-testid / ARIA preserved | E2E preservation | diff gate + `pnpm test:e2e` smoke (Phase 21 specs unchanged) | ✅ specs exist |

### Sampling Rate
- **Per task commit:** `pnpm vitest run <touched scan suite>` (no-perf-claims / no-mera-brand / theme-scan) + `pnpm lint:i18n`.
- **Per wave merge:** `pnpm test` (full vitest, all guardrails green).
- **Phase gate:** `pnpm test && pnpm lint:i18n && pnpm typecheck` green + structural assertion gates (RLS-unchanged, lwc-recolor, volt-orphan-free) + design-review tier sign-off before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] Extend `apps/web/src/styles/__tests__/theme-scan.test.ts` — add the newly-reskinned surfaces to `FOUNDATION_FILES` and any new raw-palette tokens to `FORBIDDEN_PALETTE` (keeps scan meaningful for P16 scope). *(Discretion D-09: extend vs new test — extending is strongly preferred.)*
- [ ] Add **RLS-unchanged assertion** (grep/diff test): no page imports `admin-service`/uses `service_role`; gated reads still server-side `createClient`.
- [ ] Add **lwc-recolor assertion** (grep test): no candle color in CSS; `CandleChart` recolor via `getComputedStyle`/`applyOptions` intact.
- [ ] Add **volt-orphan-free assertion** (grep test): zero `data-theme="volt"` / `nxl-theme-toggle` / `nexa-landing-theme` in `apps/web/src`.
- [ ] (If a per-surface tier-accent automated check is desired — discretion D-09 — otherwise design-review covers D-09.2.)

## Security Domain

Reskin = presentation only; the security-relevant invariant is **non-regression**, not new controls.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control (must stay intact) |
|---------------|---------|-------------------------------------|
| V4 Access Control | yes | RLS gating + anti-IDOR isolation: `requireUser/requireActiveSub/requireRole` + Postgres RLS via anon client. **Reskin must not weaken** (D-12) |
| V5 Input Validation | yes (preserve) | `parseSignalsParams` Zod whitelist on member list — untouched |
| V2 Auth | no (no change) | `@supabase/ssr` cookie auth unchanged |
| V6 Cryptography | no | n/a |

### Known Threat Patterns
| Pattern | STRIDE | Mitigation (preserve) |
|---------|--------|----------------------|
| Fetch moved client-side exposes data past RLS | Information Disclosure | Server `createClient` + RLS stays; never `service_role` on pages (D-12) |
| Admin back-office existence leak | Information Disclosure | `requireRole('superadmin')` → `notFound()` (404) — keep |
| IDOR on trade detail | Elevation/Disclosure | RLS `has_active_subscription()` is the barrier; reskin keeps gate + query intact |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `admin/affiliation/affilies`, `admin/membres`, `admin/signaux/[id]`, and most `(marketing)`/`(auth)`/`(member)`/`academie` pages are NOT yet fully tokenized (only the 9 Phase-15 foundation files are) | Inventory | Low — verified the 9 from `theme-scan`/`15-03-SUMMARY`; others inferred. Verify per-surface during planning |
| A2 | Extending `theme-scan.test.ts` is the chosen guardrail path (vs a brand-new scan) | Validation | Low — explicitly Claude's discretion (D-09); extending is the recommended, lower-risk option |
| A3 | `paiement-bientot` (under `(marketing)`) should be treated as Tier 2 funnel, not Tier 1 vitrine | Inventory | Low — UI-SPEC lists paiement/funnel as Tier 2; confirm with planner |

## Open Questions

1. **Exact set of not-yet-tokenized surfaces** — Resolution: planner runs `theme-scan`'s raw-palette regex across all `(marketing)/(auth)/(member)/(account)/academie/admin` pages to produce the precise residual list before wave-splitting. Cheap, mechanical.
2. **Per-surface tier-accent automated proof vs design-review** — Recommendation: keep D-09.2 (accent applied) as a design-review/verifier-grid item; automate only token-purity + guardrail scans (over-automating "is the glow present" is brittle).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| pnpm | all scripts | ✓ | 9.15.9 | — |
| node | vitest/scripts | ✓ (assumed; repo runs) | — | — |
| vitest | guardrail scans | ✓ | 4.1.8 | — |
| Playwright | E2E preservation | ✓ (devDep) | 1.60.0 | browsers may need `playwright install` (Phase 21 concern, not P16 gate) |

No external services required — reskin is source-only, runs fully offline against the repo.

## Project Constraints (from CLAUDE.md)

- **Next.js 15 locked** — do NOT jump to 16 (`@supabase/ssr` stabilized on 15).
- **No service_role on pages** — service_role reserved for jobs; pages use anon client + RLS.
- **Tailwind v4 CSS-first** — no `tailwind.config`; shadcn must be v4-compatible.
- **lightweight-charts v5** — `addSeries(SeriesType, …)` API; recolor via JS API.
- **Strict TS / Zod at boundaries** — preserve existing `parseSignalsParams` validation.
- **No hardcoded secrets / no naked %** — `applyThreshold` (`@app/core`) + N + provenance for any % (D-13).
- **80% coverage / TDD** — for reskin, guardrail scans + structural assertions are the operative gates (visual work, not unit-testable logic).

## Sources

### Primary (HIGH confidence — codebase-verified this session)
- `apps/web/package.json`, root `package.json`, `vitest.config.ts` — stack + script + test glob.
- `apps/web/test/no-perf-claims.test.ts`, `no-mera-brand.test.ts`; `apps/web/src/styles/__tests__/theme-scan.test.ts` — guardrail mechanics (scanned namespaces, foundation file list, forbidden palette regex).
- `apps/web/src/app/**/page.tsx` + layouts (`[locale]/layout.tsx`, `(member)/layout.tsx`, `(account)/layout.tsx`, `(admin)/layout.tsx`) — full route inventory + RLS gate pattern.
- `apps/web/src/components/signals/CandleChart.tsx` — lwc JS-API recolor (already D-11 compliant).
- `apps/web/src/components/landing/{NexaLanding,NexaLandingEffects}.tsx` + `nexa-landing.css` — volt/green blocks, glow/data-rain/aura primitives, orphans.
- `apps/web/src/styles/globals.css` (head) — 3-layer token architecture.
- `apps/web/src/components/Disclaimer.tsx`, `lib/supabase/server.ts` + `admin-service.ts` presence, `lib/auth/gate.ts`.
- `.planning/phases/15-*/15-03-SUMMARY.md` — 9 foundation surfaces already tokenized.
- `16-CONTEXT.md`, `16-UI-SPEC.md`, `15-UI-SPEC.md` (inherited) — frozen design + DoD + tier contract.

### Secondary
- `.planning/ROADMAP.md` Phase 16 Notes (anti-patterns, "recherche légère"), `REQUIREMENTS.md` (RESKIN-01..06, VITR-03).

### Tertiary
- None — no external research needed (design frozen, no new deps).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new deps; versions read from package.json.
- Surface inventory: HIGH — exhaustive `Glob` of `app/**/page.tsx` + layouts.
- Guardrails: HIGH — read all three vitest suites + config glob.
- RLS/CandleChart/landing landmines: HIGH — read the actual files.
- Which surfaces remain un-tokenized: MEDIUM — 9 confirmed from Phase 15; rest inferred (A1, resolve mechanically at plan time).

**Research date:** 2026-06-23
**Valid until:** stable (frozen design + in-repo only) — re-check only if Phase 15 tokens or guardrail tests change.
