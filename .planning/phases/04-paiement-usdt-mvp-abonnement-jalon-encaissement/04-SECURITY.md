---
phase: 04-paiement-usdt-mvp-abonnement-jalon-encaissement
secured_at: 2026-06-15T00:00:00Z
threats_total: 27
threats_closed: 27
threats_open: 0
register_authored_at_plan_time: true
asvs_level: 1
block_on: high
mode: verify-mitigations
status: SECURED
---

# Phase 04 — Paiement USDT MVP & Abonnement (Jalon Encaissement) — Security Audit

**Audit type:** Verify-mitigations (FORCE stance). Each plan-time STRIDE threat verified
present in the implementation on `master` by grep/read — not by documentation or intent.
**Scope:** Real-money USDT TRC-20 payment milestone. Inviolable money-path controls
confirmed in code.

Register built from the `<threat_model>` blocks of the 6 PLAN files (04-01 … 04-06).
CR-01 (anti-replay arm-before-network-read) and CR-02 (BigInt no-Number money path) were
flagged Critical in 04-REVIEW.md and are **fixed and present on master** (confirmed by
04-VERIFICATION.md and by direct read of the files below).

## Threat Register — Verification

| Threat ID | Category | Component | Disp. | Status | Evidence |
|-----------|----------|-----------|-------|--------|----------|
| T-04-PREC | Tampering | atomic.ts | mitigate | CLOSED | `packages/core/src/money/atomic.ts:22-43` — regex `/^(\d+)(?:\.(\d{1,6}))?$/`, BigInt-only arithmetic, zero `Number`/`parseFloat`/`* 1e6`. |
| T-04-ADDR | Spoofing | address.ts | mitigate | CLOSED | `address.ts:72-84` base58check, `base58ToHex` throws on checksum mismatch (`Buffer.compare !== 0`). |
| T-04-CRYPTO | Tampering | address.ts | mitigate | CLOSED | `address.ts:12,18-23` sha256 via native `crypto.createHash`, never re-implemented. |
| T-04-ASSUMED | Tampering | TronGrid fixtures | mitigate | CLOSED | `schema.ts:1-20` frozen on the real Nile fixture; no parser written before the network checkpoint. |
| T-04-REPLAY | Tampering/Elev | payments table | mitigate | CLOSED | `0012_payments.sql:63-64` GLOBAL `unique index payments_tx_hash_global_idx`; `payments.ts:161-163` maps 23505 → `ReplayError`. |
| T-04-RLS-ELEV | Elevation | payments RLS | mitigate | CLOSED | `0012_payments.sql:92-107` INSERT `with check (user_id=auth.uid() and status='pending')`, 2 SELECT, **0 update/delete** policy. |
| T-04-INCONSIST | Tampering | activation | mitigate | CLOSED | `0012_payments.sql:120-165` RPC `security definer`, payment→verified `WHERE status='pending'` (raise on 0-row) + subscription upsert in one tx. |
| T-04-OFFSET | DoS | offset reservation | accept | CLOSED (accepted) | `0012_payments.sql:77-79` partial unique index; `payments.ts:91-128` bounded retry loop + `OffsetExhaustedError`; sweep `releaseExpiredReservations` frees offsets. Accepted-risk logged below. |
| T-04-SVCKEY | Info Disclosure | supabase barrel | mitigate | CLOSED | `payments.ts:14` / `subscriptions.ts:9` doc-bloc "JAMAIS importé depuis apps/web"; barrel never exports service-client. |
| T-04-SC | Tampering | QR npm install | mitigate | CLOSED | `apps/web/src/lib/qr/qrcodegen.ts` — vetted, in-repo, zero network/import/postinstall (grep `fetch|require|import|process.env|navigator` = no matches). |
| T-04-QR-NET | Info Disclosure | QR rendering | mitigate | CLOSED | `QrCode.tsx:24-43` renders inline SVG from `value` only, no remote QR service, no fetch; encodes the public receive address. |
| T-04-I18N-LEAK | Info Disclosure | message files | mitigate | CLOSED | i18n namespaces carry copy only; amounts rendered via Intl on the component side (04-03-SUMMARY); no key/secret in messages. |
| T-04-FAKETOKEN | Spoofing | verify.ts | mitigate | CLOSED | `verify.ts:51-54` token identity by `sameAddress(token_info.address, ctx.contract)` only — never symbol/decimals. |
| T-04-REORG | Tampering | client/verify | mitigate | CLOSED | `client.ts:59` `only_confirmed=true`; `verify.ts:63-65` rejects `confirmed===false`. (See WR-05 deferred note.) |
| T-04-PREC-V | Tampering | verify.ts | mitigate | CLOSED | `verify.ts:68-76` `BigInt(transfer.value)`, strict `===`, no float/epsilon. |
| T-04-KEYLEAK | Info Disclosure | client.ts | mitigate | CLOSED | `client.ts:47-49,64-65` `TRONGRID_API_KEY` from env (throw if absent), sent as header `TRON-PRO-API-KEY`, never query param; server-only module. |
| T-04-AUTODECIDE | Tampering | verify.ts | mitigate | CLOSED | `verify.ts:73-76` over/under → `over`/`under` kinds (→ ambiguous queue), never auto activate/reject. |
| T-04-SVCCLIENT | Info Disclosure | actions.ts | mitigate | CLOSED | `(account)/abonnement/actions.ts:1-2,26,92-101` `'use server'`+`'server-only'`, service_role created LOCALLY via `createServiceClient`, never the barrel. |
| T-04-AMOUNTSET | Tampering | reservePayment | mitigate | CLOSED | `actions.ts:143-187` expected amount set by `reserveOffset` (service_role); client never supplies `expected_amount_atomic`. |
| T-04-LEGAL | Compliance | verifyPayment | mitigate | CLOSED | `actions.ts:222-225` `process.env.TRON_NETWORK==='mainnet' && !isLegalReviewDone()` → `legal_gate` before any real collection. |
| T-04-REPLAY-A | Tampering | verifyPayment | mitigate | CLOSED | `actions.ts:247-272` arm UPDATE `.select('id')` BEFORE network read; 23505 → `replay` with no TronGrid call; **0-row arm = hard-stop `expired`** (CR-01 fix). |
| T-04-ERRLEAK | Info Disclosure | actions.ts | mitigate | CLOSED | `actions.ts:61-86,180-186` typed error codes only; never raw `error.message` to the payment client. |
| T-04-AUTODEC-A | Tampering | verifyPayment | mitigate | CLOSED | `actions.ts:313-321` over/under → `transitionPayment('ambiguous')`, manual review; never auto. |
| T-04-ADMIN-ELEV | Elevation | (admin) | mitigate | CLOSED | `lib/auth/gate.ts:99-118` `requireRole('superadmin')` → `notFound()` 404; admin layout guards the group; per-action re-guard. |
| T-04-ADMIN-WRITE | Elevation | admin actions | mitigate | CLOSED | `membres/actions.ts:44-47` + `file/actions.ts:43-46` `guard()` re-validates `requireRole('superadmin')` per action; mutations via service_role LOCAL (`admin-service.ts`). |
| T-04-DESTRUCT | Tampering | revoke/reject | mitigate | CLOSED | `file/actions.ts:71-85` reject requires non-empty `reject_reason` (throws if empty); alert-dialog confirm on revoke/reject (04-06-SUMMARY). |
| T-04-EXTLINK | Tampering | TronScan link | mitigate | CLOSED | `file/page.tsx` `rel="noopener noreferrer" target=_blank` (confirmed grep, 04-06-SUMMARY:105). |
| T-04-EXPIRE | Tampering | expiry job | mitigate | CLOSED | `subscription-expiry.ts:44-51` + `subscriptions.ts:49-62` UPDATE bounded `WHERE status='active' AND current_period_end<=now()`, idempotent, status-only; job_runs via runJob. |
| T-04-NOEMAIL | Info Disclosure | ExpiryBanner | accept | CLOSED (accepted) | In-app banner only, no email infra (D-09). Accepted-risk logged below. Note WIRING-01 below (banner not yet rendered — functional gap, not a security hole). |

**Result: 27/27 CLOSED. threats_open = 0.**

## Accepted Risks Log

| ID | Threat | Disposition | Justification | Reference |
|----|--------|-------------|---------------|-----------|
| T-04-OFFSET | Offset reservation saturation (DoS) | accept | Partial unique index limits one active expected-amount; bounded retry (`MAX_OFFSET_ATTEMPTS=999`) + applicative sweep frees expired reservations; self-inflicted DoS only, no fund/credit impact. | PLAN 04-02 register; `payments.ts:189-222` |
| T-04-NOEMAIL | Pre-expiry reminder in-app only | accept | MVP: no email channel → no email-borne data leak; in-app banner is the sole reminder by design (D-09). | PLAN 04-06 register |

## Deferred / Known-Limitation Log (NOT open security holes)

These are documented in `04-DEFERRED-resubmission-cluster.md` and `04-VERIFICATION.md`.
Each was assessed for genuine unmitigated exposure; none is an open inviolable-control gap.
They do not block the controlled testnet UAT but **must be closed before community/prod**.

| ID | Description | Maps to | Security verdict |
|----|-------------|---------|------------------|
| Re-submission cluster (N-1/WR-02/WR-04) | A tx submitted before TronGrid indexing (`tx_not_found`) leaves the armed `tx_hash` on a rejected row; re-submitting the same hash hits `replay`. Fix = migration 0013 (nullable tx_hash + hash release). | T-04-REPLAY-A (boundary case) | Not an exposure: it FAILS CLOSED (legit payment blocked, never a double-credit). The inviolable anti-replay net stays intact. Deferred. |
| WR-01 | Discovery one-shot enforced app-level only (TOCTOU) — no partial unique index. | T-04 (out-of-register, PAY-06) | Pricing-abuse, not double-credit. App-level `canConsumeDiscovery` present (`actions.ts:155-159`). DB-layer hardening deferred. |
| WR-03 | Admin actions return raw `error.message` (`membres/actions.ts:49-51`, `file/actions.ts:48-50`). | T-04-ERRLEAK (admin path) | Gated to superadmin; payment-user path is correctly opaque. Schema-detail leak only. Deferred to typed-code mapping. |
| WR-05 | `not_confirmed` relies effectively on `only_confirmed=true` (fixture omits `confirmed`). | T-04-REORG | Single-mechanism (param is load-bearing) rather than two independent guards. TronGrid `only_confirmed` reliable. Deferred (add confirmation-count assert). |
| WR-06 | `changePlan(period)` silently ignores `period` (`subscriptions.ts:79-86`). | T-04-ADMIN-WRITE (partial) | Silent partial success on an access mutation; does not grant unauthorized access (plan changes, period simply not extended). Deferred — prioritize. |
| IN-01..04 | `unique(user_id)` subscriptions; display-only `parseFloat` in PaymentPanel; dead `getTransferByHash`; `type==='Transfer'` not asserted. | defense-in-depth | No active hole. PaymentPanel float is display-only (copy uses canonical string). Deferred. |
| WIRING-01 | `ExpiryBanner.tsx` correct but rendered nowhere → PAY-05 "user informed" not delivered at runtime. | T-04-NOEMAIL (functional) | Wiring/functional gap, not a security exposure. Human decision: wire before prod or accept deferral. |

## Unregistered Flags

None. New npm surface introduced this phase (react-hook-form, @hookform/resolvers, sonner)
are standard shadcn deps from the official registry; the only vetted bundle-client package
(QR lib) maps to **T-04-SC** and is verified offline/zero-network. No attack surface appeared
during implementation without a threat mapping.

## Audit Trail

- Loaded: 6 PLAN `<threat_model>` blocks (04-01..04-06), 5 SUMMARYs, 04-REVIEW.md,
  04-VERIFICATION.md, 04-DEFERRED-resubmission-cluster.md.
- Read implementation (read-only): `0012_payments.sql`, `trongrid/{verify,client,schema,address}.ts`,
  `core/money/atomic.ts`, `supabase/repositories/{payments,subscriptions}.ts`,
  `(account)/abonnement/actions.ts`, `(admin)/{membres,file}/actions.ts`,
  `lib/supabase/admin-service.ts`, `lib/auth/gate.ts`, `jobs/subscription-expiry.ts`,
  `lib/qr/{QrCode.tsx,qrcodegen.ts}`.
- Inviolable controls confirmed present in code:
  (1) GLOBAL `UNIQUE(tx_hash)` + arm-before-network-read with `.select('id')` 0-row hard-stop;
  (2) 5 conjoint invariants (contract-by-address, hex↔base58 checksummed recipient,
      confirmed!==false, strict BigInt === amount, over/under→ambiguous);
  (3) BigInt money path, no `Number()` on atomic columns (typed string, `.toString()` writes);
  (4) service_role created locally in server actions + `server-only`, never barrel/browser;
  (5) RLS: user INSERT pending-only, all transitions service_role, scoped reads;
  (6) admin actions re-guard `requireRole('superadmin')` per action;
  (7) no wallet private key anywhere; QR encodes public address only, offline; TronGrid key
      + USDT contract from env, header-only, never logged;
  (8) legal gate `isLegalReviewDone()` blocks mainnet activation.
- Implementation files: NOT modified (audit is read-only; only this SECURITY.md written).

_Audited: 2026-06-15 — gsd-secure-phase (verify-mitigations, FORCE stance)_
