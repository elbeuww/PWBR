---
phase: 5
slug: track-record-mesur-affich
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-15
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 05-RESEARCH.md § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.8 (ESM natif, golden tests) |
| **Config file** | racine workspace (config Vitest partagée) ; tests jobs sous `apps/jobs/src/jobs/__tests__/` |
| **Quick run command** | `pnpm vitest run packages/core/src/replay` |
| **Full suite command** | `pnpm vitest run` |
| **Estimated runtime** | ~30 secondes (quick) / suite complète selon volume |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run packages/core/src/replay`
- **After every plan wave:** Run `pnpm vitest run`
- **Before `/gsd:verify-work`:** Full suite green ET `get_advisors` (security) sans alerte sur exposition de `prediction_outcomes`
- **Max feedback latency:** ~30 secondes (quick run)

---

## Per-Task Verification Map

| Req ID | Behavior | Wave | Test Type | Automated Command | File Exists | Status |
|--------|----------|------|-----------|-------------------|-------------|--------|
| TRACK-01 | first-touch hit_tp simple | 1 | unit (golden) | `pnpm vitest run packages/core/src/replay/outcome.test.ts` | ❌ W0 | ⬜ pending |
| TRACK-01 | first-touch hit_sl simple | 1 | unit (golden) | idem | ❌ W0 | ⬜ pending |
| TRACK-01 | cas ambigu D-04 (TP+SL même bougie, règle distance) | 1 | unit (golden) | idem | ❌ W0 | ⬜ pending |
| TRACK-01 | flat D-02 (R au close valid_until, long ET short) | 1 | unit (golden) | idem | ❌ W0 | ⬜ pending |
| TRACK-01 | idempotence (2e run = 0 insert) | 1 | integration | `pnpm vitest run apps/jobs/src/jobs/__tests__/outcome-tracker.test.ts` | ❌ W0 | ⬜ pending |
| TRACK-02 | agrégat win_rate/R moyen/expectancy par dimension | 1 | integration (SQL/vue) | test de la vue (fixtures) | ❌ W0 | ⬜ pending |
| TRACK-03 | seuil N≥30 → % ; N<30 → « échantillon insuffisant » | 1 | unit (TS display) | test du helper d'affichage | ❌ W0 | ⬜ pending |
| TRACK-03 | RLS anon lit `pattern_stats`, PAS `prediction_outcomes` | 1 | e2e/integration (RLS) | Playwright + `get_advisors` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/core/src/replay/outcome.test.ts` — golden tests first-touch (TRACK-01), 5 cas : hit_tp, hit_sl, ambigu D-04, flat long, flat short
- [ ] `apps/jobs/src/jobs/__tests__/outcome-tracker.test.ts` — idempotence + sélection bornée des setups expirés (miroir de `subscription-expiry.test.ts` existant)
- [ ] Fixtures candles H1 synthétiques (séquences OHLC contrôlées) pour les golden tests
- [ ] Test RLS : un client `anon` peut SELECT `pattern_stats` mais reçoit 0 ligne / erreur sur `prediction_outcomes`
- [ ] Test du helper d'affichage seuil N≥30 (TRACK-03)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Lecture publique réelle de `pattern_stats` depuis la vitrine sans session | TRACK-03 | Vérification RLS de bout en bout en navigateur (première policy `anon` du projet) | Charger la vitrine en navigation privée (non connecté), confirmer affichage des agrégats N≥30 et masquage « échantillon insuffisant » sous le seuil |
| Aucune fuite de `prediction_outcomes` par setup au client `anon` | TRACK-03 | Confirmation sécurité (advisor + tentative manuelle) | `get_advisors` après migration + tentative SELECT `prediction_outcomes` en client anon → doit échouer / 0 ligne |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
