---
phase: 17
slug: fondation-db-scalable-perf-avant-charge
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-24
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: dérivé de `17-RESEARCH.md` §"Validation Architecture" + §"Security Domain".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.8 (unit/intégration) + Playwright 1.60.0 (E2E) |
| **Config file** | `vitest.config.ts` (racine) ; script `test:e2e` sous `apps/web` (pas de `playwright.config` dédié détecté) |
| **Quick run command** | `pnpm test` (= `vitest run`) |
| **Full suite command** | `pnpm test && pnpm typecheck` (`tsc -b --noEmit`) |
| **Estimated runtime** | ~30–60 s (Vitest) ; gates MCP LIVE hors CI |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test`
- **After every plan wave:** Run `pnpm test && pnpm typecheck`
- **Before `/gsd:verify-work`:** Full suite green + **gate MCP D-05** :
  `get_advisors(performance)` = 0 `auth_rls_initplan` · `EXPLAIN` index scan sans tri (3 listes) · `REFRESH CONCURRENTLY` OK · 0 index `INVALID` · tests RLS anon-client verts.
- **Max feedback latency:** ~60 s (Vitest) ; gates LIVE = manuels au checkpoint.

---

## Per-Task Verification Map

> Task IDs assignés par le planner. Mapping Requirement → comportement vérifiable ci-dessous ;
> à raffiner en `{plan}-{task}` une fois les PLAN.md écrits.

| Req | Wave | Behavior | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|-----|------|----------|------------|-----------------|-----------|-------------------|-------------|--------|
| SCALE-01 | post-migration | `get_advisors(performance)` = 0 `auth_rls_initplan` | T-17-RLS | Wrap `(select …)` préserve isolation | LIVE/MCP | `get_advisors(type=performance)` | ❌ gate manuel | ⬜ pending |
| SCALE-01 | post-migration | Non-abonné lit 0 ligne après wrap (pas de régression) | T-17-RLS | RLS non contournable | E2E anon-client | réutiliser `signals-rls` / `gating-rls` specs | ✅ existant | ⬜ pending |
| SCALE-02 | post-migration | `EXPLAIN` liste cible = Index Scan (pas Seq Scan + Sort) | — | N/A | LIVE/MCP | `execute_sql("EXPLAIN <keyset>")` | ❌ gate manuel | ⬜ pending |
| SCALE-03 | post-migration | `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_mrr` réussit | T-17-MV | unique index requis | LIVE/MCP | `execute_sql` refresh | ❌ gate manuel | ⬜ pending |
| SCALE-03 | unit | `get_mrr()` interdit hors superadmin | T-17-MV | Wrapper SECURITY DEFINER gated | unit RLS anon | `pnpm test` (mrr-gating) | ❌ W0 | ⬜ pending |
| SCALE-04 | post-migration | Aucun index `INVALID` après application | — | N/A | LIVE/MCP | `execute_sql` sur `pg_index.indisvalid=false` | ❌ gate manuel | ⬜ pending |
| SCALE-05 | E2E | Badge MAJ via Broadcast ; non-abonné ne reçoit rien | T-17-BC | RLS `realtime.messages` réplique `has_active_subscription()` | E2E/Manual | `apps/web` `test:e2e` badge | ⚠️ Manual-Only | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky/manual*

---

## Wave 0 Requirements

- [ ] `apps/web/tests/mrr-gating.test.ts` — `get_mrr()` via client anon → 0 ligne (SCALE-03 gating ; miroir des tests RLS existants)
- [ ] Script de gate SQL réutilisable, commenté dans `0017` : détection index `INVALID` + `EXPLAIN` des 3 listes keyset (SCALE-02/04, exécuté via MCP `execute_sql`)
- [ ] Pas de nouveau framework — Vitest + Playwright déjà en place

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `get_advisors(performance)` 100% vert | SCALE-01 | Exige connexion DB LIVE (MCP), non automatisable en Vitest CI | Au checkpoint D-05, appeler `get_advisors(type=performance)` ; 0 `auth_rls_initplan` |
| `EXPLAIN` index scan sans tri (3 listes) | SCALE-02 | Exige DB LIVE + plan d'exécution réel | `execute_sql("EXPLAIN <requête keyset>")` par liste ; vérifier absence de Sort/Seq Scan |
| `REFRESH CONCURRENTLY` + 0 index INVALID | SCALE-03/04 | Exige DB LIVE post-CONCURRENTLY | `execute_sql` refresh + requête `indisvalid=false` |
| Badge Broadcast (abonné voit / anon non) | SCALE-05 | Exige Realtime live + 2 sessions (même dépendance que P03 deferred) | Documenter en `17-HUMAN-UAT.md` : session abonnée reçoit l'event, session anon non |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
