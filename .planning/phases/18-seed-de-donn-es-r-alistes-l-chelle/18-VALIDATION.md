---
phase: 18
slug: seed-de-donn-es-r-alistes-l-chelle
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-25
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.8 |
| **Config file** | `vitest.config.ts` (racine — charge `.env.test` natif) |
| **Quick run command** | `pnpm test -- <fichier ciblé>` |
| **Full suite command** | `pnpm test` + `pnpm typecheck` |
| **Estimated runtime** | ~30s (unit) ; intégration DB gated par `skipIf(!HAS_ENV)` |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test -- <fichier ciblé>` + `pnpm typecheck`
- **After every plan wave:** Run `pnpm test` (suite complète)
- **Before `/gsd:verify-work`:** Full suite must be green + re-run seed manuel prouvant N stable + `get_advisors(security)` confirme `source` n'ouvre aucune fuite RLS
- **Max feedback latency:** ~30 seconds (tests unitaires statiques) ; tests intégration DB hors latence CI (skipIf)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 18-XX-XX | XX | 1 | SEED-02 | — | Aucun % de perf seedé (scan code statique) | unit | `pnpm test -- no-perf-seed-claims` | ❌ W0 | ⬜ pending |
| 18-XX-XX | XX | 1 | SEED-03 | T-18 V4 | Non-abonné lit 0 signal (anon) + isolation cross-user | integration (skipIf) | `pnpm test -- seed-rls` | ❌ W0 | ⬜ pending |
| 18-XX-XX | XX | 2 | SEED-01 | — | Seed idempotent FK-cohérent, re-run → N stable | integration (skipIf) | `pnpm test -- seed` (2 runs → COUNT identique) | ❌ W0 | ⬜ pending |
| 18-XX-XX | XX | 2 | SEED-02 | T-18 V5 | Labellisation `source` requêtable (`source='demo' > 0`) | integration (skipIf) | `pnpm test -- seed` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs to be finalized by the planner from the produced PLAN.md files.*

---

## Wave 0 Requirements

- [ ] `apps/web/test/no-perf-seed-claims.test.ts` — scan statique du code seed (SEED-02, toujours exécutable en CI, sans DB)
- [ ] `packages/supabase/src/repositories/__tests__/seed-rls.test.ts` — preuve RLS anon (SEED-03), `describe.skipIf(!HAS_ENV)`, calqué sur `affiliate-rls.test.ts`
- [ ] Migration `0018_seed_source_column.sql` — colonne `source` (gate avant tout seed)
- [ ] `@faker-js/faker` ajouté en devDep (`pnpm add -D -w @faker-js/faker`)
- [ ] Structure seed `apps/jobs/scripts/seed/*` avec config volumes/ratios isolée (testabilité)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Application LIVE de la migration 0018 via MCP Supabase | SEED-02 (D-01) | Le projet applique les migrations LIVE via MCP `apply_migration`, pas `supabase db push` ; non automatisable en suite Vitest | Appliquer `0018_seed_source_column.sql` via MCP, puis `generate_typescript_types` → ré-éditer `database.types.ts`, puis `get_advisors(security)` |
| Refresh `mv_mrr` post-seed + MRR visible | ADASH-02 | Dépend de l'index `mv_mrr_month_idx` (à vérifier LIVE) ; effet sur matview observé hors suite unitaire | Après seed : `REFRESH MATERIALIZED VIEW [CONCURRENTLY] mv_mrr` puis vérifier MRR > 0 mesuré |
| Re-run seed à l'échelle → N stable (perf `auth.admin.createUser`) | SEED-01 (D-06) | Coût réel à ~10k users hors budget latence CI ; prévoir mode N réduit paramétrable | Lancer seed 2× en local avec env LIVE → asserter COUNT identique + absence d'accumulation |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
