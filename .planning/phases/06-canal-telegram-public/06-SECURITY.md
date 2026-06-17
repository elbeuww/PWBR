# 06-SECURITY — Threat Verification Report

**Phase:** 06 — canal-telegram-public
**Audited:** 2026-06-17
**ASVS Level:** 1
**Block-on:** high
**Verdict:** OPEN_THREATS — 1 declared mitigation partially absent at the public-channel boundary (T-06-DUP). Closed 11/12.

---

## Method

Each threat verified against implemented code by its declared disposition. Grep/Read evidence required — documentation and intent NOT accepted as proof. Implementation files read-only. The code review (06-REVIEW.md) findings CR-02 and WR-02/03 were assessed against the relevant threat dispositions per audit scope.

---

## Threat Verification (all 12)

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-06-LEAK | Information Disclosure | mitigate | CLOSED | `FormatTrade` (format.ts:46-51) carries only symbol/direction/outcome/realized_r. Job SELECT (telegram-publish.ts:109) reads `setup_id, outcome, realized_r, resolved_at, trade_setups(direction, instruments(symbol))` — no entry/SL/TP. Grep for `entry_price\|stop_loss\|take_profit` in job = comment only (line 26). `sl`/`tp` in format.ts are static outcome labels ("SL touché"/"TP1 atteint"), not levels. |
| T-06-INJ | Tampering | mitigate | CLOSED | `escapeHtml` (format.ts:67-69) order `& < >`. Applied to every dynamic field: symbol/direction in FR (format.ts:159), via `ltr()` in AR (format.ts:72,187), winrate segments (128,130). parse_mode HTML set in bot.ts:67. |
| T-06-BIDI | Tampering | mitigate | CLOSED | Only controlled isolates injected: LRI U+2066, PDI U+2069, RLM U+200F (format.ts:24-28). No bidi from external data — `ltr()` wraps escaped data in fixed isolates; no path injects raw control chars. |
| T-06-LEGAL | Compliance (LEGAL-01) | mitigate | CLOSED | `DISCLAIMER_FR`/`DISCLAIMER_AR` (format.ts:37-40) appended unconditionally in every output: FR at line 169, AR at line 197. Reached for all three PostKind branches (no early return skips them). |
| T-06-INVENT | Integrity (D-11) | mitigate | CLOSED (see WR-05 caveat below) | Win-rate block routed through `applyThreshold` (threshold.ts:52) — single shared source with vitrine. Under N<30 → "échantillon insuffisant, N=" (format.ts:121,130); never a %. Verified `winRateLineFr`/`winRateLineAr` both call `applyThreshold`. |
| T-06-DUP | Integrity (TG-03) | mitigate | **OPEN (BLOCKER)** | Declared 2-layer mitigation present: layer 1 `getPostedKeys` (telegramPosts.ts:39-47; called telegram-publish.ts:162,179); layer 2 `UNIQUE(dedupe_key)` (0015:40) + `onConflict:'dedupe_key', ignoreDuplicates:true` (telegramPosts.ts:29). BUT the mitigation deduplicates ROWS only. Send precedes insert (telegram-publish.ts:184 send → 186 insert). A crash/insert-failure after a successful send re-sends on the next run → real double-post on the PUBLIC channel. The declared TG-03 invariant ("a 2nd run sends no duplicate") holds only on the happy path; it fails under the project's own documented failure mode (PC off mid-run, CLAUDE.md). See CR-02. |
| T-06-RLS | Elevation of Privilege | mitigate | CLOSED | 0015:47 `enable row level security`; 0015:49-50 zero write policy by design. SUMMARY 06-02 records `get_advisors security` → only `rls_enabled_no_policy` (INFO, expected = deny-all anon, service_role bypass). No anon read/write path. |
| T-06-SC | Tampering (supply chain) | mitigate | CLOSED | grammy pinned exact `1.43.0` (apps/jobs/package.json:16, no `^`/`~`). Migration applied via MCP `apply_migration` (SUMMARY 06-02), not `db push`. Vetting checkpoint recorded (06-03 Task 1). |
| T-06-LEAK-DB | Information Disclosure | accept | CLOSED | Accepted risk logged below. Table stores only `dedupe_key/post_type/posted_at/tg_message_id/run_id` (0015:38-45) — no levels, no secrets. Verified schema. |
| T-06-TOKEN | Information Disclosure | mitigate | CLOSED | Token read only via `process.env['TELEGRAM_BOT_TOKEN']` (bot.ts:28); throws if absent, no default. Never logged: `logger.error` (telegram-publish.ts:195) logs `{dedupeKey, postType}` + msg only. Return Json (telegram-publish.ts:240-245) = posted/skipped/sample_sufficient/n — no token, no raw content. |
| T-06-403 | Denial of Service | accept (ops) | CLOSED | Accepted risk logged below. Job surfaces send errors (sendPost throws after pRetry; job has no catch around send → recorded in job_runs by runJob). Bot-admin provisioning deferred to UAT-06-01 (06-03 Task 4). |
| T-06-LISTENER | Elevation of Privilege | mitigate | CLOSED | `getBot` returns `new Bot(token)` (bot.ts:33) with no `bot.start()`. Grep across apps/jobs/src: no `bot.start`/webhook/getUpdates/`bot.on` handler. Publication-only confirmed. |

**Closed:** 11/12 · **Open (BLOCKER):** 1/12 (T-06-DUP)

---

## Open Threats (BLOCKER)

### T-06-DUP — Integrity (TG-03) — partial mitigation at public-channel boundary

**Disposition:** mitigate (declared) — **NOT fully achieved.**

**Declared mitigation:** "getPostedKeys (niveau 1) + insertPost onConflict dedupe_key (niveau 2) — filet inviolable même en course concurrente."

**What is present:** Both layers exist in code and correctly prevent duplicate *rows*.

**Gap:** The threat is duplication of the *outgoing public message*, not the row. `publish()` (telegram-publish.ts:174-200) does:
1. `sendPost` (line 184) — message goes public
2. `insertPost` (line 186) — dedupe_key recorded

Two realistic interleavings double-post on the PUBLIC channel:
- (a) `sendPost` succeeds, process killed before `insertPost` (PC sleep — the documented failure mode). Next run: key absent → re-send.
- (b) `sendPost` succeeds, `insertPost` throws (transient DB error) → `publish` re-throws, job fails, next run re-sends.

The `UNIQUE(dedupe_key)` net does not help: the duplicate is already public before any row exists. This materially weakens the TG-03 integrity claim for `recap:<day>` and `notable:<setup_id>` on a reputation-bearing public channel.

**Expected remediation:** Reserve the dedupe_key *before* sending (insert-then-send): insert with `ignoreDuplicates`; if the row already existed, skip the send; only send when this run won the insert. A leftover unsent row (a missing post, caught up next run) is a far cheaper failure than a duplicated public post. Aligns with CR-02 fix.

**Files searched:** apps/jobs/src/jobs/telegram-publish.ts (174-200), packages/supabase/src/repositories/telegramPosts.ts (23-47), supabase/migrations/0015_telegram_posts.sql (40).

---

## Accepted Risks Log

| Threat ID | Disposition | Rationale | Verified |
|-----------|-------------|-----------|----------|
| T-06-LEAK-DB | accept | `telegram_posts` stores only `dedupe_key/post_type/posted_at/tg_message_id/run_id` — no trade levels, no secrets. Low value if read. | Schema 0015:38-45 confirms no sensitive column. |
| T-06-403 | accept (ops) | Bot-not-admin (403) is an operational provisioning concern, not a code defect. Job surfaces the error in job_runs (no swallow); does not mask. Covered by UAT-06-01 checkpoint. | sendPost throws on persistent failure (bot.ts:63-73); no try/catch swallows it at the send site. |

---

## Unregistered Flags (new attack surface, no threat mapping — WARNING, not blocker)

No `## Threat Flags` section exists in the three SUMMARY files. The following surfaced during implementation / code review and map to no registered threat:

| Flag | Source | Category | Assessment |
|------|--------|----------|------------|
| `direction: setup?.direction ?? 'long'` fallback | telegram-publish.ts:134 (CR WR-03) | Integrity (public misinformation) | A malformed join publishes a GUESSED-WRONG trade direction to the public channel. NOT a premium-level leak (T-06-LEAK stays clean), and NOT the win-rate block (T-06-INVENT's declared scope, which is correctly mitigated). This is unmapped integrity surface. Per project coding-style ("never trust external data, fail fast"), the row should be skipped, not guessed. WARNING. |
| `symbol: inst?.symbol ?? '?'` fallback | telegram-publish.ts:133 (CR WR-03) | Integrity (public placeholder) | Publishes a "?" symbol publicly instead of failing/skipping. Cosmetic-but-public integrity surface, unmapped. WARNING. |
| `as unknown as {...}` join cast | telegram-publish.ts:120-128 (CR WR-02) | Integrity (type-safety bypass at trust boundary) | Discards generated DB types at the join boundary; if schema/select drift, the `?? '?'`/`?? 'long'` fallbacks above silently mask the mismatch and emit placeholder/guessed data publicly. Amplifies the two flags above. WARNING. |
| `win_rate` null → "0%" under N≥30 | threshold.ts:57 (CR WR-05) | Integrity (D-11 honesty edge) | `Math.round((row.win_rate ?? 0)*100)` coerces null-rate-with-sufficient-N to a public "0% (N=…)", which reads as "lost every trade" rather than "unknown". Edge of T-06-INVENT's "jamais inventé" intent; the core threshold gate (N<30) is correctly mitigated, so this is an unmapped edge rather than a T-06-INVENT regression. WARNING. |

These are integrity/quality WARNINGs. Under `block_on: high` they do not by themselves block the phase, but the direction-guess (WR-03) is the most serious — a wrong public trade direction on a reputation channel — and should be fixed alongside the T-06-DUP BLOCKER.

---

## Conclusion

11 of 12 declared mitigations verified present and effective in code. **T-06-DUP is OPEN (BLOCKER):** both declared idempotence layers exist but guard rows, not the outgoing public message; the non-atomic send-then-insert (CR-02) allows a real double-post on the public channel under the project's documented PC-off failure mode. Per `block_on: high`, an integrity defect on a public reputation channel blocks ship.

**Next:** Implement insert-then-send (reserve dedupe_key before `sendPost`) to close T-06-DUP, and fail-fast on missing symbol/direction (WR-03) instead of guessing. Then re-run /gsd:secure-phase.

SECURITY.md: .planning/phases/06-canal-telegram-public/06-SECURITY.md
