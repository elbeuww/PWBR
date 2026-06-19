# SECURITY.md — Phase 08 (Superadmin consolidé : signaux, santé, affiliés)

**Audit type:** Threat-model verification (register authored at plan time, complete).
**ASVS Level:** 1 · **block_on:** critical, high
**Result:** SECURED — 21/21 threats resolved (18 mitigate verified CLOSED, 3 accept logged).
**Implementation:** read-only audit; no implementation files modified.

---

## Threat verification (mitigate)

| Threat | Category | Evidence (file:line) | Status |
|--------|----------|----------------------|--------|
| T-08-01 | Elevation | `(admin)/layout.tsx:19` `await requireRole('superadmin')` verbatim; `<AdminSidebar/>` mounted at :23 UNDER the gate. | CLOSED |
| T-08-02 | Info Disc | `requireRole` → `notFound()` (404). Layout has no pre-gate render; gate is line 19, before JSX return at :20. | CLOSED |
| T-08-03 | Info Disc | `AdminSidebar.tsx:1` `'use client'`; imports only next/link, next/navigation, next-intl, lucide-react (:13-25). No createAdminServiceClient / service_role / env (grep = 0). | CLOSED |
| T-08-05 | Info Disc | `signaux/page.tsx` + `signaux/[id]/page.tsx`: no `'use client'` (RSC). `createAdminServiceClient` imported server-side (signaux:28, [id]:20); `admin-service.ts:1` `import 'server-only'`. | CLOSED |
| T-08-06 | Elevation | Nested `signaux/[id]/page.tsx` adds no `requireRole`/re-guard; covered by layout gate. Header comment :4-5 documents single-barrier. | CLOSED |
| T-08-07 | Tampering | `signaux/page.tsx:96-102`: `instrument` validated against `instruments.includes(...)` else `'all'`; `status` validated against `TELEGRAM_FILTER_VALUES` (:79) else `'all'`. | CLOSED |
| T-08-09 | Info Disc | List load failures throw `new Error('loadSignals …')` server-side (:56,62); detail throws on query error (:43). Client sees Next error boundary, not raw DB message. | CLOSED |
| T-08-10 | Elevation | `sante/page.tsx` + `(admin)/page.tsx`: no `requireRole`/re-guard; covered by layout gate. | CLOSED |
| T-08-11 | Info Disc | `sante/page.tsx` + `(admin)/page.tsx`: no `'use client'` (RSC). `createAdminServiceClient` (sante:27, page:19) → `server-only` module. | CLOSED |
| T-08-12 | Tampering | `freshness.ts:29-37` `candleColor` takes `isStale` boolean as-is (`if (isStale) return 'red'`); never recomputes. `sante/page.tsx:106` + `page.tsx:101` pass `Boolean(row.is_stale)` read from `v_data_freshness`. JS only adds amber band (`ageHours > 1.5*threshold`). | CLOSED |
| T-08-13 | Info Disc | `sante/page.tsx` query errors throw `new Error('loadHealth …')` server-side (:96,119,132,143); client sees Next error boundary. | CLOSED |
| T-08-14 | Elevation | `affiliation/affilies/page.tsx`: no `requireRole`/re-guard; covered by layout gate. | CLOSED |
| T-08-15 | Info Disc | `affilies/page.tsx`: no `'use client'` (RSC); `createAdminServiceClient` (:24,38) → `server-only`. | CLOSED |
| T-08-16 | Tampering | `affilies/page.tsx:59` `BigInt(c.amount_atomic)` summed (:61,63); display `formatAtomic(BigInt(...))` (:132,135). Zero `Number(` (grep = 0). `formatAtomic` from `@app/core` (packages/core/src/money/atomic.ts). | CLOSED |
| T-08-17 | Tampering | `affilies/page.tsx:42-46` aggregates from base tables `affiliates` + `profiles!inner` + `referrals(count)` + `commissions(amount_atomic,status)`. Does NOT read `affiliate_dashboard` view (grep of literal = 0). | CLOSED |
| T-08-19 | Info Disc | `e2e/gating.spec.ts:97-135`: 6 explicit `test()` × `expect(...).toBe(404)` for /admin/signaux, /admin/signaux/[id], /admin/sante × {non-auth, auth-non-superadmin}. Barrier = layout requireRole → notFound(). | CLOSED |
| T-08-SC | Supply chain | All 4 SUMMARYs confirm zero new npm packages (08-01..08-04 Threat Surface). No new deps introduced. | CLOSED |

## Accepted risks (accept)

| Threat | Category | Rationale | Owner / Boundary |
|--------|----------|-----------|------------------|
| T-08-04 | Tampering | `signals.ts`/`freshness.ts`/`jobs.ts` are pure mappers handling no financial values; no `Number()` on atomic strings (none present). Verified: no Supabase/IO imports. | Accepted — non-financial pure functions. |
| T-08-08 | Info Disc (IDOR) | Admin detail (`signaux/[id]/page.tsx`) intentionally reads ANY trade_setup (no `status='active'` filter, decision 3). Access boundary is the superadmin layout gate, not a per-row filter. notFound() only when row truly absent (:44). | Accepted — gate is the boundary; cross-status read intentional for back-office. |
| T-08-18 | Tampering | Phase 8 is additive read-only back-office; no payout mutation introduced. Payout integrity (double-payout prevention) owned by existing `mark_commission_paid` RPC (atomic, migration 0016, Phase 7). | Accepted — integrity transferred to existing RPC; untouched this phase. |

## Unregistered flags

None. All 4 SUMMARYs ("Threat Surface" sections) declare no new attack surface beyond the threat_model. No `## Threat Flags` entries lacked a register mapping.

## Verification notes

- Layout is the single role barrier; no admin page re-guards (verified: zero `requireRole` outside layout).
- All `(admin)/**/page.tsx` are RSC (zero `'use client'`); only `AdminSidebar.tsx` is a client island and imports no secrets.
- `createAdminServiceClient` is `server-only` (build breaks if bundled) — defense-in-depth against client leakage.
- T-08-19 E2E is live-infra dependent (needs `next dev` + Supabase env); barrier logic verified statically in layout.tsx.
