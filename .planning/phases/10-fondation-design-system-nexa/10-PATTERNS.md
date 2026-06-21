# Phase 10: Fondation design system NEXA - Pattern Map

**Mapped:** 2026-06-21
**Files analyzed:** 6 in-scope code/asset files + 5 Wave-0 test files = 11
**Analogs found:** 11 / 11 (this is a MIGRATION phase — the files being changed ARE their own strongest analogs; new test files map to existing repo tests)

> Foundation/migration phase. Most "new" work is editing existing token/font plumbing in place. The planner should MIRROR the existing file structure (comment header style, `@theme`/`@theme inline`/`:root`/`.dark` partitioning, `next/font/local` array shape) and swap values/families — not invent new structure. RESEARCH.md §"Recommended globals.css layer partitioning" + §"Pattern 2" already give the target shapes.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/web/src/styles/globals.css` | config (design tokens) | transform (build-time CSS) | itself (current HEX/2-font version) | exact (in-place migrate) |
| `apps/web/src/lib/fonts.ts` | config (font loader) | transform (build-time) | itself (`inter` + `ibmPlexArabic`) | exact (in-place migrate) |
| `apps/web/src/fonts/*.woff2` | static asset | file-I/O (committed assets) | `src/fonts/IBMPlexSansArabic-*.woff2` | exact (same sourcing path) |
| `apps/web/src/app/[locale]/layout.tsx` | provider/route (RSC root) | request-response (SSR) | itself (`inter`/`ibmPlexArabic` `.variable` injection) | exact (in-place migrate) |
| `apps/web/src/components/ThemeProvider.tsx` + `ThemeToggle.tsx` | provider | event-driven | itself — **KEEP AS-IS (D-06)**, reference only | n/a (untouched) |
| `apps/web/tests/design-tokens.test.ts` | test (unit) | file-I/O (reads globals.css text) | `src/messages/__tests__/theme-parity.test.ts` | role-match (Vitest file-read assert) |
| `apps/web/tests/fonts.test.ts` | test (unit) | file-I/O (reads fonts.ts + lists `src/fonts/`) | `src/messages/__tests__/theme-parity.test.ts` | role-match |
| `apps/web/tests/no-cdn-fonts.spec.ts` | test (E2E) | event-driven (request interception) | `e2e/i18n.spec.ts` | role-match (Playwright) |
| `apps/web/tests/no-flash.spec.ts` | test (E2E) | event-driven (navigation/screenshot) | `e2e/i18n.spec.ts` | role-match (Playwright) |
| `apps/web/tests/rtl-logical-props.test.ts` | test (unit/lint) | file-I/O (regex scan of touched files) | `apps/web/test/no-perf-claims.test.ts` (text-scan guard) + `theme-parity.test.ts` | role-match |

---

## Pattern Assignments

### `apps/web/src/styles/globals.css` (config / design tokens)

**Analog:** itself — `apps/web/src/styles/globals.css` (current v2.0 blue HEX version).

The migration KEEPS the file's section order and comment-header convention; it (1) adds a primitive OKLCH ramp layer in `@theme`, (2) repoints semantic values in `:root`/`.dark` from HEX blue to `var(--nexa-*)`, (3) leaves `@theme inline` color-name mappings untouched (only the font vars change), (4) repoints `--font-latin`→Space Grotesk and `--font-arabic`→Noto, (5) repoints the `body`/`@theme inline --font-sans` and `:lang(ar)` rules.

**Imports / preamble — KEEP verbatim** (current lines 1-9):
```css
@import "tailwindcss";
@import "tw-animate-css";
@custom-variant dark (&:where(.dark, .dark *));   /* KEEP — drives .dark flip */
```

**Primitive font + OKLCH ramp layer — REPLACE current `@theme`** (current lines 17-20, only 2 font vars today):
```css
/* CURRENT (to replace): */
@theme {
  --font-latin: var(--font-inter);
  --font-arabic: var(--font-ibm-plex-arabic);
}
```
Target: 5 `--font-*` vars + raw NEXA OKLCH brand/neutral/signal primitives (theme-independent). Exact shape and values in RESEARCH.md §"Recommended globals.css layer partitioning" lines 110-130 and §"Trading-signal vs brand separation" lines 278-286. Brand green `oklch(0.7754 0.1896 155.45)`, purple `oklch(0.4233 0.1772 302.98)`, ink `oklch(0.1663 0.0262 269.37)`, signal-bull `oklch(0.6271 0.1699 149.21)` (hue 149, sober), signal-bear/destructive `oklch(0.5771 0.2152 27.33)`. D-05 separation rule MUST be a CSS comment.

**Component mapping — KEEP names, change only `--font-sans`** (current lines 28-52):
```css
@theme inline {
  --font-sans: var(--font-inter);   /* ← REPOINT to var(--font-space-grotesk) */
  --color-background: var(--background);
  --color-primary: var(--primary);
  --color-ring: var(--ring);
  /* …all 18 --color-* + 4 --radius-* mappings: NAMES UNCHANGED (auto-reskins 20 ui/) … */
}
```
Anti-pattern (RESEARCH lines 206/252): `@theme inline` must contain ONLY `var()` refs — never a literal OKLCH, or the `.dark` flip silently breaks.

**Semantic flip layer — REPLACE HEX with `var(--nexa-*)`** (current `:root` lines 59-79, `.dark` lines 82-101):
```css
/* CURRENT v2.0 (institutional blue — to migrate): */
:root {
  --radius: 0.625rem;
  --background: #FFFFFF;
  --foreground: #0B1220;
  --primary: #1E5FBF;            /* → var(--nexa-green-500) (D-04) */
  --destructive: #5B6675;        /* → var(--nexa-signal-bear) real red (Unknown #6) */
  --ring: #1E5FBF;               /* → var(--nexa-green-500) */
  /* …card/secondary/muted/accent/border/input… */
}
.dark { /* same keys, dark-tuned values */ }
```
Add semantic signal tokens `--signal-bullish`/`--signal-bearish` here too (RESEARCH lines 152-153). Keep `--radius: 0.625rem`. `--primary-foreground` flips to dark ink because brand green is light (RESEARCH line 148).

**Arabic + base layer — REPOINT font vars, KEEP logical/direction-neutral props** (current lines 108-121):
```css
:lang(ar) {
  font-family: var(--font-arabic);   /* now Noto via --font-arabic — KEEP rule */
  line-height: 1.6;                  /* direction-neutral, RTL-safe (Pitfall 2) */
}
@layer base {
  * { @apply border-border outline-ring/50; }
  body {
    @apply bg-background text-foreground;
    font-family: var(--font-latin), system-ui, sans-serif;  /* --font-latin now → Space Grotesk */
  }
}
```
Note (RESEARCH line 236): the `--font-latin` var name can stay (repointed in `@theme`) OR be renamed to `--font-sans`/`--font-display`; whichever is chosen, `body` and `@theme inline` must reference a var that resolves, or body silently falls back to `system-ui`.

---

### `apps/web/src/lib/fonts.ts` (config / font loader)

**Analog:** itself — current `inter` (`next/font/google`) + `ibmPlexArabic` (`next/font/local`).

Migration: DELETE the `inter` export and the `next/font/google` import (D-03), DELETE `ibmPlexArabic` (D-01), ADD 5 `localFont(...)` exports (4 latin + Noto). Mirror the EXISTING `localFont` array shape exactly.

**Current `next/font/local` pattern to replicate ×5** (lines 24-31):
```typescript
import localFont from 'next/font/local'

export const ibmPlexArabic = localFont({
  src: [
    { path: '../fonts/IBMPlexSansArabic-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/IBMPlexSansArabic-SemiBold.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-ibm-plex-arabic',
  display: 'swap',
})
```

**Target shape** (5 families, 400+600 each, variable names per D-02 / RESEARCH §Pattern 2 lines 184-200):
- `archivo` → `variable: '--font-archivo'` (display)
- `spaceGrotesk` → `--font-space-grotesk` (body/UI)
- `jetbrainsMono` → `--font-jetbrains-mono` (numeric/tabular)
- `chakraPetch` → `--font-chakra-petch` (accents)
- `notoArabic` → `--font-noto-arabic` (arabic)

**REMOVE entirely** (current lines 16-22):
```typescript
import { Inter } from 'next/font/google'   // DELETE (D-03)
export const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })  // DELETE
```

Keep `display: 'swap'` on every family (no-flash, Pitfall 1, RESEARCH line 243). Update the file's JSDoc header to describe the 5 NEXA families.

---

### `apps/web/src/fonts/*.woff2` (static assets)

**Analog:** `apps/web/src/fonts/IBMPlexSansArabic-Regular.woff2` + `-SemiBold.woff2` (the only two present today).

**Sourcing path (proven in repo, RESEARCH lines 45/261):** copy from `node_modules/@fontsource/<name>/files/<name>-<subset>-<weight>-normal.woff2` into `apps/web/src/fonts/`. Latin subset for the 4 latin families; **arabic** subset for Noto (NOT latin — Pitfall 4). 10 files total (5 families × 400 + 600).

**ADD:** `Archivo-{Regular,SemiBold}.woff2`, `SpaceGrotesk-{Regular,SemiBold}.woff2`, `JetBrainsMono-{Regular,SemiBold}.woff2`, `ChakraPetch-{Regular,SemiBold}.woff2`, `NotoSansArabic-{Regular,SemiBold}.woff2` (exact filenames must match the `path` strings chosen in `fonts.ts`).

**DELETE (orphaned after migration, RESEARCH line 234):** `IBMPlexSansArabic-Regular.woff2`, `IBMPlexSansArabic-SemiBold.woff2`.

Dev-time sourcing install (NOT runtime dep, RESEARCH lines 54-58): `pnpm add -D @fontsource/{archivo,space-grotesk,jetbrains-mono,chakra-petch}` (noto-sans-arabic already installed).

---

### `apps/web/src/app/[locale]/layout.tsx` (provider / RSC root)

**Analog:** itself — current 2-font `.variable` injection on `<body>`.

Surgical change: swap the font imports and the `<body className>` join. Everything else (`hasLocale` guard, `setRequestLocale`, `<html lang dir suppressHydrationWarning>`, `ThemeProvider`, header) is OUT OF SCOPE — KEEP verbatim.

**Current import + injection to change** (lines 23, 52):
```typescript
import { inter, ibmPlexArabic } from '../../lib/fonts'
// …
<body className={`${inter.variable} ${ibmPlexArabic.variable}`}>
```

**Target** (RESEARCH §Pattern 2 line 201):
```typescript
import { archivo, spaceGrotesk, jetbrainsMono, chakraPetch, notoArabic } from '../../lib/fonts'
// …
<body className={[archivo, spaceGrotesk, jetbrainsMono, chakraPetch, notoArabic].map(f => f.variable).join(' ')}>
```

**KEEP verbatim — no-flash + RTL contract** (lines 47-53):
```typescript
<html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} suppressHydrationWarning>
  <body className={...}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
```

---

### `apps/web/src/components/ThemeProvider.tsx` + `ThemeToggle.tsx` — DO NOT MODIFY

**D-06:** kept as-is. Reference only. `ThemeProvider` is a thin `'use client'` re-export of `next-themes` (lines 12-19); the pre-paint no-flash script + `suppressHydrationWarning` on `<html>` already solve DESIGN-03. RESEARCH §"Don't Hand-Roll" forbids extending it.

---

## Wave-0 Test Files

> ⚠️ **CONFIG GAP (load-bearing — planner must resolve in Wave 0).** The current root `vitest.config.ts` `include` (lines 37-44) does **NOT** match a top-level `apps/web/tests/**/*.test.ts` path. It covers `apps/**/__tests__/**`, `apps/web/test/**/*.test.ts`, and `apps/web/src/lib/**/*.test.ts` only. Two options for the 3 Vitest unit files:
> - **(A)** place them under an already-covered path (e.g. `apps/web/src/styles/__tests__/design-tokens.test.ts`, `apps/web/test/fonts.test.ts`), OR
> - **(B)** add `'apps/web/tests/**/*.test.ts'` to the `include` array.
> The Playwright `.spec.ts` files ARE covered: `playwright.config.ts` line 17 matches `tests/**/*.spec.ts` (relative to `testDir: 'apps/web'`). So `apps/web/tests/no-cdn-fonts.spec.ts` and `no-flash.spec.ts` work as-named with zero config change.

### `tests/design-tokens.test.ts` + `tests/fonts.test.ts` + `tests/rtl-logical-props.test.ts` (Vitest unit)

**Analog (structure):** `apps/web/src/messages/__tests__/theme-parity.test.ts` (key-presence guard) and `apps/web/test/no-perf-claims.test.ts` (text-scan guard).

**Vitest skeleton — explicit imports (config `globals: false`, line 45)**:
```typescript
import { describe, it, expect } from 'vitest'
// then read the target file as text and assert
```
`globals: false` means `describe/it/expect` MUST be imported (no ambient globals). Mirror the French-comment JSDoc header + `describe('…', () => { it('…', () => {…}) })` nesting from theme-parity.test.ts lines 1-40.

- **design-tokens.test.ts:** read `src/styles/globals.css` as a string; assert `oklch(` present, `--nexa-green-500` defined, NO stale brand HEX (`#1E5FBF`, `#03d87f`, `#63279b`) in the semantic layer, `@theme inline` contains only `var(` refs. (RESEARCH §Test Map line 328.)
- **fonts.test.ts:** read `src/lib/fonts.ts`; assert 5 exports + 5 `--font-*` variable strings; `fs.readdirSync('src/fonts')` lists the 10 expected `.woff2` and NO `IBMPlexSansArabic-*`. (Line 329.)
- **rtl-logical-props.test.ts:** regex-scan touched base-layer files for physical props `\b(ml-|mr-|left-|right-|pl-|pr-)\b` → fail if found. (Line 331; mirror the text-scan approach of `no-perf-claims.test.ts`.)

### `tests/no-cdn-fonts.spec.ts` + `tests/no-flash.spec.ts` (Playwright E2E)

**Analog (structure):** `apps/web/e2e/i18n.spec.ts`.

**Playwright skeleton**:
```typescript
import { test, expect } from '@playwright/test'

test.describe('…', () => {
  test('…', async ({ page }) => {
    await page.goto('/fr/login')   // baseURL http://localhost:3000 (playwright.config line 29)
    // assertions
  })
})
```
Mirror i18n.spec.ts's `test.describe` grouping, the fr/en/ar loop pattern (lines 57-78), and the GREEN-prerequisite JSDoc header (lines 1-19: requires `next dev` on :3000 — these specs hit live app).

- **no-cdn-fonts.spec.ts:** `page.on('request', …)` interception; assert ZERO request to `fonts.googleapis.com` / `fonts.gstatic.com`. (RESEARCH line 329.)
- **no-flash.spec.ts:** set `localStorage.theme='dark'`, reload, assert `<html class="dark">` present at first paint, no light-frame; run across fr/en/ar (line 330). Use the `page.locator('html')` + `toHaveAttribute` idiom from i18n.spec.ts lines 58-63.

---

## Shared Patterns

### File comment-header convention (apply to every touched file)
**Source:** all current files (`globals.css` lines 4-8, `fonts.ts` lines 1-14, `layout.tsx` lines 1-13, `theme-parity.test.ts` lines 1-7).
Every file opens with a French JSDoc/block comment stating purpose + the decision/research refs (e.g. `Source : 02-RESEARCH.md §Pattern 2`). New/migrated files MUST update these headers to cite Phase-10 decisions (D-01…D-06) and `10-RESEARCH.md`.

### Tailwind v4 CSS-first (no `tailwind.config`)
**Source:** `globals.css` + CLAUDE.md (locked).
**Apply to:** globals.css only. All tokens live in `@theme`/`@theme inline`/`:root`/`.dark`. No `tailwind.config` exists or may be added. `@custom-variant dark (&:where(.dark, .dark *))` (line 9) drives the flip — KEEP.

### Logical-properties-only (RTL, DESIGN-04)
**Source:** `layout.tsx` (`ms-6`, `ms-auto` lines 60/64), `globals.css` `:lang(ar)`.
**Apply to:** any base-layer/`:lang(ar)`/body rule this phase touches. `font-family`/`line-height` are direction-neutral (safe). Never introduce `ml-/mr-/left-/right-`. Enforced by `tests/rtl-logical-props.test.ts`.

### next-themes no-flash (kept, D-06)
**Source:** `ThemeProvider.tsx` (lines 12-19), `layout.tsx` (`suppressHydrationWarning` + `attribute="class"` lines 51-53).
**Apply to:** referenced, not modified. Primitives must stay in `:root`/`.dark` (parsed synchronously with the stylesheet) so no second flash — do not move tokens to JS injection.

### Vitest explicit-import + French-comment test style
**Source:** `theme-parity.test.ts` (lines 8/17), `no-perf-claims.test.ts`.
**Apply to:** all 3 Wave-0 `.test.ts`. `import { describe, it, expect } from 'vitest'` (no globals), JSDoc header naming the behavior tested.

---

## No Analog Found

None. Every file has a strong in-repo analog (the migrated files are their own analogs; test files map to existing Vitest/Playwright suites). The test **harness already exists** (`vitest.config.ts` + `playwright.config.ts` at repo root) — Wave 0 does NOT install a harness, it only (optionally) widens the Vitest `include` glob per the CONFIG GAP note above.

## Metadata

**Analog search scope:** `apps/web/src/styles`, `apps/web/src/lib`, `apps/web/src/fonts`, `apps/web/src/app/[locale]`, `apps/web/src/components`, `apps/web/src/messages/__tests__`, `apps/web/test`, `apps/web/e2e`, `apps/web/tests`, repo-root `vitest.config.ts` + `playwright.config.ts`.
**Files scanned:** ~12 read in full; ~35 test files enumerated via glob.
**Pattern extraction date:** 2026-06-21
