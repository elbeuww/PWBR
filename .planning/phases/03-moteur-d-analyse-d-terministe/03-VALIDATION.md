---
phase: 3
slug: moteur-d-analyse-d-terministe
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-13
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.8 (ESM, golden-value tests) |
| **Config file** | `vitest.config.ts` (root workspace) |
| **Quick run command** | `pnpm vitest run packages/indicators` |
| **Full suite command** | `pnpm vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run packages/indicators`
- **After every plan wave:** Run `pnpm vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-T1 | 03-01 | 1 | TECH-04, FUND-01..03 | T-03-01/02 | RLS + index uniques dans migration | static (grep) | `grep -v '^--' supabase/migrations/0005_snapshots.sql \| grep -c "enable row level security"` == 2 | ❌ Wave 0 | ⬜ pending |
| 03-01-T2 | 03-01 | 1 | TECH-04, FUND-01..03 | T-03-01/02 | migration appliquée + get_advisors=0 | manual (MCP) | MCP get_advisors(security)==0 + list_tables | ❌ Wave 0 | ⬜ pending |
| 03-01-T3 | 03-01 | 1 | TECH-04 | T-03-03 | upsert idempotent + no service-client export | integration | `pnpm vitest run packages/supabase` | ❌ Wave 0 | ⬜ pending |
| 03-02-T1 | 03-02 | 2 | TECH-01 | T-03-05/07 | wrappers déterministes (valeur+longueur) | unit (golden) | `pnpm vitest run packages/indicators/src/wrappers` | ❌ Wave 0 | ⬜ pending |
| 03-02-T2 | 03-02 | 2 | TECH-02, TECH-03 | T-03-06 | swings/BOS-CHoCH corps/S-R/POC+source | unit (golden) | `pnpm vitest run packages/indicators/src/structure` | ❌ Wave 0 | ⬜ pending |
| 03-02-T3 | 03-02 | 2 | TECH-01..03 | T-03-05/08 | hash déterministe + Zod §3 | unit (golden) | `pnpm vitest run packages/indicators/src/snapshots` | ❌ Wave 0 | ⬜ pending |
| 03-03-T1 | 03-03 | 3 | TECH-04 | T-03-10 | forme §3 + hash + gap EMA200 | unit (golden) | `pnpm vitest run apps/jobs/__tests__/technical-engine.test.ts` | ❌ Wave 0 | ⬜ pending |
| 03-03-T2 | 03-03 | 3 | TECH-01..04 | T-03-09/11/12 | engine read→§3→hash→upsert isolé | unit + Zod | `pnpm vitest run apps/jobs/__tests__/technical-engine.test.ts` | ❌ Wave 0 | ⬜ pending |
| 03-03-T3 | 03-03 | 3 | TECH-04 | — | enregistrement dispatcher | static (grep) | `grep -q "'technical-engine': technicalEngine" apps/jobs/src/dispatch.ts` | ❌ Wave 0 | ⬜ pending |
| 03-04-T1 | 03-04 | 4 | FUND-01 | T-03-14/16 | règles FRED + drivers table | unit (golden) | `pnpm vitest run apps/jobs/__tests__/fundamental-engine.test.ts` | ❌ Wave 0 | ⬜ pending |
| 03-04-T2 | 03-04 | 4 | FUND-02, FUND-03 | T-03-14/17 | sentiment décroissant + news_risk <2h/<24h | unit (golden) | `pnpm vitest run apps/jobs/__tests__/news-engine.test.ts` | ❌ Wave 0 | ⬜ pending |
| 03-04-T3 | 03-04 | 4 | FUND-01..03 | — | enregistrement dispatcher | static (grep) | `grep -q "'fundamental-engine'" apps/jobs/src/dispatch.ts` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/indicators/package.json` + `@app/indicators` alias in `vitest.config.ts` — install `technicalindicators@3.1.0` (plan 03-02 implementation step 1)
- [ ] `packages/indicators/src/__fixtures__/btcusdt-h4.json` — offline OHLCV slice (≥210 bougies for EMA200) derived from the ~30,935 real Binance crypto candles already in DB (plan 03-02)
- [ ] `packages/indicators/src/wrappers/*.test.ts` — golden values for RSI/MACD/EMA/ATR/Bollinger (value + output length) (plan 03-02)
- [ ] `packages/indicators/src/structure/*.test.ts` — hand-verified swings/BOS-CHoCH/S-R/POC fixtures (plan 03-02)
- [ ] `packages/indicators/src/snapshots/*.test.ts` — Zod §3 parse + deterministic hash (plan 03-02)
- [ ] `apps/jobs/__tests__/{technical,fundamental,news}-engine.test.ts` — snapshot-shape + hash + window tests (plans 03-03/04)
- [ ] `supabase/migrations/0005_snapshots.sql` applied + regenerated `database.types.ts` + `snapshots`/`assetDrivers` repos + RLS/idempotency test (plan 03-01)

*Existing root vitest infrastructure (`.env.test`, `process.loadEnvFile`) covers harness setup; Phase 3 adds the `packages/indicators` golden fixtures.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Apply migration 0005 to cloud DB + regen types + security gate | TECH-04, FUND-01..03 | MCP-driven cloud migration (project convention D-17); operator runs/approves `apply_migration` | Plan 03-01 Task 2: MCP `apply_migration` (project csotpitrjxryjkadyiml) → `generate_typescript_types` → `get_advisors(security)`==0 |

*All compute behaviors (indicators, structure, snapshot derivation, hash, news windows) have automated golden verification. The single manual step is the cloud migration apply, which has no CLI equivalent in this project.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planned
