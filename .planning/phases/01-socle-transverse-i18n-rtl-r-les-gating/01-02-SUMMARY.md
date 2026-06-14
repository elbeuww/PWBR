---
phase: 01-socle-transverse-i18n-rtl-r-les-gating
plan: 02
subsystem: i18n-rtl-foundation
tags: [i18n, next-intl, tailwind-v4, rtl, l10n]
requires: []
provides:
  - "i18n routing (fr/en/ar, defaultLocale fr, localePrefix always)"
  - "localized navigation wrappers (Link/redirect/usePathname/useRouter/getPathname)"
  - "getRequestConfig loading messages/{locale}.json with hasLocale fallback"
  - "messages fr/en/ar (common/language/auth/access/pricing, strict key parity)"
  - "Tailwind v4 via @tailwindcss/postcss + globals.css (--font-arabic on :lang(ar))"
affects:
  - apps/web/next.config.ts (wrapped by withNextIntl)
tech-stack:
  added:
    - "next-intl@4.13.0 (deps)"
    - "tailwindcss@4.3.1 (devDeps)"
    - "@tailwindcss/postcss@4.3.1 (devDeps)"
  patterns:
    - "RTL via native CSS logical properties (Tailwind v4) — NO tailwindcss-rtl/logical"
    - "locale validated at trust boundary via hasLocale before render (T-01-05)"
key-files:
  created:
    - apps/web/postcss.config.mjs
    - apps/web/src/styles/globals.css
    - apps/web/src/i18n/routing.ts
    - apps/web/src/i18n/navigation.ts
    - apps/web/src/i18n/request.ts
    - apps/web/src/messages/fr.json
    - apps/web/src/messages/en.json
    - apps/web/src/messages/ar.json
  modified:
    - apps/web/package.json
    - apps/web/next.config.ts
    - pnpm-lock.yaml
decisions:
  - "D-01/02/03 encoded: localePrefix always, defaultLocale fr, locales fr/en/ar"
  - "D-11: @theme minimal (--font-arabic only), brand design system deferred P2"
  - "A1 resolved: next-intl 4.13 import paths confirmed against installed exports (routing/navigation/server/root hasLocale)"
metrics:
  duration: "3 min"
  completed: "2026-06-14"
  tasks: 3
  files: 11
---

# Phase 01 Plan 02: Socle i18n/RTL Summary

next-intl 4.13 routing + localized navigation + message loading, with fr/en/ar messages at strict key parity and Tailwind v4 (RTL via native logical properties, Arabic font on :lang(ar)) — the i18n/RTL foundation reused by every later page, no routes moved.

## What Was Built

- **Task 1** — Installed `next-intl@4.13.0` (deps) + `tailwindcss@4.3.1` / `@tailwindcss/postcss@4.3.1` (devDeps) at exact locked versions. Created `postcss.config.mjs` (Tailwind v4 plugin) and `globals.css` (`@import "tailwindcss"` + `@theme { --font-arabic }` + `:lang(ar)` mapping). Wrapped `next.config.ts` with `withNextIntl('./src/i18n/request.ts')`, preserving `transpilePackages`, `outputFileTracingRoot`, and `turbopack.root`. Confirmed `tailwindcss-rtl` / `tailwindcss-logical` absent.
- **Task 2** — Created `routing.ts` (`defineRouting`, locales fr/en/ar, defaultLocale fr, localePrefix always), `navigation.ts` (`createNavigation(routing)` → Link/redirect/usePathname/useRouter/getPathname), `request.ts` (`getRequestConfig` loading `messages/{locale}.json`, validated by `hasLocale` with defaultLocale fallback). Import paths verified against the installed next-intl 4.13 export map.
- **Task 3** — Created `messages/{fr,en,ar}.json` with namespaces `common`, `language`, `auth`, `access`, `pricing`. Strict key parity proven by Node script; language autonyms (Français/English/العربية) identical across all three files; pricing placeholder title+body in all three languages.

## Decisions Made

- **D-01/02/03** encoded directly in `routing.ts`: every URL is locale-prefixed, root resolves to `/fr`, no Accept-Language auto-detection at MVP.
- **D-11**: `@theme` kept minimal (`--font-arabic` only). Brand palette/typography/shadcn deferred to Phase 2.
- **A1 resolved**: next-intl 4.13 subpath imports confirmed against the installed package's `exports` map — `next-intl/routing`, `next-intl/navigation`, `next-intl/server`, and root `next-intl` for `hasLocale`.

## Deviations from Plan

None for Tasks 1-3 — plan executed exactly as written.

### Out-of-scope discovery (logged, not fixed)

`tsc --noEmit` on the web package surfaces ~50 pre-existing errors in `packages/supabase`
(`database.types.ts` does not export the named aliases ProfileRow/TradeSetupRow/etc.) plus an
intentional lint fixture. None are in this plan's files (verified by filtering tsc output for
`i18n|messages|next.config` — zero matches). Per SCOPE BOUNDARY these are NOT fixed; logged to
`deferred-items.md` for a follow-up to Plan 01-01's type regeneration.

## Verification

- Task 1 automated check: `next-intl` in deps + `@tailwindcss/postcss`/`tailwindcss` in devDeps, no rtl/logical packages — PASS.
- Task 2 automated check: `localePrefix` / `createNavigation` / `getRequestConfig` present — PASS (OK).
- Task 3 automated check (plan's Node script): strict key parity fr/en/ar — PASS (true); autonyms identical — PASS (true).
- Typecheck on this plan's files (`apps/web/src/i18n/*`, `messages/*`, `next.config.ts`): zero errors.
- No route moved (config + messages only, per plan scope).

## Notes for Future Plans

- Plan 01-03 consumes these wrappers: build `[locale]/layout.tsx` with `<html lang dir>` (ar → rtl), the middleware from `routing`, the language selector via `usePathname`/`useRouter`, and gate redirects via `redirect` from `i18n/navigation`. All UI strings must come from `messages/*` (I18N-03, grep-verified at Plan 04).
- A `middleware.ts` (using `createMiddleware(routing)`) is NOT created here — it belongs to the route-moving Plan 03.

## Self-Check: PASSED

All 8 created files present on disk; all 3 task commits (c3de216, 5fae04b, 0b4dd41) found in git history.
