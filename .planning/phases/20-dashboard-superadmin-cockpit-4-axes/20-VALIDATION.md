---
phase: 20
slug: dashboard-superadmin-cockpit-4-axes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-26
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x |
| **Config file** | `apps/web/vitest.config.ts` (existing) |
| **Quick run command** | `pnpm --filter web test -- --run` |
| **Full suite command** | `pnpm --filter web test -- --run && pnpm --filter web typecheck` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter web test -- --run`
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

> Filled in by the planner against the final PLAN.md task IDs. Threat refs map to each PLAN.md `<threat_model>` block.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 0 | ADASH-04/07 | T-20-01 | Non-superadmin → 404 + 0 ligne cross-tenant (anon+RLS) | unit | `pnpm --filter web test -- --run admin-rls` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/web/test/admin-rls.test.ts` — RLS cross-tenant 0-fuite : un non-superadmin (anon-client) lit 0 ligne sur chaque table admin (profiles, telegram_posts, candles, payments, payouts, subscriptions) ; gating 404
- [ ] Extension `rls-unchanged` / IDOR test au groupe `(admin)` — calque pattern anti-IDOR P18 D-07
- [ ] `apps/web/test/no-perf-claims.test.ts` + `no-perf-seed-claims.test.ts` — étendre le namespace de scan aux pages `(admin)` (D-13) : aucun chiffre de performance fabriqué côté admin
- [ ] `apps/web/src/lib/admin/searchParams.ts` — helper filtres serveur keyset (état abo / source / recherche), stub + test calque P19

*Existing infrastructure (vitest) couvre le reste — pas d'installation de framework requise.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Atomicité RPC `grant_subscription_time` / `suspend_account` + écriture `admin_audit_log` dans la même transaction | ADASH-04 | Nécessite exécution SQL live (MCP) + inspection `admin_audit_log` post-action | Via MCP `execute_sql` : appeler le RPC en tant que superadmin, vérifier prolongation abo ET 1 ligne audit (acteur/cible/action) ; appeler en tant que non-superadmin → exception gate |
| `EXPLAIN ANALYZE` funnel/churn/mix sur seed ~10k pour trancher matview vs à-la-volée (D-10, A3) | ADASH-01/02 | Décision de perf basée sur plan d'exécution réel | Via MCP `execute_sql` : `EXPLAIN ANALYZE` chaque RPC KPI ; si coût justifie → matview+wrapper, sinon à-la-volée |
| Suspension = barrière réelle (compte suspendu réellement bloqué, pas UI seule) | ADASH-04 | Flux auth end-to-end (signOut + 0 ligne RLS) | Suspendre un compte test via RPC, vérifier accès refusé au login (gate `requireUser`) ET 0 ligne via RLS |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
