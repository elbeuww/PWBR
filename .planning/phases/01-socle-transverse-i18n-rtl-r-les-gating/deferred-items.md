# Deferred Items — Phase 01

Out-of-scope discoveries logged during execution (not fixed — SCOPE BOUNDARY).

## [RESOLVED] typecheck errors in `packages/supabase` (discovered Plan 01-02)

`pnpm --filter web tsc --noEmit` reports ~50 errors of the form:
`Module '"./database.types"' has no exported member 'ProfileRow' / 'TradeSetupRow' / ...`
plus `src/lib/supabase/__lint_fixtures__/forbidden-service-import.ts` (intentional lint fixture).

- **Root cause:** `packages/supabase/src/index.ts` and repositories import named type
  aliases (ProfileRow, TradeSetupRow, etc.) that the regenerated `database.types.ts`
  does not re-export under those names.
- **Scope:** NONE of these errors are in Plan 01-02 files (`apps/web/src/i18n/*`,
  `apps/web/src/messages/*`, `next.config.ts`). Confirmed by filtering tsc output.
- **Disposition:** RESOLVED (orchestrator, after Plan 01-02). NOT pre-existing — it was a
  regression introduced by Plan 01-01's checkpoint type regeneration: the raw `supabase gen`
  output overwrote the hand-maintained alias block (ProfileRow, TradeSetupRow, CandleInsert, …)
  that the repositories import. Fix: re-appended the hand-maintained alias block verbatim and
  added the Phase-1 v2.0 aliases (UserRole, SubscriptionStatus, SubscriptionPlan,
  SubscriptionRow/Insert) for the new 0008/0009 schema. `tsc -b packages/supabase` → exit 0.
