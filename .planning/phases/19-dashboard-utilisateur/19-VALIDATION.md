---
phase: 19
slug: dashboard-utilisateur
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-26
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Dérivée de `19-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.8 (root `package.json`, `test: vitest run`) |
| **Config file** | racine (workspace) — voir `packages/supabase/__tests__/*` + `apps/web/test/*` |
| **Quick run command** | `pnpm vitest run <fichier>` |
| **Full suite command** | `pnpm test` (617 tests verts au dernier état P17) |
| **Estimated runtime** | ~30 s (suite complète) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run <fichier touché>`
- **After every plan wave:** Run `pnpm test` (suite complète) + `pnpm tsc --noEmit` (typecheck vert)
- **Before `/gsd:verify-work`:** suite verte + `get_advisors(performance)` 0 `auth_rls_initplan` + `get_advisors(security)` 0 nouvelle alerte + EXPLAIN keyset Index Scan
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| UDASH-03 | Non-propriétaire écrit 0 ligne d'autrui (anti-IDOR insert) | integration (RLS live, anon-client) | `pnpm vitest run packages/supabase/.../user-followed-rls.test.ts` | ❌ W0 (calquer `seed-rls.test.ts`) | ⬜ pending |
| UDASH-03 | Abonné lit/insère/supprime SA watchlist | integration | idem | ❌ W0 | ⬜ pending |
| UDASH-03 | Toggle optimiste : rollback + toast si erreur | unit (composant, mock mutation) | `pnpm vitest run apps/web/.../WatchlistToggle.test.tsx` | ❌ W0 | ⬜ pending |
| UDASH-02 | Curseur keyset : encode/decode round-trip + curseur corrompu → null | unit | `pnpm vitest run apps/web/src/lib/keyset/__tests__/cursor.test.ts` | ❌ W0 | ⬜ pending |
| UDASH-02 | Pas de trou/doublon entre 2 pages keyset (timestamps égaux) | integration | idem RLS file | ❌ W0 | ⬜ pending |
| UDASH-02 | EXPLAIN keyset = Index Scan (pas Seq+Sort) | DB gate (manuel MCP) | `execute_sql` EXPLAIN (gabarit 0017 (b)) | ❌ gate manuel | ⬜ pending |
| UDASH-01 | Overview ne rend AUCUN chiffre de perf fabriqué | unit (no-perf-claims) | `pnpm vitest run apps/web/test/no-perf-seed-claims.test.ts` (étendre) | ⚠️ existe, étendre | ⬜ pending |
| UDASH-04 | ExpiryBanner rendu dans le shell (anti-orphelin WIRING-01) | unit/intégration rendu | assert présence dans layout `(dash)` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/supabase/.../__tests__/user-followed-rls.test.ts` — anti-IDOR insert/delete/select (calquer `seed-rls.test.ts`, `describe.skipIf(!HAS_ENV)`)
- [ ] `apps/web/src/lib/keyset/__tests__/cursor.test.ts` — round-trip + curseur corrompu
- [ ] `apps/web/src/components/dash/__tests__/WatchlistToggle.test.tsx` — optimiste + rollback
- [ ] Étendre `apps/web/test/no-perf-seed-claims.test.ts` pour couvrir l'overview `(dash)`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| EXPLAIN keyset = Index Scan à l'échelle seed | UDASH-02 | Nécessite la DB live ~10k + MCP `execute_sql` (non automatisable en Vitest) | Exécuter `EXPLAIN ANALYZE` sur la requête keyset suivis/historique (gabarit 0017 (b)) → vérifier Index Scan, pas Seq Scan + Sort |
| Advisors perf/sécurité 0 nouvelle alerte | UDASH-02/03 | `get_advisors` via MCP Supabase | `get_advisors(performance)` → 0 `auth_rls_initplan` ; `get_advisors(security)` → 0 nouvelle alerte après migration 0020 |
| RLS join `!inner` pour abonné expiré → 0 ligne (A2) | UDASH-02 | Nécessite session abonné expiré live | Tester en session abonné `current_period_end` passé → suivis/historique retournent 0 ligne |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (4 fichiers ci-dessus)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
