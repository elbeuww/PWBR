---
phase: 4
slug: moteur-ia-v-t-ran-scoring
status: ready
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-13
updated: 2026-06-14
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Mise à jour 2026-06-14 (révision --reviews) : couverture complète des 7 REQ + concerns revue.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.8 (ESM natif, partage la config Vite) |
| **Config file** | `vitest.config.ts` (racine workspace) / `packages/core/vitest.config.ts` si présent |
| **Quick run command** | `pnpm vitest run packages/core` |
| **Full suite command** | `pnpm vitest run` |
| **Estimated runtime** | ~15 s (unitaires purs : scoring, garde-fous, Zod, sanitize, path traversal) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run <package touché>`
- **After every plan wave:** Run `pnpm vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

> La colonne « Test Type » distingue golden (fixtures snapshot→{score,risk,confidence}),
> guardrail (recalcul R:R, cohérence SL/TP, structure_against, hard rules §3),
> frontier (Zod parse/reject + log job_runs.stats), security (path traversal, sanitize injection),
> et schema (DDL/RLS cross-platform).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-T1 | 01 | 1 | SCORE-01 | T-04-06 | OutputSchema §3 PERMISSIF (A1) — clés en trop non rejetées ; score/risk/confidence absents du contrat | unit (frontier) | `pnpm vitest run packages/core/__tests__/schemas/output-schema.test.ts` | ❌ W0 | ⬜ pending |
| 04-01-T2 | 01 | 1 | SCORE-05 | T-04-01, T-04-13 | DDL + RLS select-only + session_day + unique partiel (filet race) | unit (schema, cross-platform) | `pnpm vitest run packages/core/__tests__/schemas/migration-0006.test.ts` | ❌ W0 | ⬜ pending |
| 04-02-T1 | 02 | 2 | SCORE-02 | T-04-05 | R:R bord conservateur (anti-surestimation) golden long/short | unit (golden) | `pnpm vitest run packages/core/__tests__/scoring/rr.test.ts` | ❌ W0 | ⬜ pending |
| 04-02-T2 | 02 | 2 | SCORE-03 | T-04-04 | risk_level/confidence dérivés code reproductible | unit (golden) | `pnpm vitest run packages/core/__tests__/scoring/risk.test.ts packages/core/__tests__/scoring/confidence.test.ts` | ❌ W0 | ⬜ pending |
| 04-02-T3 | 02 | 2 | SCORE-02 | T-04-14 | opportunity_score décomposable + cap 45 (condition exacte) + clamp inputs [0,100] | unit (golden) | `pnpm vitest run packages/core/__tests__/scoring` | ❌ W0 | ⬜ pending |
| 04-03-T1 | 03 | 3 | SCORE-04 | T-04-06, T-04-15, T-04-08 | readRunArtifacts anti path traversal + garde-fous (structure_against, tp_bounds) + rejets normalisés | unit (frontier + security) | `pnpm vitest run apps/jobs/__tests__/runArtifacts.test.ts apps/jobs/__tests__/persist.test.ts` | ❌ W0 | ⬜ pending |
| 04-03-T2 | 03 | 3 | SCORE-05 | T-04-09 | immuabilité expiry clé session_day + valid_until 24/72h + snapshot.partial relève risk ; analyse jamais mutée | unit (guardrail) | `pnpm vitest run apps/jobs/__tests__/persist.test.ts` | ❌ W0 | ⬜ pending |
| 04-04-T1 | 04 | 4 | JOB-02 | T-04-16 | univers session ∩ actifs (crypto chaque session) + sanitizeMarketText (anti injection) | unit (golden + security) | `pnpm vitest run apps/jobs/__tests__/sessions-config.test.ts apps/jobs/__tests__/sanitize-market-text.test.ts` | ❌ W0 | ⬜ pending |
| 04-04-T2 | 04 | 4 | SCORE-01 | T-04-10 | prompt_version sha256(veteran.md) + délimiteurs <market_data> | unit | `pnpm vitest run apps/jobs/__tests__/persist.test.ts` | ❌ W0 | ⬜ pending |
| 04-04-T3 | 04 | 4 | JOB-01 | T-04-12 | routines crons UTC §5 + run réel ≥1 setup (manuel — exige agent Max) | manual | voir Manual-Only Verifications | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Couverture REQ (7/7) :** SCORE-01 (04-01-T1, 04-04-T2), SCORE-02 (04-02-T1, 04-02-T3), SCORE-03 (04-02-T2), SCORE-04 (04-03-T1), SCORE-05 (04-01-T2, 04-03-T2), JOB-01 (04-04-T3 manuel), JOB-02 (04-04-T1). Aucune REQ sans test (automatisé ou manuel justifié).

---

## Wave 0 Requirements

- [ ] Répertoire `packages/core/src/schemas/` créé (OutputSchema) + `packages/core/__tests__/schemas/`
- [ ] Répertoire `packages/core/src/scoring/__fixtures__/` (ou `__tests__/scoring/__fixtures__/`) — fixtures `setups.ts` partagées (output long/short figés) (SCORE-02)
- [ ] Golden fixtures scoring — snapshot §3 → {opportunity_score, risk_level, confidence} attendus, incluant cas cap 45 (HTF contre, catalyseur fort/absent) + cas inputs hors borne (RSI=150, ATR<0) (SCORE-01, SCORE-02, SCORE-03)
- [ ] Fixtures de garde-fous persist (`apps/jobs/__tests__/__fixtures__/run-artifacts.ts`) — payloads agent valides/invalides : R:R<1.2, SL/TP incohérents, structure_against (bos_choch contre direction), alloc_pct≠100, fence markdown (SCORE-04)
- [ ] Fixtures path traversal — run_id valides + malicieux (`../`, séparateurs) + répertoire vide (T-04-15)
- [ ] Fixtures sanitize — headline avec caractères de contrôle + « ignore previous instructions » + chaîne >280 (T-04-16)
- [ ] Fixtures d'immuabilité — clé (instrument_id, style, session, session_day) ré-analysée → expiry de l'antérieur (SCORE-05)
- [ ] Confirmer config Vitest au niveau workspace (sinon Wave 0 l'ajoute)

*Le scoring lit le snapshot §3 (déjà validé P3) — pas de dépendance candles/technicalindicators côté tests.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Raisonnement réel de l'agent vétéran (qualité du jugement, pas la forme) | JOB-01 | L'ANALYZE exige l'agent Claude Code planifié (pas d'API en P1) — non automatisable en CI | Lancer la routine sur une session démo ; vérifier que ≥1 setup valide est produit dans run-artifacts/<RUN_ID>/ + persisté, et inspecter le taux de rejet dans `job_runs.stats` |
| Déclenchement cron aux ouvertures de session UTC | JOB-01 | Dépend de l'ordonnanceur (Claude Code scheduled agents / Windows Task Scheduler) + horloge réelle | Vérifier `job_runs` après une fenêtre de session ; confirmer 1 run/session dans le budget Max |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (JOB-01 = manuel justifié : exige agent Max)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (fixtures scoring/guardrails/path-traversal/sanitize/immuabilité)
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter
- [x] Couverture des 7 REQ (SCORE-01..05, JOB-01, JOB-02) — voir Per-Task Verification Map

**Approval:** ready (révisé 2026-06-14 post cross-review)
