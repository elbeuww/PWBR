---
phase: 21
slug: tests-e2e-audit-de-scalabilit
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-26
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright 1.60.0 (E2E) + Vitest 4.1.8 (contrats RLS) |
| **Config file** | `playwright.config.ts` (racine) — à étendre (projects par rôle + `dependencies` + `webServer` + `retries` CI) |
| **Quick run command** | `pnpm test:e2e --project=<role concerné>` |
| **Full suite command** | `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e` |
| **Estimated runtime** | ~120-300 s (E2E chromium, dépend du nombre de specs) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test:e2e --project=<role concerné>` (sous-ensemble rapide)
- **After every plan wave:** Run `pnpm test && pnpm test:e2e` (suite complète locale)
- **Before `/gsd:verify-work`:** Suite CI verte (lint+typecheck+vitest+e2e) ET `21-AUDIT.md` produit avec verdict D-06 respecté (D-11)
- **Max feedback latency:** ~300 s

---

## Per-Task Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists |
|--------|----------|-----------|-------------------|-------------|
| E2E-01 | Flux dashboard utilisateur (Phase 19) | e2e | `pnpm test:e2e --project=abonne` | ❌ W0 (`e2e/dash/*.spec.ts`) |
| E2E-01 | Cockpit superadmin 4 axes (Phase 20, ←20-UAT) | e2e | `pnpm test:e2e --project=superadmin` | ❌ W0 (`e2e/admin/*.spec.ts`) |
| E2E-01 | Smoke non-régression auth/i18n/academie | e2e | `pnpm test:e2e` | ✅ specs existantes |
| E2E-02 | non-superadmin → 404 discret | e2e | `pnpm test:e2e --project=abonne` | ⚠️ partiel (`gating.spec.ts`) → étendre cockpit |
| E2E-02 | non-abonné → 0 ligne / redirection tarifs | e2e | `pnpm test:e2e` | ⚠️ partiel (`gating.spec.ts` L.66) |
| E2E-02 | cross-user isolation (barrière données) | integration | `pnpm test` (admin-rls/seed-rls) | ✅ Vitest (reste la preuve données) |
| SCALE-06 | EXPLAIN keyset = Index Scan (pas Seq Scan + tri) | manual-audit | MCP `execute_sql` `EXPLAIN (ANALYZE, BUFFERS)` | ❌ W0 (`21-AUDIT.md`) |
| SCALE-06 | RLS wrappée non réévaluée par ligne (InitPlan 1×) | manual-audit | MCP `execute_sql` EXPLAIN (lire nœud InitPlan) | ❌ W0 (`21-AUDIT.md`) |
| SCALE-06 | 0 nouvel advisor perf/sécu (baseline→delta) | manual-audit | MCP `get_advisors` | ❌ W0 |
| SCALE-06 | top requêtes / temps borné (médiane N=5) | manual-audit | `pg_stat_statements` (si activé) / EXPLAIN | ❌ W0 |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/web/e2e/auth.setup.ts` — setup-project login 5 rôles → storageState par rôle (D-04)
- [ ] `apps/web/e2e/fixtures/roles.ts` — emails/rôles déterministes (anon/free/abonné/affilié/superadmin)
- [ ] `apps/jobs/scripts/seed-fixtures.ts` — seed comptes E2E idempotent, distinct du seed ~10k (D-05)
- [ ] `apps/web/e2e/dash/*.spec.ts` — couverture Phase 19 (E2E-01)
- [ ] `apps/web/e2e/admin/*.spec.ts` — couverture Phase 20 (E2E-01 + E2E-02, ←20-UAT)
- [ ] `playwright.config.ts` — `projects` par rôle + `dependencies` + `webServer` (décommenter L.43-47) + `retries` CI
- [ ] `.github/workflows/ci.yml` — pipeline complet lint+typecheck+vitest+e2e (D-09 ; aucune CI n'existe — à créer)
- [ ] `.planning/phases/21-tests-e2e-audit-de-scalabilit/21-AUDIT.md` — rapport chiffré SCALE-06 (D-10)
- [ ] `.gitignore` — `playwright/.auth/`, `playwright-report/`, `test-results/`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Audit DB chiffré (EXPLAIN/advisors/pg_stat) | SCALE-06 | Exécuté via MCP Supabase contre le cloud partagé sur seed ~10k ; produit un rapport, pas un pass/fail de runner | Lancer `EXPLAIN (ANALYZE, BUFFERS)` sur chaque requête clé + `get_advisors` baseline→delta ; consigner plans + verdict D-06 dans `21-AUDIT.md` |

*Le reste des comportements de phase ont une vérification automatisée (Playwright/Vitest/CI).*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 300s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
