---
phase: 01
slug: fondations-s-curit
status: executed
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-09
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.8 (unit/integration) + Playwright 1.60.0 (E2E) |
| **Config file** | `vitest.config.ts` + `playwright.config.ts` (créés au plan 01-01) |
| **Quick run command** | `pnpm vitest run` |
| **Full suite command** | `pnpm vitest run && pnpm playwright test` |
| **Estimated runtime** | ~30 seconds (unit) + ~30 seconds (1 E2E auth) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run`
- **After every plan wave:** Run `pnpm vitest run && pnpm playwright test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

> Populated by the planner. Each phase requirement (AUTH-01/02/03, DATA-05, JOB-03, JOB-04) maps to at least one verifiable task.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-T2 | 01-01 | 1 | DATA-05 | — | constantes temps (bougie clôturée/UTC/daily par source) déterministes | unit | `pnpm vitest run packages/core` | ✅ | ✅ green (16/16 golden values, 2026-06-12) |
| 01-02-T1 | 01-02 | 2 | AUTH-02 | T-02 | un user ne lit pas le profiles/job_runs d'un autre + RLS active 3 tables | integration | `pnpm vitest run packages/supabase` | ✅ | ✅ green (6/6, 2026-06-12) |
| 01-02-T3 | 01-02 | 2 | AUTH-01 | T-03 | signup → login → session persiste entre rechargements | e2e | `pnpm exec playwright test auth.spec.ts` | ✅ | ✅ green (5/5, 2026-06-12) |
| 01-02-T4 | 01-02 | 2 | AUTH-03 | T-01 | import service_role depuis apps/web échoue au lint | lint (statique) | `pnpm lint` (fixture import interdit) | ✅ | ✅ green (exit ≠ 0 sur fixture seule, 2026-06-12) |
| 01-03-T1 | 01-03 | 3 | JOB-04 | T-10 | runJob écrit job_runs (success + error) via service_role | integration | `pnpm vitest run apps/jobs` | ✅ | ✅ green (2/2 + invariant timestamps, 2026-06-12) |
| 01-03-T2 | 01-03 | 3 | JOB-03 | T-08 | dispatcher exécutable hors agent Claude (.cmd Task Scheduler) | manuel/doc | `apps/jobs/windows/run-job.cmd heartbeat` | ✅ | ✅ green (exit 0, ligne job_runs cloud vérifiée, 2026-06-12) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `vitest.config.ts` + `playwright.config.ts` — infra de test (plan 01-01, projet greenfield)
- [x] golden-values pour les constantes temps de `packages/core` (DATA-05, plan 01-01)
- [x] test d'intégration RLS (deux users, isolation `profiles`/`job_runs`) (plan 01-02)
- [x] 1 E2E Playwright auth (signup → login → session persiste) (plan 01-02)
- [x] fixture lint AUTH-03 (import service_role interdit depuis apps/web) (plan 01-02)
- [x] test intégration `runJob` écrit job_runs (plan 01-03)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `service_role` absent du bundle frontend | AUTH-03 | vérifié par lint anti-import (ESLint `no-restricted-imports`) + `server-only`, pas par un test runtime | `pnpm lint apps/web` échoue si `apps/web` importe le module service_role (fixture) ; inspecter le bundle build |
| RLS active sur toutes les tables | AUTH-02 | vérifiable via `get_advisors` (MCP Supabase), pas un test code | exécuter `get_advisors` → aucune table sans RLS (checkpoint [BLOCKING] plan 01-02) |
| Modèle d'exécution Routines Claude documenté | JOB-03 | dépendance externe — vérification documentaire, pas testable en code | `docs/routines-claude.md` reflète RESEARCH.md §Routines (cloud/quota/secrets/MCP) |
| Job exécuté hors agent Claude (Task Scheduler) | JOB-03 | nécessite une tâche OS planifiée | tâche Windows pointant `run-job.cmd heartbeat` écrit une ligne job_runs sans session Claude |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planned (waiting execution)
