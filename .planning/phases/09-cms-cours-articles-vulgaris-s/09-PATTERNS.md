# Phase 9: l'Académie (CMS lecture vitrine trilingue) - Pattern Map

**Mapped:** 2026-06-19
**Files analyzed:** 18 (new) + 3 (modified)
**Analogs found:** 18 / 21 (3 net-new, no analog — see §No Analog Found)

> Tous les chemins sont absolus relatifs à la racine repo `apps/web/`. Le contenu MDX est rédigé par l'agent (D-01), lu par `fs` au render RSC, JAMAIS importé comme module (piège `!` du chemin projet — RESEARCH Pitfall 1).

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/academie/searchParams.ts` | utility (parse/serialize Zod) | request-response (URL→filters) | `src/lib/signals/searchParams.ts` | exact |
| `src/lib/academie/frontmatter.ts` | model (Zod schema, data boundary) | transform | `src/lib/signals/searchParams.ts` (z.enum/z.infer) + `[id]/page.tsx` SignalPayloadSchema | role-match |
| `src/lib/academie/content.ts` | service (fs scan, resolve, fallback) | file-I/O | *(none — net-new fs catalog)* | no-analog |
| `src/lib/academie/reading-time.ts` | utility (deterministic calc) | transform | *(none — net-new, lib `reading-time`)* | no-analog |
| `src/lib/academie/toc.ts` | utility (heading→anchor extraction) | transform | *(none — net-new, lib `github-slugger`)* | no-analog |
| `src/lib/academie/course-model.ts` | service (derive course/lesson order) | transform | `src/lib/signals/searchParams.ts` (pure derive style) | partial |
| `src/app/[locale]/(marketing)/academie/page.tsx` | route (index + filters) | request-response (RSC searchParams) | `(member)/signaux/page.tsx` | exact |
| `src/app/[locale]/(marketing)/academie/[slug]/page.tsx` | route (article OR course) | file-I/O → RSC render | `(marketing)/methodologie/page.tsx` (prose) + `(member)/signaux/[id]/page.tsx` (Zod boundary) | role-match |
| `src/app/[locale]/(marketing)/academie/[course]/[lesson]/page.tsx` | route (lesson + prev/next) | file-I/O → RSC render | `(marketing)/methodologie/page.tsx` | role-match |
| `src/components/academie/FilterBar.tsx` | component (client chips) | event-driven (URL update) | `src/components/signals/FilterBar.tsx` | exact |
| `src/components/academie/mdx-components.tsx` | config (MDX component map) | transform | *(none — net-new mapping)* | no-analog |
| `src/components/academie/Callout.tsx` | component (RSC pedago) | request-response | UI-SPEC §Color callout spec | partial |
| `src/components/academie/Steps.tsx` | component (RSC pedago) | request-response | UI-SPEC §2 Steps | partial |
| `src/components/academie/Figure.tsx` | component (next/image + caption) | request-response | UI-SPEC §2 Figure | partial |
| `src/components/academie/TradeExample.tsx` | component (bdi-wrapped values) | request-response | dashboard affilié `<bdi>` precedent (D-02-03-A) | partial |
| `src/components/academie/Toc.tsx` | component (sticky TOC) | request-response | UI-SPEC §2 TOC | partial |
| `src/components/academie/ContentCard.tsx` | component (article/course card) | request-response | `ui/card.tsx` + `ui/badge.tsx` | role-match |
| `src/components/academie/FallbackBanner.tsx` | component (D-14 alert) | request-response | `ui/alert.tsx` + `Disclaimer.tsx` (RSC i18n) | role-match |
| `src/app/sitemap.ts` | config (metadata route) | batch (enumerate slug×locale) | *(none — net-new, RESEARCH §Sitemap example)* | no-analog |
| `src/app/[locale]/layout.tsx` | route (MODIFY — nav entry) | request-response | itself (header L52-58) | exact |
| `src/components/signals/SignalDetail.tsx` (or `[id]/page.tsx`) | component (MODIFY — funnel link D-08b) | request-response | `i18n/navigation` Link | exact |
| `messages/{fr,en,ar}.json` | config (MODIFY — `academy` namespace) | — | existing `signals`/`methodology` namespaces | exact |

---

## Pattern Assignments

### `src/lib/academie/searchParams.ts` (utility, request-response) — analog: EXACT

**Analog:** `src/lib/signals/searchParams.ts` (full file, 74 lines). Copy the structure 1:1, swap enums for the 3 Académie axes (D-05). The security model (whitelist Zod, out-of-enum ignored, never throw — threat T-03-05) transfers directly.

**Enum + schema pattern** (analog lines 14-29):
```typescript
import { z } from 'zod'

const StyleEnum = z.enum(['day', 'swing'])
const RiskEnum = z.enum(['low', 'medium', 'high', 'extreme'])
const ClassEnum = z.enum(['crypto', 'forex', 'metal', 'energy'])
const SortEnum = z.enum(['score', 'recent', 'rr'])

export const SignalsParamsSchema = z.object({
  style: StyleEnum.optional(),
  risk: RiskEnum.optional(),
  class: ClassEnum.optional(),
  asset: z.string().min(1).optional(),
  sort: SortEnum.default('score'),
})
export type SignalsParams = z.infer<typeof SignalsParamsSchema>
```
**Académie adaptation:** reuse `ThemeEnum`/`NiveauEnum`/`PlateformeEnum` from `frontmatter.ts` (single source of truth — import them here, do NOT redeclare). Multi-select per axis (D-05) → handle `string[]` (theme=a&theme=b), so the `pick` helper must collect arrays, not just `firstString`.

**Out-of-enum-ignored parse** (analog lines 33-59):
```typescript
function firstString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}
export function parseSignalsParams(raw: RawParams): SignalsParams {
  const pick = <T extends z.ZodTypeAny>(schema: T, value: string | string[] | undefined) => {
    const r = schema.safeParse(firstString(value))
    return r.success ? r.data : undefined        // corrupt filter → undefined, never throws
  }
  return { style: pick(StyleEnum, raw.style), /* ... */ }
}
```
**Test analog exists:** `src/lib/signals/__tests__/searchParams.test.ts` — mirror it as `src/lib/academie/searchParams.test.ts` (Wave 0 gap, CMS-01).

---

### `src/components/academie/FilterBar.tsx` (component, event-driven) — analog: EXACT

**Analog:** `src/components/signals/FilterBar.tsx` (full file, 154 lines). Copy the localized-navigation mechanics verbatim.

**Imports + localized nav** (analog lines 1-21) — CRITICAL: use `@/i18n/navigation`, NOT `next/navigation`, for `useRouter`/`usePathname` (preserves locale, `localePrefix: always`); `useSearchParams` from `next/navigation` is read-only OK:
```typescript
'use client'
import { useTranslations } from 'next-intl'
import { useRouter, usePathname } from '../../i18n/navigation'  // localized — preserves locale
import { useSearchParams } from 'next/navigation'                // read-only OK
```

**URL toggle without scroll jump** (analog lines 42-59):
```typescript
function setParam(key: string, value: string | undefined) {
  const next = new URLSearchParams(searchParams.toString())
  if (value === undefined || value === '') next.delete(key)
  else next.set(key, value)
  const qs = next.toString()
  router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })  // RSC re-render
}
function toggleParam(key: string, value: string) {
  setParam(key, current(key) === value ? undefined : value)
}
function resetAll() { router.replace(pathname, { scroll: false }) }
```

**Chip active/repos states** (analog lines 64-83) — UI-SPEC §1 maps these to Badge variants (active = `variant="default"` bg-primary, repos = `variant="outline"`). Reuse the `min-h-11` tap target + logical-prop pattern. Multi-select per axis = toggle adds/removes from array param, not single set.

---

### `src/app/[locale]/(marketing)/academie/page.tsx` (route index) — analog: EXACT

**Analog:** `src/app/[locale]/(member)/signaux/page.tsx` (81 lines). Copy the RSC params/searchParams await + parse + empty/error state shape. Note: Académie is PUBLIC (marketing group) — drop the Supabase/RLS gate; data comes from `content.ts` (fs scan).

**RSC entry + params await (Next 15)** (analog lines 16-40):
```typescript
import { setRequestLocale, getTranslations } from 'next-intl/server'

interface SignalsPageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}
export default async function SignalsPage({ params, searchParams }: SignalsPageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('signals')        // → 'academy' for Académie
  const sp = await searchParams
  const filters = parseSignalsParams(sp)            // → parseAcademyParams
  // const catalog = await listAcademyContent(locale); filtered = filter(catalog, filters)
}
```

**Empty/error states** (analog lines 52-73) — UI-SPEC §1 requires empty state (`academy.emptyHeading`/`emptyBody` + reset button) and error state (`academy.error.*`). Copy the conditional block shape (error → retry block; 0 rows → centered empty; else → grid). For Académie: grid is `grid gap-6 sm:grid-cols-2 lg:grid-cols-3` (UI-SPEC §1), container `max-w-6xl mx-auto px-4 py-16 md:px-6 text-start`.

---

### `src/app/[locale]/(marketing)/academie/[slug]/page.tsx` (route detail) — analog: role-match

**Analog A (prose layout + Disclaimer):** `src/app/[locale]/(marketing)/methodologie/page.tsx` (56 lines).
**Analog B (Zod data boundary on untrusted payload):** `(member)/signaux/[id]/page.tsx` lines 18-60.

**Prose shell + Disclaimer footer** (methodologie lines 15-55):
```typescript
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { Disclaimer } from '@/components/Disclaimer'

export default async function MethodologyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('methodology')         // → 'academy'
  return (
    <main className="mx-auto max-w-prose px-4 py-16 text-start md:px-6">
      <h1 className="font-heading text-2xl font-semibold">{t('title')}</h1>
      {/* ... TOC + {content} ... */}
      <div className="mt-12 border-t border-border pt-6">
        <Disclaimer />                                    {/* LEGAL-01 — injected by PAGE, not MDX */}
      </div>
    </main>
  )
}
```
> CAUTION UI-SPEC §Typography: `font-heading` is a no-op (not in `@theme`) — UI-SPEC says prefer `font-semibold` directly. The analog uses `font-heading` harmlessly; for Académie use `text-2xl font-semibold` per UI-SPEC.

**compileMDX render (NEW pattern, no analog — from RESEARCH Pattern 1)** — the load-bearing piece that dodges the `!`:
```typescript
import { compileMDX } from 'next-mdx-remote/rsc'
import { promises as fs } from 'node:fs'
const file = await fs.readFile(resolved.absPath, 'utf8')   // fs, NOT import — dodges `!` (Pitfall 1)
const { content, frontmatter } = await compileMDX({
  source: file,
  components: MDX_COMPONENTS,
  options: { parseFrontmatter: true,
    mdxOptions: { remarkPlugins: [remarkGfm], rehypePlugins: [rehypeSlug] } },
})
const meta = FrontmatterSchema.parse(frontmatter)          // Zod boundary (D-11)
```

**Zod-on-untrusted boundary discipline** (signaux/[id] lines 35-60) — same posture: parse failure → `notFound()`, never a 500. Apply to frontmatter (invalid → notFound/error state, never crash).

---

### `src/app/[locale]/(marketing)/academie/[course]/[lesson]/page.tsx` (route lesson) — analog: role-match

Same prose+compileMDX shell as `[slug]/page.tsx`. Adds prev/next nav (UI-SPEC §4): 2 `Button variant="outline"` anchored logical `start`/`end`, `h-11` tap target, disabled/hidden at bounds. prev/next derived by `course-model.ts` (neighbors in sorted list). Localized nav via `@/i18n/navigation` `Link` (see SignalDetail integration analog below).

---

### `src/components/academie/FallbackBanner.tsx` (component D-14) — analog: role-match

**Analog A:** `src/components/Disclaimer.tsx` (15 lines) — the RSC + i18n minimal pattern:
```typescript
import { getTranslations } from 'next-intl/server'
export async function Disclaimer() {
  const t = await getTranslations('disclaimer')
  return <p className="text-sm text-muted-foreground ps-4 pe-4">{t('footer')}</p>  // logical props ps/pe
}
```
**Analog B:** `src/components/ui/alert.tsx` (shadcn). UI-SPEC §5: render `Alert` neutral variant (NEVER destructive/red), icon `Languages`/`Info` lucide, copy `academy.fallbackBanner`, at TOP of content. Never 404 a content that exists in another language.

---

### `src/components/academie/ContentCard.tsx` (component) — analog: role-match

Compose `ui/card.tsx` + `ui/badge.tsx`. **Badge variants reference** (`ui/badge.tsx` lines 11-22): `default` = bg-primary (RESERVED for active filter only — UI-SPEC §Color), `outline` = border-border text-foreground (theme/niveau/plateforme badges at repos), `secondary` = bg-secondary. Card cover = `next/image` ratio 16:9, title `text-xl font-semibold`, summary `text-sm text-muted-foreground` (UI-SPEC §1). Course card adds `outline` "Cours" badge + "Commencer le cours" CTA.

---

## Shared Patterns

### Disclaimer auto-injection (LEGAL-01 / D-09)
**Source:** `src/components/Disclaimer.tsx` (RSC, i18n key `disclaimer.footer`).
**Apply to:** every article + lesson detail page, rendered by the PAGE after `{content}` — NOT inside the MDX (RESEARCH Pattern 2: author could forget → LEGAL-01 hole; page injection is non-contournable).
```typescript
<div className="mt-12 border-t border-border pt-6"><Disclaimer /></div>
```

### Localized navigation (preserve locale, `localePrefix: always`)
**Source:** `src/i18n/navigation.ts` — `Link`, `useRouter`, `usePathname`.
**Apply to:** ALL internal links/redirects in Académie (FilterBar URL updates, lesson prev/next, funnel links, nav entry). NEVER `next/navigation` primitives for navigation (would drop the locale).
```typescript
import { Link, useRouter, usePathname } from '@/i18n/navigation'
```

### RSC trilingual entry + RTL logical props
**Source:** `methodologie/page.tsx` L24-25, `signaux/page.tsx` L31-43, `layout.tsx` L44-48 (dir rtl/ltr).
**Apply to:** every Académie route. Head: `const { locale } = await params; setRequestLocale(locale); const t = await getTranslations('academy')`. Layout: `text-start`, logical props `ms-*/me-*` `ps-*/pe-*`, `border-s-4` (never `border-l`). Numeric trade values wrapped in `<bdi>` (Pitfall 4).

### Zod whitelist on system boundaries (anti-injection / path-traversal)
**Source:** `signals/searchParams.ts` (out-of-enum ignored, T-03-05) + `signaux/[id]/page.tsx` (Zod on untrusted payload → notFound, not 500).
**Apply to:** `searchParams.ts` (filters), `frontmatter.ts` (content boundary D-11), `content.ts` slug/locale resolution. Validate `slug` against `^[a-z0-9-]+$`, `locale` against `routing.locales`, join + assert path stays under `content/academie/` — NEVER concatenate raw slug (RESEARCH §Security path-traversal).

### Nav entry insertion (MODIFY)
**Source:** `src/app/[locale]/layout.tsx` lines 52-58 (the header). Add the "Académie" entry here.
```typescript
<header className="flex h-14 items-center justify-between bg-secondary px-4 md:px-6">
  <span className="font-semibold">Vétéran Trading</span> {/* i18n-ignore: marque */}
  {/* + nav <Link href="/academie">{t('nav.academy')}</Link> via @/i18n/navigation, i18n label */}
  <div className="ms-auto flex items-center gap-2"> {/* ThemeToggle + LanguageSwitcher */} </div>
</header>
```
> The brand name uses `// i18n-ignore: marque` — the nav label must NOT (lint:i18n exit 0, I18N-03).

### Funnel contextual link from signaux (D-08b — MODIFY)
**Source:** `(member)/signaux/[id]/page.tsx` L21 imports `Link` from `@/i18n/navigation`. Add a "Comment exécuter ce signal ?" link (copy `academy.signalExecLink`, UI-SPEC §6) → `/academie/<cours-plateforme>`, placed in `SignalDetail.tsx` or the detail page. i18n label, localized Link.

---

## No Analog Found

Net-new in this codebase — planner uses RESEARCH.md patterns (cited), not a codebase analog:

| File | Role | Data Flow | Reason / RESEARCH ref |
|------|------|-----------|------------------------|
| `src/lib/academie/content.ts` | service | file-I/O | No fs-based content catalog exists. Use RESEARCH Pattern 3 (`gray-matter` frontmatter-only scan) + Pattern 4 (FR fallback D-14). First `fs.readdir` content layer in repo. |
| `src/lib/academie/reading-time.ts` | utility | transform | No reading-time calc exists. RESEARCH Q4: home-grown deterministic call on raw body via `reading-time` lib (testable golden values fr/en/ar). |
| `src/lib/academie/toc.ts` | utility | transform | No TOC extraction exists. RESEARCH Pitfall 5: `github-slugger` (same algo as `rehype-slug`) so TOC anchors match rendered `id`. |
| `src/components/academie/mdx-components.tsx` | config | transform | First MDX component map in repo. RESEARCH Pattern 2 (Callout/Steps/Figure/TradeExample + h2 anchor). |
| `src/app/sitemap.ts` | config | batch | No sitemap exists. RESEARCH §Sitemap: `MetadataRoute.Sitemap` + `alternates.languages`; emit hreflang ONLY for locales actually present (NOT FR-fallback — Pattern 4 / Q3). |

> `content.ts`, `reading-time.ts`, `toc.ts`, `course-model.ts`, `frontmatter.ts` all have Wave 0 unit-test gaps (RESEARCH §Wave 0 Gaps) — planner schedules tests-first.

---

## Build / Runtime Constraint (carry into every plan)

- **MDX = `fs.readFile` + `compileMDX` ONLY.** Never `import './x.mdx'`, never a webpack `.mdx` loader rule, never `@next/mdx`. The project path contains `!` → webpack treats it as a loader separator (Pitfall 1). `compileMDX` reads a string via `fs`, bypassing module resolution.
- **Local runtime non-viable.** `next build` (webpack) breaks on `!`; `dev` (turbopack) mis-resolves `@app/*`. Acceptance criterion = **render verified in Vercel preview**, NOT a green local `next build` (Pitfall 2).
- **No new shadcn registry dep** — all `ui/*` primitives (Card, Badge, Progress, Alert, Button, Select, Separator) already present (UI-SPEC §Registry Safety).
- **No green/red color** in callouts/TradeExample — reserved for trading (UI-SPEC §Color, D-04). Distinguish by icon + i18n label.

## Metadata

**Analog search scope:** `apps/web/src/{lib,components,app}/` (signals, marketing, ui, i18n).
**Files scanned:** 12 read in full/targeted; 5 strong analogs extracted (early-stop).
**Pattern extraction date:** 2026-06-19
