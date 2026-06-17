# 06-SECURITY — Threat Verification Report

**Phase:** 06 — canal-telegram-public
**Audited:** 2026-06-17 (re-audit after fix 5d85d6d)
**ASVS Level:** 1
**Block-on:** high
**threats_open: 0**
**Verdict:** SECURED — all 12 declared mitigations verified present and effective. T-06-DUP closed by reserve-then-send (commit 5d85d6d). Closed 12/12.

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
| T-06-DUP | Integrity (TG-03) | mitigate | **CLOSED** (re-audit 2026-06-17, fix 5d85d6d) | **Reserve-then-send** now inverts the order: `reservePost` (telegramPosts.ts:37-51, `upsert onConflict:'dedupe_key' ignoreDuplicates:true .select()` → true only if THIS call created the row) is called at telegram-publish.ts:203 BEFORE `sendPost` (telegram-publish.ts:219), gated on `won` (telegram-publish.ts:211). Crash between reserve and send → key persists → next run `reservePost` returns false → SKIP (telegram-publish.ts:211-216), a missed post, NEVER a public duplicate. Send-failure path releases the reservation (`releasePost`, telegramPosts.ts:59-71; called telegram-publish.ts:228) then rethrows → clean retry, no silent skip (D-10). Layer 1 `getPostedKeys` (telegramPosts.ts:76-84; called telegram-publish.ts:176, checked :198) unchanged. Tests: telegram-publish.test.ts:263-286 (reserve-fail rollback + concurrent-reserve no-resend). Residual ack-loss window assessed acceptable below. |
| T-06-RLS | Elevation of Privilege | mitigate | CLOSED | 0015:47 `enable row level security`; 0015:49-50 zero write policy by design. SUMMARY 06-02 records `get_advisors security` → only `rls_enabled_no_policy` (INFO, expected = deny-all anon, service_role bypass). No anon read/write path. |
| T-06-SC | Tampering (supply chain) | mitigate | CLOSED | grammy pinned exact `1.43.0` (apps/jobs/package.json:16, no `^`/`~`). Migration applied via MCP `apply_migration` (SUMMARY 06-02), not `db push`. Vetting checkpoint recorded (06-03 Task 1). |
| T-06-LEAK-DB | Information Disclosure | accept | CLOSED | Accepted risk logged below. Table stores only `dedupe_key/post_type/posted_at/tg_message_id/run_id` (0015:38-45) — no levels, no secrets. Verified schema. |
| T-06-TOKEN | Information Disclosure | mitigate | CLOSED | Token read only via `process.env['TELEGRAM_BOT_TOKEN']` (bot.ts:28); throws if absent, no default. Never logged: `logger.error` (telegram-publish.ts:195) logs `{dedupeKey, postType}` + msg only. Return Json (telegram-publish.ts:240-245) = posted/skipped/sample_sufficient/n — no token, no raw content. |
| T-06-403 | Denial of Service | accept (ops) | CLOSED | Accepted risk logged below. Job surfaces send errors (sendPost throws after pRetry; job has no catch around send → recorded in job_runs by runJob). Bot-admin provisioning deferred to UAT-06-01 (06-03 Task 4). |
| T-06-LISTENER | Elevation of Privilege | mitigate | CLOSED | `getBot` returns `new Bot(token)` (bot.ts:33) with no `bot.start()`. Grep across apps/jobs/src: no `bot.start`/webhook/getUpdates/`bot.on` handler. Publication-only confirmed. |

**Closed:** 12/12 · **Open (BLOCKER):** 0/12

---

## T-06-DUP — Integrity (TG-03) — CLOSED (re-audit 2026-06-17)

**Prior status:** OPEN (BLOCKER) — non-atomic send-then-insert allowed a real public double-post under the documented PC-off failure mode.

**Fix verified (commit 5d85d6d):** order inverted to **reserve-then-send**.

1. **Ordering gated on win.** `reservePost(client, row)` (telegram-publish.ts:203) runs BEFORE `sendPost` (telegram-publish.ts:219). `reservePost` (telegramPosts.ts:37-51) is `upsert([row], {onConflict:'dedupe_key', ignoreDuplicates:true}).select('dedupe_key')` and returns `(data ?? []).length > 0` — true only when THIS call created the row. Send is reached only when `won === true` (telegram-publish.ts:211).
2. **Crash window now skips, not duplicates.** A crash/kill between `reservePost` and a successful `sendPost` leaves the key in `telegram_posts`. The next run: layer 1 `getPostedKeys` (telegram-publish.ts:176, checked :198) or layer 2 `reservePost` → `won=false` (telegram-publish.ts:211-216) → SKIP. The outcome is a *missed* post (caught up at the next eligible run, recap is per-day idempotent), never a duplicate already-public message. This is the cheaper failure the prior audit prescribed.
3. **Rollback bounds, does not re-open, the double-post.** On `sendPost` throw, `releasePost(client, dedupeKey)` (telegram-publish.ts:228; telegramPosts.ts:59-71 `delete().eq('dedupe_key', …)`) deletes the reservation and the error rethrows (no swallow, D-10). Residual window = `sendPost` reports an error *after* Telegram actually delivered (carrier-level ack loss). In that case release+next-run re-sends once. This window is (a) far narrower than the prior unbounded crash window, (b) not the project's documented PC-off mode (a kill leaves the key → skip, case 2), and (c) bounded to a single re-send per genuine ack-loss event. **Assessed acceptable** for an ASVS-1 educational public channel: residual duplicate only under rare carrier ack-loss, vs the prior guaranteed duplicate on every mid-run kill.

**Tests:** telegram-publish.test.ts:263-276 (send fails after reserve → key released, retry posts exactly once), :278-286 (key already reserved by prior/concurrent run → `sendMessage` not called), :201-212 (2nd consecutive run posts 0).

**Files verified:** apps/jobs/src/jobs/telegram-publish.ts:176-233, packages/supabase/src/repositories/telegramPosts.ts:37-84.

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
| ~~`direction: setup?.direction ?? 'long'` fallback~~ | telegram-publish.ts (CR WR-03) | Integrity (public misinformation) | **RESOLVED in 5d85d6d.** The `?? 'long'` guess is removed; `loadResolvedTrades` now throws on missing direction (telegram-publish.ts:138-142) — fail-fast, no wrong-direction publish. Throw message carries only `setup_id` (no premium levels → no leak). Test :306-318. |
| ~~`symbol: inst?.symbol ?? '?'` fallback~~ | telegram-publish.ts (CR WR-03) | Integrity (public placeholder) | **RESOLVED in 5d85d6d.** The `?? '?'` placeholder is removed; same fail-fast throw on missing symbol (telegram-publish.ts:138-142). Test :306-318. |
| `as unknown as {...}` join cast | telegram-publish.ts:120-128 (CR WR-02) | Integrity (type-safety bypass at trust boundary) | Discards generated DB types at the join boundary; if schema/select drift, the `?? '?'`/`?? 'long'` fallbacks above silently mask the mismatch and emit placeholder/guessed data publicly. Amplifies the two flags above. WARNING. |
| `win_rate` null → "0%" under N≥30 | threshold.ts:57 (CR WR-05) | Integrity (D-11 honesty edge) | `Math.round((row.win_rate ?? 0)*100)` coerces null-rate-with-sufficient-N to a public "0% (N=…)", which reads as "lost every trade" rather than "unknown". Edge of T-06-INVENT's "jamais inventé" intent; the core threshold gate (N<30) is correctly mitigated, so this is an unmapped edge rather than a T-06-INVENT regression. WARNING. |

As of the 2026-06-17 re-audit, the two WR-03 flags are RESOLVED (fail-fast). The remaining two flags (`as unknown as` join cast, WR-05 null-rate "0%") are unchanged cosmetic/edge WARNINGs; under `block_on: high` they do not block.

---

## Security Audit 2026-06-17 (re-audit)

Re-audit triggered by fix commit **5d85d6d** closing the single prior OPEN threat (T-06-DUP).

**Scope:** verify (1) reserve-then-send ordering, (2) crash window yields skip not double-post, (3) releasePost rollback does not reintroduce unbounded double-post, (4) CR-01 / WR-03 introduce no new threat surface.

**Findings:**
- **T-06-DUP → CLOSED.** Reserve-then-send verified: `reservePost` (telegram-publish.ts:203) precedes `sendPost` (:219), gated on `won` (:211). Crash mid-run → key persists → next run skips (:211-216 / getPostedKeys :198). Residual ack-loss re-send window assessed acceptable (bounded, single re-send, not the documented PC-off mode).
- **releasePost rollback** (:228, telegramPosts.ts:59-71): deletes only on send failure then rethrows; a process kill before release leaves the key (fail-closed → skip). No unbounded double-post reintroduced.
- **CR-01** (`now.hour >= RECAP_HOUR_UTC`, :171): catch-up recap still idempotent via `recap:<dayKey>` + reserve gate. Tests :288-304. No new surface.
- **WR-03** (fail-fast, :138-142): resolves the two prior direction/symbol integrity WARNINGs; throw leaks no premium data (setup_id only). Test :306-318. No new surface.

**Counts:** Closed 12/12 · Open 0/12 · Accepted 2 (T-06-LEAK-DB, T-06-403) · Unregistered flags 2 remaining (WARNING, non-blocking; 2 prior resolved).

**Verdict:** SECURED — `threats_open: 0`. Phase 06 clears the public-channel integrity boundary.

---

## Conclusion

12 of 12 declared mitigations verified present and effective in code. **T-06-DUP is CLOSED:** the reserve-then-send inversion (commit 5d85d6d) makes a mid-run crash yield a missed post rather than a public double-post, and the rollback path is fail-closed. The two WR-03 integrity WARNINGs are resolved by fail-fast. No new threat surface introduced by the fix. Under `block_on: high`, no blocker remains.

SECURITY.md: .planning/phases/06-canal-telegram-public/06-SECURITY.md
