# Phase 10: Fondation design system NEXA - Research

**Researched:** 2026-06-21
**Domain:** Tailwind v4 CSS-first design tokens (OKLCH), `next/font/local` self-hosting, next-themes no-flash, RTL logical properties
**Confidence:** HIGH

## Summary

Phase 10 is a foundation/plumbing phase: migrate `globals.css` from flat HEX tokens to a layered OKLCH token system (primitive → semantic → component), replace 2 fonts (Inter + IBM Plex Arabic) with 5 self-hosted NEXA families, and flip the brand from institutional blue to cyber-green/royal-purple — all while keeping next-themes no-flash and RTL logical properties intact. The locked decisions (D-01→D-06) and the approved 10-UI-SPEC.md already resolve the *values*; the open work is the *CSS architecture* and the *font migration mechanics*.

The OKLCH values declared in 10-UI-SPEC.md were independently re-derived in this session via the sRGB→OKLab→OKLCH transform and match to 4 decimal places — they are correct and can be used verbatim. All 5 Fontsource packages exist on npm at current versions; the existing repo already self-hosts IBM Plex `.woff2` copied from `@fontsource/.../files/`, so the same sourcing path applies to the 5 new families (zero new runtime dependency — `@fontsource/*` packages are devDependencies / a copy source, the `.woff2` files are committed and loaded via `next/font/local`).

**Primary recommendation:** Three CSS layers in `globals.css` — raw OKLCH ramps in `:root` (primitive, theme-independent) → semantic `--primary`/`--background`/`--ring` in `:root`+`.dark` (the only layer that flips) → `@theme inline --color-*` (component, unchanged names so the 20 `ui/` primitives reskin automatically). Self-host 5 families at 2 weights each (400 + 600) via `next/font/local` arrays, sourcing `.woff2` from `@fontsource/*/files/`. Keep next-themes exactly as-is.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| OKLCH token layers | CDN/Static (`globals.css`) | — | Pure CSS, compiled by Tailwind v4 at build; no JS runtime |
| Theme flip (light/dark) | Browser (next-themes pre-paint script) | Frontend Server (SSR `suppressHydrationWarning`) | Class toggled on `<html>` before paint; SSR avoids hydration mismatch |
| Font self-hosting | Frontend Server (`next/font/local` build-time) | CDN/Static (`.woff2` assets) | Next bundles `.woff2`, generates `@font-face` + `--font-*` var at build, served from app origin |
| `<html dir>` + lang | Frontend Server (RSC `[locale]/layout.tsx`) | — | Set server-side from route locale; no client JS |
| RTL mirroring | CDN/Static (logical-property CSS) | — | `ms-*`/`me-*`/`ps-*`/`start-*` resolve against `dir` automatically |

## Standard Stack

No new runtime dependency (CLAUDE.md / ROADMAP hard rule). This phase uses only the already-locked stack.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tailwind CSS | `4.3.0` (locked) | CSS-first token engine, `@theme`/`@theme inline`/`@custom-variant` | Already in repo; native OKLCH + CSS-var tokens [VERIFIED: repo globals.css] |
| next/font/local | bundled w/ Next `15.5.19` | Build-time self-host of 5 `.woff2` families → `--font-*` vars | Zero runtime CDN; already used for IBM Plex [VERIFIED: node next 15.5.19] |
| next-themes | (locked, present) | Class-strategy pre-paint no-flash theme | Kept as-is per D-06 [VERIFIED: repo ThemeProvider] |

### Supporting (font sourcing — NOT runtime deps)
| Package | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@fontsource/archivo` | `5.2.8` | Source `.woff2` for Archivo (display) | Copy `files/*.woff2` into `src/fonts/`, then uninstall or keep as devDep [VERIFIED: npm] |
| `@fontsource/space-grotesk` | `5.2.10` | Source `.woff2` for Space Grotesk (body/UI) | idem [VERIFIED: npm] |
| `@fontsource/jetbrains-mono` | `5.2.8` | Source `.woff2` for JetBrains Mono (numeric) | idem [VERIFIED: npm] |
| `@fontsource/chakra-petch` | `5.2.7` | Source `.woff2` for Chakra Petch (accents) | idem [VERIFIED: npm] |
| `@fontsource/noto-sans-arabic` | `5.2.10` | Source `.woff2` for Noto Sans Arabic (arabic + latin subset) | idem; already installed [VERIFIED: npm + node_modules] |

**Sourcing precedent (already in repo):** the existing `src/fonts/IBMPlexSansArabic-*.woff2` were copied from `@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-<subset>-<weight>-normal.woff2` [VERIFIED: `ls node_modules/@fontsource/ibm-plex-sans-arabic/files`]. Follow the identical path for the 5 NEXA families — pick the `latin` subset for the 4 latin families and `arabic` (+ optionally `latin`) subset for Noto.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `next/font/local` + committed `.woff2` | `@fontsource` CSS `@import` | Rejected — `@import "@fontsource/..."` injects `@font-face` but loses Next's per-route preload + `size-adjust` fallback; also harder to guarantee subset. Stick with `next/font/local` (matches existing pattern). |
| `next/font/local` | `next/font/google` | Rejected for new families — Google route still needs network at build and offers less control; D-03 removes the Google (Inter) path entirely. |
| Targeted OKLCH stops | Full 50–950 ramp ×N hues | Full ramp is over-engineering for a foundation that only needs ~6 semantic roles. Recommend **targeted stops** (see Pattern 1). |

**Sourcing install (dev-time only, NOT runtime):**
```bash
# in apps/web — only for the 4 not-yet-present families (noto-sans-arabic already installed)
pnpm add -D @fontsource/archivo @fontsource/space-grotesk @fontsource/jetbrains-mono @fontsource/chakra-petch
# then copy chosen subset/weight .woff2 from node_modules/@fontsource/*/files/ into apps/web/src/fonts/
```

**Version verification (this session):** `npm view @fontsource/<name> version` returned 5.2.7–5.2.10 for all five [VERIFIED: npm, 2026-06-21]. Next.js `15.5.19` confirmed via `node -e require(next/package.json).version` [VERIFIED].

## Package Legitimacy Audit

> Phase installs **no new runtime packages**. `@fontsource/*` are dev-time `.woff2` sources only; final artifacts are committed font files + CSS. Audit covers the font-source packages for supply-chain hygiene.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| @fontsource/archivo | npm | mature (5.x) | high | github.com/fontsource/fontsource | n/a (unavailable) | Approved — official Fontsource org |
| @fontsource/space-grotesk | npm | mature | high | fontsource/fontsource | n/a | Approved |
| @fontsource/jetbrains-mono | npm | mature | high | fontsource/fontsource | n/a | Approved |
| @fontsource/chakra-petch | npm | mature | high | fontsource/fontsource | n/a | Approved |
| @fontsource/noto-sans-arabic | npm | mature | high | fontsource/fontsource | n/a | Approved — already in repo |

**Packages removed due to [SLOP]:** none.
**Packages flagged [SUS]:** none.
slopcheck was not available in this environment; mitigations: all five belong to the well-known `@fontsource` monorepo (single GitHub source, millions of weekly downloads, already trusted by the existing IBM Plex setup). Risk is low. If the planner wants strict provenance, gate the 4 new `pnpm add -D` behind a single `checkpoint:human-verify` task. No `postinstall` scripts in Fontsource packages (they ship static assets) [ASSUMED — verify with `npm view @fontsource/archivo scripts.postinstall`].

## Architecture Patterns

### System Architecture Diagram

```
                         BUILD TIME (Next.js / Tailwind v4)
  src/fonts/*.woff2 ──► next/font/local ──► @font-face + --font-* CSS vars
  @fontsource/*/files ──(copy)──┘                       │
                                                        ▼
  globals.css ──► Tailwind v4 compile ──► utility classes + resolved tokens
     │  @theme            (primitive: --font-*, raw OKLCH ramps)
     │  :root / .dark     (semantic: --primary,--background,--ring…) ◄─ ONLY layer that flips
     │  @theme inline     (component: --color-*, --radius-*) ──► bg-primary, text-foreground
     ▼
                         RUNTIME (browser)
  next-themes pre-paint script (inline, <head>) ──► sets class="dark" on <html> BEFORE paint
                                                        │ (no flash)
  RSC [locale]/layout.tsx ──► <html lang dir suppressHydrationWarning>
                              <body class={5× font .variable}> ──► --font-* live on body
                                                        │
  :lang(ar) ──► font-family: var(--font-arabic); line-height:1.6
  dir=rtl + logical props (ms-/me-/ps-/start-) ──► mirrored layout
```

### Recommended `globals.css` layer partitioning (resolves Unknown #2)

```
@import "tailwindcss";
@import "tw-animate-css";
@custom-variant dark (&:where(.dark, .dark *));   /* KEEP */

@theme {
  /* PRIMITIVE — fonts (5 families) + raw NEXA OKLCH ramps. Theme-INDEPENDENT.
     These never flip; they are the source palette. */
  --font-display: var(--font-archivo);
  --font-sans:    var(--font-space-grotesk);
  --font-mono:    var(--font-jetbrains-mono);
  --font-accent:  var(--font-chakra-petch);
  --font-arabic:  var(--font-noto-arabic);

  /* brand primitives (targeted stops, not full 50–950) */
  --nexa-green-500: oklch(0.7754 0.1896 155.45); /* #03d87f brand */
  --nexa-green-600: oklch(0.7100 0.1800 155.45); /* darker step for borders/hover */
  --nexa-purple-500: oklch(0.4233 0.1772 302.98);/* #63279b */
  --nexa-purple-400: oklch(0.5400 0.1900 302.98);/* lighter, dark-bg eyebrow */
  /* neutrals — light & dark anchors */
  --nexa-white:  oklch(1.0000 0 0);
  --nexa-ink:    oklch(0.1663 0.0262 269.37);    /* #0a0e1a near-black navy */
  /* trading signals — SEPARATE namespace (D-05) */
  --nexa-signal-bull: oklch(0.6271 0.1699 149.21); /* #16a34a sober green */
  --nexa-signal-bear: oklch(0.5771 0.2152 27.33);  /* #dc2626 red */
}

@theme inline {
  /* COMPONENT — shadcn token names → semantic vars. NAMES UNCHANGED from v2.0
     so the 20 ui/ primitives reskin automatically. */
  --color-background: var(--background);
  --color-primary: var(--primary);
  --color-ring: var(--ring);
  /* …all existing --color-* mappings, untouched names… */
  --radius-sm: calc(var(--radius) - 4px); /* …unchanged… */
}

:root {
  /* SEMANTIC — light. Maps semantics → primitives. */
  --radius: 0.625rem;
  --background: var(--nexa-white);
  --foreground: var(--nexa-ink);
  --primary: var(--nexa-green-500);
  --primary-foreground: var(--nexa-ink);     /* green is light → dark text */
  --ring: var(--nexa-green-500);
  --destructive: var(--nexa-signal-bear);    /* see Unknown #6 — now real red */
  /* signal tokens exposed semantically too (Phase 11 consumes) */
  --signal-bullish: var(--nexa-signal-bull);
  --signal-bearish: var(--nexa-signal-bear);
  /* …secondary/card/muted/border/input from neutral ramp… */
}

.dark {
  /* SEMANTIC — dark. Only override the values that flip. */
  --background: var(--nexa-ink);
  --foreground: oklch(0.95 0.01 260);
  --primary: var(--nexa-green-500);          /* may brighten for dark contrast */
  --primary-foreground: var(--nexa-ink);
  --ring: var(--nexa-green-500);
  /* signals usually KEEP same hue across themes (a loss is red in both) */
}
```

**Key idiom (Tailwind v4 CSS-first):**
- `@theme` → registers *design-token-as-utility* (so `font-display`, `text-nexa-green-500` exist). Put primitives here when you want a utility generated.
- `@theme inline` → emits `var(--x)` references *without* re-declaring the value, so `:root`/`.dark` overrides win. This is exactly why semantic flipping works — component layer points at `var(--primary)`, not a frozen value. [CITED: existing repo `@theme inline` block already uses this correctly]
- `:root`/`.dark` plain CSS → the flip layer. next-themes toggles `.dark` on `<html>`; `@custom-variant dark` resolves it.

### Pattern 1: Targeted tonal stops, not a full ramp (resolves Unknown #1)

For a 6-role semantic system you need **anchors + 1–2 adjacent stops per brand hue**, not a 50–950 ramp. Recommended stops:
- Green: 500 (brand `#03d87f`), 600 (hover/border, ~L 0.71), optionally 400 (dark-bg glow, ~L 0.84).
- Purple: 500 (`#63279b`), 400 (lighter eyebrow on dark, ~L 0.54).
- Neutrals: derive a 5-step grey ramp in OKLCH at fixed chroma ~0.02–0.03, hue ~265 (navy-tinted) to match the ink — keeps perceptual neutrality between light card surfaces and dark slate.

OKLCH perceptual-uniformity advantage: hold C and H constant, vary only L to make tonal steps — steps look evenly spaced and hue does not drift (unlike HSL). For dark-theme contrast, *raising L slightly* (e.g. green 500→ ~0.80) is enough; do not change hue.

### Pattern 2: 5-family `next/font/local` (resolves Unknown #4)

```typescript
// lib/fonts.ts (shape — planner writes full file)
import localFont from 'next/font/local'

export const archivo = localFont({
  src: [{ path: '../fonts/Archivo-Regular.woff2', weight: '400', style: 'normal' },
        { path: '../fonts/Archivo-SemiBold.woff2', weight: '600', style: 'normal' }],
  variable: '--font-archivo', display: 'swap',
})
// …spaceGrotesk → --font-space-grotesk, jetbrainsMono → --font-jetbrains-mono,
//   chakraPetch → --font-chakra-petch (all latin subset, weights 400+600)…
export const notoArabic = localFont({
  src: [{ path: '../fonts/NotoSansArabic-Regular.woff2', weight: '400', style: 'normal' },
        { path: '../fonts/NotoSansArabic-SemiBold.woff2', weight: '600', style: 'normal' }],
  variable: '--font-noto-arabic', display: 'swap',
})
```
Layout: `<body className={[archivo, spaceGrotesk, jetbrainsMono, chakraPetch, notoArabic].map(f=>f.variable).join(' ')}>`.

**Weights: 2 per family (400 + 600)** — matches the UI-SPEC type scale (regular + semibold only). 5 families × 2 weights = 10 `.woff2`, each subset-limited (latin ≈ 15–40 KB, arabic ≈ 30–60 KB). Total foundation font payload ≈ 300–450 KB across the app, but only the latin set preloads on non-AR routes (Noto loads on demand via `:lang(ar)` usage). Do **not** self-host weights you will not render — the scale uses only 400/600, so 300/500/700 are dead weight.

### Anti-Patterns to Avoid
- **Re-declaring values in `@theme inline`** instead of referencing `var(--x)` → breaks theme flip. The inline block must contain only `var()` references.
- **Renaming semantic tokens** (`--primary`→`--brand`) → breaks the 20 `ui/` components (they consume `--color-primary`). D-04/UI-SPEC: keep names identical.
- **Putting brand green into a directional/signal context** → violates D-05. Brand green (hue 155, L 0.78) and bullish green (hue 149, L 0.63) must stay separate tokens.
- **Physical properties** (`ml-`, `left-`, `pr-`) anywhere this phase touches base layer → breaks RTL. Logical only.
- **`@import "@fontsource/..."` in globals.css** → bypasses Next preload/`size-adjust`; not the repo pattern.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| No-flash theme | Custom `<script>` reading localStorage | next-themes (kept, D-06) | Already solves SSR mismatch + pre-paint; D-06 forbids extending it |
| `@font-face` + preload + fallback metrics | Hand-written `@font-face` blocks | `next/font/local` | Auto `size-adjust`/`ascent-override` fallback (less CLS), per-route preload |
| RTL mirroring | `[dir=rtl]` override sheets | Tailwind logical utilities (`ms-/me-/ps-/start-`) | Browser resolves against `dir`; already the repo convention |
| HEX→OKLCH conversion | Eyeballing values | Values in 10-UI-SPEC (re-verified this session) | Already computed & mathematically confirmed |
| Tonal ramp generation | Manual hue tweaking in HSL | OKLCH L-only steps at fixed C/H | Perceptual uniformity for free |

**Key insight:** Every hard part of this phase already has a locked solution (next-themes, logical props, next/font/local, computed OKLCH). The phase is *assembly + migration*, not invention.

## Runtime State Inventory

> This is a rename/migration-flavored phase (font + token swap). State audit:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | next-themes writes `theme: light|dark` to `localStorage`. Key/values unchanged (still light/dark, D-06 mono-brand). | None — no migration; stored value stays valid. |
| Live service config | None — no external service stores tokens/fonts. | None. |
| OS-registered state | None. | None. |
| Secrets/env vars | None — fonts/tokens are not secret-driven. | None. |
| Build artifacts | `src/fonts/IBMPlexSansArabic-Regular.woff2` + `-SemiBold.woff2` become orphaned after D-01 swap. `@fontsource/ibm-plex-sans-arabic` node_module dep no longer needed. Inter via `next/font/google` removed (D-03). | Delete 2 IBM Plex `.woff2`; remove `ibmPlexArabic`+`inter` exports from `lib/fonts.ts`; drop `inter`/`ibmPlexArabic` imports + `.variable` usage in `[locale]/layout.tsx`; optionally `pnpm remove @fontsource/ibm-plex-sans-arabic`. |

**Canonical question — after every file is updated, what still references old state?** The `--font-latin`/`--font-inter`/`--font-ibm-plex-arabic` CSS vars in `globals.css` (lines 18–19, 29) and the `inter.variable`/`ibmPlexArabic.variable` in layout (line 52) + `font-family: var(--font-latin)` at line 119. All must repoint to the new `--font-*` vars or the body falls back to system-ui silently.

## Common Pitfalls

### Pitfall 1: FOUC when token *values* change (P13)
**What goes wrong:** Theme class is applied pre-paint, but if a token references a font var or OKLCH var that resolves late, a flash of fallback color/font can appear.
**Why it happens:** next-themes only guarantees the *class* is set before paint; it does not control whether your CSS vars are defined. As long as primitives live in `:root` (parsed with the stylesheet, synchronously) there is no second flash.
**How to avoid:** Keep all primitive + semantic vars in `globals.css` `:root`/`.dark` (not injected by JS). Keep `font-display: swap` (already). next-themes pre-paint script stays sufficient — confirmed, no extension needed (D-06).
**Warning signs:** A one-frame color jump on reload in dark mode → a token resolving from a non-`:root` scope.

### Pitfall 2: RTL leak via physical properties (P8)
**What goes wrong:** A base-layer rule using `left`/`margin-right` does not mirror in `dir=rtl`.
**Why it happens:** Logical convention is enforced per-utility, but raw CSS in `@layer base` can slip in physical props.
**How to avoid:** Any base rule this phase adds (e.g. body, `:lang(ar)`) uses logical props or direction-neutral props only. `line-height`/`font-family` are direction-neutral — safe.
**Warning signs:** Header actions (`ms-auto`) drift to the wrong side in AR.

### Pitfall 3: Theme flip silently broken by value re-declaration in `@theme inline`
**What goes wrong:** Dark mode stops working after refactor.
**Why it happens:** Putting a literal OKLCH value (not `var(--primary)`) in `@theme inline` freezes it; `.dark` override never wins.
**How to avoid:** `@theme inline` = `var()` references only. Verify with the no-flash/dark test.
**Warning signs:** `bg-primary` identical in light and dark.

### Pitfall 4: Self-hosting the wrong subset (Noto Arabic)
**What goes wrong:** Arabic glyphs missing or huge file.
**Why it happens:** Copying the `latin` subset file for Noto, or copying the full unsubsetted file.
**How to avoid:** Use `@fontsource/noto-sans-arabic/files/noto-sans-arabic-arabic-<weight>-normal.woff2` for the arabic subset; optionally also the `latin` subset file if AR pages mix latin. The 4 latin families use their `latin` subset file.
**Warning signs:** `□□□` boxes in AR, or a 300 KB+ single woff2.

## Code Examples

### OKLCH conversion verification (this session, re-derivable)
```js
// sRGB→linear→OKLab→OKLCH (Björn Ottosson). Confirms 10-UI-SPEC values:
// #03d87f → oklch(0.7754 0.1896 155.45)  brand green
// #63279b → oklch(0.4233 0.1772 302.98)  royal purple
// #dc2626 → oklch(0.5771 0.2152 27.33)   destructive / bearish
// #16a34a → oklch(0.6271 0.1699 149.21)  bullish (sober)
// #0a0e1a → oklch(0.1663 0.0262 269.37)  ink (dark bg)
// Source: independent node computation, 2026-06-21 [VERIFIED]
```

### Trading-signal vs brand separation (D-05)
```css
/* PRIMITIVE: two green hues, never aliased to each other */
--nexa-green-500:    oklch(0.7754 0.1896 155.45); /* brand, vivid, hue 155 */
--nexa-signal-bull:  oklch(0.6271 0.1699 149.21); /* bullish, sober, hue 149 */
/* SEMANTIC: distinct consumers */
--primary:         var(--nexa-green-500);   /* CTA / ring — brand ONLY */
--signal-bullish:  var(--nexa-signal-bull); /* trade direction ONLY */
/* RULE (comment in CSS for Phase 11): --primary MUST NOT encode trade direction. */
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tailwind.config.js` theme | Tailwind v4 CSS-first `@theme` | TW v4 (2025) | All tokens live in CSS; repo already on v4 |
| HSL/HEX tokens | OKLCH tokens | TW v4 default palette is OKLCH | Perceptual ramps, wider gamut; this phase adopts it |
| `next/font/google` | `next/font/local` self-host | ongoing best practice (privacy/perf) | D-03 removes Google path entirely |
| `@supabase/auth-helpers` style flat tokens | layered primitive→semantic→component | shadcn/radix convention | Enables auto-reskin of `ui/` components |

**Deprecated/outdated:**
- Inter via `next/font/google` — removed (D-03).
- IBM Plex Sans Arabic — replaced by Noto Sans Arabic (D-01).
- `--destructive` as neutral grey — promoted to real red (Unknown #6 resolved below).

## Resolved Unknowns (Claude's Discretion)

| # | Unknown | Resolution | Source |
|---|---------|-----------|--------|
| 1 | HEX→OKLCH + ramp granularity | Values in UI-SPEC are correct (re-verified). Use **targeted stops** (500/600 green, 500/400 purple, 5-step neutral ramp), not full 50–950. | [VERIFIED: node computation] |
| 2 | TW v4 layer partitioning | Primitives (fonts + raw OKLCH) in `@theme`; semantics in `:root`/`.dark`; component `--color-*` in `@theme inline` as `var()` refs. | [CITED: repo globals.css pattern] |
| 3 | Brand-green vs signal-green (D-05) | Two primitives at distinct hues (155 vs 149) + distinct semantics (`--primary` vs `--signal-bullish`); document the rule in CSS comment. | [CITED: UI-SPEC §D-05] |
| 4 | Font weights/subset | 400 + 600 per family (matches 2-weight scale); latin subset for 4 latin, arabic subset for Noto; source from `@fontsource/*/files/`. | [VERIFIED: fontsource files + UI-SPEC scale] |
| 5 | No-flash + RTL pitfalls | next-themes pre-paint stays sufficient (primitives in `:root`); logical-props-only for base layer. No script extension (D-06). | [CITED: repo ThemeProvider + RTL convention] |
| 6 | `--destructive` status | Promote to **real red** `oklch(0.5771 0.2152 27.33)` now that bearish lives in `--signal-bearish`. Destructive = irreversible UI; bearish = trade outcome. Never shared. | [CITED: UI-SPEC resolved] |

## Validation Architecture

> nyquist_validation enabled (no config override found).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `4.1.8` (unit) + Playwright `@playwright/test 1.60.0` (E2E/visual) — locked stack |
| Config file | `apps/web` workspace (vitest + playwright config present per stack) |
| Quick run command | `pnpm --filter web test` (Vitest) |
| Full suite command | `pnpm --filter web test && pnpm --filter web exec playwright test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DESIGN-01 | `globals.css` contains layered OKLCH tokens; semantic `--primary` resolves to green primitive; no HEX brand left | unit (CSS text assert) | grep/regex test: `oklch(` present, `--nexa-green-500` defined, no `#1E5FBF`/`#03d87f` literals in semantic layer | ❌ Wave 0 |
| DESIGN-02 | 5 `--font-*` vars exposed; 10 `.woff2` self-hosted; **zero** runtime CDN font request | unit + E2E | unit: assert `lib/fonts.ts` exports 5 families w/ `--font-*`; E2E: load page, assert no request to `fonts.googleapis.com`/`fonts.gstatic.com` (Playwright `page.on('request')`) | ❌ Wave 0 |
| DESIGN-03 | Stored theme renders with no flash in fr/en/ar | E2E visual | Playwright: set `localStorage.theme='dark'`, reload, screenshot first paint; assert `<html class="dark">` present before first paint, no light-frame | ❌ Wave 0 |
| DESIGN-04 | AR layout mirrored; no physical properties in base layer | unit (lint) + E2E | unit: regex scan touched files for `\b(ml-|mr-|left-|right-|pl-|pr-)\b` → fail if found in base; E2E: AR route, assert header actions on logical `end` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter web test` (Vitest CSS/font asserts, fast).
- **Per wave merge:** full Vitest + Playwright (no-flash + no-CDN + RTL).
- **Phase gate:** full suite green before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `tests/design-tokens.test.ts` — DESIGN-01 (OKLCH presence, layer structure, no stale brand HEX)
- [ ] `tests/fonts.test.ts` — DESIGN-02 (5 `--font-*` vars, 10 woff2 present in `src/fonts/`)
- [ ] `tests/no-cdn-fonts.spec.ts` — DESIGN-02 (Playwright request interception: zero google fonts)
- [ ] `tests/no-flash.spec.ts` — DESIGN-03 (stored-theme first-paint, fr/en/ar)
- [ ] `tests/rtl-logical-props.test.ts` — DESIGN-04 (physical-property lint on touched files)

## Security Domain

> `security_enforcement` not explicitly false; included. This phase is pure CSS + static font assets — minimal surface.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | no | tokens/fonts are static, no user input |
| V6 Cryptography | no | — |
| V14 Config (supply chain) | yes | font `.woff2` from official `@fontsource` org; verify integrity; no new runtime dep |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious font asset (supply chain) | Tampering | Source only from official `@fontsource` packages (re-verified on npm); commit reviewed `.woff2`; no `postinstall` in Fontsource |
| Third-party CDN font leak (privacy) | Information disclosure | Self-host = zero runtime CDN call (DESIGN-02 success criterion) — eliminates the leak |

## Project Constraints (from CLAUDE.md)
- Tailwind v4 **CSS-first** — NO `tailwind.config` file; all tokens in `globals.css`.
- Next.js **15** (do not jump to 16); `next/font/local` for fonts.
- **Zero new runtime dependency** — `@fontsource/*` are dev-time `.woff2` sources, final artifacts are committed font files.
- TypeScript strict; immutability; logical properties only for RTL.

## Sources

### Primary (HIGH confidence)
- Repo `apps/web/src/styles/globals.css`, `lib/fonts.ts`, `[locale]/layout.tsx` — current token/font/RTL structure [read this session]
- 10-CONTEXT.md (D-01→D-06), 10-UI-SPEC.md (token values, type scale) [read this session]
- npm registry — `@fontsource/{archivo,space-grotesk,jetbrains-mono,chakra-petch,noto-sans-arabic}` 5.2.7–5.2.10; Next 15.5.19 [VERIFIED: npm view, 2026-06-21]
- Independent node OKLCH computation confirming all UI-SPEC values [VERIFIED]
- `ls node_modules/@fontsource/ibm-plex-sans-arabic/files` — sourcing precedent + subset naming [VERIFIED]

### Secondary (MEDIUM confidence)
- nextjs.org/docs/app/api-reference/components/font — `next/font/local` `src` array, `variable`, `adjustFontFallback` [CITED]
- fontsource.org/fonts/noto-sans-arabic/install — arabic subset, weights 100–900 incl. 400/600 [CITED]

### Tertiary (LOW confidence)
- (none — all claims verified or cited)

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Fontsource packages have no network `postinstall` | Package Legitimacy Audit | Low — verify `npm view @fontsource/archivo scripts.postinstall`; if present, gate behind checkpoint |
| A2 | Dark theme may slightly brighten green for contrast (L≈0.80) but exact value is design taste | Pattern 1 / globals layers | Low — visual tuning, not correctness; planner can keep 0.7754 in both if contrast passes |
| A3 | Neutral ramp navy-tint (hue ~265, C ~0.02) | Pattern 1 | Low — cosmetic; any low-chroma neutral works |

## Metadata
**Confidence breakdown:**
- Standard stack: HIGH — all versions verified on npm, no new runtime dep.
- Architecture (layering): HIGH — derived from existing working `@theme inline` pattern in repo.
- Token values: HIGH — independently re-computed and matched.
- Pitfalls: HIGH — grounded in repo conventions + next-themes/TW v4 docs.

**Research date:** 2026-06-21
**Valid until:** 2026-07-21 (stable; Fontsource/Next 15 not fast-moving)
