---
phase: 20-dashboard-superadmin-cockpit-4-axes
reviewed: 2026-06-26T00:00:00Z
depth: standard
files_reviewed: 26
files_reviewed_list:
  - supabase/migrations/0021_admin_cockpit.sql
  - apps/web/src/lib/admin/queries.ts
  - apps/web/src/lib/admin/searchParams.ts
  - apps/web/src/lib/admin/kpis.ts
  - apps/web/src/lib/auth/gate.ts
  - apps/web/src/app/(admin)/page.tsx
  - apps/web/src/app/(admin)/_components/AdminSidebar.tsx
  - apps/web/src/app/(admin)/_components/AxisSummaryRevenus.tsx
  - apps/web/src/app/(admin)/_components/AxisSummaryOps.tsx
  - apps/web/src/app/(admin)/_components/AxisSummaryAcquisition.tsx
  - apps/web/src/app/(admin)/_components/AxisSummaryConformite.tsx
  - apps/web/src/app/(admin)/membres/actions.ts
  - apps/web/src/app/(admin)/membres/page.tsx
  - apps/web/src/app/(admin)/affiliation/payouts/actions.ts
  - apps/web/src/app/(admin)/affiliation/payouts/page.tsx
  - apps/web/src/app/(admin)/affiliation/page.tsx
  - apps/web/src/app/(admin)/affiliation/affilies/page.tsx
  - apps/web/src/app/(admin)/file/page.tsx
  - apps/web/src/app/(admin)/sante/page.tsx
  - apps/web/src/app/(admin)/signaux/page.tsx
  - apps/web/src/app/(admin)/signaux/[id]/page.tsx
  - apps/web/src/components/admin/MemberRowActions.tsx
  - apps/web/test/admin-rls.test.ts
  - apps/web/src/lib/admin/__tests__/queries.sanitize.test.ts
  - apps/web/src/lib/admin/__tests__/kpis.test.ts
  - apps/web/src/styles/__tests__/rls-unchanged.test.ts
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: issues_found
---

# Phase 20: Code Review Report

**Reviewed:** 2026-06-26
**Depth:** standard
**Files Reviewed:** 26 (database.types.ts excluded — generated)
**Status:** issues_found

## Summary

Reviewed the superadmin cockpit: migration 0021 (RLS policies, SECURITY DEFINER RPCs, suspension barrier), the anon-client KPI/query layer, the gate, the 4-axis dashboard + detail pages, write Server Actions (membres / payouts), and the RLS contract tests.

The security core is sound. Specifically verified and found correct:

- **Write-RPC gating:** all 4 mutating RPCs put `if not (select is_superadmin()) then raise 'forbidden'` in head position, before any business logic, with the audit insert in the same transaction (atomic). `revoke ... from public, anon` + `grant to authenticated` is consistent.
- **Keyset cursor anti-injection (T-20-13):** `ISO_TIMESTAMP` = `[\d:.]` only and strict `UUID` regex, anchored `^...$`. A comma/parenthesis cannot survive either test, so the un-parameterized `.or()` interpolation cannot be broken out of. Unit tests cover the break-out payloads.
- **Filter whitelisting:** `status`/`source` are `z.enum`, parsed field-by-field with `safeParse` (out-of-enum → ignored, never thrown, never raw-interpolated). `q` goes through parameterized `.ilike`.
- **Anti double-payout:** `admin_mark_commission_paid` does `update ... where status='due'` + `raise if row_count=0` before inserting the payout — the transition is the unique guard.
- **Anon-client discipline:** no page/query in scope instantiates service_role; `kpis.ts` never touches `mv_mrr` directly. `file/actions.ts` + `affiliation/actions.ts` retaining service_role is the documented Option-B / 0022 deferral (accepted, not flagged).

Findings below are correctness/robustness/maintainability defects, no blockers.

## Warnings

### WR-01: RLS test (4) never exercises the suspension barrier — passes for the wrong reason

**File:** `apps/web/test/admin-rls.test.ts:165-178`
**Issue:** The case titled "(4) après suspend_account, le compte suspendu lit 0 trade_setups / analyses" calls `suspend_account` **as the member** (`memberClient`). That call is correctly rejected with `forbidden`, so the member is **never actually suspended**. The subsequent assertions that the member reads 0 `trade_setups` / `analyses` then pass only because the member has no active subscription — not because of suspension. The single most important new RLS barrier in this phase (`has_active_subscription() and not suspended`, D-17) therefore has **zero executable coverage**; the test gives false confidence it works.
**Fix:** Drive the suspension through a superadmin client, then assert the member loses reads:
```ts
// promote/seed superClient, then:
const { error } = await superClient.rpc('suspend_account', { p_user_id: memberId, p_reason: 'rls-contract-test' })
expect(error).toBeNull()
// give member an active sub first (so the 0-rows result is attributable to suspension, not missing sub)
const { data: setups } = await memberClient.from('trade_setups').select('id').limit(1)
expect(setups ?? []).toHaveLength(0)
await superClient.rpc('unsuspend_account', { p_user_id: memberId }) // cleanup
```

### WR-02: account-mutation RPCs write to admin_audit_log even when the target row does not exist

**File:** `supabase/migrations/0021_admin_cockpit.sql:181-201` (`suspend_account`), `207-226` (`unsuspend_account`), `140-175` (`grant_subscription_time`)
**Issue:** `suspend_account` / `unsuspend_account` run `update public.profiles ... where id = p_user_id` and then unconditionally insert an audit row, **never checking `row_count`**. A typo'd or stale `p_user_id` updates 0 rows yet still records a `suspend_account` / `unsuspend_account` entry in `admin_audit_log` and returns success (the UI shows a success toast). This is inconsistent with `admin_mark_commission_paid`, which correctly raises on `row_count = 0`. It corrupts the audit trail (records actions that had no effect) and hides operator mistakes. `grant_subscription_time` has the related gap: on a non-existent `p_user_id` it falls through to `insert into subscriptions`, relying solely on a FK to fail.
**Fix:** Mirror the commission RPC's guard in the account RPCs:
```sql
update public.profiles set suspended = true, ... where id = p_user_id;
get diagnostics v_updated = row_count;
if v_updated = 0 then
  raise exception 'suspend_account: utilisateur % introuvable', p_user_id;
end if;
-- then insert audit
```

### WR-03: get_churn ignores subscription status; funnel stages can invert

**File:** `supabase/migrations/0021_admin_cockpit.sql:352-385` (`get_churn`), `291-343` (`get_acquisition_funnel`)
**Issue:** Two analytics-correctness defects on superadmin-facing KPIs:
1. `get_churn` aggregates `from public.subscriptions s` with **no `status` filter at all**. `active_start` = `count(distinct user_id) where current_period_end >= m_start` therefore counts users whose subscription is `expired`/`canceled` (but with a future-or-recent `current_period_end`) as part of the "active at month start" denominator. `get_plan_mix` (L.392-407) correctly filters `status = 'active'`; churn does not, so the churn rate denominator is computed on a different population than the rest of the cockpit.
2. `get_acquisition_funnel` "activation" counts any user with a verified payment in the window (not the *first* payment, despite the `1er paiement verified` comment), and "inscription" only counts profiles `created_at` inside the window. A user who registered before the window but paid inside it lands in activation without ever appearing in inscription, so for a given source `activation` can exceed `inscription` — a visibly inverted funnel.
**Fix:** Add `and s.status = 'active'` to the churn base (or define `active_start` explicitly as active subs at `m_start`); for the funnel, either relabel the stages to "users with ≥1 / ≥2 verified payments" or anchor inscription/activation to the same cohort so stages are monotone.

### WR-04: keyset cursor sanitization duplicated and at risk of drift

**File:** `apps/web/src/app/(admin)/file/page.tsx:40-83` vs `apps/web/src/lib/admin/queries.ts:60-122`
**Issue:** The anti-injection regexes (`ISO_TIMESTAMP`, `UUID`) and the keyset `.or()` build are copy-pasted into `file/page.tsx` instead of reusing the exported `sanitizeCursor` from `lib/admin/queries.ts`. The same pair is also re-declared (comment: "regex copiées verbatim depuis lib/watchlist/queries.ts"). Because this is the security-critical guard for un-parameterized `.or()` interpolation, three independent copies mean a future hardening of one regex can silently leave the others vulnerable. The `queries.sanitize.test.ts` suite only covers the `lib/admin/queries.ts` copy, so the `file/page.tsx` copy is untested.
**Fix:** Extract a single shared `sanitizeCursor` (e.g. in `lib/keyset/cursor.ts`) and import it in both `lib/admin/queries.ts` and `file/page.tsx`; point the existing test at the shared symbol.

### WR-05: suspended superadmin keeps full RLS read access

**File:** `supabase/migrations/0021_admin_cockpit.sql:32-56, 100-120`
**Issue:** The suspension barrier lives in `has_active_subscription()` (`and not suspended`), but the new `superadmin voit tout` policies on `profiles`/`trade_setups`/`analyses`/`candles`/`telegram_posts` gate solely on `is_superadmin()`, which checks `role = 'superadmin'` and does **not** consider `suspended`. So suspending the superadmin account does not revoke its data reads at the RLS layer; only the proactive `gate.ts` sign-out (a UX layer, by its own comment) stops it. The phase repeatedly states "la vraie barrière est la RLS" — for the one account that matters most, it is not.
**Fix:** Decide intent explicitly. If a suspended superadmin must lose access, add `and not exists (... profiles p where p.id = auth.uid() and p.suspended)` to `is_superadmin()` (or to the policies). If suspending the sole superadmin is out of scope, document it and guard `suspend_account` against suspending a superadmin target.

## Info

### IN-01: `q` search param is unbounded and LIKE metacharacters are not escaped

**File:** `apps/web/src/lib/admin/searchParams.ts:24`, `apps/web/src/lib/admin/queries.ts:101`
**Issue:** `q` is validated as `z.string().min(1)` only (no max length) and is interpolated into `\`%${params.q}%\`` for `.ilike`. `%`/`_` are passed through as wildcards, so a user-supplied `%` widens the search and a very long `q` is sent verbatim. Not an injection (the value is parameterized), but a robustness/abuse edge.
**Fix:** Add `.max(120)` and escape LIKE metacharacters (`q.replace(/[%_\\]/g, '\\$&')`) before building the pattern.

### IN-02: repeated `as unknown as` casts erode type safety at the data boundary

**File:** `apps/web/src/lib/admin/queries.ts:110-113,129`; `affiliation/payouts/page.tsx:53-54`; `affiliation/affilies/page.tsx:48-52`; `file/page.tsx:89`; `signaux/page.tsx:68`; `signaux/[id]/page.tsx:46`
**Issue:** Embedded-relation shapes are forced via `as unknown as {...}`, bypassing the generated `database.types.ts`. A schema/embed change won't surface as a type error; it becomes a runtime `undefined` access. The `?.email ?? '—'` guards soften this but the typing is fictional.
**Fix:** Type embeds from the generated `Database` types (or a small Zod parse at the boundary) instead of `as unknown as`.

### IN-03: `console.error` for server-action failures diverges from the project logging standard

**File:** `apps/web/src/app/(admin)/membres/actions.ts:64`, `apps/web/src/app/(admin)/affiliation/payouts/actions.ts:69`
**Issue:** Project stack standardizes on `pino` for structured logs. The opaque-error mapping is correct (no raw DB message leaks to the client), but `console.error` produces unstructured output. Low impact, consistency only.
**Fix:** Route through the shared structured logger if one is available to the web app.

### IN-04: `signaux/page.tsx` loads all trade_setups unbounded then filters in memory

**File:** `apps/web/src/app/(admin)/signaux/page.tsx:48-78,105-112`
**Issue:** `loadSignals` selects all `trade_setups` with no `.limit()` and filters/derives Telegram status in JS, while sibling admin tables (membres, file) use keyset pagination. As the table grows this loads the whole set into the RSC. Flagged as correctness/consistency context only — pure performance is out of v1 review scope.
**Fix:** Apply keyset pagination consistent with `membres`/`file`, or bound the query window.

---

_Reviewed: 2026-06-26_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
