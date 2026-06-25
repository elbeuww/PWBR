---
phase: 17
slug: fondation-db-scalable-perf-avant-charge
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-24
validated: 2026-06-25
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
| SCALE-01 | post-migration | `get_advisors(performance)` = 0 `auth_rls_initplan` | T-17-RLS | Wrap `(select …)` préserve isolation | LIVE/MCP | `get_advisors(type=performance)` | ⚠️ gate manuel | ⚠️ PASS (gate 1, 17-03) |
| SCALE-01 | post-migration | Non-abonné lit 0 ligne après wrap (pas de régression) | T-17-RLS | RLS non contournable | E2E anon-client | `apps/web/tests/signals-rls.spec.ts` (+ `gating-rls.test.ts`) | ✅ existant | ✅ green |
| SCALE-02 | post-migration | `EXPLAIN` liste cible = Index Scan (pas Seq Scan + Sort) | — | N/A | LIVE/MCP | `execute_sql("EXPLAIN <keyset>")` | ⚠️ gate manuel | ⚠️ PASS (gate 3, 17-03 ; trade_setups prouvé `enable_seqscan=off`) |
| SCALE-03 | post-migration | `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_mrr` réussit | T-17-MV | unique index requis | LIVE/MCP | `execute_sql` refresh | ⚠️ gate manuel | ⚠️ PASS (gate 4, 17-03) |
| SCALE-03 | unit | `get_mrr()` interdit hors superadmin | T-17-MV | Wrapper SECURITY DEFINER gated | unit RLS anon | `pnpm test` (`apps/web/tests/mrr-gating.test.ts`) | ✅ existant | ✅ green (assertif post-0017 LIVE) |
| SCALE-04 | post-migration | Aucun index `INVALID` après application | — | N/A | LIVE/MCP | `execute_sql` sur `pg_index.indisvalid=false` | ⚠️ gate manuel | ⚠️ PASS (gate 5, 17-03) |
| SCALE-05 | E2E | Badge MAJ via Broadcast ; non-abonné ne reçoit rien | T-17-BC | RLS `realtime.messages` réplique `has_active_subscription()` | E2E/Manual | UAT navigateur (gate 7 / `17-HUMAN-UAT.md`) | ⚠️ Manual-Only | ✅ PASS (UAT 5/5, Gate 7 levé) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ manuel PASS*

---

## Wave 0 Requirements

- [x] `apps/web/tests/mrr-gating.test.ts` — `get_mrr()` via client anon → 0 ligne (SCALE-03 gating ; miroir des tests RLS existants) — **créé 17-02, assertif post-0017 LIVE (gate 6)**
- [x] Script de gate SQL réutilisable, commenté dans `0017` : détection index `INVALID` + `EXPLAIN` des 3 listes keyset (SCALE-02/04, exécuté via MCP `execute_sql`) — **exécuté en 17-03 (gates 3/5)**
- [x] Pas de nouveau framework — Vitest + Playwright déjà en place

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

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (2 automatisés + 4 gates LIVE/MCP manuels justifiés + 1 E2E UAT)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (mrr-gating + script de gate — 0 référence MISSING restante)
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-25 — 0 gap automatisable ; couverture LIVE/UAT complète.

---

## Validation Audit 2026-06-25

> État A (audit du VALIDATION.md existant). Phase exécutée LIVE intégralement (plans 17-01 authoring → 17-02 client + Wave-0 → 17-03 application LIVE 0017) ; UAT humain 5/5, Gate 7 (Broadcast) levé.

| Metric | Count |
|--------|-------|
| Gaps found (automatisables, MISSING) | 0 |
| Resolved (tests générés) | 0 |
| Escalated (→ manual-only) | 0 |
| Couverture automatisée | 2 (`mrr-gating.test.ts` SCALE-03, `signals-rls.spec.ts` SCALE-01) |
| Gates LIVE/MCP manuels (justifiés, PASS) | 4 (SCALE-01 advisors, SCALE-02 EXPLAIN, SCALE-03 REFRESH, SCALE-04 INVALID) |
| E2E manuel UAT (PASS) | 1 (SCALE-05 Broadcast, Gate 7) |

**Verdict : VALIDATED (PARTIAL).** Aucun gap automatisable détecté — tout comportement automatisable a un test vert. Les 4 gates restants exigent une connexion DB LIVE via MCP (advisors / `EXPLAIN` / `REFRESH CONCURRENTLY` / `pg_index.indisvalid`) et sont non-automatisables en Vitest CI : classés manual-only justifiés et **tous PASS** au gate D-05 (17-03). SCALE-05 (Broadcast runtime) validé en UAT navigateur réel. Aucun spawn `gsd-nyquist-auditor` requis (rien à générer).
