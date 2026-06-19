# Phase 8: Superadmin consolidé (signaux, santé, affiliés) - Pattern Map

**Mapped:** 2026-06-19
**Files analyzed:** 8 (6 new + 1 edit + 1 reuse-as-is)
**Analogs found:** 8 / 8 (every new file has an exact in-repo analog)

> All paths absolute under repo root `apps/web/src/app/(admin)`. Admin group is HORS `[locale]` (mono-FR). The layout owns the `requireRole('superadmin')` gate — pages NEVER re-guard; server actions DO re-guard.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `(admin)/layout.tsx` (EDIT) | layout/provider | request-response | itself (current `layout.tsx`) | self-extend |
| `(admin)/_components/AdminSidebar.tsx` (new) | component (client island) | event-driven (`usePathname`) | `components/admin/PayoutRowAction.tsx` (`'use client'` shape) | role-match |
| `(admin)/page.tsx` (new) | page (RSC, KPI cards) | CRUD-read (counts) | `(admin)/membres/page.tsx` | role-match |
| `(admin)/signaux/page.tsx` (new) | page (RSC, list + filters) | CRUD-read + transform (join) | `(admin)/membres/page.tsx` + `payouts/page.tsx` | exact |
| `(admin)/signaux/[id]/page.tsx` (new) | page (RSC, read-only detail) | CRUD-read (single) | `[locale]/(member)/signaux/[id]/page.tsx` (anti-pattern source) + `payouts/page.tsx` (read) | role-match |
| `(admin)/sante/page.tsx` (new) | page (RSC, status cards + table) | CRUD-read + transform | `(admin)/file/page.tsx` + `payouts/page.tsx` | role-match |
| `(admin)/affiliation/affilies/page.tsx` (new) | page (RSC, aggregate list) | CRUD-read + transform (aggregate) | `(admin)/affiliation/payouts/page.tsx` | exact |
| `(admin)/affiliation/payouts/*` (NO CHANGE) | — | — | already complete (D-09/D-10 satisfied by migration 0016) | n/a |

**Shared infrastructure (read-only, do not modify):**
- `lib/supabase/admin-service.ts` → `createAdminServiceClient()` (service_role, `server-only`).
- `lib/auth/gate.ts` → `requireRole('superadmin')` (404 via `notFound()`).
- `@app/core` → `formatAtomic(BigInt(x))`, `toAtomic(str)` (CR-02 money).
- Type aliases in `packages/supabase/src/database.types.ts` lines 1062–1129 (`JobRunRow`, `DataFreshnessRow`, `TradeSetupRow`, `TelegramPostRow`, `AffiliateRow`, `CommissionRow`, `PayoutRow`, `AffiliateDashboardRow`).

---

## Pattern Assignments

### `(admin)/layout.tsx` (EDIT — add sidebar shell)

**Analog:** itself (current file, 25 lines). Keep gate + provider + Toaster verbatim; wrap children in a two-column flex with the sidebar.

**Current structure (lines 17–25) — preserve exactly:**
```tsx
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole('superadmin')                       // gate stays here — DO NOT move
  return (
    <NextIntlClientProvider locale="fr" messages={frMessages}>
      <div className="min-h-screen bg-background text-foreground">{children}</div>
      <Toaster />
    </NextIntlClientProvider>
  )
}
```

**Edit shape (per UI-SPEC §Admin Shell):** replace the single `<div>` with a flex row mounting `<AdminSidebar/>` (client) + a scrollable content column. Sidebar surface `bg-card text-card-foreground border-e border-border`, width `w-60`. Content column keeps each page's own `max-w-6xl main`.

---

### `(admin)/_components/AdminSidebar.tsx` (new, client island)

**Analog:** `components/admin/PayoutRowAction.tsx` (lines 1–13) for the `'use client'` + `useTranslations('admin')` shape. Active-state needs `usePathname()`.

**Imports / directive pattern** (from PayoutRowAction.tsx lines 1–13):
```tsx
'use client'
import { usePathname } from 'next/navigation'        // active-route detection (prefix-match)
import { useTranslations } from 'next-intl'
import { LayoutDashboard, Users, Inbox, Share2, Wallet, Radio, Activity } from 'lucide-react'
import { Link } from '...'                            // or next/link (admin is HORS [locale] — plain next/link, NOT i18n nav)
```

**Active-state contract (UI-SPEC §Sidebar):**
- idle: `text-muted-foreground rounded-md px-3 py-2 text-sm`
- hover: `hover:bg-accent hover:text-accent-foreground`
- active: `bg-primary/10 text-primary font-medium` (prefix-match so `/admin/affiliation/payouts` lights "Payouts")
- icon: lucide 16px leading label with `gap-2`
- Nav order (D-01): Tableau de bord · Membres · File · Affiliation · Payouts · Signaux · Santé

> ⚠️ Admin is HORS `[locale]` — use plain `next/link` and literal `/admin/...` hrefs. Do NOT use `i18n/navigation` `Link` (that one localizes; member detail page uses it, admin must not).

---

### `(admin)/page.tsx` (new — `/admin` dashboard, KPI cards)

**Analog:** `(admin)/membres/page.tsx` (RSC + `createAdminServiceClient()` + `getTranslations('admin')`). Replace table with `Card` grid.

**RSC skeleton + service_role read** (membres/page.tsx lines 56–64, 111–122):
```tsx
import { getTranslations } from 'next-intl/server'
import { createAdminServiceClient } from '@/lib/supabase/admin-service'

async function loadKpis() {
  const client = createAdminServiceClient()
  // counts via head:true + count:'exact' (cheap, no rows)
  const { count: pendingFile } = await client
    .from('payments').select('id', { count: 'exact', head: true }).eq('status', 'ambiguous')
  // ...active members, freshness summary...
  return { /* ... */ }
}

export default async function AdminDashboardPage() {
  const t = await getTranslations('admin')
  const kpis = await loadKpis()
  // grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ; shadcn Card per UI-SPEC §Dashboard
}
```

**Card contract (UI-SPEC §Dashboard):** `grid gap-4 sm:grid-cols-2 lg:grid-cols-3`; Card header = label `text-sm text-muted-foreground`, body = `text-3xl font-semibold`; counts via `Intl.NumberFormat('fr-FR')`; each card links to its page. Health card = traffic-light dot + word linking `/admin/sante`.

**Copy keys (new):** `admin.dashboard.*` (title « Tableau de bord »).

---

### `(admin)/signaux/page.tsx` (new — trade_setups × telegram_posts)

**Analog:** `(admin)/membres/page.tsx` (filters + in-memory filtering) + `(admin)/affiliation/payouts/page.tsx` (PostgREST select + manual map). EXACT pattern match.

**Filter bar (GET, URL-synced)** — copy verbatim from membres/page.tsx lines 135–165:
```tsx
<form className="mt-6 flex flex-wrap items-end gap-3" method="get">
  <div className="grid gap-1.5">
    <label htmlFor="instrument" className="text-sm text-muted-foreground">{t('signals.filterInstrument')}</label>
    <select id="instrument" name="instrument" defaultValue={instrumentFilter}
      className="h-9 rounded-md border bg-background px-3 text-sm">…</select>
  </div>
  {/* second select: telegram status */}
</form>
```

**searchParams as Promise (Next 15)** — membres/page.tsx lines 111–119:
```tsx
export default async function Page({ searchParams }: { searchParams: Promise<{ instrument?: string; status?: string }> }) {
  const params = await searchParams                    // MUST await (Pitfall 5)
  const instrumentFilter = params.instrument ?? 'all'
}
```

**Telegram cross-ref (D-03, 2-state — RESOLVED)** — no FK; match on `dedupe_key = 'notable:' + setup.id`:
```ts
const { data: setups } = await client
  .from('trade_setups')
  .select('id, instrument_id, direction, opportunity_score, status, created_at, instruments!inner(canonical_symbol)')
  .order('created_at', { ascending: false })            // D-04 chronological desc
const { data: posts } = await client.from('telegram_posts').select('dedupe_key').like('dedupe_key', 'notable:%')
const postedIds = new Set((posts ?? []).map(p => p.dedupe_key.replace('notable:', '')))
// telegramStatus = postedIds.has(s.id) ? 'posted' : 'unpublished'   (Posté / Non publié ONLY)
```
> Failures are NOT persisted per setup (releasePost deletes the reservation). Show telegram-job failures in Santé via `job_runs`, not here. Badge: emerald (Posté) / muted `secondary` (Non publié) per UI-SPEC §Color.

**Direction cell:** neutral `<bdi>{direction}</bdi>` — NO green/red (D-04 holds).

**Row → detail link:** to NEW admin detail `/admin/signaux/${id}` (NOT the member route — see Anti-Patterns). Same-app link, no `_blank`.

**Empty state** (membres/page.tsx lines 168–172): `rounded-lg border border-dashed p-10 text-center` → `font-medium` heading + `mt-1 text-sm text-muted-foreground` body. Copy `admin.signals.emptyHeading/emptyBody`.

---

### `(admin)/signaux/[id]/page.tsx` (new — admin read-only detail)

**Analog (POSITIVE):** `(admin)/affiliation/payouts/page.tsx` (single-row read via `createAdminServiceClient()`).
**Analog (ANTI — do NOT reuse):** `[locale]/(member)/signaux/[id]/page.tsx` lines 1–25.

**Why a dedicated admin page (resolved decision):** the member detail route filters `status='active'` + active-sub RLS via anon client (anti-IDOR) → expired/invalidated setups `notFound()`. Admin must see ANY setup. Read via `createAdminServiceClient()` server-side, NO `status='active'` guard:
```ts
const client = createAdminServiceClient()
const { data, error } = await client
  .from('trade_setups')
  .select('*, instruments!inner(canonical_symbol)')
  .eq('id', id)
  .maybeSingle()                                        // member uses maybeSingle too (line ~9 comment)
if (error) throw new Error(`loadSetup: ${error.message}`)
if (!data) notFound()                                   // genuine 404 only when truly absent
```
> Member route uses `createClient()` (anon + cookies) and `status='active'` — admin route uses service_role and NO status filter. This is the key divergence. Params is a Promise: `const { id } = await params`.

**Read-only (D-05):** NO action island, NO edit/publish controls.

---

### `(admin)/sante/page.tsx` (new — job_runs + freshness traffic-lights)

**Analog:** `(admin)/file/page.tsx` (RSC table) for the jobs table; freshness cards follow UI-SPEC §Santé.

**News/macro freshness — computed IN-RSC (resolved: no migration).** `v_data_freshness` covers candles only. Derive news/macro from `max()` timestamps:
```ts
const client = createAdminServiceClient()
// candles: existing boolean is_stale
const { data: fresh } = await client.from('v_data_freshness').select('canonical_symbol, timeframe, last_ts, is_stale')
// news: max(published_at) ; macro: max(ts) — single-row aggregate reads
const { data: lastNews } = await client.from('news').select('published_at').order('published_at', { ascending: false }).limit(1).maybeSingle()
const { data: lastMacro } = await client.from('macro_series').select('ts').order('ts', { ascending: false }).limit(1).maybeSingle()
// traffic-light mapping (EXTRACT to lib/admin/freshness.ts for unit test — Wave 0):
//   candles: red = is_stale ; amber = !is_stale && age > 1.5× threshold ; green otherwise
//   news:  amber > 6h / red > 24h since published_at
//   macro: amber > 36h / red > 72h since ts
```

**job_runs read (D-07)** — last-run-per-job reducer (EXTRACT to `lib/admin/jobs.ts` for unit test):
```ts
const { data } = await client
  .from('job_runs')
  .select('job_name, status, started_at, finished_at')
  .order('started_at', { ascending: false })
// duration = finished_at - started_at ; group distinct job_name keeping first (most recent)
// status map: 'success' → OK badge (emerald) ; 'error' → Échec badge (red) ; 'running' → neutral
```

**Freshness card visual (UI-SPEC §Santé):** dot `size-2.5 rounded-full` + label. `emerald-500` « À jour » / `amber-500` « Limite » / `red-500` « Périmé ».

**Jobs table badge tint (UI-SPEC):** ok = `border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400`; échec = same with `red`. Date: `Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })`.

**Copy keys (new):** `admin.health.*`.

---

### `(admin)/affiliation/affilies/page.tsx` (new — affiliés + perfs)

**Analog:** `(admin)/affiliation/payouts/page.tsx` (EXACT — same dir, same select+map+table shape).

**CRITICAL (resolved decision A3):** do NOT read `affiliate_dashboard` view via service_role — it is `security_invoker=true` + `auth.uid()`-scoped → returns NOTHING under service_role (no auth.uid()). Aggregate from BASE tables:
```ts
const client = createAdminServiceClient()
const { data, error } = await client
  .from('affiliates')
  .select('id, profiles!inner(email), referrals(count), commissions(amount_atomic, status)')
if (error) throw new Error(`loadAffilies: ${error.message}`)
// sum per-affiliate in JS: counts plain; amounts string→BigInt (CR-02), never Number()
```

**Money cell** (payouts/page.tsx lines 104–108): `<bdi>{`${formatAtomic(BigInt(r.amountAtomic))} ${unit}`}</bdi>`. `unit` from `getTranslations('payment')('amountUnit')`.

**Nav placement:** sidebar "Affiliation" slot — planner confirms whether candidature queue (existing `affiliation/page.tsx`) or this perfs view is the default route.

---

## Shared Patterns

### Authentication / Gate
**Source:** `lib/auth/gate.ts` (`requireRole`, lines 99–118) — already invoked in `(admin)/layout.tsx` line 18.
**Apply to:** ALL new pages = inherit gate from layout, NO inline re-guard. Server actions ONLY re-guard.
```ts
await requireRole('superadmin')   // layout: lines 109–112 → notFound() (404, never 403) for non-superadmin
```

### Cross-user reads (service_role, server-only)
**Source:** `lib/supabase/admin-service.ts` (lines 23–34).
**Apply to:** every new RSC page (`page.tsx`) read.
```ts
import { createAdminServiceClient } from '@/lib/supabase/admin-service'
const client = createAdminServiceClient()   // server-only; build fails if bundled
```
> Do NOT import `@app/supabase` service-client or service-role repos from `apps/web` (lint `no-restricted-imports`). The repos `jobRuns.ts`/`tradeSetups.ts`/`telegramPosts.ts` are WRITE wrappers for apps/jobs — not for web reads.

### Server-action mutation (only payouts — already done; template for any future mutation)
**Source:** `(admin)/affiliation/payouts/actions.ts` (lines 1–61).
**Apply to:** any new mutation (none required this phase; payout reused as-is).
```ts
'use server'
import 'server-only'
export async function action(formData: FormData) {
  await requireRole('superadmin')               // M-01: re-guard (POST callable directly)
  const client = createAdminServiceClient()
  // M-02 amount /^[0-9]+$/ ; M-03 tx_hash /^[A-Fa-f0-9]{64}$/
  // M-05: opaque error keys via fail(err), never raw err.message
}
```

### Money formatting (CR-02)
**Source:** `@app/core` `formatAtomic` / `toAtomic`; usage in membres/page.tsx line 202, PayoutRowAction.tsx line 56.
**Apply to:** every money cell.
```tsx
<bdi>{`${formatAtomic(BigInt(amountAtomicString))} ${unit}`}</bdi>   // string→BigInt, NEVER Number()
```

### Established page chrome (UI-SPEC §Established Admin Page Pattern)
**Source:** membres/page.tsx + payouts/page.tsx (verbatim).
**Apply to:** all new pages.
| Element | Class |
|---------|-------|
| Container | `<main className="mx-auto max-w-6xl px-4 py-8">` |
| h1 | `text-2xl font-semibold` |
| Filter form | `mt-6 flex flex-wrap items-end gap-3` `method="get"` |
| Filter field | `<div className="grid gap-1.5">` + `text-sm text-muted-foreground` label |
| Native select | `h-9 rounded-md border bg-background px-3 text-sm` |
| Table wrapper | `<div className="mt-6 w-full overflow-x-auto">` + shadcn `Table` |
| Empty state | `rounded-lg border border-dashed p-10 text-center` |
| Date | `Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' })`, fallback `'—'` |
| External link | `target="_blank" rel="noopener noreferrer"` |

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none) | — | — | Every new file maps to an exact or close in-repo analog. Phase 8 is pure composition over the established admin pattern. |

**Genuine new logic (no copy source — write + unit-test fresh, extract to `lib/admin/`):**
- Telegram-status pure fn (`notable:` → setup-id Set match) → `lib/admin/signals.ts`.
- Freshness→color mapper (candles is_stale + amber band; news/macro age thresholds) → `lib/admin/freshness.ts`.
- job_runs duration + last-per-job reducer → `lib/admin/jobs.ts`.
> Keep these as pure exported functions (testable without rendering RSC) per Research §Wave 0 Gaps.

---

## Metadata

**Analog search scope:** `apps/web/src/app/(admin)/**`, `apps/web/src/lib/{auth,supabase}/**`, `apps/web/src/components/admin/**`, `apps/web/src/app/[locale]/(member)/signaux/**`, `packages/supabase/src/database.types.ts`.
**Files scanned:** 11 read in full (layout, membres, file, affiliation, payouts page+actions, PayoutRowAction, admin-service, gate, member detail head, type aliases).
**Pattern extraction date:** 2026-06-19
**Key divergence to honor:** admin signal detail uses `createAdminServiceClient()` + NO `status='active'` filter (opposite of the member route's anti-IDOR design).
