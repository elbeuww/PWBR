---
phase: 04-paiement-usdt-mvp-abonnement-jalon-encaissement
reviewed: 2026-06-15T00:00:00Z
depth: deep
files_reviewed: 44
files_reviewed_list:
  - packages/core/src/money/atomic.ts
  - packages/core/src/money/atomic.test.ts
  - packages/core/src/index.ts
  - packages/data-sources/src/trongrid/address.ts
  - packages/data-sources/src/trongrid/address.test.ts
  - packages/data-sources/src/trongrid/schema.ts
  - packages/data-sources/src/trongrid/schema.test.ts
  - packages/data-sources/src/trongrid/client.ts
  - packages/data-sources/src/trongrid/verify.ts
  - packages/data-sources/src/trongrid/verify.test.ts
  - packages/data-sources/src/trongrid/index.ts
  - packages/data-sources/src/index.ts
  - supabase/migrations/0012_payments.sql
  - packages/supabase/src/repositories/payments.ts
  - packages/supabase/src/repositories/subscriptions.ts
  - packages/supabase/src/index.ts
  - apps/jobs/src/jobs/subscription-expiry.ts
  - apps/jobs/src/jobs/__tests__/subscription-expiry.test.ts
  - apps/jobs/src/dispatch.ts
  - apps/web/src/app/[locale]/(account)/abonnement/actions.ts
  - apps/web/src/app/[locale]/(account)/abonnement/discovery.ts
  - apps/web/src/app/[locale]/(account)/abonnement/__tests__/discovery.test.ts
  - apps/web/src/app/[locale]/(account)/abonnement/page.tsx
  - apps/web/src/app/[locale]/(account)/abonnement/PlanCard.tsx
  - apps/web/src/app/[locale]/(account)/abonnement/PaymentPanel.tsx
  - apps/web/src/app/[locale]/(account)/abonnement/HashForm.tsx
  - apps/web/src/app/[locale]/(account)/abonnement/VerificationPolling.tsx
  - apps/web/src/app/[locale]/(account)/abonnement/CopyButton.tsx
  - apps/web/src/app/[locale]/(account)/layout.tsx
  - apps/web/src/app/(admin)/membres/page.tsx
  - apps/web/src/app/(admin)/membres/actions.ts
  - apps/web/src/app/(admin)/file/page.tsx
  - apps/web/src/app/(admin)/file/actions.ts
  - apps/web/src/app/(admin)/layout.tsx
  - apps/web/src/components/admin/MemberRowActions.tsx
  - apps/web/src/components/admin/QueueRowActions.tsx
  - apps/web/src/components/member/ExpiryBanner.tsx
  - apps/web/src/lib/supabase/admin-service.ts
  - apps/web/src/lib/qr/qrcodegen.ts
  - apps/web/src/lib/qr/toSvgPath.ts
  - apps/web/src/lib/qr/QrCode.tsx
  - apps/web/src/lib/qr/index.ts
  - apps/web/src/lib/qr/__tests__/qrcodegen.test.ts
  - apps/web/src/lib/auth/gate.ts
findings:
  critical: 2
  warning: 6
  info: 4
  total: 12
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-06-15
**Depth:** deep
**Files Reviewed:** 44
**Status:** issues_found

## Summary

Real-money on-chain payment milestone (USDT TRC-20). Reviewed the full money path: atomic conversion, the 5 conjoint verification invariants, anti-replay/anti-TOCTOU in `verifyPayment`, RPC idempotency in migration 0012, service_role boundary, admin authz, secrets, the legal gate, and offset reservation/sweep.

Overall the architecture is strong and intentional: BigInt-only money math is clean, the 5 verification invariants hold conjointly and in the right order, the GLOBAL `UNIQUE(tx_hash)` is correctly used as the inviolable anti-replay net, the RPC enforces idempotency via `WHERE status='pending'`, secrets are read from env and never bundled, and admin actions re-validate `requireRole('superadmin')` on every endpoint.

Two real defects must block: (1) a **double-spend / cross-payment tx_hash reuse window** caused by the arm-step UPDATE accepting 0-row matches without aborting, combined with the reservation placeholder `tx_hash` scheme; and (2) the **`amount === expected` strict-equality check is silently undermined by `Number()` coercion** at the DB write boundary for the expected amount, which (while currently safe for 9/3 USDT) is a latent correctness landmine and is not what the money invariant promises. Plus six warnings, mostly around the arm-step semantics, the discovery one-shot TOCTOU, and error-message leakage in admin actions.

## Critical Issues

### CR-01: Arm-step UPDATE silently continues on 0-row match → tx_hash never armed before network read (anti-replay window)

**File:** `apps/web/src/app/[locale]/(account)/abonnement/actions.ts:241-254`
**Issue:**
The contract of the flow (per the file header and Pitfall 2) is: arm `UNIQUE(tx_hash)` via UPDATE **before** any TronGrid read, so a replayed hash is caught by 23505 *before* network I/O and before activation. But the arm UPDATE is:

```ts
const { error: armErr } = await service
  .from('payments')
  .update({ tx_hash: trimmed })
  .eq('id', paymentId)
  .eq('user_id', user.id)
  .eq('status', 'pending')   // <-- filter
```

In PostgREST, an UPDATE that matches **0 rows is NOT an error** (`armErr` is null). The code only branches on `armErr.code === '23505'` and otherwise treats the arm as successful. So whenever the `status='pending'` predicate matches 0 rows (e.g. the reservation row was already swept to `'rejected'` by `releaseExpiredReservations`, or already moved to `verified`/`ambiguous` by a prior verify), the function **proceeds to the network read and verification with the tx_hash NOT written to any row** — the anti-replay arm did not happen.

Concrete failure scenario (replay across the sweep boundary):
1. User reserves payment A (status pending, placeholder `tx_hash=reservation:<u>:<amt>`, reservation_expires_at in 60 min).
2. Reservation expires; the sweep flips A to `status='rejected'` (tx_hash still the placeholder).
3. User submits the real on-chain `txH`. Arm UPDATE filters `status='pending'` → matches 0 rows → `armErr` null → **txH is never written, 23505 never triggers**.
4. Flow reads network, `verifyTransfer` returns `exact`, calls `activateForPayment`. The RPC `WHERE status='pending'` matches 0 rows → raises → caught as generic → returns `internal`. The legitimate payment is now stuck/rejected even though it was valid (correctness/UX failure), AND `txH` was never recorded as consumed.
5. The user re-reserves payment B (new pending row), submits the SAME `txH`. This time arm matches (B is pending), `txH` is written, 23505 does NOT fire (no other row holds `txH` — step 3/4 never persisted it), `verifyTransfer` returns `exact` again, subscription activated. The single on-chain transfer `txH` has now been used to drive verification twice; if step 4 had instead succeeded for any reason (e.g. A was still pending at a different status path), this is a direct double-credit.

The root cause is that "arm matched 0 rows" is indistinguishable from "arm succeeded" here. The design relies on RPC idempotency as the backstop, but the backstop only protects the *specific row* A — it does nothing to prevent the *same tx_hash* from being armed onto a *different* row B once A no longer holds it. The `UNIQUE(tx_hash)` net only fires if some row still physically holds `txH`; on the 0-row-arm path it never gets written.

**Fix:** Make the arm-step authoritative — require exactly 1 row updated, and abort otherwise. Use `.select()` to count, and treat 0 rows as a hard stop (not a silent continue):

```ts
const { data: armed, error: armErr } = await service
  .from('payments')
  .update({ tx_hash: trimmed })
  .eq('id', paymentId)
  .eq('user_id', user.id)
  .eq('status', 'pending')
  .select('id')

if (armErr) {
  if ((armErr as { code?: string }).code === '23505') {
    return { ok: false, status: 'rejected', code: 'replay' }
  }
  return { ok: false, status: 'rejected', code: 'internal' }
}
// 0-row arm = payment not in 'pending' (expired/already-processed). Do NOT read network.
if (!armed || armed.length === 0) {
  return { ok: false, status: 'rejected', code: 'tx_not_found' } // or a dedicated 'expired' code
}
```

Additionally, consider arming on a `UNIQUE(tx_hash)` write that does **not** depend on the row being pending (so the hash is globally claimed regardless of row state) — e.g. record the consumed hash in a dedicated `consumed_tx_hashes` table inside the same RPC transaction. As written, the global uniqueness guarantee is only as strong as "some pending/active row still holds the hash," which the 0-row path breaks.

---

### CR-02: `expected_amount_atomic` is coerced through `Number()` on every DB write, undermining the BigInt-only money invariant

**File:** `packages/supabase/src/repositories/payments.ts:106,151,243` (and read-back `actions.ts:264`)
**Issue:**
The money invariant (atomic.ts header, Pitfall 4) is explicit: amounts must be BigInt end-to-end, "aucun Number()/parseFloat()." But `database.types.ts` types the `bigint` columns as JS `number` (lines 313-343), and the repository launders every atomic amount through `Number()` before writing:

```ts
expected_amount_atomic: Number(expected),     // reserveOffset (l.106)
expected_amount_atomic: Number(input.expected_amount_atomic),  // insertPendingPayment (l.151)
patch.amount_atomic = Number(extra.amount_atomic)              // transitionPayment (l.243)
```

and reads it back via `BigInt(payment.expected_amount_atomic)` (actions.ts:264). The verification then does `received === expected` where `expected = BigInt(payment.expected_amount_atomic)`.

For the current plans (9 USDT = `9_000_000`, +offset < 1000) this is well under `Number.MAX_SAFE_INTEGER` (~9e15), so **no precision is lost today** — which is why I am not asserting an active exploit. But:
- The invariant the codebase loudly promises ("zéro float, jamais Number sur les montants") is violated at the most safety-critical boundary — the column that the strict `===` comparison depends on.
- `amount_atomic` (the *received* on-chain value) also passes through `Number()` (l.243). A received over-payment is attacker-controlled; an attacker can send a transfer with value `> 2^53` micro-USDT. That row goes to the `ambiguous` queue where `Number(extra.amount_atomic)` is stored, then the admin page does `BigInt(r.receivedAmountAtomic)` — the displayed/stored received amount is silently rounded, so an admin reviewing the queue sees a wrong number and may approve based on corrupted data. This is the realistic failure path.

**Fix:** Stop coercing atomic amounts to `Number`. Type the columns as `string` (preferred for Postgres `bigint` via PostgREST, which returns bigint as string by default) or `bigint`, and write/read as string:

```ts
// write
expected_amount_atomic: expected.toString(),
amount_atomic: extra.amount_atomic.toString(),
// read
const expectedAtomic = BigInt(payment.expected_amount_atomic) // already string
```

Update `database.types.ts` to `expected_amount_atomic: string` / `amount_atomic: string | null` (consistent with PostgREST bigint serialization), and update the two admin pages (`membres/page.tsx:201`, `file/page.tsx:100,104`) which currently do `BigInt(numberValue)`.

---

## Warnings

### WR-01: `discovery_consumed` enforcement is a TOCTOU — concurrent reservations can both pass

**File:** `apps/web/src/app/[locale]/(account)/abonnement/actions.ts:154-159` + `discovery.ts:22-26`
**Issue:** `reservePayment('discovery')` reads prior plans, checks `canConsumeDiscovery`, then inserts a pending payment. Two concurrent requests both read "no prior discovery," both pass the check, both insert pending discovery rows. The `payments_expected_amount_active_idx` only enforces unique *expected_amount*, not "one discovery per user." So a user can reserve (and pay) the 3$/7d one-shot twice via a double-submit/race. Lower severity than the money path because it is a pricing-abuse, not a double-credit, but it defeats the D-12 one-shot rule.
**Fix:** Enforce one-shot at the DB layer: a partial unique index `unique (user_id) where plan='discovery' and status in ('pending','verified')`, and map its 23505 to `discovery_consumed`. The app-level check then becomes a fast-path UX only.

### WR-02: `releaseExpiredReservations` rejects expired reservations but never frees the placeholder `tx_hash` for re-use; and a rejected reservation row blocks a later legitimate verify

**File:** `packages/supabase/src/repositories/payments.ts:204-220` + `actions.ts:241-254`
**Issue:** The sweep flips expired pending reservations to `status='rejected'` but leaves `tx_hash=reservation:<u>:<amt>` and `expected_amount_atomic` on the row. The offset *is* freed (the partial index is `where status='pending'`), so offset exhaustion is mitigated — good. But the reservation row now permanently holds a placeholder tx_hash under the GLOBAL unique index. That's harmless for real hashes, but it means a user who paid *after* their reservation expired can never arm the real hash onto that row (status no longer pending — see CR-01). The user is silently pushed to re-reserve, and their already-sent on-chain funds risk being orphaned until manual review. Verify the re-reservation + re-submit path actually recovers these funds.
**Fix:** Either (a) when re-reserving, detect an expired rejected reservation for the same user/plan and reuse it, or (b) extend the verify path to accept arming a real hash onto a recently-expired reservation (CR-01 fix should define an explicit `expired` code and a recovery route), and document the operator runbook for funds sent against an expired reservation.

### WR-03: Admin server actions return raw `error.message` to the client

**File:** `apps/web/src/app/(admin)/membres/actions.ts:49-51`, `apps/web/src/app/(admin)/file/actions.ts:48-50`
**Issue:** `fail(err)` returns `{ ok:false, error: err.message }`. These messages include raw repository/Postgres strings (e.g. `activateForPayment failed: <pg detail>`, `changePlan failed: …`). The payment user-facing path correctly maps everything to opaque typed codes (T-04-ERRLEAK), but the admin path leaks raw DB error text to the (admin) client bundle. Even though only superadmins reach it, it is inconsistent with the project's no-raw-error-message rule and can leak schema/constraint internals into the browser. Lower severity because gated to superadmin.
**Fix:** Map to typed codes like the payment actions: return a small enum (`'invalid_input' | 'db_error' | 'forbidden'`) and log the raw message server-side via pino. Do not forward `error.message`.

### WR-04: `reserveOffset` placeholder `tx_hash` collisions are silently retried as "offset taken," masking a different failure

**File:** `packages/supabase/src/repositories/payments.ts:95-124`
**Issue:** The insert sets `tx_hash: reservation:${user_id}:${expected}` AND `expected_amount_atomic: Number(expected)`. Both columns are globally unique. A 23505 is caught and the loop advances the offset. But a 23505 could come from EITHER the expected-amount index OR the tx_hash index; since the placeholder embeds `expected`, they move in lockstep, so it's currently fine. However, the comment claims the collision means "offset déjà réservé actif" — it actually cannot distinguish that from a stale rejected reservation still holding the placeholder tx_hash (WR-02). If a prior expired reservation for the same user at the same offset still holds `reservation:<u>:<amt>` (status rejected), the tx_hash index fires 23505 even though the *amount* index (partial, pending-only) would allow it — so a freed offset is wrongly skipped, accelerating offset exhaustion. Verify this against the sweep behavior.
**Fix:** Drop the placeholder-`tx_hash` uniqueness coupling: either make the reservation tx_hash nullable (allow NULL, and the unique index on tx_hash ignores NULLs) or include a per-reservation random suffix so a stale rejected row never collides with a fresh reservation. Reserve uniqueness should be carried by the amount index alone.

### WR-05: `not_confirmed` invariant relies solely on `only_confirmed=true` server filter; the optional `confirmed` field is never set by the observed fixture

**File:** `packages/data-sources/src/trongrid/verify.ts:63-65` + `client.ts:57-61` + `schema.ts:43`
**Issue:** Invariant 3 (confirmation/anti-reorg) is enforced two ways: the client passes `only_confirmed=true`, and verify rejects `confirmed === false`. But `schema.ts` notes the real fixture does not carry `confirmed` at all (absence = confirmed). So in practice the *only* confirmation guard is the query param `only_confirmed=true`. If TronGrid ever returns an unconfirmed transfer despite the param (or the param is dropped in a URL refactor), verify cannot catch it because `confirmed` is `undefined`, not `false`. There is no confirmation-count threshold check despite the context mentioning one. Lower severity because TronGrid's `only_confirmed` is reliable, but the "conjoint invariant" is weaker than advertised — it is effectively one mechanism, not two independent ones.
**Fix:** If a confirmation threshold is a real requirement, fetch and assert block confirmations explicitly (`block_timestamp` age or a confirmations count) rather than trusting a single query param. At minimum, add a test that a transfer with `confirmed` absent but flagged unconfirmed upstream is handled, and document that `only_confirmed=true` is load-bearing and must never be removed.

### WR-06: `changePlan` with a `period` argument silently ignores the period (claims D-11 prolongation but never applies it)

**File:** `packages/supabase/src/repositories/subscriptions.ts:75-87` + `membres/actions.ts:82-84`, `file/actions.ts:94-97`
**Issue:** `ChangePlanInput` documents "Avec `period`, la prolongation atomique passe par la RPC d'activation (D-11)" and the admin actions pass a parsed `period` into `changePlan`. But the implementation only does `update({ plan })` and never reads `input.period` — the period is dropped on the floor. An admin who selects "change plan + extend 1 month" gets the plan changed but no extension, with `{ ok: true }` returned. Silent partial success on a money/access-control mutation.
**Fix:** Either implement the documented behavior (when `period` is provided, route through `activateForPayment`/the RPC to extend `current_period_end`), or remove `period` from `ChangePlanInput` and the admin call sites so the API does not promise something it doesn't do. Add a test asserting that `changePlan({period})` actually extends the period.

---

## Info

### IN-01: `activate_subscription_for_payment` picks "most recent subscription" by `created_at`, which can mis-target multi-row users

**File:** `supabase/migrations/0012_payments.sql:148-163`
**Issue:** The RPC selects the user's subscription via `order by created_at desc limit 1`. If a user ever has more than one subscription row (no unique constraint on `subscriptions.user_id` is shown), activation always targets the newest, which may not be the intended one. For the current single-sub model this is fine; flag to verify there is a `unique(user_id)` (or equivalent) on `subscriptions`, otherwise the "most recent" heuristic is fragile.
**Fix:** Add/confirm `unique (user_id)` on `subscriptions`, or pass the target subscription id explicitly.

### IN-02: `PaymentPanel.useFormattedAmount` runs the atomic amount through `Number.parseFloat` for display

**File:** `apps/web/src/app/[locale]/(account)/abonnement/PaymentPanel.tsx:43-47`
**Issue:** Display formatting does `nf.format(Number.parseFloat(decimal))`. This is display-only (the copy button uses the canonical string `amountRaw`, l.62-65, which is correct), so no float touches the verified amount. But it is a float on a money value in the money UI, contradicting the "zéro float anywhere" stance and could mis-display amounts at large magnitudes. Keep it display-only and never feed this back into any submission.
**Fix:** Format the BigInt string directly (manual grouping/trim) instead of `parseFloat`, or at least add a comment marking it strictly display-only. Verify no code path reads `amountDisplay` back into a payment value.

### IN-03: `getTransferByHash` is exported but unused by the verify path (which re-implements the find inline)

**File:** `packages/data-sources/src/trongrid/client.ts:109-116`, exported in `index.ts:40`
**Issue:** `verifyPayment` calls `fetchTrc20TransfersForReceiver` then `transfers.find(...)` inline (actions.ts:268-269) rather than `getTransferByHash`. The exported helper is dead relative to the payment flow. Not harmful, but it is duplicated logic and an unused export (cross-reference structural pre-pass if available).
**Fix:** Either route `verifyPayment` through `getTransferByHash` (single source of truth for the find), or drop the export.

### IN-04: Schema does not assert `type === 'Transfer'`

**File:** `packages/data-sources/src/trongrid/schema.ts:41`
**Issue:** `type: z.string()` accepts any string; `verifyTransfer` never checks `type`. The `/transactions/trc20` endpoint should only return Transfer events, so this is currently benign, but a non-Transfer event type (e.g. an approval) slipping through would still be evaluated against the amount/recipient invariants. Defense-in-depth gap, not an active hole.
**Fix:** Either `z.literal('Transfer')` in the schema, or add `if (transfer.type !== 'Transfer') return rejected` as a leading invariant in `verifyTransfer`.

---

_Reviewed: 2026-06-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
