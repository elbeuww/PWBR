---
phase: 4
slug: moteur-ia-v-t-ran-scoring
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-13
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.8 (ESM natif, partage la config Vite) |
| **Config file** | `vitest.config.ts` (racine workspace) / `packages/core/vitest.config.ts` si présent |
| **Quick run command** | `pnpm vitest run packages/core` |
| **Full suite command** | `pnpm vitest run` |
| **Estimated runtime** | ~15 s (unitaires purs : scoring, garde-fous, Zod) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run <package touché>`
- **After every plan wave:** Run `pnpm vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

> Dérivée pendant l'exécution depuis les `<acceptance_criteria>` des PLAN.md. La colonne « Test Type »
> distingue golden (fixtures snapshot→{score,risk,confidence}), guardrail (recalcul R:R, cohérence SL/TP,
> hard rules §3), et frontier (Zod parse/reject + log job_runs.stats).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-XX-XX | XX | X | SCORE-01 | — | scoring déterministe reproductible (golden) | unit (golden) | `pnpm vitest run packages/core` | ❌ W0 | ⬜ pending |
| 04-XX-XX | XX | X | SCORE-03 | — | sortie non conforme rejetée + loggée (T-02-13 : messages normalisés) | unit (frontier) | `pnpm vitest run apps/jobs` | ❌ W0 | ⬜ pending |
| 04-XX-XX | XX | X | SCORE-04 | — | analyse jamais mutée ; ancienne marquée expired à l'insert | unit (guardrail) | `pnpm vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Golden fixtures `packages/core/src/scoring/__fixtures__/*.json` — snapshot §3 → {opportunity_score, risk_level, confidence} attendus (SCORE-01, SCORE-02, SCORE-05)
- [ ] Fixtures de garde-fous — payloads agent valides/invalides pour persist.ts (R:R<1.2, SL/TP incohérents, hard rules §3) (SCORE-03)
- [ ] Fixtures d'immuabilité — clé (instrument,style,session,jour) ré-analysée → expiry de l'antérieur (SCORE-04)
- [ ] Confirmer config Vitest au niveau workspace (sinon Wave 0 l'ajoute)

*Le scoring lit le snapshot §3 (déjà validé P3) — pas de dépendance candles/technicalindicators côté tests.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Raisonnement réel de l'agent vétéran (qualité du JugeMENT, pas la forme) | JOB-01 | L'ANALYZE exige l'agent Claude Code planifié (pas d'API en P1) — non automatisable en CI | Lancer la routine sur une session démo ; vérifier que ≥1 setup valide est produit + persisté, et inspecter le taux de rejet dans `job_runs.stats` |
| Déclenchement cron aux ouvertures de session UTC | JOB-02 | Dépend de l'ordonnanceur (Croner / Windows Task Scheduler) + horloge réelle | Vérifier `job_runs` après une fenêtre de session ; confirmer 1 run/session dans le budget Max |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
