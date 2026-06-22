# Phase 12: Routines d'analyse Claude planifiées (sans API) - Pattern Map

**Mapped:** 2026-06-21
**Files analyzed:** 6 (1 config edit, 1 doc edit, 1 gitignore-verify, 1 new test; 4 engine files REUSED as-is)
**Analogs found:** 4 strong / 4 (the deliverables that have a code analog)

> ⚠️ **Phase nature:** ACTIVATION + CONFIGURATION, not feature code. The Remote Environment, secrets, network allowlist and cron schedules live **OUTSIDE git** (Anthropic dashboard / `/schedule`). They are NOT files and have NO code analog — they are documented in `docs/routines-claude.md` for reproducibility, not committed as config. The trust-boundary engine files (`persist.ts`, `runJob.ts`, `dispatch.ts`, `combine-engine.ts`) are **reused verbatim** — DO NOT modify them.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/jobs/config/sessions.ts` | config | transform (data-not-code) | itself (already sketches crons) | self / exact |
| `docs/routines-claude.md` | doc/runbook | n/a | itself (P1 draft, stale §4/§6/§7) | self / exact |
| `.gitignore` (verify `run-artifacts/`) | config | n/a | itself (line 38 already present) | self / already-done |
| `apps/jobs/__tests__/routine-*.test.ts` (new smoke/validation) | test | unit + static-check | `apps/jobs/__tests__/fault-isolation.test.ts` | role + flow match |
| `apps/jobs/src/jobs/persist.ts` | service (boundary D-43) | request-response (file→DB) | **REUSED AS-IS — do not edit** | invariant |
| `apps/jobs/src/runJob.ts` | service (monitoring) | event-driven (job_runs) | **REUSED AS-IS — do not edit** | invariant |
| `apps/jobs/src/dispatch.ts` | route/entrypoint | request-response (CLI) | **REUSED AS-IS — registry only** | invariant |
| `apps/jobs/src/jobs/combine-engine.ts` | service | transform | **REUSED AS-IS — do not edit** | invariant |
| `apps/jobs/prompts/veteran.md` | prompt/config | n/a | founder review only (D-12-08) | reviewed, not refactored |

**No code analog (config lives outside git):** Cloud Environment (secrets + Custom network allowlist `*.supabase.co`), Remote routines (crons), `/schedule` invocations. See § No Analog Found.

## Pattern Assignments

### `apps/jobs/config/sessions.ts` (config, data-not-code) — EDIT

**Analog:** itself — the cron UTC schedules are already sketched in the doc comment (lines 27-32). Any scope/schedule change for ROUTINE-02 edits THIS file, never dispersed logic.

**`as const satisfies` data-not-code pattern** (lines 33-53) — the canonical shape to copy for any rollout edit:
```typescript
export const SESSIONS = {
  asia: {
    asset_classes: ['forex', 'metal', 'crypto'],
    styles: ['day'],
  },
  london: {
    asset_classes: ['forex', 'metal', 'energy', 'crypto'],
    styles: ['day', 'swing'],
  },
  newyork: {
    asset_classes: ['forex', 'metal', 'energy', 'crypto'],
    styles: ['day'],          // ← rollout #1 (D-12-01)
  },
  'eod-swing': {
    asset_classes: ['forex', 'metal', 'energy', 'crypto'],
    styles: ['swing'],        // ← rollout #1 (D-12-01)
  },
} as const satisfies Record<string, SessionDef>

export type SessionName = keyof typeof SESSIONS
```

**Cron UTC source of truth** (lines 27-32, doc comment — crons live in the comment, the routine config lives outside git):
```
 *  - asia      `00 23 * * 0-4`
 *  - london    `00 07 * * 1-5`
 *  - newyork   `30 12 * * 1-5`   ← rollout #1
 *  - eod-swing `00 21 * * 1-5`   ← rollout #1
```
**Planner note:** D-12-01 rollout = activate `newyork` + `eod-swing` Remote routines first. The `SESSIONS` map already includes all 4; the *routine activation* (which crons exist in the dashboard) is what's staged, NOT the config map. If ROUTINE-02 day-window resolution needs a second cron (open + close), reflect the agreed UTC expression in this comment so it stays the single source of truth, but the actual schedule is set via `/schedule` (outside git).

---

### `docs/routines-claude.md` (runbook doc) — EDIT (correct stale claims)

**Analog:** itself (Phase 1 draft). RESEARCH explicitly flags three stale sections that P12 must correct:

- **§4 line 49** — *"accessible depuis le réseau Anthropic sans configuration spéciale a priori"* → **FALSE.** Default Trusted profile does NOT include `*.supabase.co`. Must document: Environment `Network access = Custom` + `*.supabase.co` + include-defaults. Fallback `Full` if Custom non-functional (A2 / GitHub #30112).
- **§4 line 50 + §7 line 122** — *"À confirmer si nécessaire — A1"* / *"network access vers `*.supabase.co` (à confirmer)"* → resolved: **Custom allowlist REQUIRED**, not optional.
- **§6 lines 110-113** — example UTC times (`22:30`, `09:15`, `00:15`) are P1 placeholders; align with `sessions.ts` crons (`30 12`, `00 21`, etc.) for the activated routines.

**Existing structure to preserve** (the doc already has the right skeleton):
- §3 Injection de secrets via Environments (correct — keep).
- §4 invariant jobs architecture diagram (lines 53-65, correct — keep): `Routine → dispatch.ts → runJob.ts → supabase-js (NOT MCP)`.
- §5 Windows Task Scheduler fallback (correct — ingestion only, not ANALYZE).
- §7 TODO checklist → convert to a "go-live runbook" with the Custom-network step marked REQUIRED, plus the ROUTINE-01 smoke-run gate.

**Add (from RESEARCH):** P-NET (403 `host_not_allowed`), P-SECRET (SERVICE_ROLE_KEY visible to Environment editors, no secrets store), P-MCP (remove any Supabase MCP connector), the single-run handoff constraint (steps 4-5 in same cloud run — fresh clone loses `run-artifacts/`), and RUN_ID format `<session>-<YYYYMMDD>T<HHmm>Z`.

---

### `.gitignore` (config) — VERIFY ONLY (A3 already satisfied)

**Analog:** itself. RESEARCH A3 flagged `run-artifacts/` must be gitignored. **Already present** at line 37-38:
```
# Artefacts éphémères de l'ANALYZE (JSON agent par run, lus par persist.ts — D-43)
run-artifacts/
```
**Planner note:** No edit needed. A3 is CLOSED. Just confirm in the plan that the entry exists (it does) — fresh-clone cloud runs won't carry committed artifacts.

---

### `apps/jobs/__tests__/routine-*.test.ts` (test, unit + static-check) — NEW (Wave 0 gaps)

**Analog:** `apps/jobs/__tests__/fault-isolation.test.ts` — closest existing test that (a) loads `.env` explicitly, (b) creates a service_role client, (c) skips gracefully when env absent, (d) queries `v_data_freshness.is_stale`. Copy these patterns for the Wave-0 validation tests.

**dotenv + path bootstrap** (lines 20-26) — required so `vitest run` from monorepo root finds `apps/jobs/.env`:
```typescript
import { config as dotenvConfig } from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenvConfig({ path: path.resolve(__dirname, '../.env') })
```

**Service_role client + skip-if-no-env guard** (lines 34-42, 36, 159-171):
```typescript
const SUPABASE_URL = process.env['SUPABASE_URL'] ?? ''
const SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? ''
const HAS_SUPABASE = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY)

function getVerifyClient() {
  return createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
// ... in the test:
it('...', async () => {
  if (!HAS_SUPABASE) return   // clean skip when env not configured
  const client = getVerifyClient()
  // ...
})
```

**Staleness contract query** (lines 176-190) — the `v_data_freshness.is_stale` interrogation to reuse for ROUTINE-04:
```typescript
const { data, error } = await client
  .from('v_data_freshness')
  .select('*')
  .limit(10)
expect(error).toBeNull()
if (data && data.length > 0) {
  expect(data[0]).toHaveProperty('is_stale')
}
```

**Top-level `vi.mock` for offline isolation** (lines 50-90) — pattern for any unit test that must run without network (e.g. the `persist` true-empty vs all-rejected cases): mock `@app/supabase` / `@app/data-sources` with `importOriginal()` spread, then dynamic-`import()` the job AFTER mocks are active (line 114).

**Wave-0 tests to author (from RESEARCH § Wave 0 Gaps), each using the above analog:**
1. `persist` **true-empty**: 0 artifact → `{written:0, rejected:0}` success — confirms WR-04 does NOT throw (D-12-02). See WR-04 excerpt below.
2. `persist` **all-rejected**: N artifacts all rejected → throws (intended, P-EMPTY).
3. **Idempotence at run level**: re-run same `session_day` → no duplicate (`expirePriorSetups`, persist.ts:319).
4. **ROUTINE-05 static check**: grep `apps/jobs` → no MCP import, no `ANTHROPIC_API_KEY`; `runJob`/`persist` use `createClient`.

---

### REUSED-AS-IS engine files (DO NOT MODIFY — trust boundary)

These are NOT modified in P12. Excerpts below are the **contracts** the plan must respect, not edit targets.

**`persist.ts` — RUN_ID requirement** (lines 257-261) — the entry contract the ANALYZE step must satisfy via env:
```typescript
export async function persist(): Promise<Json> {
  const runId = process.env['RUN_ID']
  if (!runId) {
    throw new Error('persist: RUN_ID must be set (résolu/exporté par l\'ANALYZE en 04-04)')
  }
  const model = process.env['MODEL_LABEL'] ?? 'claude-code-max'
  const promptVersion = process.env['PROMPT_VERSION'] ?? computePromptVersion()
  // ... reads run-artifacts/<RUN_ID>/ → Zod §3 → guardrails → scoreSetup → expirePriorSetups → insert
}
```
RUN_ID format (from veteran.md / RESEARCH): `<session>-<YYYYMMDD>T<HHmm>Z` e.g. `RUN_ID=newyork-20260622T1730Z tsx src/dispatch.ts persist`.

**`persist.ts` — WR-04 throw guard** (lines 369-370) — the exact line confirming D-12-02 semantics:
```typescript
if (stats.written === 0 && stats.rejected > 0) {
  throw new Error(`persist: 0 setup écrit sur ${stats.rejected} rejet(s)`)
}
```
→ true-empty (`written=0 && rejected=0`) does NOT throw = success. all-rejected (`rejected>0`) DOES throw = intended error. DO NOT weaken.

**`dispatch.ts` — job registry** (lines 39-65) — the entrypoint a Remote routine invokes per step via `tsx`. The full sequence already registered (`market-ingest`, `news-ingest`, `macro-ingest`, `technical-engine`, `fundamental-engine`, `news-engine`, `combine-engine`, `persist`). No new job to register — Anti-Pattern 1: NO `analyze.ts`.

**`runJob.ts` — monitoring wrapper** (lines 50-70) — the `startRun`/`finishRun` → `job_runs` contract the `stale` flag depends on; lazy service_role client (lines 30-41), `supabase-js` only, never MCP (ROUTINE-05).

## Shared Patterns

### Lazy service_role client (supabase-js only, never MCP)
**Source:** `apps/jobs/src/runJob.ts` lines 30-41
**Apply to:** every DB-touching deliverable (validation tests, smoke run, persist).
```typescript
function getServiceClient() {
  const url = process.env['SUPABASE_URL']
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!url || !key) {
    throw new Error('runJob: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set...')
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
```
This is exactly what fails with `403 host_not_allowed` if the Custom network allowlist is missing (P-NET) — the gate of ROUTINE-01.

### data-not-code scope changes (`as const` + `keyof typeof`)
**Source:** `apps/jobs/config/sessions.ts` lines 33-53
**Apply to:** any session/rollout scope change. Edit the versioned config, never dispersed logic.

### `dotenv/config` no-op in cloud
**Source:** `apps/jobs/src/dispatch.ts` line 16 (`import 'dotenv/config'`)
**Apply to:** documentation only — `.env` loads locally, is a no-op in cloud (vars injected by the Environment). No code change between local and cloud (`docs/routines-claude.md` §3).

## No Analog Found

These deliverables have NO code analog because they live **outside git** (Anthropic dashboard / `/schedule`). Planner should treat them as CONFIGURATION STEPS documented in `docs/routines-claude.md`, not as files to create. Use RESEARCH § Code Examples + § Common Pitfalls for the exact procedure.

| Deliverable | Role | Why no analog |
|-------------|------|---------------|
| Cloud Environment (secrets `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`) | live service config | Dashboard-only, no secrets store, not committable (P-SECRET) |
| Custom network allowlist `*.supabase.co` (+ defaults) | live service config | Dashboard-only; default Trusted blocks Supabase (P-NET) — **REQUIRED**, corrects D-12-10 |
| Remote routines `newyork` + `eod-swing` (crons) | scheduler config | Created via `/schedule` + dashboard; persistent cloud routines (D-12-11), not Cron* session-scoped |
| ROUTINE-01 smoke run (egress gate) | manual gate | Cloud-only, not automatable from repo; confirms allowlist + absence of `403` in `job_runs.error` |
| ROUTINE-03 real end-to-end run (≥1 setup persisted) | manual gate | Cloud-only; phase gate before widening to `asia`/`london` |
| `veteran.md` founder review (D-12-08) | review activity | Review, not refactor; any change bumps `prompt_version` (semver+sha256) — no structural edit |

## Metadata

**Analog search scope:** `apps/jobs/**` (config, src/jobs, __tests__, src, prompts, windows), `docs/`, repo-root `.gitignore`
**Files scanned:** ~40 (apps/jobs tree) + docs + gitignore
**Files read for excerpts:** `sessions.ts`, `dispatch.ts`, `runJob.ts`, `persist.ts` (targeted), `fault-isolation.test.ts`, `.gitignore`, `docs/routines-claude.md`
**Pattern extraction date:** 2026-06-21
