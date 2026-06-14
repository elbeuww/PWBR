---
phase: 03
slug: espace-membre-signaux-gated-rls
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-15
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Détail des dimensions testables dans `03-RESEARCH.md` → section « Validation Architecture ».

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x (unit/intégration) + Playwright 1.60 (E2E + RLS) |
| **Config file** | `apps/web/vitest.config.ts` / `playwright.config.ts` (à confirmer Wave 0) |
| **Quick run command** | `pnpm vitest run` |
| **Full suite command** | `pnpm vitest run && pnpm playwright test` |
| **Estimated runtime** | ~60–120 secondes |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run`
- **After every plan wave:** Run `pnpm vitest run && pnpm playwright test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 120 secondes

---

## Per-Task Verification Map

> À compléter par le planner / Wave 0. Dimensions critiques issues de la recherche :
> (a) gating RLS lecture `trade_setups`/`candles` pour abonné vs non-abonné, (b) Realtime postgres_changes
> filtré par RLS, (c) affichage VERBATIM du contenu IA, (d) repli « facteurs contributifs » si breakdown absent.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD-01 | TBD | 1 | MEMB-01 | T-03-RLS | Abonné lit setups actifs ; non-abonné = 0 ligne | e2e | `pnpm playwright test signals-rls` | ❌ W0 | ⬜ pending |
| TBD-02 | TBD | 2 | MEMB-03 | — | veteran_note/raisons rendues VERBATIM (pas de reformulation) | unit | `pnpm vitest run signal-detail` | ❌ W0 | ⬜ pending |
| TBD-03 | TBD | 2 | MEMB-04 | T-03-RT | Realtime INSERT visible abonné, filtré RLS | e2e | `pnpm playwright test signals-realtime` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/web/vitest.config.ts` + `playwright.config.ts` — confirmer/installer la config tests web si absente.
- [ ] Fixtures RLS Playwright : un user abonné (`has_active_subscription()` = true) et un user non-abonné, pour prouver l'isolement.
- [ ] Installer libs manquantes du lockfile web (lightweight-charts 5.2.0, @tanstack/react-query 5.101.0) avant tout test de composant.

*Le planner doit transformer ces stubs en tâches Wave 0 concrètes.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Rendu visuel du chart (entrée/SL/TP tracés correctement) | MEMB-03 | Canvas lightweight-charts difficile à assert pixel-près | Ouvrir un détail signal, vérifier visuellement les price lines entrée=neutre / SL=rouge / TP=vert + légendes texte |
| Badge Realtime « N nouveaux » + repli silencieux si WS tombe | MEMB-04 | Coupure WebSocket dure à simuler en CI de façon fiable | Couper le réseau, vérifier que la liste revalidate sans erreur visible |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
