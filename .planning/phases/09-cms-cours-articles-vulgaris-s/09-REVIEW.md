---
phase: 09-cms-cours-articles-vulgaris-s
reviewed: 2026-06-19T00:00:00Z
depth: standard
files_reviewed: 27
files_reviewed_list:
  - apps/web/src/lib/academie/content.ts
  - apps/web/src/lib/academie/course-model.ts
  - apps/web/src/lib/academie/render-mdx.ts
  - apps/web/src/lib/academie/searchParams.ts
  - apps/web/src/lib/academie/frontmatter.ts
  - apps/web/src/lib/academie/reading-time.ts
  - apps/web/src/lib/academie/toc.ts
  - apps/web/src/app/[locale]/(marketing)/academie/page.tsx
  - apps/web/src/app/[locale]/(marketing)/academie/[slug]/page.tsx
  - apps/web/src/app/[locale]/(marketing)/academie/[course]/[lesson]/page.tsx
  - apps/web/src/app/[locale]/(marketing)/page.tsx
  - apps/web/src/app/[locale]/layout.tsx
  - apps/web/src/app/sitemap.ts
  - apps/web/src/components/academie/mdx-components.tsx
  - apps/web/src/components/academie/Callout.tsx
  - apps/web/src/components/academie/Steps.tsx
  - apps/web/src/components/academie/Figure.tsx
  - apps/web/src/components/academie/TradeExample.tsx
  - apps/web/src/components/academie/Toc.tsx
  - apps/web/src/components/academie/ContentCard.tsx
  - apps/web/src/components/academie/FilterBar.tsx
  - apps/web/src/components/academie/FallbackBanner.tsx
  - apps/web/src/components/signals/SignalDetail.tsx
  - apps/web/e2e/academie.spec.ts
findings:
  critical: 1
  warning: 6
  info: 4
  total: 11
status: issues_found
---

# Phase 9: Code Review Report

**Reviewed:** 2026-06-19
**Depth:** standard
**Files Reviewed:** 24 source files (some via glob `components/academie/*.tsx`)
**Status:** issues_found

## Summary

Read-only public "Académie" surface: MDX rendered via `compileMDX(fs.readFile)`, file-based catalog, Zod-validated boundaries. The headline security concerns hold up well:

- **Path traversal (T-09-PATH): SAFE.** `safeFilePath` rejects any slug not matching `^[a-z0-9-]+$` and any locale outside `routing.locales` *before* any disk access. `..`, `/`, `\`, `.` are all blocked by the regex. The `[course]/[lesson]` route resolves only the `lesson` param through this same guard; `course` is never fed to `fs`. The `path.resolve` + `startsWith(CONTENT_ROOT + sep)` confinement is redundant (the regex already guarantees confinement) but harmless.
- **MDX render path: SAFE.** `render-mdx.ts` reads via `fs.readFile` only — no `import '*.mdx'`, no `@next/mdx`, no webpack loader. Component injection is a fixed allowlist (`MDX_COMPONENTS`), no `dangerouslySetInnerHTML`, no raw-HTML passthrough, no `rehype-raw`. XSS surface is minimal.
- **LEGAL-01: SATISFIED.** `<Disclaimer />` is injected by every page surface (article, course landing, lesson, and even the render-error fallback states), never by the MDX, and is deliberately excluded from `MDX_COMPONENTS`.
- **searchParams (T-09-01): SAFE.** Strict per-axis `z.enum` allowlist, out-of-enum silently dropped, never throws.

One BLOCKER: the catalog scan validates frontmatter with `.parse` (throws), so a single malformed file 500s the entire index — directly contradicting the documented "degrade gracefully, never 500" boundary contract that `render-mdx.ts` honors via `safeParse`.

## Critical Issues

### CR-01: `listContent` uses throwing `.parse` — one malformed file 500s the whole catalog

**File:** `apps/web/src/lib/academie/content.ts:205`
**Issue:** The render path (`render-mdx.ts:46`) correctly uses `FrontmatterSchema.safeParse(...)` and returns `null` on invalid frontmatter so the page degrades to an error state instead of a 500. The catalog scan does the opposite:

```ts
const fm = FrontmatterSchema.parse(data) // frontière D-11 (throw si invalide)
```

`listContent` is called by the index page (`academie/page.tsx:131`), the course-landing path (`[slug]/page.tsx:72,129`), and the lesson page (`[course]/[lesson]/page.tsx:58`). A single author-introduced bad frontmatter field (missing `titre`, bad `order`, unknown `theme`, etc.) in *any* file throws, which propagates up and produces a 500 on the **entire Académie index and every course/lesson page** — not just the broken document. This is the exact failure mode the phase brief calls out as forbidden ("malformed file degrades gracefully, never 500"). The reassuring comment on the line is wrong.

**Fix:** Use `safeParse` and skip invalid entries (degrade gracefully), mirroring `render-mdx.ts`:
```ts
const parsed = FrontmatterSchema.safeParse(data)
if (!parsed.success) continue // skip the broken file, keep the catalog alive
const fm = parsed.data
```
Optionally log the skipped path server-side (pino) so authors notice the dropped document.

## Warnings

### WR-01: Lesson route never verifies the lesson belongs to the requested course

**File:** `apps/web/src/app/[locale]/(marketing)/academie/[course]/[lesson]/page.tsx:35-60`
**Issue:** The route resolves `resolveContent(lesson, locale)` and renders it without ever checking `meta.course === course`. Any lesson is served under *any* `course` segment, e.g. `/academie/totally-wrong-course/01-installer-mt5` returns HTTP 200 with the real lesson content. `lessonNavigation(course, order, catalog)` then derives nav from the (wrong) `course`, so `nav.total` is 0 and prev/next disappear, while the lesson still renders. This produces canonical-duplication (same content at many URLs — an SEO concern given the sitemap work in this phase) and broken in-course navigation rather than a clean `notFound()`.
**Fix:** After rendering, assert the frontmatter ties the lesson to the route:
```ts
if (rendered.meta.type !== 'lecon' || rendered.meta.course !== course) notFound()
```

### WR-02: Duplicate React `key` when an explicit `type:'cours'` file shares a slug with a lesson bucket

**File:** `apps/web/src/app/[locale]/(marketing)/academie/page.tsx:86-119`
**Issue:** `buildDisplayCards` emits a card with `key: 'cours:${entry.slug}'` for any explicit `type:'cours'` file (lines 86-99), and *also* emits `key: 'cours:${courseSlug}'` for every lesson bucket (lines 106-118). If a course has both an explicit cours file `foo.fr.mdx` (`type:'cours'`) and lessons with `course: 'foo'` (the documented "page-cours explicite" scenario in `[slug]/page.tsx:71`), two cards with identical `key="cours:foo"` and identical `href` are pushed. React will warn about duplicate keys and may drop/mis-reconcile a card. The two derivation paths (explicit file vs. bucket) are mutually unaware.
**Fix:** Track course slugs already emitted from explicit files and skip the bucket (or vice-versa). E.g. collect `explicitCourseSlugs: Set<string>` while iterating, then `if (explicitCourseSlugs.has(courseSlug)) continue` before pushing the bucket card.

### WR-03: Frontmatter `cover` is rendered into `next/image` with no validation or allowlist

**File:** `apps/web/src/lib/academie/frontmatter.ts:35`, consumed at `academie/[slug]/page.tsx:97`, `ContentCard.tsx:59`, `Figure.tsx:23`
**Issue:** `cover: z.string().min(1)` accepts any string. It flows straight into `<Image src={...}>`. A frontmatter author can set `cover: https://attacker.example/x.png` (remote host not in `next.config` `images.remotePatterns` → build/runtime image error or unintended outbound fetch) or a `data:`/relative path that breaks rendering. Same for `Figure` `src` coming from MDX props. Content is currently trusted (repo-committed), so severity is WARNING not BLOCKER, but the data-boundary discipline applied to every other field is missing here.
**Fix:** Constrain in the schema, e.g. require a site-relative path: `cover: z.string().regex(/^\/[\w\-./]+\.(png|jpe?g|webp|avif|svg)$/i)`. Or validate against the configured `images` allowlist before passing to `<Image>`.

### WR-04: Course-card "head" selection diverges from `deriveCourse`, can pick a different lesson

**File:** `apps/web/src/app/[locale]/(marketing)/academie/page.tsx:65-66,102-104` vs `course-model.ts:46-60`
**Issue:** The index buckets lessons by `entry.course` for *any* lesson (line 65 only checks `entry.course` is truthy, not that `order` is a number), then picks the head via `.sort((a,b) => (a.order ?? 0) - (b.order ?? 0))[0]` (treating missing `order` as 0). `deriveCourse` (used by the course landing page) instead *filters out* lessons with non-numeric `order` and tie-breaks by slug. So a lesson missing `order` can become the index card's title/cover (`order ?? 0` wins the sort) while being excluded entirely from the actual course page — the card on the index and the course landing can show different "first lesson". Inconsistent and surprising.
**Fix:** Reuse `deriveCourse`/the shared sort for the index head selection, or apply the same `typeof e.order === 'number'` filter and slug tie-break in `buildDisplayCards` so both surfaces agree.

### WR-05: `Steps` step number is CSS-`content`-only and `aria-hidden` — number invisible to assistive tech, fragile in print/no-CSS

**File:** `apps/web/src/components/academie/Steps.tsx:24-27`
**Issue:** The step index is rendered purely via `before:content-[counter(step)]` on an `aria-hidden="true"` span. Screen-reader users get no step number at all, and the number vanishes if the arbitrary Tailwind counter utility fails to compile or in any no-CSS context. For a pedagogical "numbered steps" component the ordinal is semantic content, not decoration.
**Fix:** Use a real ordered list semantics or render the number as actual text (e.g. an accessible `<span>{n}</span>` passed as a prop / derived from list position) instead of a CSS pseudo-element hidden from AT.

### WR-06: Render-error fallback returns 200 instead of `notFound()`, undermining the "graceful" contract's HTTP semantics

**File:** `apps/web/src/app/[locale]/(marketing)/academie/[slug]/page.tsx:55-66`, `[course]/[lesson]/page.tsx:39-52`
**Issue:** When `renderMdxFile` returns `null` (invalid frontmatter at render time), the page renders an inline error block with HTTP 200. The E2E spec asserts `status < 400`, so this passes the test — but a content document that exists yet is unrenderable is arguably a `404`/`notFound()` case for SEO and link correctness, not a soft 200 "error" page that search engines will index. At minimum it is inconsistent with `notFound()` used for genuinely missing slugs in the same files. (Note this is the *correct* place to handle the boundary gracefully; the issue is the HTTP status, not the try/skip.)
**Fix:** Prefer `notFound()` for unrenderable content, or set the response to 404 via route segment config, so crawlers don't index broken pages. If the soft-error UI is an intentional product decision, document it and confirm it is excluded from the sitemap (it is, since the slug only appears if frontmatter scanned cleanly — but CR-01 must be fixed first or the sitemap path also throws).

## Info

### IN-01: Confinement check in `safeFilePath` is dead code

**File:** `apps/web/src/lib/academie/content.ts:81-82`
**Issue:** Because `slug` already passed `^[a-z0-9-]+$` and `locale` is whitelisted, `fileName` contains no separators, so `path.resolve(CONTENT_ROOT, fileName)` can never escape `CONTENT_ROOT`; the `startsWith` branch is unreachable. Not a vulnerability — but the comment frames it as the primary guard when the regex is. Keep it as defense-in-depth; consider a comment correction so future maintainers don't weaken the regex believing the resolve check protects them.

### IN-02: `findAbsPath` returns the first matching file across course dirs — silent slug collision

**File:** `apps/web/src/lib/academie/content.ts:97-114`
**Issue:** A lesson slug (e.g. `01-introduction.fr.mdx`) is searched in `articles/` then in every `cours/*/` directory, returning the first hit. If two different courses contain a lesson with the same filename, only the first (readdir order) is ever served via the `[slug]` route, and the other is shadowed with no warning. Low risk given authored content, but worth a uniqueness lint on lesson slugs.

### IN-03: Layout has a stray `{' '}` text node between brand span and nav Link

**File:** `apps/web/src/app/[locale]/layout.tsx:56`
**Issue:** `<span>Vétéran Trading</span> {/* comment */}` leaves a literal whitespace/JSX expression in the flex header. Cosmetic; the comment-as-child after the span renders an empty text node. Harmless but untidy in a flex row using `ms-6`/`ms-auto` for spacing.

### IN-04: `date` schema accepts arbitrary strings, defeating the ISO intent

**File:** `apps/web/src/lib/academie/frontmatter.ts:34`
**Issue:** `z.iso.datetime().or(z.string())` — the `.or(z.string())` makes the ISO branch meaningless: any string passes. `date` is currently unused in rendering (no sort by date observed), so impact is nil today, but if a future feature sorts/formats by date, malformed values will slip through. Tighten to `z.iso.datetime()` (or `z.iso.date()`) once content conforms, or drop the field until needed.

---

_Reviewed: 2026-06-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
