---
phase: 19-dashboard-utilisateur
verified: 2026-06-26T12:00:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Vue d'ensemble démontrable sur données seedées (SC1)"
    expected: "Un membre connecté voit son statut d'abonnement, 3-4 derniers signaux seedés, et les raccourcis watchlist/paramètres/affiliation"
    why_human: "Requires a live browser session with seeded DB; RSC rendering and Supabase RLS cannot be confirmed by grep alone"
  - test: "ExpiryBanner J-3/J-1 s'affiche en tête du shell (SC3 / WIRING-01)"
    expected: "Un abonné dont la subscription expire dans ≤3 jours voit le bandeau en haut du contenu du (dash) layout"
    why_human: "The ExpiryBanner renders only when current_period_end is within the window — needs a seeded near-expiry subscription"
  - test: "Abonné expiré lit 0 ligne sur Suivis/Historique (RLS barrier D-03 / SC4)"
    expected: "Subscriber with expired subscription sees the renewal state (not empty state) on /dashboard/suivis — the trade_setups!inner join under has_active_subscription() filters all rows"
    why_human: "Requires a live user with an expired subscription against the remote DB; grep on the .or() filter in queries.ts cannot prove the RLS behavior at runtime"
  - test: "EXPLAIN keyset → Index Scan (not Seq Scan + Sort)"
    expected: "EXPLAIN on 'SELECT ... FROM user_followed_setups WHERE user_id=<uuid> ORDER BY created_at DESC, id DESC LIMIT 21' shows 'Index Scan using user_followed_setups_keyset_idx'"
    why_human: "Requires MCP execute_sql on the live remote DB; confirmed LIVE by the phase itself (migration 0020 applied 20260626130456) but EXPLAIN gate cannot be re-run from this verifier"
  - test: "WatchlistToggle flip optimiste visible + rollback toast dans le navigateur (SC2)"
    expected: "Clicking the star icon on a SignalCard instantly fills the star (optimistic), then inserts into user_followed_setups; on network error the star reverts and a toast appears"
    why_human: "Requires a live browser session; the pure-helper test (WatchlistToggle.test.tsx) covers the logic but not the visual DOM behavior"
  - test: "Anti-IDOR test vert avec .env.test (user-followed-rls.test.ts)"
    expected: "pnpm vitest run packages/supabase/src/repositories/__tests__/user-followed-rls.test.ts exits 0 with all assertions passing (not just skipped)"
    why_human: "Test uses describe.skipIf(!HAS_ENV) — requires SUPABASE_URL + ANON_KEY + SERVICE_ROLE_KEY in .env.test; currently skips in CI without credentials"
---

# Phase 19: Dashboard utilisateur — Verification Report

**Phase Goal:** Livrer le groupe de routes `(dash)` membre complet — vue d'ensemble, signaux suivis/historique, watchlist, abonnement, affiliation intégrée, paramètres — en agrégeant les surfaces déjà livrées sans les réimplémenter.
**Verified:** 2026-06-26T12:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| SC1 | Membre accède au `(dash)` (gate `requireUser`) avec vue d'ensemble démontrable (abonnement, derniers signaux, raccourcis) | ✓ VERIFIED (code) / ? HUMAN (runtime) | `(dash)/layout.tsx` L.21 `requireUser()`; `(dash)/dashboard/page.tsx` calls `fetchActiveSignals(…,{sort:'recent'}).slice(0,4)`, renders `<AffiliateSummaryCard/>`, subscription status + renewal state |
| SC2 | Membre consulte signaux suivis/historique (keyset cursor), et toggle watchlist (anti-IDOR, user_id jamais envoyé) | ✓ VERIFIED (code) / ? HUMAN (runtime) | `fetchFollowedSetups` with tuple-compare keyset, `WatchlistToggle` inserts only `{setup_id}` (grep `user_id` in component = 0), `with check (user_id = (select auth.uid()))` in 0020 migration |
| SC3 | Membre gère abonnement (ExpiryBanner J-3/J-1), voit affiliation intégrée (agrégats mesurés, no PII) | ✓ VERIFIED (code) / ? HUMAN (visual) | `ExpiryBanner` mounted in `(dash)/layout.tsx` L.37; `AffiliateSummaryCard` uses `formatAtomic(BigInt(…))` not `Number()`, checks `profile.role === 'affiliate'`, returns null otherwise |
| SC4 | Membre accède aux paramètres de compte ; listes gated par RLS (jamais gate UX seul) | ✓ VERIFIED (code) / ? HUMAN (runtime) | `(dash)/dashboard/parametres/page.tsx` renders email + `<PasswordChangeForm>` + `<LanguageSwitcher>` + signOut; watchlist queries use anon-client, no service_role import anywhere in `(dash)` surfaces |

**Score:** 4/4 ROADMAP success criteria satisfied at code level

---

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `supabase/migrations/0020_user_followed_setups.sql` | ✓ VERIFIED | Table + 3 RLS policies (`with check (user_id = (select auth.uid()))` confirmed); CONCURRENTLY index in Part B comment; applied LIVE per phase memo (20260626130456) |
| `packages/supabase/src/database.types.ts` | ✓ VERIFIED | `grep user_followed_setups` = 5 hits; `grep UserFollowedSetupRow` = 3 hits (aliases present) |
| `packages/supabase/src/repositories/__tests__/user-followed-rls.test.ts` | ✓ EXISTS / ? HUMAN (env) | `describe.skipIf(!HAS_ENV)` pattern; anti-IDOR case `insert({ user_id: userIdB, … })` asserts `error` non-null at L.162 |
| `apps/web/src/app/[locale]/(dash)/layout.tsx` | ✓ VERIFIED | `requireUser()` L.21; `ExpiryBanner` L.37; `DashShell` wrapper; no `requireActiveSub`; no service_role |
| `apps/web/src/components/dash/DashShell.tsx` | ✓ VERIFIED | 6 nav items; `usePathname` from `@/i18n/navigation`; no glow (grep = 0); no physical dir classes; tokens `bg-[var(--primary)]/10`; sidebar + bottom-nav; historique treated as sub-view of suivis (WR-02 fixed) |
| `apps/web/src/messages/{fr,en,ar}.json` (namespace `dash`) | ✓ VERIFIED | 54 keys at strict parity FR=EN=AR; `dash.renewal.cta` = "Renouveler l'abonnement"; no "gratuit/free"; `sidebarLabel`/`bottomLabel` distinct (WR-05 fixed) |
| `apps/web/src/lib/keyset/cursor.ts` | ✓ VERIFIED | `encodeCursor`/`decodeCursor` base64url; `decodeCursor` no `throw` (try/catch → null); tolerant on undefined/empty/corrupt |
| `apps/web/src/lib/keyset/__tests__/cursor.test.ts` | ✓ VERIFIED | round-trip + `@@corrompu@@` → `toBeNull()` + undefined → null cases |
| `apps/web/src/lib/watchlist/queries.ts` | ✓ VERIFIED | `from('user_followed_setups')` + `trade_setups!inner`; tuple-compare `.or(created_at.lt.X,and(created_at.eq.X,id.lt.Y))`; `fetchFollowedSetupIds` returns `Set<string>`; no service_role; no `throw` (grep = 0) |
| `apps/web/src/lib/signals/searchParams.ts` (extended) | ✓ VERIFIED | `cursor: z.string().min(1).optional()` + `tab: z.enum(['suivis','historique']).default('suivis')`; `parseWatchlistParams` safeParse champ par champ; no `nuqs` |
| `apps/web/src/components/dash/WatchlistToggle.tsx` | ✓ VERIFIED | `user_id` grep = 0 (anti-IDOR); `useMutation` + `onError` rollback; `createClient` from `@/lib/supabase/client`; `min-h-11 min-w-11`; no service_role |
| `apps/web/src/components/dash/__tests__/WatchlistToggle.test.tsx` | ✓ VERIFIED | Tests `buildWatchlistToggle` pure helper; covers optimistic flip + rollback on error; covers anti-IDOR (`insert.mock.calls[0][0]` lacks `user_id` property) |
| `apps/web/src/components/signals/SignalCard.tsx` | ✓ VERIFIED | `WatchlistToggle` is SIBLING of `<Link>` (inside `<div className="relative">`, after `</Link>` at L.141-147); `followed?: boolean` prop; no `'use client'` |
| `apps/web/src/components/signals/SignalDetail.tsx` | ✓ VERIFIED | `WatchlistToggle` mounted L.95; `followed?: boolean` prop L.58; `<Disclaimer>` intact |
| `apps/web/src/app/[locale]/(member)/signaux/page.tsx` | ✓ VERIFIED | `fetchFollowedSetupIds` called once L.46; `followedIds` passed as prop (no N+1); gate `requireActiveSub` at `(member)/layout.tsx` INTACT |
| `apps/web/src/app/[locale]/(member)/signaux/[id]/page.tsx` | ✓ VERIFIED | `fetchFollowedSetupIds` L.159; `followed = followedIds.has(id)` L.160; passed to `SignalDetail` L.216 |
| `apps/web/src/components/dash/AffiliateSummaryCard.tsx` | ✓ VERIFIED | Returns null if `profile.role !== 'affiliate'`; `grep requireRole = 0`; `formatAtomic(BigInt(rawAtomic))` + `|| '0'` (WR-04 fixed); `grep Number( = 0`; `/affiliation/dashboard` link present |
| `apps/web/src/app/[locale]/(dash)/dashboard/page.tsx` | ✓ VERIFIED | `fetchActiveSignals` + `.slice(0,4)`; renewal state (`dash.renewal.*`); `<AffiliateSummaryCard />`; 0 equity/P&L/ROI/PnL |
| `apps/web/src/app/[locale]/(dash)/dashboard/suivis/page.tsx` | ✓ VERIFIED | `fetchFollowedSetups(supabase, { status: 'suivis', cursor })`; 4 states (Suspense skeleton, error, renewal via `has_active_subscription` RPC + `!rpcError && hasActive === false` check (WR-01 fixed), empty); `parseWatchlistParams` |
| `apps/web/src/app/[locale]/(dash)/dashboard/historique/page.tsx` | ✓ VERIFIED | `fetchFollowedSetups(…, { status: 'historique', cursor })`; same 4-state pattern with WR-01 fix |
| `apps/web/src/app/[locale]/(dash)/dashboard/watchlist/page.tsx` | ✓ VERIFIED | Redirect to `/dashboard/suivis` via `@/i18n/navigation redirect`; no duplicate query |
| `apps/web/src/app/[locale]/(dash)/dashboard/affiliation/page.tsx` | ✓ VERIFIED | Redirect to `/affiliation/dashboard` (WR-03 fix — was 404 before review) |
| `apps/web/src/app/[locale]/(dash)/dashboard/abonnement/page.tsx` | ✓ VERIFIED | Rehosted under `(dash)/dashboard/abonnement`; mounts existing `PlanCard` from `(account)/abonnement`; no service_role |
| `apps/web/src/app/[locale]/(dash)/dashboard/parametres/page.tsx` | ✓ VERIFIED | `LanguageSwitcher` + `PasswordChangeForm` + `NotificationPreferences` + signOut; no theme toggle (grep ThemeToggle = 0) |
| `apps/web/src/components/dash/PasswordChangeForm.tsx` | ✓ VERIFIED | `'use client'`; `auth.updateUser({ password })`; createClient from `@/lib/supabase/client`; no service_role |
| `apps/web/src/components/dash/KeysetList.tsx` | ✓ VERIFIED | `cursor` link to `?cursor=${nextCursor}`; grep `offset` = 0; `outcome`/`realized_r` rendered for historique variant; RTL-safe (no physical dir classes) |
| `apps/web/test/no-perf-seed-claims.test.ts` | ✓ VERIFIED | Scans `(dash)/dashboard/page.tsx` + `AffiliateSummaryCard.tsx` (L.123-124); test is non-trivial |
| Old `/dashboard` stub (`[locale]/dashboard/` directory) | ✓ VERIFIED REMOVED | Directory no longer exists at `[locale]/dashboard/`; URL `/dashboard` now served by `(dash)/dashboard/page.tsx` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `(dash)/layout.tsx` | `requireUser` | gate at layout | ✓ WIRED | L.21; no `requireActiveSub` |
| `(dash)/layout.tsx` | `ExpiryBanner` | `current_period_end` from anon-client subscriptions | ✓ WIRED | L.37; no service_role |
| `WatchlistToggle` | `user_followed_setups` (insert) | anon-client, `{setup_id}` only | ✓ WIRED | `user_id` never sent from client (grep = 0) |
| `(member)/signaux/page.tsx` | `fetchFollowedSetupIds` | single RSC call → Set passed as prop | ✓ WIRED | L.46 one call; no N+1 |
| `watchlist/queries.ts` | `user_followed_setups ⋈ trade_setups!inner` | `.or(created_at.lt.X,and(created_at.eq.X,id.lt.Y))` keyset | ✓ WIRED | tuple-compare present × 2 |
| `AffiliateSummaryCard` | `affiliate_dashboard` view | anon-client, agrégats no-PII | ✓ WIRED | `formatAtomic(BigInt(…))`, no `Number()` |
| `(dash)/dashboard/watchlist/page.tsx` | `/dashboard/suivis` | localized redirect | ✓ WIRED | no duplicate query |
| `(dash)/dashboard/affiliation/page.tsx` | `/affiliation/dashboard` | localized redirect | ✓ WIRED | WR-03 fix; nav link no longer 404s |
| `(member)/layout.tsx` | `requireActiveSub` | gate intact | ✓ VERIFIED UNCHANGED | not weakened by Phase 19 |

---

### Anti-Patterns Found

| File | Pattern | Severity | Status |
|------|---------|----------|--------|
| `(dash)/layout.tsx` | No `requireActiveSub` — correct, `requireUser` is intentional (D-03) | Info | Expected by design |
| `user-followed-rls.test.ts` | `describe.skipIf(!HAS_ENV)` — skips without credentials | Info | Accepted; HUMAN needed with .env.test |
| No TBD/FIXME/XXX/HACK markers found in phase files | — | — | Clean |

---

### Requirements Coverage

| Requirement | Plans | Status | Evidence |
|-------------|-------|--------|---------|
| UDASH-01 | 19-04 | ✓ SATISFIED | `(dash)/dashboard/page.tsx` overview cockpit (sub status + signals + shortcuts) |
| UDASH-02 | 19-03, 19-07 | ✓ SATISFIED | Suivis + Historique keyset pages; `fetchFollowedSetups` source unique; `KeysetList` cursor link |
| UDASH-03 | 19-01, 19-06 | ✓ SATISFIED | `WatchlistToggle` no `user_id`; RLS `with check`; anti-IDOR test (skipIf) |
| UDASH-04 | 19-02 | ✓ SATISFIED | `(dash)/layout.tsx` = `requireUser` + `ExpiryBanner` (WIRING-01 resolved) |
| UDASH-05 | 19-04 | ✓ SATISFIED | `AffiliateSummaryCard` conditional, no PII, `formatAtomic`, `/affiliation/dashboard` link |
| UDASH-06 | 19-05 | ✓ SATISFIED | `parametres/page.tsx`: email + `PasswordChangeForm` (`updateUser`) + `LanguageSwitcher` + signOut |

---

### Behavioral Spot-Checks

| Behavior | Check | Status |
|----------|-------|--------|
| `decodeCursor('@@corrompu@@')` → null | `cursor.test.ts` covers this | ✓ PASS (test file verified) |
| WatchlistToggle rollback on insert error | `WatchlistToggle.test.tsx` buildWatchlistToggle + onError | ✓ PASS (test file verified) |
| No equity/ROI/P&L in overview | `grep -Eic "equity|P&L|ROI" (dash)/dashboard/page.tsx` = 0 | ✓ PASS |
| `user_id` never in WatchlistToggle insert payload | `grep -c "user_id" WatchlistToggle.tsx` = 0 | ✓ PASS |
| i18n parity FR/EN/AR for `dash` namespace | `node` check: 54 keys each, missing_en=[], missing_ar=[] | ✓ PASS |
| `(member)/layout.tsx` still uses `requireActiveSub` | grep confirmed | ✓ PASS |

---

### Human Verification Required

#### 1. Vue d'ensemble démontrable sur données seedées

**Test:** Connectez-vous en tant que membre abonné actif, naviguez vers `/dashboard`. Vérifiez que (1) le statut d'abonnement avec la date d'expiration s'affiche, (2) 3-4 signaux seedés récents apparaissent dans la grille, (3) les raccourcis watchlist/paramètres s'affichent.
**Expected:** Layout cockpit complet, aucun placeholder, données live de la DB.
**Why human:** Requires live browser session against seeded remote DB.

#### 2. ExpiryBanner J-3/J-1

**Test:** Mettez à jour une subscription en base pour que `current_period_end` soit dans ≤3 jours. Accédez à n'importe quelle route `(dash)`. Vérifiez le bandeau en haut du contenu.
**Expected:** ExpiryBanner visible avec CTA « Renouveler » → /tarifs.
**Why human:** Needs a near-expiry subscription — not reproducible by grep.

#### 3. Abonné expiré → 0 lignes + état renewal (RLS barrier)

**Test:** Connectez-vous avec un compte dont l'abonnement a expiré. Naviguez vers `/dashboard/suivis` (même si des entrées `user_followed_setups` existent). Vérifiez que l'état renewal (`dash.renewal.*`) s'affiche, pas un état vide générique.
**Expected:** « Votre abonnement a expiré » + CTA « Renouveler l'abonnement » (pas « Aucun signal suivi »).
**Why human:** Requires expired subscriber account; the `trade_setups!inner` under `has_active_subscription()` RLS cannot be confirmed without runtime DB state.

#### 4. EXPLAIN keyset → Index Scan

**Test:** Via MCP `execute_sql`: `EXPLAIN SELECT * FROM public.user_followed_setups WHERE user_id = '<any-uuid>' ORDER BY created_at DESC, id DESC LIMIT 21;`
**Expected:** Output contains "Index Scan using user_followed_setups_keyset_idx", no "Seq Scan" or "Sort" node.
**Why human:** Requires MCP connection to remote DB; migration 0020 confirmed LIVE but EXPLAIN gate was run during phase execution, not independently re-runnable here.

#### 5. WatchlistToggle flip + rollback dans le navigateur

**Test:** Sur `/signaux` (liste), cliquez sur l'étoile d'un signal → l'étoile se remplit immédiatement (optimiste). Simulez une erreur réseau (DevTools offline) et recliquez → l'étoile revient en non-suivi + toast d'erreur visible.
**Expected:** Flip instantané, rollback + toast sur erreur.
**Why human:** DOM behavior; `WatchlistToggle.test.tsx` covers the pure logic via `buildWatchlistToggle` but not the React rendering/event flow.

#### 6. Anti-IDOR test vert avec .env.test

**Test:** Avec `SUPABASE_URL` + `ANON_KEY` + `SERVICE_ROLE_KEY` dans `.env.test`, exécuter: `pnpm vitest run packages/supabase/src/repositories/__tests__/user-followed-rls.test.ts`
**Expected:** Exit 0; cas "insert user_id usurpé → error non null" passe (pas skip).
**Why human:** Test skips without credentials; CI currently skips. Needs .env.test populated.

---

### Gaps Summary

No gaps. All must-haves are implemented and substantively wired. The 5 review warnings (WR-01..WR-05) were all fixed before this verification:
- WR-01: `has_active_subscription` RPC null treated as false → fixed (checks `!rpcError && hasActive === false`)
- WR-02: Historique not treated as sub-view of Suivis nav item → fixed (special-case in `isActive`)
- WR-03: `/dashboard/affiliation` 404 → fixed (redirect page created)
- WR-04: `BigInt(null ?? '0')` vs `BigInt('' ?? '0')` → fixed (`|| '0'` instead of `?? '0'`)
- WR-05: Two `<nav>` with identical aria-label → fixed (`sidebarLabel`/`bottomLabel` at 3-way parity)

The 6 human verification items above are runtime/visual items where the code is correct but only confirmable against the live app.

---

_Verified: 2026-06-26_
_Verifier: Claude (gsd-verifier)_
