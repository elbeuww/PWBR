# Deferred Items — Phase 01

Out-of-scope discoveries logged during execution (not fixed — SCOPE BOUNDARY).

## Pre-existing typecheck errors in `packages/supabase` (discovered Plan 01-02)

`pnpm --filter web tsc --noEmit` reports ~50 errors of the form:
`Module '"./database.types"' has no exported member 'ProfileRow' / 'TradeSetupRow' / ...`
plus `src/lib/supabase/__lint_fixtures__/forbidden-service-import.ts` (intentional lint fixture).

- **Root cause:** `packages/supabase/src/index.ts` and repositories import named type
  aliases (ProfileRow, TradeSetupRow, etc.) that the regenerated `database.types.ts`
  does not re-export under those names.
- **Scope:** NONE of these errors are in Plan 01-02 files (`apps/web/src/i18n/*`,
  `apps/web/src/messages/*`, `next.config.ts`). Confirmed by filtering tsc output.
- **Disposition:** DEFERRED. Pre-existing condition in the `@app/supabase` package,
  unrelated to i18n/RTL config. Should be addressed where database.types.ts type
  aliases are owned (likely a follow-up to Plan 01-01's type regeneration).
