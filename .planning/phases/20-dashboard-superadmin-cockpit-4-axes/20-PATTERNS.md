# Phase 20: Dashboard superadmin (cockpit 4 axes) - Pattern Map

**Mapped:** 2026-06-26
**Files analyzed:** 22 (new + modified)
**Analogs found:** 22 / 22 (100% — greenfield-zero, tout réutilise l'existant)

> Every new/modified file has a concrete in-repo analog. Paths are absolute-from-repo-root.
> All line ranges VERIFIED by reading the analog this session.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/0021_admin_cockpit.sql` | migration | DDL + CRUD + transform | `supabase/migrations/0017_scalable_foundation.sql` (policies+matview wrapper), `0016` (RPC atomique), `0008` (is_superadmin), `0009` (has_active_subscription) | exact (calque multi-source) |
| `apps/web/src/lib/admin/kpis.ts` | service (RPC wrapper) | request-response (read agg) | `supabase/migrations/0017` `get_mrr()` + `lib/auth/gate.ts` `.rpc()` | role-match |
| `apps/web/src/lib/admin/queries.ts` (users keyset) | service (query) | CRUD read + keyset | `apps/web/src/lib/watchlist/queries.ts` | exact |
| `apps/web/src/lib/admin/searchParams.ts` (NEW) | utility | transform (parse/serialize) | `apps/web/src/lib/signals/searchParams.ts` (`WatchlistParamsSchema`) | exact |
| `apps/web/src/lib/auth/gate.ts` (MODIFY: suspension) | middleware (auth gate) | request-response | self (`requireUser`/`requireActiveSub`, L.78-97) | self-extend |
| `apps/web/src/app/(admin)/page.tsx` (MODIFY → cockpit) | component (RSC page) | request-response (read agg) | self (current KPI head-counts) + `lib/admin/freshness.ts` | self-reskin |
| `apps/web/src/app/(admin)/membres/page.tsx` (MODIFY) | component (RSC page) | CRUD read + keyset + filters | `lib/watchlist/queries.ts` (keyset) + self (table render) | role+flow |
| `apps/web/src/app/(admin)/file/page.tsx` (MODIFY) | component (RSC page) | CRUD read + keyset | `membres/page.tsx` + `watchlist/queries.ts` | role-match |
| `apps/web/src/app/(admin)/sante/page.tsx` (MODIFY) | component (RSC page) | request-response (read) | self + `(admin)/page.tsx` freshness pattern | self-reskin |
| `apps/web/src/app/(admin)/signaux/page.tsx` + `[id]/page.tsx` (MODIFY, read-only) | component (RSC page) | request-response (read) | self (anon-client swap only) | self-reskin |
| `apps/web/src/app/(admin)/affiliation/{page,affilies/page,payouts/page}.tsx` (MODIFY) | component (RSC page) | CRUD read | self (anon-client swap; policies already there) | self-reskin |
| `apps/web/src/app/(admin)/membres/actions.ts` (MODIFY → RPC gated) | controller (Server Action) | request-response (write) | `(admin)/affiliation/payouts/actions.ts` (gated RPC call) | role-match |
| `apps/web/src/app/(admin)/file/actions.ts` (MODIFY) | controller (Server Action) | request-response (write) | `payouts/actions.ts` | role-match |
| `apps/web/src/app/(admin)/affiliation/actions.ts` (MODIFY) | controller (Server Action) | request-response (write) | `payouts/actions.ts` | role-match |
| `apps/web/src/app/(admin)/affiliation/payouts/actions.ts` (MODIFY → gated RPC) | controller (Server Action) | request-response (write) | self (swap `markCommissionPaid` service_role → `admin_mark_commission_paid` anon RPC) | self-extend |
| `apps/web/src/app/(admin)/_components/AxisSummary*.tsx` (NEW) | component (RSC card) | presentation | `(admin)/page.tsx` Card+Link block (L.166-205) | role-match |
| `apps/web/src/app/(admin)/_components/AdminSidebar.tsx` (MODIFY → 4 axes) | component (client nav) | presentation | self (`NAV_ITEMS` L.36-44) | self-extend |
| `apps/web/src/components/admin/MemberRowActions.tsx` (MODIFY → offrir/suspendre) | component (client) | event-driven (dialog→action) | self (dialog+alert-dialog+transition pattern) | self-extend |
| `apps/web/test/admin-rls.test.ts` (NEW) | test (integration RLS) | request-response | `lib/signals/__tests__/searchParams.test.ts` (vitest shape) + RLS anon convention §Validation | partial |
| `apps/web/src/styles/__tests__/rls-unchanged.test.ts` (MODIFY → scan admin) | test (static scan) | file-I/O | self (`SCANNED_GROUPS` L.31, `FORBIDDEN` L.41-46) | self-extend |
| `apps/web/test/no-perf-claims.test.ts` (MODIFY) + `no-perf-seed-claims.test.ts` | test (static scan) | file-I/O | self (`SCANNED_NAMESPACES` L.36-45) | self-extend |
| `apps/web/src/lib/admin/__tests__/searchParams.test.ts` (NEW) | test (unit) | transform | `lib/signals/__tests__/searchParams.test.ts` | exact |

---

## Pattern Assignments

### `supabase/migrations/0021_admin_cockpit.sql` (migration — DDL + RPC + policies)

This file aggregates FOUR canonical SQL layers. Copy each block from its precise source.

**Layer A — SELECT policy « superadmin voit tout » (3 to 5 policies).**
Analog: `supabase/migrations/0009_subscriptions_gating.sql` L.46-50 (policy form) + `0017` InitPlan wrap `(select ...)`.
```sql
-- 0009 L.46-50 — exact policy shape. P20: wrap InitPlan from the start (0017 convention).
create policy "subscriptions: superadmin voit tout"
  on public.subscriptions
  for select to authenticated
  using (public.is_superadmin());
```
P20 form (research §Migration Mapping, wrap `(select ...)` to avoid `auth_rls_initplan` advisor):
```sql
create policy "profiles: superadmin voit tout"
  on public.profiles for select to authenticated
  using ((select public.is_superadmin()));
-- idem telegram_posts, candles ; +A1 trade_setups, analyses (if superadmin not guaranteed subscribed)
```
Tables needing the policy (research, VERIFIED per-table): `profiles`, `telegram_posts`, `candles` (always); `trade_setups`, `analyses` (assumption A1). All others already covered by 0017.

**Layer B — `admin_audit_log` table + read-only RLS.**
Analog: table+RLS shape from `0009` L.27-50; "superadmin-only select, no write policy" from `0016` affiliate_applications pattern (insert only via SECURITY DEFINER bypass). Schema in research §RPC L.190-207.
```sql
create table public.admin_audit_log ( id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id), action text not null check (...),
  target_type text not null check (...), target_id uuid not null,
  payload jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());
alter table public.admin_audit_log enable row level security;
create policy "admin_audit_log: superadmin voit tout" on public.admin_audit_log
  for select to authenticated using ((select public.is_superadmin()));
-- NO insert/update/delete policy → writes ONLY via SECURITY DEFINER RPC (mirror 0016).
```

**Layer C — `profiles.suspended` column + helper extension.**
Analog: `alter table add column` from `0008` L.20-22; helper drop/recreate from `0009` L.63-77.
```sql
-- column (mirror 0008 L.20-22 add-column-with-default)
alter table public.profiles add column suspended boolean not null default false;
alter table public.profiles add column suspended_reason text;
alter table public.profiles add column suspended_at timestamptz;
```
Suspension as a REAL RLS barrier (research A2 recommendation): drop/recreate `has_active_subscription()` (`0009` L.63-77) adding `and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.suspended)`. One source of truth → suspended user reads 0 rows everywhere gated by that helper.

**Layer D — write RPCs `SECURITY DEFINER` gated + atomic audit.**
Analog: `supabase/migrations/0016_affiliation.sql` `mark_commission_paid` L.331-362 (atomic update + insert in one tx, anti-double-effect via `row_count`) + gate guard `is_superadmin()` from `0008`. Grant contract from `0008` L.46-47 / `get_mrr` `0017` L.272-273.
```sql
-- skeleton each RPC (research Code Examples, calque mark_commission_paid 0016 L.331-362):
create function public.suspend_account(p_user_id uuid, p_reason text)
  returns void language plpgsql security definer set search_path = public as $$
begin
  if not (select public.is_superadmin()) then raise exception 'forbidden'; end if;  -- D-03
  update public.profiles set suspended=true, suspended_reason=p_reason, suspended_at=now()
   where id = p_user_id;
  insert into public.admin_audit_log (actor_id, action, target_type, target_id, payload)
  values ((select auth.uid()), 'suspend_account', 'user', p_user_id,
          jsonb_build_object('reason', p_reason));                                  -- D-04 atomic
end; $$;
revoke execute on function public.suspend_account(uuid, text) from public, anon;  -- 0008 L.46
grant  execute on function public.suspend_account(uuid, text) to authenticated;   -- 0008 L.47
```
RPCs to create: `grant_subscription_time(p_user_id, p_interval)` (whitelist `p_interval`, replicate active def `0009` L.30-35), `suspend_account`, `unsuspend_account`, `admin_mark_commission_paid(p_commission_id, p_tx_hash, p_amount_atomic)` (replicate `mark_commission_paid` 0016 L.344-357 anti-double-payout `where status='due'` + raise on row_count=0, then insert payouts + insert audit).

**Layer E — KPI read wrappers (funnel/churn/mix), gated, NO matview (D-10).**
Analog: `get_mrr()` `0017` L.262-273 — `where (select is_superadmin())` at the END returns 0 rows (never throws).
```sql
-- calque get_mrr 0017 L.262-273
create function public.get_acquisition_funnel(p_from date, p_to date)
  returns table (stage text, n bigint, source text)
  language sql stable security definer set search_path = public as $$
  select * from ( /* COUNT(DISTINCT user_id) per stage + source */ ) q
  where (select public.is_superadmin());
$$;
revoke execute on function public.get_acquisition_funnel(date,date) from public, anon;
grant  execute on function public.get_acquisition_funnel(date,date) to authenticated;
```
Apply via MCP `apply_migration` (never `db push`); then `generate_typescript_types` → hand-edit `database.types.ts` (alias + `*_atomic` string override) → `get_advisors(security|performance)` 0 new alert.

---

### `apps/web/src/lib/admin/queries.ts` — users keyset query (users/file/affiliés tables)

**Analog:** `apps/web/src/lib/watchlist/queries.ts` (full file — keyset + sanitizeCursor).

**Anti-injection cursor guard** (copy verbatim, `watchlist/queries.ts` L.87-101):
```ts
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T[\d:.]+(?:[+-]\d{2}:?\d{2}|Z)?$/
const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
function sanitizeCursor(c: Cursor | null): Cursor | null {
  if (!c) return null
  if (!ISO_TIMESTAMP.test(c.createdAt) || !UUID.test(c.id)) return null
  return c
}
```

**Keyset query core** (adapt `watchlist/queries.ts` L.114-153 to `profiles`; research Code Examples L.421-432):
```ts
const cursor = sanitizeCursor(decodeCursor(params.cursor))
let q = supabase.from('profiles')
  .select('id, email, created_at, source, role, suspended, subscriptions(status, plan, current_period_end)')
  .order('created_at', { ascending: false }).order('id', { ascending: false })
  .limit(PAGE_SIZE + 1)
if (params.source) q = q.eq('source', params.source)        // D-15 indexed filter
if (params.email)  q = q.ilike('email', `%${params.email}%`) // parameterized
if (cursor) q = q.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`)
```
Then PAGE_SIZE+1 sentinel + `encodeCursor` (`watchlist/queries.ts` L.146-153). Import from `../keyset/cursor` (unchanged). Client = anon `createClient()` from `../supabase/server`, NEVER `admin-service`.

---

### `apps/web/src/lib/admin/searchParams.ts` (NEW) — users filter schema

**Analog:** `apps/web/src/lib/signals/searchParams.ts` `WatchlistParamsSchema` block L.94-127.

**Schema + parse pattern** (copy `WatchlistParamsSchema` shape, add filters):
```ts
const StatusEnum = z.enum(['active', 'expired', 'none'])   // D-15 subscription state
const SourceEnum = z.enum(['demo', 'backtest', 'live'])    // D-15 source (0018)
export const AdminUsersParamsSchema = z.object({
  status: StatusEnum.optional(),
  source: SourceEnum.optional(),
  q: z.string().min(1).optional(),     // email/id search
  cursor: z.string().min(1).optional(),
})
```
Field-by-field `.safeParse` (signals L.44-59 / watchlist L.108-116): out-of-enum value → undefined, never throws, never reaches the query (anti-injection T-03-05). Serialize: omit defaults/absent (signals L.65-73).

---

### `apps/web/src/lib/admin/kpis.ts` (NEW) — typed RPC wrappers

**Analog:** `lib/auth/gate.ts` L.89 (`supabase.rpc('has_active_subscription')`) for the call shape; `get_mrr` 0017 for the contract.
```ts
import { createClient } from '@/lib/supabase/server'   // ANON @supabase/ssr (cookies superadmin)
const supabase = await createClient()
const { data: mrr } = await supabase.rpc('get_mrr')                // 0 rows if non-superadmin
const { data: funnel } = await supabase.rpc('get_acquisition_funnel', { p_from, p_to })
```
MRR label LOCKED « cash encaissé / mois », amount via `formatAtomic(BigInt(revenue_atomic))` (never float). NEVER read `mv_mrr` via `.from()` (Pitfall 3 — `revoke all` 0017 L.278).

---

### `apps/web/src/lib/auth/gate.ts` (MODIFY) — suspension branch (D-17)

**Analog:** self — `authedClient()` L.58-76 already reads via anon client; `requireActiveSub` L.83-97 already calls a SQL helper.
Add to `authedClient()` (or `requireUser`): after `getUser()`, select `profiles.suspended`; if true → `signOut()` + redirect `/login?suspended=1`. Mirror the existing `requireRole` profile read (L.102-106). RLS helper extension (Layer C) is the real barrier; this is the UX layer.

---

### `apps/web/src/app/(admin)/page.tsx` (MODIFY → cockpit 4 sections)

**Analog:** self (current head-count KPIs L.67-149 + Card/Link render L.166-205) + `lib/admin/freshness.ts`.
- Swap `createAdminServiceClient()` (L.19, L.68) → `createClient()` anon from `@/lib/supabase/server`.
- Status lights tokens (copy verbatim, current L.55-59): `green→bg-[var(--signal-bullish)]`, `amber→bg-[var(--risk-moderate)]`, `red→bg-destructive` (D-08 swap law).
- New AxisSummary cards in order Revenus→Ops→Acquisition→Conformité (D-07); each = `<Link>` to existing detail page (current L.167 Card-in-Link pattern). KPIs via `lib/admin/kpis.ts` `.rpc()`.

---

### `apps/web/src/app/(admin)/membres/page.tsx` (MODIFY) + `file/page.tsx`

**Analog:** self (table render L.130-225) for markup; `lib/admin/queries.ts` (keyset) replaces in-memory JS filter.
- Remove `createAdminServiceClient` (L.26, L.57) → anon `createClient()`. `profiles!inner(email)` now works under RLS once 0021 `profiles` policy is live (Pitfall 1 — apply 0021 BEFORE the anon swap).
- DELETE the JS in-memory filter (L.101-107) → push `.eq('source')`/`.ilike('email')` + keyset to the query (research §Keyset L.277).
- Keep `formatAtomic(BigInt(...))` amount render (L.202), `<bdi>`, Badge/Table shadcn.

---

### `apps/web/src/app/(admin)/{sante,signaux,affiliation/*}/page.tsx` (MODIFY)

**Analog:** self. Single change: `createAdminServiceClient` → anon `createClient()`. `sante` candles freshness unblocked by 0021 `candles` policy; `signaux` telegram status unblocked by 0021 `telegram_posts` policy; signaux stays READ-ONLY (D-09). Affiliation tables already gated superadmin (0016/0017) — pure client swap.

---

### `apps/web/src/app/(admin)/membres/actions.ts` (MODIFY → RPC gated) + `file/actions.ts` + `affiliation/actions.ts`

**Analog:** `apps/web/src/app/(admin)/affiliation/payouts/actions.ts` (full file) — the gated-write template.

**Re-gate + opaque error pattern** (copy `payouts/actions.ts` L.28-61):
```ts
'use server'
import 'server-only'
export async function grantSubscriptionTime(formData: FormData): Promise<AdminActionResult> {
  try {
    await requireRole('superadmin')              // re-gate (POST endpoint, T-04-ADMIN-WRITE)
    const supabase = await createClient()        // ANON — NOT createAdminServiceClient
    // ...validate whitelisted params (current actions.ts PERIODS L.31-42)...
    const { error } = await supabase.rpc('grant_subscription_time', { p_user_id, p_interval })
    if (error) throw new Error(error.message)
    revalidatePath('/membres')
    return { ok: true }
  } catch (err) { return fail(err) }
}
```
- REMOVE `createAdminServiceClient` + `activateForPayment`/`changePlan` repo helpers (current membres/actions.ts L.16-18, L.66, L.86) → replace with `.rpc()` to the new gated RPCs.
- Keep param whitelist (`PERIODS` L.31-42) — feeds RPC `p_interval` (security V5).
- Opaque error mapping (`payouts/actions.ts` `fail()` L.55-61) — never leak `err.message` raw.

---

### `apps/web/src/app/(admin)/affiliation/payouts/actions.ts` (MODIFY → gated RPC)

**Analog:** self. Swap `markCommissionPaid(client, ...)` service_role helper (L.16, L.43) → `supabase.rpc('admin_mark_commission_paid', { p_commission_id, p_tx_hash, p_amount_atomic })` on anon client. Keep `TX_HASH_PATTERN` (L.26) + `ATOMIC_PATTERN` (L.23) validation and opaque `fail()` (L.55-61) unchanged.

---

### `apps/web/src/app/(admin)/_components/AxisSummary*.tsx` (NEW)

**Analog:** `(admin)/page.tsx` Card-in-Link block L.166-205. KPI value mono/tabular (UI-SPEC), mandatory provenance line « Mesuré · N = {n} · {période} · source : {source} » (D-13) — numbers RENDERED, never literal i18n strings. CTA « Voir le détail ». Reuse `Card`/`CardHeader`/`CardContent` shadcn.

---

### `apps/web/src/app/(admin)/_components/AdminSidebar.tsx` (MODIFY → 4 axes)

**Analog:** self. Group existing `NAV_ITEMS` (L.36-44) under 4 axis headers (Acquisition/Revenus/Ops/Conformité, D-06). **URLs unchanged** (research A5 — no redirects). Keep `isActive` prefix-match (L.46-49), active-item `--primary` accent (L.68), literal `/admin/...` hrefs (NOT i18n Link).

---

### `apps/web/src/components/admin/MemberRowActions.tsx` (MODIFY → offrir/suspendre)

**Analog:** self (full file — dropdown + Dialog + AlertDialog + `useTransition` + sonner toast).
- "Offrir du temps gratuit": new `Dialog` with presets 7j/1mois/3mois/custom (copy the plan `Dialog` L.142-193 shape; `Select` from PERIODS L.61). CTA « Confirmer la prolongation » (accent). Calls `grantSubscriptionTime` action.
- "Suspendre": new destructive `AlertDialog` (copy revoke L.120-139), REQUIRED reason field, CTA « Suspendre » destructive. Calls `suspend_account` action.
- Keep `run()` transition+toast helper (L.71-81) and `buildForm` (L.83-88).

---

### Tests

**`apps/web/test/admin-rls.test.ts` (NEW)** — RLS anon two-role integration (superadmin reads / member 0 rows on profiles/telegram_posts/candles/trade_setups; RPC forbidden in member role; suspended → 0 rows). Analog: vitest shape from `lib/signals/__tests__/searchParams.test.ts` + `.env.test` anon-client convention (research §Validation, vitest.config loads `.env.test`).

**`apps/web/src/styles/__tests__/rls-unchanged.test.ts` (MODIFY)** — self-extend. Add `(admin)` to `SCANNED_GROUPS` (L.31) once service_role removed; the `FORBIDDEN` detectors (L.41-46: admin-service import / createAdminServiceClient / service_role / browser client) already exist. Keep `stripComments` (L.54-58) so header prose like "jamais service_role" is not flagged.

**`apps/web/test/no-perf-claims.test.ts` (MODIFY)** — self-extend. Add `'admin'` to `SCANNED_NAMESPACES` (L.36-45). The `FORBIDDEN = /%|\d+\s*%|.../i` detector (L.55) catches any literal `%` in admin copy — so churn/funnel `%` must render via `applyThreshold`, never as i18n strings. MRR label « cash encaissé/mois » passes (no `%`). Extend `no-perf-seed-claims.test.ts` with `ADMIN_UI_FILES` + `FORBIDDEN_PERF_UI = /\bequity\b|P&L|PnL|\bROI\b|[+-]\s*\d+%/i` scanning `(admin)/page.tsx`.

**`apps/web/src/lib/admin/__tests__/searchParams.test.ts` (NEW)** — Analog: `lib/signals/__tests__/searchParams.test.ts` (parse/serialize round-trip, out-of-enum → undefined).

---

## Shared Patterns

### Gating — SQL `is_superadmin()` (the real barrier)
**Source:** `supabase/migrations/0008_profiles_role.sql` L.29-47.
**Apply to:** every 0021 policy, every read wrapper (`where (select is_superadmin())`), every write RPC (`if not (select is_superadmin()) then raise`).
```sql
create function public.is_superadmin() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'superadmin');
$$;
revoke execute on function public.is_superadmin() from public, anon;
grant  execute on function public.is_superadmin() to authenticated;
```

### Atomic write + audit RPC (SECURITY DEFINER)
**Source:** `supabase/migrations/0016_affiliation.sql` `mark_commission_paid` L.331-362.
**Apply to:** all four 0021 write RPCs. Pattern: `language plpgsql security definer set search_path = public`; guard `is_superadmin()` first; mutate then `insert admin_audit_log` in the SAME tx; anti-double-effect via `get diagnostics ... row_count` + `raise` (L.350-353); `revoke ... from public, anon` + `grant ... to authenticated`.

### Gated read wrapper (matview / aggregate)
**Source:** `supabase/migrations/0017_scalable_foundation.sql` `get_mrr()` L.262-278.
**Apply to:** `get_mrr` (reuse as-is), `get_acquisition_funnel`, `get_churn`, `get_plan_mix`. `where (select is_superadmin())` at END = 0 rows for non-superadmin (never throws). NEVER `grant select` on a matview directly (`revoke all` L.278).

### Anon client + RLS (never service_role on a page)
**Source:** `apps/web/src/lib/auth/gate.ts` L.22, L.62 (`createClient` from `../supabase/server`).
**Apply to:** all `(admin)/**` pages + Server Actions. Replace every `createAdminServiceClient` (9 files, research §Bascule L.242-249). Enforced by extended `rls-unchanged.test.ts`.

### Keyset pagination + cursor anti-injection
**Source:** `apps/web/src/lib/keyset/cursor.ts` (encode/decode, tolerant) + `apps/web/src/lib/watchlist/queries.ts` L.87-153 (sanitizeCursor + `.or()` tuple-compare + PAGE_SIZE+1 sentinel).
**Apply to:** users/file/affiliés tables (`lib/admin/queries.ts`). Index `profiles_keyset_idx (created_at desc, id desc)` LIVE (0017 Partie B).

### URL-state filter validation (Zod safeParse field-by-field)
**Source:** `apps/web/src/lib/signals/searchParams.ts` L.44-59 (`pick` safeParse) + `WatchlistParamsSchema` L.94-116.
**Apply to:** `lib/admin/searchParams.ts`. Out-of-enum → undefined, never throws, never raw-concatenated into a query.

### Status lights (tokenized, D-08 swap law)
**Source:** `apps/web/src/app/(admin)/page.tsx` L.55-59 + `lib/admin/freshness.ts` (`candleColor`/`ageColor`), `jobs.ts`, `signals.ts`.
**Apply to:** all cockpit cards/tables. `green→--signal-bullish`, `amber→--risk-moderate`, `red→--destructive`. Never hardcode status hex. Accent `--primary` reserved for active nav / dialog CTA / focus ring only (UI-SPEC).

### Row-action dialog (client island)
**Source:** `apps/web/src/components/admin/MemberRowActions.tsx` (full) — DropdownMenu + Dialog/AlertDialog + `useTransition` + sonner. Destructive = AlertDialog red; presets = Dialog + Select.

### Server Action re-gate + opaque error
**Source:** `apps/web/src/app/(admin)/affiliation/payouts/actions.ts` L.28-61.
**Apply to:** every admin action. `requireRole('superadmin')` first line (re-gate POST), validate whitelisted params, call gated `.rpc()`, map errors to opaque keys (`fail()` L.55-61) — never leak DB internals.

---

## No Analog Found

None. Every file maps to an in-repo analog. The phase is explicitly "enrich + reskin the existing P8 germe + reuse P16/P17/P19 infra" — ~90% of infrastructure already exists (CONTEXT/RESEARCH §Key insight).

---

## Metadata

**Analog search scope:** `supabase/migrations/` (0008, 0009, 0016, 0017), `apps/web/src/app/(admin)/**`, `apps/web/src/lib/{auth,keyset,watchlist,signals,admin,supabase}/**`, `apps/web/src/components/admin/**`, `apps/web/test/**`, `apps/web/src/styles/__tests__/**`.
**Files scanned (read this session):** 16 analogs (4 SQL migrations, 9 web source files, 3 tests).
**Pattern extraction date:** 2026-06-26
