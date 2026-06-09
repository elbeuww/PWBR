---
phase: 01
slug: fondations-s-curit
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-09
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.8 (unit/integration) + Playwright 1.60.0 (E2E) |
| **Config file** | none — Wave 0 installs (`vitest.config.ts`, `playwright.config.ts`) |
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

> Populated by the planner. Each phase requirement (AUTH-01/02/03, DATA-05, JOB-03, JOB-04) must map to at least one verifiable task.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | 01 | 1 | DATA-05 | — | constantes temps (bougie clôturée/UTC/daily par source) déterministes | unit | `pnpm vitest run packages/core` | ❌ W0 | ⬜ pending |
| TBD | 01 | — | AUTH-02 | T-01 | un user ne lit pas le profiles/job_runs d'un autre | integration | `pnpm vitest run` (RLS cross-user) | ❌ W0 | ⬜ pending |
| TBD | 01 | — | AUTH-01 | T-01 | signup → login → session persiste entre rechargements | e2e | `pnpm playwright test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` + `playwright.config.ts` — infra de test (aucune n'existe, projet greenfield)
- [ ] golden-values stubs pour les constantes temps de `packages/core` (DATA-05)
- [ ] fixture/test d'intégration RLS (deux users, isolation `profiles`/`job_runs`)
- [ ] 1 E2E Playwright auth (signup → login → session persiste)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `service_role` absent du bundle frontend | AUTH-03 | vérifié par lint anti-import (ESLint `no-restricted-imports`) + `server-only`, pas par un test runtime | `pnpm lint` échoue si `apps/web` importe le module service_role ; inspecter le bundle build |
| RLS active sur toutes les tables | AUTH-02 | vérifiable via `get_advisors` (MCP Supabase), pas un test code | exécuter `get_advisors` → aucune table sans RLS |
| Modèle d'exécution Routines Claude documenté | JOB-03 | dépendance externe — vérification documentaire, pas testable en code | RESEARCH.md §Routines confirme cloud/quota/secrets/MCP |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
