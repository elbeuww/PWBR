# Phase 8: Superadmin consolidé (signaux, santé, affiliés) - Research

**Researched:** 2026-06-19
**Domain:** Next.js 15 App Router back-office (RSC + server actions), Supabase Postgres/RLS, read-only operational dashboards
**Confidence:** HIGH (all findings grounded in on-disk code/migrations, not training data)

## Summary

Phase 8 is **almost entirely additive UI over an existing data foundation**. The single biggest open question flagged by CONTEXT (payout DB schema) is **already resolved in code**: migration `0016_affiliation.sql` (Phase 7) already shipped a dedicated `payouts` table, a `commissions.status` ('due'/'paid') column, and an atomic, idempotent `mark_commission_paid(uuid, text, bigint)` RPC. The payout page (`(admin)/affiliation/payouts/page.tsx`) + server action (`actions.ts`) already mark commissions paid with tx_hash + amount and render paid history inline. **D-09/D-10 require NO migration** — they are satisfied today; Phase 8 "enrichment" is cosmetic (history visibility) or zero-work.

The remaining work is straightforward against established patterns: (1) an admin **shell with sidebar** mounted in the existing `(admin)/layout.tsx` (under the existing `requireRole('superadmin')` gate), (2) a **dashboard landing** with KPI cards, (3) a read-only **signaux view** joining `trade_setups` × `telegram_posts`, (4) a read-only **santé view** over `job_runs` + `v_data_freshness`. Every admin page follows one verbatim pattern: RSC `page.tsx` reading via `createAdminServiceClient()` (local service_role, server-only) + URL-synced GET filters + shadcn `Table` + client island for actions.

**One real gap to flag:** `v_data_freshness` covers **candles only** (per instrument×timeframe). D-06 asks for green/orange/red per source = candles / news / macro. News and macro freshness do **not** exist as a view today and must be derived (either a new view in a migration, or computed in the RSC from `max(published_at)` / `max(ts)`). This is the one genuine design decision left.

**Primary recommendation:** Build 4 new RSC pages + 1 sidebar component reusing the exact `membres`/`payouts` page pattern and `createAdminServiceClient()` reads. Add ONE small migration (`0017`) only if you want a `v_data_freshness`-style view extended to news/macro; otherwise compute freshness in-RSC. Payouts = no DB work.

## User Constraints (from 08-CONTEXT.md)

### Locked Decisions

**Shell / navigation**
- **D-01:** Consolidate isolated admin pages (`membres`, `file`, `affiliation`, `affiliation/payouts`) under a **persistent sidebar** listing: Tableau de bord · Membres · File · Affiliation · Payouts · Signaux · Santé. Sidebar lives in `(admin)/layout.tsx` (or a client component it mounts), under the existing `requireRole('superadmin')`.
- **D-02:** Add `/admin` **dashboard landing** with KPI cards: membres actifs, file de validation en attente, santé globale des données (ok/stale). This is the back-office landing.

**Signaux (ADMIN-04)**
- **D-03:** Chronological list of `trade_setups`, each row showing Telegram publication status (posté / échoué / non publié) cross-referenced from `telegram_posts`.
- **D-04:** Filters by instrument + by statut. Each row links to signal detail.
- **D-05:** Read-only — no edit/delete of signals from admin.

**Santé (ADMIN-04)**
- **D-06:** Green/orange/red indicators per source (candles / news / macro freshness) based on `stale` thresholds / freshness view.
- **D-07:** Table of latest `job_runs` per job: statut (ok/échec), durée, last-run timestamp.
- **D-08:** Operational presentation only — no automatic alerting (deferred).

**Payouts (ADMIN-03)**
- **D-09:** Enrich existing manual payout workflow: mark commission 'payée' with a transaction reference + keep payout history.
- **D-10:** Mutative server action under `requireRole('superadmin')`, idempotent + auditable — reuse Phase 7 M-01..M-05 hardening.

### Claude's Discretion
- Exact visual style of sidebar/dashboard (shadcn/ui existing, FR mono-language) — defer to UI-SPEC.
- Exact orange-vs-red freshness thresholds — derive from existing `stale` logic.
- **To resolve in research/plan:** does the 'paid' marking + tx ref require a DB migration (payout status column / `payouts` table / field on `commissions`)? Migration numbering: next free after 0015; **0013 is RESERVED — do not reuse**. → **RESOLVED below: no migration needed (already shipped in 0016).**

### Deferred Ideas (OUT OF SCOPE)
- Automatic alerting/notifications on stale data or failed jobs (email/Telegram admin).
- On-chain automated payout.
- Editing/moderating signals from admin (read-only in Phase 8).
- CSV export of payouts (replaced by in-app history).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ADMIN-03 | Superadmin sees affiliés + perfs and manages commission payouts | `affiliate_dashboard` view (0016) for per-affiliate aggregates; `(admin)/affiliation/page.tsx` (queue) + `payouts/page.tsx` (already marks paid via `mark_commission_paid` RPC). Affiliés-performance view = new read over `affiliate_dashboard` + `affiliates→profiles`. |
| ADMIN-04 | Superadmin sees published signals + job/data health (`job_runs`, freshness) | `trade_setups` (0006) × `telegram_posts` (0015) join for signaux; `job_runs` (0001) + `v_data_freshness` (0003/0004) for santé. All readable via `createAdminServiceClient()`. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Admin shell / sidebar nav | Frontend Server (RSC layout) + Client island (active state) | — | `(admin)/layout.tsx` already RSC under gate; active route detection needs `usePathname()` → small client component. |
| `requireRole('superadmin')` gate | Frontend Server (RSC) | Database (RLS) | Defense-in-depth: gate is UX (404), RLS is the real barrier. Gate already in layout — do NOT duplicate inline. |
| Cross-user data reads (signals, jobs, members, affiliés) | Frontend Server (RSC via service_role) | Database (RLS for affiliate self-reads) | `profiles` has no superadmin SELECT policy → admin reads MUST use `createAdminServiceClient()` server-side (server-only, never bundled). |
| Payout mutation (mark paid) | API / Server Action | Database (atomic RPC) | Financial mutation: server action re-guards role; `mark_commission_paid` RPC owns atomicity + anti-double-pay. |
| Freshness/staleness logic | Database (view) | Frontend Server (traffic-light mapping) | `v_data_freshness` computes `is_stale` in SQL (timezone-aware FX weekend logic). RSC maps boolean→color. News/macro freshness: gap (see Open Questions). |
| Commission/financial computation | Database (RPC) | — | ZERO financial math in JS (CR-02 / T-07-FLOAT). All in `compute_affiliate_commissions` / `mark_commission_paid`. |

## Standard Stack

**No new packages.** Everything required is already installed and locked (see CLAUDE.md / UI-SPEC §Registry Safety). Phase 8 is pure composition of existing primitives.

### Core (already present — reuse, do not re-add)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 15.x | App Router RSC pages + server actions | Locked. Admin pattern is RSC + `'use server'`. |
| @supabase/supabase-js | 2.108.0 | `createClient<Database>` for `createAdminServiceClient()` | Locked. Admin reads via service_role local client. |
| @supabase/ssr | 0.12.0 | `getUser()` in gate | Locked. `requireRole` uses cookie client. |
| next-intl | (locked) | FR mono-language `admin` namespace via `getTranslations('admin')` / `useTranslations('admin')` | Back-office is FR-fixed; layout mounts `NextIntlClientProvider locale="fr"`. |
| shadcn/ui (radix-nova) | copied | `Table`, `Card`, `Badge`, `Select`, `Dialog`, `Skeleton`, `Button`, `Input`, `Label`, `Separator` — all installed | UI-SPEC §Registry Safety: no new installs anticipated. Sidebar hand-built from primitives + lucide. |
| lucide-react | (locked) | Sidebar icons (`LayoutDashboard`, `Users`, `Inbox`, `Share2`, `Wallet`, `Radio`, `Activity`) | UI-SPEC suggested set. |
| @app/core `formatAtomic` | workspace | BigInt ×10⁶ → display string (CR-02) | Already used in every money cell. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner (`@/components/ui/sonner`) | installed | Toast feedback for payout action | Toaster already mounted in `(admin)/layout.tsx`. |
| @tanstack/react-query | 5.101.0 | NOT needed for these pages | Admin pages are RSC reads; no client fetching/cache required. Skip. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `createAdminServiceClient()` reads | anon-client + RLS `is_superadmin()` | Rejected in Plan 06 (documented deviation): `profiles` has NO superadmin SELECT policy (0008) → email joins fail under anon RLS. Service_role local read is the established admin pattern. |
| In-RSC freshness for news/macro | New SQL view migration 0017 | View = single source of truth, mirrors `v_data_freshness`; in-RSC = no migration but logic duplication. See Open Questions Q1. |

**Installation:** None. `pnpm install` already satisfies all deps.

## Package Legitimacy Audit

> Not applicable — Phase 8 installs **zero** external packages. All primitives already present (shadcn components installed, all npm deps locked in CLAUDE.md). slopcheck gate skipped: nothing to audit.

## Architecture Patterns

### System Architecture Diagram

```
                         Browser (superadmin only)
                                  │
                                  ▼
            ┌──────────────────────────────────────────────┐
            │  (admin)/layout.tsx   [RSC]                    │
            │   await requireRole('superadmin')             │  ← gate (UX 404)
            │     ├─ notFound() if not superadmin           │
            │   <NextIntlClientProvider locale="fr">        │
            │   ┌─────────────┬──────────────────────────┐  │
            │   │ <AdminSidebar/>  │   {children}          │  │  ← D-01 sidebar (client island, usePathname)
            │   │ (client island)  │   (per-page RSC main) │  │
            │   └─────────────┴──────────────────────────┘  │
            │   <Toaster/> (sonner)                          │
            └───────────────┬──────────────────────────────┘
                            │  each page.tsx (RSC)
        ┌───────────────────┼────────────────────┬─────────────────┐
        ▼                   ▼                    ▼                  ▼
  /admin (dashboard)   /admin/signaux       /admin/sante     /admin/affiliation/*
   KPI cards            trade_setups ×        job_runs +       affiliés + payouts
   (counts)             telegram_posts        v_data_freshness (existing)
        │                   │                    │                  │
        └───────────────────┴────────────────────┴──────────────────┘
                            │ createAdminServiceClient() (service_role, server-only)
                            ▼
            ┌──────────────────────────────────────────────┐
            │  Supabase Postgres (RLS active everywhere)     │
            │   reads: trade_setups, telegram_posts,         │
            │          job_runs, v_data_freshness,           │
            │          commissions, affiliates, profiles,    │
            │          affiliate_dashboard, subscriptions    │
            │   write (payout only): RPC mark_commission_paid│  ← atomic, anti-double-pay
            └──────────────────────────────────────────────┘
                            ▲
                            │  'use server' actions (re-guard requireRole)
                  PayoutRowAction → payCommission(formData)
```

### Component Responsibilities

| File (new unless noted) | Responsibility |
|-------------------------|----------------|
| `(admin)/layout.tsx` (EDIT) | Mount `<AdminSidebar/>` + two-column flex around `{children}`. Keep existing gate + provider + Toaster untouched. |
| `(admin)/_components/AdminSidebar.tsx` (new, client) | `'use client'`, `usePathname()`, prefix-match active state, nav list from UI-SPEC. Lucide icons. |
| `(admin)/page.tsx` (new) | `/admin` dashboard. KPI cards: count active members, count pending file items, global health summary. Each card links to its page. |
| `(admin)/signaux/page.tsx` (new) | RSC. Read trade_setups + telegram_posts cross-ref, instrument + status filters (GET form), link to detail. |
| `(admin)/sante/page.tsx` (new) | RSC. Read `v_data_freshness` (+ news/macro freshness), `job_runs`. Traffic-light cards + job table. |
| `(admin)/affiliation/affilies/page.tsx` (new, or extend `affiliation/page.tsx`) | RSC. Affiliés + perfs from `affiliate_dashboard` + `affiliates→profiles` (ADMIN-03 part 1). |
| `(admin)/affiliation/payouts/*` (NO CHANGE or trivial) | Already complete (D-09/D-10 satisfied). |

### Pattern 1: Admin RSC page (THE established pattern — match verbatim)
**What:** RSC `page.tsx` reads via local service_role client; URL-synced GET filters; shadcn `Table`; client island for any mutation. NO inline gate (layout owns it).
**When to use:** every Phase 8 page.
**Example (distilled from `membres/page.tsx` + `payouts/page.tsx`):**
```tsx
// Source: apps/web/src/app/(admin)/membres/page.tsx (verbatim pattern)
import { getTranslations } from 'next-intl/server'
import { createAdminServiceClient } from '@/lib/supabase/admin-service'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

async function loadX(filter: string | null) {
  const client = createAdminServiceClient()           // service_role, server-only
  const { data, error } = await client.from('...').select('...').order('created_at', { ascending: false })
  if (error) throw new Error(`loadX: ${error.message}`)
  return data ?? []
}

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const t = await getTranslations('admin')
  const params = await searchParams                    // Next 15: searchParams is a Promise
  const rows = await loadX(params.status ?? null)
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold">{t('...title')}</h1>
      <form className="mt-6 flex flex-wrap items-end gap-3" method="get"> {/* URL-synced GET filters */} </form>
      <div className="mt-6 w-full overflow-x-auto">
        {rows.length === 0
          ? <div className="rounded-lg border border-dashed p-10 text-center">…empty…</div>
          : <Table>…</Table>}
      </div>
    </main>
  )
}
```

### Pattern 2: Server action mutation (payout — already implemented, reuse for any new mutation)
```ts
// Source: apps/web/src/app/(admin)/affiliation/payouts/actions.ts
'use server'
import 'server-only'
import { requireRole } from '../../../../lib/auth/gate'
import { createAdminServiceClient } from '../../../../lib/supabase/admin-service'

export async function payCommission(formData: FormData) {
  await requireRole('superadmin')                      // M-01: re-guard (POST callable directly)
  const client = createAdminServiceClient()
  // M-03: tx_hash bounded /^[A-Fa-f0-9]{64}$/ ; M-02: atomic /^[0-9]+$/
  // RPC owns atomicity + anti-double-pay (raises if already paid)
  await markCommissionPaid(client, { commission_id, tx_hash, amount_atomic })
  revalidatePath('/affiliation/payouts')
  // M-05: opaque error keys, never raw err.message
}
```

### Pattern 3: Telegram status cross-reference (D-03)
`telegram_posts` does NOT have a foreign key to `trade_setups.id`. The link is the **`dedupe_key`** convention: `notable:<setup_id>` (per 0015 comment). To compute publication status per setup:
- **Posté** = a `telegram_posts` row exists with `dedupe_key = 'notable:' || setup.id`.
- **Échoué / Non publié** = no such row. The DB has no "échec" record (failed sends call `releasePost` which DELETES the reservation — 0015/telegramPosts.ts). **There is no persisted "failed" state.** ⚠️ See Open Questions Q2 — the 3-state UI (posté/échoué/non publié) is not fully derivable from data: only posté vs. not-posted is. `job_runs.status='error'` for the telegram job is the only failure signal, and it is not per-setup.

### Recommended Project Structure
```
apps/web/src/app/(admin)/
├── layout.tsx                    # EDIT: add sidebar shell
├── _components/
│   └── AdminSidebar.tsx          # new client island (usePathname active state)
├── page.tsx                      # new: /admin dashboard (KPI cards)
├── signaux/
│   └── page.tsx                  # new: trade_setups × telegram_posts
├── sante/
│   └── page.tsx                  # new: job_runs + v_data_freshness
├── membres/, file/               # unchanged (rattachés au shell visuellement)
└── affiliation/
    ├── page.tsx                  # candidatures queue (existing) — or add affilies/
    ├── affilies/page.tsx         # new (optional): affiliés + perfs (ADMIN-03 pt1)
    └── payouts/                  # COMPLETE — no change for D-09/D-10
```

### Anti-Patterns to Avoid
- **Duplicating the gate inline in pages.** Layout already runs `requireRole('superadmin')`. Pages must NOT re-guard (membres/page.tsx says so explicitly). Server *actions* DO re-guard (different trust boundary).
- **Importing `@app/supabase` service-client or service-role repos from apps/web.** Lint-forbidden (no-restricted-imports). Use `createAdminServiceClient()` (local) instead. The repos `jobRuns.ts`/`tradeSetups.ts`/`telegramPosts.ts` are WRITE wrappers for apps/jobs and are NOT for web reads.
- **Coercing atomic amounts via `Number()`.** Always `BigInt(string)` + `formatAtomic` (CR-02; bigint > 2^53).
- **Using green/red for trading direction.** D-04 holds: long/short = neutral `<bdi>` text. Green/orange/red allowed ONLY for operational health (UI-SPEC §Status color exception).
- **Linking admin signaux rows to the member detail route for expired setups.** The member route (`[locale]/(member)/signaux/[id]`) is gated by active subscription AND filters `status='active'` (anti-IDOR) → expired/invalidated setups → `notFound()`. See Open Questions Q3.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Mark commission paid + record tx | New `payouts` table / new RPC / new status column | Existing `mark_commission_paid(uuid,text,bigint)` RPC + `commissions.status` + `payouts` table (all in 0016) | Already atomic, idempotent, anti-double-pay, RLS-locked. Re-building = regression risk on financial path. |
| Candle staleness | Custom age math in RSC | `v_data_freshness.is_stale` (boolean) | View handles FX weekend + DST (America/New_York) correctly (0004 fix). Re-deriving in JS will get weekends wrong. |
| Service_role admin client | New SDK wiring | `createAdminServiceClient()` | Already env-validated + `server-only` guarded. |
| Superadmin gate | Inline role check | `requireRole('superadmin')` in layout | Already 404s (discretion), reads role post-getUser (never JWT). |
| Money formatting | `toFixed`/`Number` | `@app/core formatAtomic(BigInt(x))` | CR-02 determinism. |

**Key insight:** Phase 8 is a *visibility* phase. The producer-side (jobs, RPCs, RLS) is done. Nearly all "logic" you'd be tempted to write already exists in SQL or repos — your job is to READ and PRESENT it, not recompute it.

## Common Pitfalls

### Pitfall 1: Re-running migration 0013/0016 numbering confusion
**What goes wrong:** CONTEXT D-10 says "next free after 0015" and "0013 reserved", but on-disk the latest migration is **0016** (Phase 7 already used it). Using 0016 again, or 0017 wrongly, breaks ordering.
**Why it happens:** CONTEXT was written before/around P7 shipping 0016.
**How to avoid:** If (and only if) a migration is needed (news/macro freshness view), use **0017**. Confirmed on-disk sequence: 0001–0012, 0014, 0015, 0016 (0013 absent/reserved). Apply via `mcp__supabase__apply_migration` (writable), NOT `mcp__claude_ai_Supabase__*`, NOT `supabase db push`.
**Warning signs:** A planned `0016_*` filename, or any `db push`.

### Pitfall 2: `generate_typescript_types` wipes manual aliases
**What goes wrong:** Regenerating `database.types.ts` (e.g. after a 0017 view) OVERWRITES the hand-maintained alias block (lines ~1058–1129: `JobRunRow`, `TradeSetupRow`, `TelegramPostRow`, `DataFreshnessRow`, `CommissionRow`, `PayoutRow`, etc.) AND the `*_atomic` string overrides.
**Why it happens:** Project is not `link`ed; types are edited by hand after MCP regen (documented in every migration header).
**How to avoid:** After ANY type regen, re-apply the manual alias block + atomic string overrides. If no migration → no regen → no risk (preferred: compute news/macro freshness in-RSC to avoid touching types).
**Warning signs:** TS errors on `DataFreshnessRow` / missing aliases after a migration.

### Pitfall 3: Telegram "échec" state is not persisted
**What goes wrong:** D-03 specifies 3 states (posté/échoué/non publié) but the data only supports 2 (posté / not-posted). Failed sends DELETE the reservation (`releasePost`), leaving no per-setup failure record.
**Why it happens:** 0015 design is reserve-before-send + rollback-on-failure (anti double-post), not a status log.
**How to avoid:** Planner must decide: (a) collapse to 2 states (Posté / Non publié) and surface telegram-job failures separately in Santé via `job_runs`, or (b) add a persisted failure column (out of read-only scope, likely defer). Recommend (a).
**Warning signs:** Trying to query a non-existent `telegram_posts.status` column.

### Pitfall 4: News/macro have no freshness view
**What goes wrong:** D-06 wants per-source feux for candles/news/macro; `v_data_freshness` only covers candles.
**How to avoid:** Either add an extended view (0017) or compute in-RSC: news fresh = `max(published_at)` recent; macro fresh = `max(ts)` recent. Thresholds = Claude's discretion (suggest below).
**Warning signs:** Assuming `v_data_freshness` has news/macro rows (it doesn't).

### Pitfall 5: `searchParams` / `params` are Promises in Next 15
**What goes wrong:** Direct `params.status` access fails.
**How to avoid:** `const params = await searchParams` (every existing admin page does this).

## Code Examples

### Cross-reference trade_setups with telegram publication (D-03, Posté/Non publié)
```ts
// Source pattern: payouts/page.tsx PostgREST select + manual map.
// No FK between telegram_posts and trade_setups → match on dedupe_key 'notable:<id>'.
async function loadSignals(client, instrumentFilter, statusFilter) {
  const { data: setups } = await client
    .from('trade_setups')
    .select('id, instrument_id, direction, opportunity_score, status, created_at, instruments!inner(canonical_symbol)')
    .order('created_at', { ascending: false })          // D-04 chronological desc

  const { data: posts } = await client
    .from('telegram_posts')
    .select('dedupe_key')
    .like('dedupe_key', 'notable:%')
  const postedSetupIds = new Set((posts ?? []).map(p => p.dedupe_key.replace('notable:', '')))

  return (setups ?? []).map(s => ({
    ...s,
    telegramStatus: postedSetupIds.has(s.id) ? 'posted' : 'unpublished',  // 2-state (see Pitfall 3)
  }))
  // instrument + status filtering applied in-memory (mirrors membres/page.tsx)
}
```

### Read candle freshness (D-06 green/orange/red)
```ts
// v_data_freshness gives is_stale (boolean). For 3-state green/orange/red, RSC adds
// an "approaching" band from last_ts age vs threshold (threshold = 2× timeframe hrs).
const { data } = await client
  .from('v_data_freshness')
  .select('canonical_symbol, timeframe, last_ts, is_stale')
// red   = is_stale === true
// amber = !is_stale && age > 1.5× threshold (approaching) — discretion
// green = otherwise
```

### Read latest job_runs (D-07)
```ts
// job_runs: id, job_name, status('running'|'success'|'error'), started_at, finished_at, error, stats
const { data } = await client
  .from('job_runs')
  .select('job_name, status, started_at, finished_at')
  .order('started_at', { ascending: false })
// duration = finished_at - started_at ; "last run per job" = distinct on job_name (or group in JS)
// UI maps status: 'success' → OK badge (emerald), 'error' → Échec badge (red), 'running' → neutral
```

### Affiliés + perfs (ADMIN-03 pt1)
```ts
// affiliate_dashboard is security_invoker=true and filters auth.uid() → returns ONLY the
// caller's row. Under service_role there is no auth.uid() → it returns NOTHING.
// ⚠️ For superadmin "all affiliés" view, do NOT read affiliate_dashboard via service_role.
// Aggregate directly from affiliates + referrals + commissions, OR add a superadmin view.
const { data } = await client
  .from('affiliates')
  .select('id, profiles!inner(email), referrals(count), commissions(amount_atomic, status)')
// then sum per-affiliate in JS (counts) — amounts as string→BigInt (CR-02)
```

## Runtime State Inventory

> Phase 8 is additive UI; no rename/migration. This section covers only the (minimal) state touched.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Payout state already persisted: `commissions.status`, `payouts` rows (0016). No new stored data unless a freshness view is added. | None for payouts. Optional 0017 view if news/macro freshness wanted. |
| Live service config | None — admin pages are read-only over existing DB. | None. |
| OS-registered state | None — no new jobs/tasks. Windows Task Scheduler / Claude agents untouched. | None. |
| Secrets/env vars | `SUPABASE_SERVICE_ROLE_KEY` already required by `createAdminServiceClient()` (apps/web/.env.local). No new secret. | Verify present (already used by membres/payouts). |
| Build artifacts | If a migration regenerates `database.types.ts`, manual alias block (lines ~1058–1129) + `*_atomic` string overrides are clobbered. | Re-apply alias block after any regen (Pitfall 2). If no migration → none. |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CONTEXT assumed payout schema might need a migration (gray area) | `payouts` table + `commissions.status` + `mark_commission_paid` RPC already shipped | Phase 7 / migration 0016 | D-09/D-10 require no DB work. |
| CONTEXT "next migration after 0015 (0013 reserved)" | On-disk latest is 0016; next free is **0017** | Phase 7 shipped 0016 | Any new migration = 0017. |

**Deprecated/outdated:** None relevant.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `telegram_posts` `dedupe_key` for setups is `notable:<setup_id>` (per 0015 comment) and is the only setup↔post link | Pattern 3 / Code Examples | If recap/winrate posts also reference setups differently, "posté" detection misses some. LOW — verified in migration comment + telegramPosts.ts. |
| A2 | News freshness can be derived from `news.published_at` and macro from `macro_series.ts` | Open Questions Q1 | If "fresh" should reflect last *ingestion* not last *event*, thresholds differ. MEDIUM — needs confirmation of intended semantics. |
| A3 | Affiliés-perfs superadmin view should aggregate from base tables (not `affiliate_dashboard`, which is auth.uid()-scoped) | Code Examples | If planner reads `affiliate_dashboard` via service_role it returns empty (no auth.uid()). HIGH if missed — flagged explicitly. |
| A4 | Orange (approaching-stale) band is a UI-only derivation; underlying view stays boolean | Pitfall 4 / Code Examples | If founder wants exact orange thresholds in SQL, needs a view change. LOW — D-06 marks thresholds as discretion. |

## Open Questions (RESOLVED)

> All four resolved by the founder during /gsd:plan-phase 8 (2026-06-19): (1) freshness computed **in-RSC**, no migration; (2) Telegram badge **2-state** (Posté/Non publié), failures via job_runs; (3) signal detail = **dedicated admin page** via service_role, no status='active' guard; (4) affiliés-perfs **aggregated from base tables**, not affiliate_dashboard. Plans 08-01..08-04 implement these.

1. **News/macro freshness source (D-06).**
   - What we know: `v_data_freshness` covers candles only (per instrument×timeframe). News (`news.published_at`) and macro (`macro_series.ts`) tables exist with timestamps.
   - What's unclear: whether to add a unified view (migration 0017) or compute in-RSC; and whether "fresh" means last event time vs last ingestion run.
   - Recommendation: Compute in-RSC (no migration, no type regen risk). Suggested thresholds: candles use existing `is_stale`; news amber > 6h / red > 24h since `max(published_at)`; macro amber > 36h / red > 72h since `max(ts)` (macro is low-frequency). Confirm with founder during planning.

2. **Telegram 3-state vs 2-state (D-03).**
   - What we know: data supports posté vs not-posted only; failures are not persisted per setup (releasePost deletes reservation).
   - What's unclear: how to show "échoué".
   - Recommendation: 2-state row badge (Posté / Non publié); surface telegram-job failures in Santé via `job_runs` (job_name like telegram). Confirm copy with founder.

3. **Signaux detail link target (D-04).**
   - What we know: member detail route `[locale]/(member)/signaux/[id]` exists but is sub-gated (active subscription) and only renders `status='active'` setups (anti-IDOR) → expired setups 404.
   - What's unclear: where admin "détail" should point for non-active setups.
   - Recommendation: Build a thin admin read-only detail (or link to member route only for `status='active'` rows and show inline summary for others). Planner to choose; admin-own detail is safest and read-only-compliant.

4. **Affiliés-perfs page placement (ADMIN-03 pt1).**
   - The existing `affiliation/page.tsx` is the *candidature queue*, not a perfs view. ADMIN-03 needs "voir les affiliés et leurs performances". Recommend a new `affiliation/affilies` page (or a tab) aggregating from base tables. Confirm nav slot (sidebar "Affiliation" → which view is default?).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase (remote project) | All reads + payout RPC | ✓ (used by P4–P7) | Postgres 15+ | — |
| `SUPABASE_SERVICE_ROLE_KEY` env | `createAdminServiceClient()` | ✓ (membres/payouts already use it) | — | — |
| `mcp__supabase__apply_migration` | Only if 0017 freshness view added | ✓ (writable channel) | — | Compute freshness in-RSC (no migration) |
| Installed shadcn primitives | All UI | ✓ (UI-SPEC confirms all present) | — | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** Migration tooling only needed if a freshness view is chosen over in-RSC computation.

## Validation Architecture

> nyquist_validation assumed enabled (no config override found). Vitest + Playwright per CLAUDE.md.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.8 (unit) + Playwright 1.60.0 (E2E) |
| Config file | workspace vitest config (existing; affiliation.guards.test.ts present) |
| Quick run command | `pnpm vitest run <file>` |
| Full suite command | `pnpm vitest run` (+ `pnpm playwright test` for E2E) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ADMIN-04 | Telegram status derivation (posted-set from dedupe_key) | unit | `pnpm vitest run apps/web/.../signals.test.ts` | ❌ Wave 0 |
| ADMIN-04 | Freshness traffic-light mapping (is_stale + amber band) | unit | `pnpm vitest run apps/web/.../freshness.test.ts` | ❌ Wave 0 |
| ADMIN-04 | job_runs duration + last-per-job grouping | unit | `pnpm vitest run apps/web/.../jobs.test.ts` | ❌ Wave 0 |
| ADMIN-03 | Non-superadmin → 404 on every new admin route (gate) | E2E | `pnpm playwright test admin-gate` | ❌ Wave 0 (extend existing admin RLS E2E) |
| ADMIN-03 | Payout already covered (markCommissionPaid) | unit | existing affiliation tests | ✅ |

### Sampling Rate
- **Per task commit:** quick `pnpm vitest run <changed file>` + `pnpm tsc --noEmit` on touched package.
- **Per wave merge:** full `pnpm vitest run`.
- **Phase gate:** full suite green + Playwright admin-gate (404 for non-superadmin on `/admin`, `/admin/signaux`, `/admin/sante`).

### Wave 0 Gaps
- [ ] Unit test for telegram-status pure function (extract `notable:` → setup id matching).
- [ ] Unit test for freshness→color mapper (green/amber/red boundaries).
- [ ] Unit test for job_runs duration + last-per-job reducer.
- [ ] E2E: extend admin gate test to cover new routes return 404 for non-superadmin (T-04-ADMIN-ELEV).
- [ ] Pure logic extracted into testable functions (avoid testing RSC directly) — put mappers in `apps/web/src/lib/admin/*` or `@app/core`.

## Security Domain

> `security_enforcement` assumed enabled. Back-office is a sensitive surface (financial + cross-user data).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | yes | Defense-in-depth: layout gate (UX 404) + RLS (real barrier). `profiles.role` never in JWT. |
| V2 Authentication | yes | `getUser()` (token revalidated server-side) in gate, never `getSession()`. |
| V4 Access Control | yes | `requireRole('superadmin')` in layout; server actions RE-validate (T-07-ADMIN-WRITE). Non-superadmin → `notFound()` (no existence leak, T-04-ADMIN-ELEV). |
| V5 Input Validation | yes | Payout: tx_hash `^[A-Fa-f0-9]{64}$` (M-03), amount `^[0-9]+$` (M-02). Signaux/santé are read-only; filter params are URL strings → validate against known instrument list / status enum before query. |
| V6 Cryptography | no | No new crypto. |
| V7 Error Handling | yes | Opaque error keys to client (M-05); detail logged server-side. No raw DB messages. |
| V8 Data Protection | yes | Affiliate no-PII: superadmin CAN see emails (already does in membres/payouts), but affiliate dashboard view stays aggregate-only. Admin reads via service_role server-only (never bundled). |

### Known Threat Patterns for {Next.js RSC + Supabase admin}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Direct POST to payout server action bypassing UI | Tampering/Elevation | Re-guard `requireRole('superadmin')` in action (M-01) — already implemented. |
| Double-payout via re-submit | Tampering | `mark_commission_paid` updates only `status='due'`, raises if 0 rows (T-07-DOUBLEPAY) — already in 0016. |
| Back-office existence leak to non-admins | Information Disclosure | `notFound()` 404, never 403 (T-04-ADMIN-ELEV) — in gate. |
| Service_role key leaking to browser bundle | Information Disclosure/Elevation | `createAdminServiceClient()` is `server-only`; build fails if bundled. Lint `no-restricted-imports` blocks `@app/supabase` service-client. |
| IDOR on signal detail | Information Disclosure | If reusing member detail route: it filters `status='active'` + active-sub via RLS. Admin-own detail must read via service_role server-side only. |
| Filter param injection | Tampering | PostgREST parameterizes; still validate instrument/status filter values against known enums before query. |

## Sources

### Primary (HIGH confidence — on-disk code/migrations, this repo)
- `supabase/migrations/0016_affiliation.sql` — payouts table, commissions.status, `mark_commission_paid` RPC, `affiliate_dashboard` view (resolves D-09/D-10 gray area).
- `supabase/migrations/0003_data_ingestion_tables.sql` + `0004_fix_freshness_weekend.sql` — `v_data_freshness` view (candles only; FX weekend/DST logic).
- `supabase/migrations/0001_init_profiles_instruments_job_runs.sql` — `job_runs` schema.
- `supabase/migrations/0006_analyses_trade_setups.sql` — `trade_setups` schema.
- `supabase/migrations/0015_telegram_posts.sql` — `telegram_posts` schema + dedupe_key convention.
- `apps/web/src/app/(admin)/layout.tsx`, `membres/page.tsx`, `affiliation/page.tsx`, `affiliation/payouts/page.tsx` + `actions.ts` — established admin page + payout patterns (M-01..M-05 visible).
- `apps/web/src/lib/auth/gate.ts`, `lib/supabase/admin-service.ts` — gate + service_role read pattern.
- `apps/web/src/app/[locale]/(member)/signaux/[id]/page.tsx` — existing detail route (gated, status='active' only).
- `packages/supabase/src/repositories/{jobRuns,tradeSetups,telegramPosts,commissions}.ts` — service_role write wrappers (NOT for web reads).
- `packages/supabase/src/database.types.ts` (lines ~1058–1129) — manual alias block (regen-clobber risk).

### Secondary (MEDIUM)
- `.planning/phases/08-superadmin-...-/08-UI-SPEC.md` — approved UI contract (sidebar, KPI, badges, copy, color exception).
- `.planning/phases/07-affiliation-paliers/07-CONTEXT.md` — D-15 payout = tx_hash+date+montant; migration 0016 numbering.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new packages; all primitives verified installed.
- Architecture/patterns: HIGH — every pattern read verbatim from existing admin pages + migrations.
- Payout schema resolution: HIGH — 0016 read directly; RPC + table + status confirmed.
- News/macro freshness + telegram 3-state: MEDIUM — genuine gaps, flagged as Open Questions (require founder confirmation).

**Research date:** 2026-06-19
**Valid until:** 2026-07-19 (stable internal codebase; re-check if migrations beyond 0016 land)
