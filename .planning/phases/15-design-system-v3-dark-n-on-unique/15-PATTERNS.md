# Phase 15: Design system v3 « dark néon unique » — Pattern Map

**Mapped:** 2026-06-22
**Files analyzed:** 9 files to modify / 0 to create
**Analogs found:** 9 / 9 (all read directly — migration phase, targets ARE the analogs)

---

## File Classification

| File | Role | Data Flow | Closest Analog / Source | Match Quality |
|------|------|-----------|------------------------|---------------|
| `apps/web/src/styles/globals.css` | token source-of-truth | transform (Layer 2 flip) | `apps/web/src/components/landing/nexa-landing.css` `.nxl[data-theme="green"]` | exact — values to promote verbatim |
| `apps/web/src/app/[locale]/layout.tsx` | theme provider | request-response | itself (lines 63, 22, 82) | exact — surgical edit |
| `apps/web/src/components/ThemeToggle.tsx` | component-to-delete | — | itself | exact — full deletion |
| `apps/web/src/components/LanguageSwitcher.tsx` | component-to-fix | request-response | `ThemeToggle.tsx` focus-ring pattern | role-match |
| `apps/web/src/components/signals/CandleChart.tsx` | component-to-verify | event-driven (MutationObserver) | itself (lines 166–188) | exact — no change required (D-06) |
| `apps/web/src/components/ui/sonner.tsx` | component-to-verify | request-response | itself | exact — no change required (D-06) |
| `apps/web/src/messages/{fr,en,ar}.json` | i18n | — | itself (lines 13–17 each file) | exact — `"theme"` namespace purge, trilingual parity |
| `apps/web/src/app/[locale]/affiliation/dashboard/page.tsx` + `(admin)/*` + `TrackRecordView.tsx` | utility-to-tokenize (7 files) | CRUD | `globals.css` semantic layer (`--signal-bullish`, `--signal-bearish`, `--risk-moderate`) | role-match |

---

## Pattern Assignments

### `apps/web/src/styles/globals.css` (token source-of-truth, transform)

**Action:** Promote GREEN values from `nexa-landing.css` `.nxl[data-theme="green"]` (lines 19–37) into the `:root` semantic block (Layer 2, lines 111–139). Replace current light-theme `:root` values. Keep `.dark` block as-is (D-06 — CandleChart + sonner observe it); it will now be identical to `:root` post-promotion.

**Source values to promote** (`apps/web/src/components/landing/nexa-landing.css` lines 19–37):
```css
/* .nxl[data-theme="green"] — copy these VALUES into :root */
--bg: #070b08;             /* → --background */
--bg2: #0b110d;            /* → new primitive or direct value for bg2 surface */
--surface: rgba(255, 255, 255, 0.035);   /* → --card (translucent) */
--surface-solid: #0f1611;  /* → --card / --popover (solid) */
--line: rgba(255, 255, 255, 0.1);        /* → --border / --input */
--line-soft: rgba(255, 255, 255, 0.06);  /* no shadcn equivalent — keep as custom prop */
--text: #eafff1;            /* → --foreground */
--sub: rgba(212, 244, 224, 0.64);        /* → --muted-foreground */
--mute: rgba(212, 244, 224, 0.4);        /* tertiary/placeholder — no shadcn equivalent */
--primary: oklch(0.84 0.18 150);         /* → --primary (replaces --nexa-green-500 ref in :root) */
--on-primary: #051009;     /* → --primary-foreground */
--glow: oklch(0.84 0.18 150 / 0.55);     /* → --ring glow / custom --glow prop */
--display-weight: 800;     /* → keep as-is in nexa-landing.css scope only (faux-bold, D-11) */
```

**Current `:root` block to replace** (`globals.css` lines 111–139):
```css
:root {
  --radius: 0.625rem;
  --background: var(--nexa-white);
  --foreground: var(--nexa-ink);
  --card: var(--nexa-neutral-50);
  --card-foreground: var(--nexa-ink);
  --popover: var(--nexa-white);
  --popover-foreground: var(--nexa-ink);
  --primary: var(--nexa-green-500);
  --primary-foreground: var(--nexa-ink);
  --secondary: var(--nexa-neutral-50);
  --secondary-foreground: var(--nexa-ink);
  --muted: var(--nexa-neutral-50);
  --muted-foreground: var(--nexa-neutral-500);
  --accent: var(--nexa-neutral-50);
  --accent-foreground: var(--nexa-ink);
  --destructive: var(--nexa-signal-bear);
  --border: var(--nexa-neutral-200);
  --input: var(--nexa-neutral-200);
  --ring: var(--nexa-green-500);
  --signal-bullish: var(--nexa-signal-bull);
  --signal-bearish: var(--nexa-signal-bear);
  --accent-brand: var(--nexa-purple-500);
  --risk-moderate: var(--nexa-amber-500);
}
```

**Target `:root` after promotion** (D-02, D-03 — copy values verbatim, not `.nxl` selector):
```css
:root {
  --radius: 0.625rem;
  /* === FROZEN GREEN — promoted verbatim from .nxl[data-theme="green"] (D-02/D-03) === */
  --background: #070b08;
  --foreground: #eafff1;
  --card: #0f1611;
  --card-foreground: #eafff1;
  --popover: #0f1611;
  --popover-foreground: #eafff1;
  --primary: oklch(0.84 0.18 150);
  --primary-foreground: #051009;
  --secondary: #0f1611;
  --secondary-foreground: #eafff1;
  --muted: #0f1611;
  --muted-foreground: rgba(212, 244, 224, 0.64);
  --accent: #0f1611;
  --accent-foreground: #eafff1;
  --destructive: oklch(0.68 0.2 24);         /* --sell from nxl */
  --border: rgba(255, 255, 255, 0.10);
  --input: rgba(255, 255, 255, 0.10);
  --ring: oklch(0.84 0.18 150);
  /* Extended GREEN tokens (no shadcn name — exposed as custom props) */
  --background-alt: #0b110d;                  /* bg2 */
  --surface-translucent: rgba(255, 255, 255, 0.035);
  --line-soft: rgba(255, 255, 255, 0.06);
  --muted-tertiary: rgba(212, 244, 224, 0.40);
  --glow: oklch(0.84 0.18 150 / 0.55);
  /* Trading signals — DISTINCT from --primary (D-05) */
  --signal-bullish: var(--nexa-signal-bull);
  --signal-bearish: var(--nexa-signal-bear);
  /* Phase 11 additions — kept (DESIGN-05) */
  --accent-brand: var(--nexa-purple-400);     /* dark variant now always active */
  --risk-moderate: var(--nexa-amber-500);
}
```

**`.dark` block** (`globals.css` lines 145–168) — **must be kept intact** (D-06). After promotion it will resolve to same values as `:root`, which is correct. No edit needed on `.dark`.

**`@theme inline` block** (`globals.css` lines 71–98) — **no edit needed** (Layer 3 reads `var()` only, already correct).

---

### `apps/web/src/app/[locale]/layout.tsx` (theme provider, request-response)

**Action:** 3 surgical edits.

**Edit 1 — Remove import** (line 22):
```tsx
// DELETE this line:
import { ThemeToggle } from '../../components/ThemeToggle'
```

**Edit 2 — ThemeProvider props** (line 63):
```tsx
// BEFORE:
<ThemeProvider attribute="class" defaultTheme="light" enableSystem>

// AFTER (D-04):
<ThemeProvider attribute="class" forcedTheme="dark">
```

**Edit 3 — Remove ThemeToggle render** (line 82 in header):
```tsx
// BEFORE:
<div className="ms-auto flex items-center gap-2">
  <ThemeToggle />
  <LanguageSwitcher />
</div>

// AFTER (D-05):
<div className="ms-auto flex items-center gap-2">
  <LanguageSwitcher />
</div>
```

**`suppressHydrationWarning` on `<html>`** (line 61) — keep as-is.

---

### `apps/web/src/components/ThemeToggle.tsx` (component-to-delete)

**Action:** Delete the entire file. No replacement.

**Consumers confirmed:**
- `apps/web/src/app/[locale]/layout.tsx` line 22 (import) + line 82 (render) — both removed in layout edit above.
- No other import found.

**i18n dependency:** Uses `useTranslations('theme')` — namespace `theme` purged in messages step.

---

### `apps/web/src/components/LanguageSwitcher.tsx` (component-to-fix, request-response)

**Action:** Replace 2 hardcoded `ring-[#2563EB]` occurrences with token-based focus ring.

**Trigger button** (line 168):
```tsx
// BEFORE:
className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"

// AFTER (D-07 — ring token):
className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
```

**List item** (line 200):
```tsx
// BEFORE:
className="flex cursor-pointer items-center gap-2 px-3 py-2 text-start text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2563EB] data-[active=true]:font-semibold"

// AFTER:
className="flex cursor-pointer items-center gap-2 px-3 py-2 text-start text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring data-[active=true]:font-semibold"
```

**Also:** Listbox dropdown (line 183) uses `bg-white` hardcode — tokenize:
```tsx
// BEFORE:
className="absolute end-0 z-10 mt-1 min-w-40 rounded-md border border-black/10 bg-white py-1 shadow-md"

// AFTER:
className="absolute end-0 z-10 mt-1 min-w-40 rounded-md border border-border bg-popover py-1 shadow-md"
```

---

### `apps/web/src/components/signals/CandleChart.tsx` (component-to-verify, event-driven)

**No edit required.** D-06 confirmed: MutationObserver at lines 183–187 observes `document.documentElement` class attribute. With `forcedTheme="dark"`, `.dark` is always present → `recolor()` fires once on mount, reads GREEN tokens, never flips. Code is correct as-is.

**Pattern to preserve** (lines 183–187):
```tsx
themeObserver = new MutationObserver(recolor)
themeObserver.observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['class'],
})
```

---

### `apps/web/src/components/ui/sonner.tsx` (component-to-verify, request-response)

**No edit required.** D-06 confirmed: `useTheme()` returns `"dark"` under `forcedTheme="dark"` → `resolvedTheme` resolves to `"dark"` on line 12-13, Toaster renders dark-consistently. Inline CSS vars already reference semantic tokens (`var(--popover)`, `var(--border)`, `var(--radius)`).

**Pattern to preserve** (lines 8–13, 38–43):
```tsx
const { theme = "system" } = useTheme()
const resolvedTheme: NonNullable<ToasterProps["theme"]> =
  theme === "light" || theme === "dark" || theme === "system" ? theme : "system"
// ...
style={{ "--normal-bg": "var(--popover)", "--normal-text": "var(--popover-foreground)", ... }}
```

---

### `apps/web/src/messages/{fr,en,ar}.json` (i18n, trilingual parity purge)

**Action:** Remove the top-level `"theme"` namespace from all 3 files **in the same commit** (strict key parity, D-05).

**Block to delete in each file** (lines 13–17):
```json
/* fr.json, en.json, ar.json — identical structure, different values */
"theme": {
  "toggleLabel": "...",
  "light": "...",
  "dark": "..."
},
```

**Verify no other `"theme"` namespace usage remains** — `(admin)` routes at lines 597 (`fr.json`) and 402 (`en.json`, `ar.json`) contain a different `"theme"` key inside another namespace; do NOT delete those.

---

### Bespoke palette utilities — 7 files (utility-to-tokenize)

**Pattern:** Replace Tailwind palette utilities with semantic token utilities. Mapping:

| Raw utility | Semantic replacement | Token source |
|-------------|---------------------|-------------|
| `text-emerald-700 dark:text-emerald-400` | `text-[--signal-bullish]` | `globals.css` `--signal-bullish` |
| `text-red-700 dark:text-red-400` | `text-[--signal-bearish]` or `text-destructive` | `globals.css` `--destructive` |
| `text-amber-700 dark:text-amber-400` | `text-[--risk-moderate]` | `globals.css` `--risk-moderate` |
| `bg-emerald-500/10 border-emerald-600/30` | `bg-[--signal-bullish]/10 border-[--signal-bullish]/30` | same |
| `bg-red-500/10 border-red-600/30` | `bg-destructive/10 border-destructive/30` | same |
| `bg-amber-500/10 border-amber-600/30` | `bg-[--risk-moderate]/10 border-[--risk-moderate]/30` | same |
| `bg-red-500` (dot indicator, no opacity) | `bg-destructive` | same |

**File-by-file locations:**

**`apps/web/src/app/[locale]/affiliation/dashboard/page.tsx` line 203:**
```tsx
// BEFORE:
<p className="text-2xl font-semibold text-amber-700 dark:text-amber-400">
// AFTER:
<p className="text-2xl font-semibold text-[--risk-moderate]">
```

**`apps/web/src/app/(admin)/signaux/page.tsx` line 197:**
```tsx
// BEFORE:
<Badge className="border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
// AFTER:
<Badge className="border-[--signal-bullish]/30 bg-[--signal-bullish]/10 text-[--signal-bullish]">
```

**`apps/web/src/app/(admin)/page.tsx` line 56:**
```tsx
// BEFORE:
red: 'bg-red-500',
// AFTER:
red: 'bg-destructive',
```

**`apps/web/src/app/(admin)/sante/page.tsx` lines 67, 217, 221:**
```tsx
// line 67:
red: 'bg-red-500',  →  red: 'bg-destructive',

// line 217 (green badge):
<Badge className="border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
→ <Badge className="border-[--signal-bullish]/30 bg-[--signal-bullish]/10 text-[--signal-bullish]">

// line 221 (red badge):
<Badge className="border-red-600/30 bg-red-500/10 text-red-700 dark:text-red-400">
→ <Badge className="border-destructive/30 bg-destructive/10 text-destructive">
```

**`apps/web/src/app/(admin)/affiliation/page.tsx` line 101:**
```tsx
// BEFORE:
<Badge className="border-amber-600/30 bg-amber-500/10 text-amber-700 dark:text-amber-400">
// AFTER:
<Badge className="border-[--risk-moderate]/30 bg-[--risk-moderate]/10 text-[--risk-moderate]">
```

**`apps/web/src/app/(admin)/affiliation/payouts/page.tsx` line 130:**
```tsx
// Same amber pattern → same replacement as above
```

**`apps/web/src/app/(admin)/file/page.tsx` line 121:**
```tsx
// Same amber pattern → same replacement as above
```

**`apps/web/src/components/track-record/TrackRecordView.tsx` line 218:**
```tsx
// BEFORE:
? 'text-emerald-700 dark:text-emerald-400'
// AFTER:
? 'text-[--signal-bullish]'
```

---

## Shared Patterns

### Focus ring (cross-cutting)
**Source:** `ThemeToggle.tsx` line 43 (being deleted) — pattern is `focus-visible:ring-2 focus-visible:ring-[#2563EB]`
**Apply to all interactive elements:** Replace `ring-[#2563EB]` → `ring-ring` (Tailwind `--ring` token)
**Confirmed occurrences:** `LanguageSwitcher.tsx` lines 168 + 200. No other `ring-[#2563EB]` found in codebase.

### Token-via-`var()` rule (no literals in Layer 2)
**Source:** `globals.css` comment at line 68: "Références var() UNIQUEMENT — AUCUNE valeur OKLCH/HEX littérale ici"
**Exception for Phase 15 only:** `:root` Layer 2 now carries the raw literal values (promotion result) because the GREEN values are not yet in the primitives layer. The `@theme` Layer 1 (`--nexa-*`) keeps its existing values unchanged. Planner may optionally add new `--nexa-*` primitives for the promoted green values, but it is NOT required for Phase 15 correctness.

### No-FOUC guarantee
**Source:** `layout.tsx` line 61 `suppressHydrationWarning` + `globals.css` `:root` carrying frozen values
**Pattern:** `:root` with frozen dark values = first-paint is dark regardless of `next-themes` script timing. `forcedTheme="dark"` ensures `next-themes` always writes `.dark` — both layers resolve identically.

### RTL orthogonality
**Source:** `globals.css` lines 175–178 (`:lang(ar)`) + `layout.tsx` line 59 (`dir={locale === 'ar' ? 'rtl' : 'ltr'}`)
**Do not touch:** These are orthogonal to the theme freeze (D-12). `:lang(ar)` block preserved verbatim.

---

## No Analog Found

None. All targets are concrete existing files. The migration is purely semantic-layer promotion — no new files, no new patterns.

---

## Metadata

**Files read:** 10 (globals.css, nexa-landing.css, layout.tsx, fonts.ts, ThemeToggle.tsx, LanguageSwitcher.tsx, CandleChart.tsx, sonner.tsx, fr.json/en.json/ar.json excerpts)
**Codebase searched:** `apps/web/src/**` for `ring-[#2563EB]`, palette utilities, ThemeToggle consumers
**Pattern extraction date:** 2026-06-22
**Phase reference:** D-01..D-12, UI-SPEC §Color / §Theme Contract
