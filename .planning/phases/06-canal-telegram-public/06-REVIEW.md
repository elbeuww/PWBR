---
phase: 06-canal-telegram-public
reviewed: 2026-06-17T00:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - apps/jobs/src/dispatch.ts
  - apps/jobs/src/jobs/telegram-publish.ts
  - apps/jobs/src/telegram/bot.ts
  - apps/jobs/src/jobs/__tests__/telegram-publish.test.ts
  - apps/web/src/lib/track-record/patternStats.ts
  - apps/web/src/lib/track-record/threshold.ts
  - packages/core/src/index.ts
  - packages/core/src/telegram/format.ts
  - packages/core/src/telegram/format.test.ts
  - packages/core/src/track-record/threshold.ts
  - packages/core/src/track-record/threshold.test.ts
  - packages/supabase/src/index.ts
  - packages/supabase/src/repositories/patternStats.ts
  - packages/supabase/src/repositories/telegramPosts.ts
  - supabase/migrations/0015_telegram_posts.sql
findings:
  critical: 2
  warning: 6
  info: 4
  total: 12
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-06-17
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Phase 6 ships a publication-only grammY Telegram job with a pure bilingual (FR+AR
RTL) formatter, a shared track-record threshold, and a `telegram_posts`
idempotence table. The security-sensitive invariants are mostly honored well:
the bot token is env-only and never logged or returned (T-06-TOKEN holds),
dynamic data is escaped before HTML insertion (T-06-INJ holds), premium levels
(entry/SL/TP) are never selected or formatted (D-03 holds), and idempotence is
double-guarded at app level (`getPostedKeys`) and DB level
(`UNIQUE(dedupe_key)` + `ignoreDuplicates`).

The serious problems are correctness ones around the cadence contract. The daily
recap fires only on an exact `hour === 21` match, which silently violates the
stated D-10 "never skip a day" guarantee precisely under the project's own
documented failure mode (PC off / missed run). Idempotence also depends on a
non-atomic send-then-insert sequence that can double-post under realistic
retry/crash interleavings. Several quality defects (unused `run_id` traceability
column, a mislabeled test that doesn't test what it claims, swallowed Supabase
error type) round out the list.

## Critical Issues

### CR-01: Daily recap is skipped permanently if the 21:00 UTC run is missed

**File:** `apps/jobs/src/jobs/telegram-publish.ts:157,215-227`
**Issue:** The daily recap only fires when `now.hour === RECAP_HOUR_UTC` (exact
equality on 21). The job is documented as hourly and the project constraints
state explicitly that the PC may be off (`CLAUDE.md`: "PC potentiellement
éteint → jobs idempotents + monitoring"). If the single 21:00 UTC run is missed
(machine asleep, scheduler hiccup, run crashes before reaching the recap block),
no run at 20:00 or 22:00 will ever produce that day's recap: the dedupe key
`recap:<day>` is only minted inside the `hour === 21` branch. This directly
violates the D-10 invariant ("même un jour sans trade clos poste « aucun
trade » … jamais de skip") under the exact scenario the platform was designed to
survive. The 21:00-only test (`TUESDAY_RECAP`) passes precisely because it never
exercises a missed-hour run, so the gap is invisible to the suite.
**Fix:** Make the recap fire-or-catch-up rather than fire-on-exact-hour. Drive it
off the dedupe key, not the wall clock: post the recap whenever the current UTC
time is at or past the recap anchor for `dayKey` and `recap:<dayKey>` is absent.

```ts
// Replace the exact-hour gate with a catch-up gate.
const recapAnchorPassed = now.hour >= RECAP_HOUR_UTC // any hourly run >= 21:00
if (recapAnchorPassed) {
  const input: FormatInput = { kind: 'recap', winRate, trades: trades.map(/* ... */) }
  await publish(`recap:${dayKey}`, 'recap', input) // posted.has() makes it idempotent
}
// Same pattern for the Friday winrate post (isFriday + key absence), so a missed
// hour on Friday still gets caught up by the next hourly run.
```

### CR-02: send-then-insert is not atomic — a crash or insert failure double-posts on the next run

**File:** `apps/jobs/src/jobs/telegram-publish.ts:174-200`
**Issue:** `publish()` sends the Telegram message first, then inserts the
dedupe_key. The code comment acknowledges the window ("message déjà envoyé mais
trace échouée") but the chosen mitigation does not actually prevent a duplicate
public post — it only logs. Two realistic interleavings produce a visible
double-post on the public channel:
(1) `sendPost` succeeds, the process is killed (PC sleep — the documented failure
mode) before `insertPost` runs; the next run sees the key absent and sends again.
(2) `sendPost` succeeds but `insertPost` throws (transient DB error); `publish`
re-throws, the job fails, the next run re-sends.
The DB `UNIQUE(dedupe_key)` net does NOT help here because the duplicate is the
*outgoing sendMessage*, not the row — the unique constraint only deduplicates
rows, after the message is already public. For `notable:<setup_id>` and
`recap:<day>` this means the channel can show the same trade/recap twice.
**Fix:** Reserve the dedupe_key *before* sending (insert-then-send), or use
Telegram-side idempotency. Insert the row first with `ignoreDuplicates`; if the
insert reports the row already existed, skip the send; only send when this run
won the insert. A leftover row whose send never happened is a far cheaper failure
(a missing post, caught up next run via CR-01's catch-up) than a duplicated
public post.

```ts
const reserved = await tryReserveKey(client, dedupeKey, postType) // insert, returns false if conflict
if (!reserved) { skippedCount += 1; return }
const messageId = await sendPost(bot, channelId, html)
await updateMessageId(client, dedupeKey, messageId) // best-effort traceability
```

## Warnings

### WR-01: `run_id` traceability column is declared but never written

**File:** `apps/jobs/src/jobs/telegram-publish.ts:185-190`, `packages/supabase/src/repositories/telegramPosts.ts:23-34`, `supabase/migrations/0015_telegram_posts.sql:44`
**Issue:** Migration 0015 adds `run_id uuid references job_runs(id)` with the
comment "run du job ayant publié", and the type `TelegramPostInsert` accepts it,
but `insertPost` is only ever called with `{ dedupe_key, post_type,
tg_message_id }`. Every row will have `run_id = NULL`, defeating the stated
traceability purpose and leaving an FK column that looks populated by design but
never is. `runJob` owns the `runId` but `telegramPublish` has no access to it.
**Fix:** Thread the active `runId` into the job (e.g. via the `RUN_ID` env var
already used by `persist`, or by having `runJob` pass it to the fn) and include
`run_id` in the `insertPost` payload. If traceability is genuinely not needed,
drop the column rather than leaving it permanently NULL.

### WR-02: `loadResolvedTrades` casts the join result through `as unknown as {...}`, bypassing the generated types

**File:** `apps/jobs/src/jobs/telegram-publish.ts:120-128`
**Issue:** The Supabase join row is force-cast via `as unknown as {...}` with a
hand-written shape. This discards the generated `Database` types at exactly the
boundary where they matter most (the join cardinality the comment is worried
about). If the schema or the select string drifts, the compiler will not catch
it — the cast silently asserts a shape that may no longer hold, and the
defensive `?? '?'` / `?? 'long'` fallbacks will mask the mismatch by emitting
placeholder data to the public channel. CLAUDE/typescript rules explicitly call
out avoiding `as any`-style escapes.
**Fix:** Type the select result from the generated types (Supabase infers join
shapes from the select string) or validate the row with a small Zod schema at
this ingestion boundary, failing loudly instead of substituting `'?'`/`'long'`.

### WR-03: Placeholder symbol/direction fallbacks emit misleading data to the public channel

**File:** `apps/jobs/src/jobs/telegram-publish.ts:133-134`
**Issue:** `symbol: inst?.symbol ?? '?'` and `direction: setup?.direction ??
'long'` silently fabricate output. A missing symbol becomes a public post
reading "? (long) — ✅ TP1 atteint +2.3R", and a missing direction defaults to
`long` — publishing a *wrong* direction for a real trade on a public,
reputation-bearing channel. Per project coding-style ("Never trust external data
… Fail fast"), a join that comes back malformed should abort the post, not
guess.
**Fix:** Skip (and log) any trade whose `symbol` or `direction` is missing rather
than defaulting. Never publish a guessed direction.

### WR-04: `getPostedKeys` selects the entire `telegram_posts` table unbounded

**File:** `packages/supabase/src/repositories/telegramPosts.ts:39-47`, `apps/jobs/src/jobs/telegram-publish.ts:162`
**Issue:** Idempotence level 1 loads *all* dedupe_keys on every hourly run with no
`WHERE`/`LIMIT`. The docstring in `telegram-publish.ts:15` calls this a
"sélection bornée" but it is unbounded — it grows linearly forever (every recap,
notable, and winrate post accumulates). Over months/years of hourly runs this is
an ever-growing full-table read each hour. (Flagged as correctness/robustness of
the "bornée" claim, not as a perf-only issue: the code's own contract says
bounded and it is not.)
**Fix:** Bound the select to the relevant window, e.g. `posted_at >= now() -
interval '2 days'` (the only keys that can collide are recent: today's recap,
this week's winrate, and notables from the 24h trade window).

### WR-05: Empty-symbol/`win_rate` rounding can publish "0%" as a measured result

**File:** `packages/core/src/track-record/threshold.ts:57`
**Issue:** `winRatePct: Math.round((row.win_rate ?? 0) * 100)`. When `n >=
MIN_SAMPLE` but `win_rate` is `null` (the `pattern_stats` view can return N
without a computed rate, and the test `threshold.test.ts:57` explicitly covers
this), the public channel prints "Taux de réussite mesuré : 0% (N=…)". A
hard 0% measured win rate is itself a misleading public claim and contradicts
the "jamais inventé" honesty goal — 0% here means "unknown", not "lost every
trade". Same path turns a genuine low rate like 0.004 into "0%".
**Fix:** When `win_rate` is `null` despite sufficient N, treat as insufficient
(emit the "échantillon insuffisant"/unknown branch) rather than coercing to 0.

### WR-06: `pickTop` does not guarantee the FR/AR blocks stay under 4096 once both languages + disclaimers are summed

**File:** `packages/core/src/telegram/format.ts:107-113,199`
**Issue:** `MAX_DETAILED = 10` caps the *number* of detailed trades, but each
trade is rendered twice (FR + AR), with isolate characters, emojis (multi-byte),
and a long symbol. The only length test (`format.test.ts:100`) uses 50 trades —
which triggers truncation to 10 — but never tests 10 long-symbol trades at the
boundary, nor counts UTF-16 code units vs Telegram's character limit. Telegram
counts entities/length differently from `String.length`; `out.length < 4096` in
the test is not the same bound Telegram enforces. The cap is asserted by comment
("< 4096 chars … sortie bornée") but not actually proven at the worst case.
**Fix:** Add a test with 10 maximally-long symbols (e.g. 30-char tickers) in both
blocks and assert the real byte/entity length, or lower `MAX_DETAILED` with a
computed margin. Consider truncating on rendered length, not trade count.

## Info

### IN-01: Mislabeled test — "N=58" case actually passes n=30

**File:** `packages/core/src/track-record/threshold.test.ts:22-29`
**Issue:** The test titled `'N=58 → winRatePct 58 (cas plan)'` calls
`applyThreshold({ n: 30, ... })` and asserts `result.n).toBe(30)`. It tests
neither N=58 nor the win-rate value 58 meaningfully (58 is the *percentage*, not
N). The title is misleading and the case duplicates the N=30 boundary test above
it, reducing real coverage.
**Fix:** Either set `n: 58` to match the title, or rename to reflect that it tests
`win_rate: 0.58 → winRatePct 58` at the threshold.

### IN-02: `getPatternStats` return shape differs between repo and `StatRow`/`loadGlobalStat`

**File:** `packages/supabase/src/repositories/patternStats.ts:23-31`, `apps/jobs/src/jobs/telegram-publish.ts:88-97`
**Issue:** `PatternStatRow` types `n` as `number | null`, but `StatRow`
(`@app/core`) types `n` as non-nullable `number`. `loadGlobalStat` papers over
this with `global?.n ?? 0`. It works, but the two source-of-truth types for the
same view disagree on nullability, which is the kind of boundary mismatch the
"single source" decision (D-49/D-11) was meant to avoid.
**Fix:** Align the nullability of `n` across `PatternStatRow` and `StatRow`, or
document why the view's `n` is nullable.

### IN-03: `loadResolvedTrades` error handling diverges from `getPatternStats` "never throw" contract

**File:** `apps/jobs/src/jobs/telegram-publish.ts:113-115` vs `packages/supabase/src/repositories/patternStats.ts:48-52`
**Issue:** `getPatternStats` is documented and built to never throw (returns
`{rows:[], error}`), while the inline `loadResolvedTrades` SELECT throws on
error. Mixed error conventions for two reads in the same job make failure
behavior harder to reason about. Not a bug (the job is allowed to fail and
`runJob` records it), but the inconsistency is worth noting.
**Fix:** Pick one convention for data reads in this job; throwing-on-error is fine
here, so consider moving `getPatternStats`'s error to a throw at the call site
(`loadGlobalStat` already does) and document the chosen convention.

### IN-04: Migration comment references RLS read-grant for `pattern_stats` but `telegram_posts` has none — verify advisor at gate

**File:** `supabase/migrations/0015_telegram_posts.sql:28-30,47-50`, `packages/supabase/src/repositories/patternStats.ts:34-39`
**Issue:** The migration correctly enables RLS on `telegram_posts` with zero
policies (write = service_role bypass, read = nobody). The `patternStats` repo
docstring claims `pattern_stats` is `anon`-readable ("première lecture publique
du projet"). These are two different tables, but the telegram job reads
`pattern_stats` with the service_role client, so the anon-read grant is never
exercised by this phase — make sure the phase gate's `get_advisors` run actually
covers the anon path the vitrine relies on, not just the job path.
**Fix:** No code change; confirm the security advisor check at the phase gate
exercises `pattern_stats` anon SELECT and `telegram_posts` anon-no-access.

---

_Reviewed: 2026-06-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
