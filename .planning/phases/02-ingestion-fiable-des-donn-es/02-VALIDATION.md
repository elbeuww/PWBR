---
phase: 2
slug: ingestion-fiable-des-donn-es
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-12
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.8 (installé Phase 1, config racine `vitest.config.ts` + `.env.test` via `process.loadEnvFile`) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `pnpm vitest run --changed` |
| **Full suite command** | `pnpm vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run --changed`
- **After every plan wave:** Run `pnpm vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| *(rempli par le planner — voir Wave 0 ci-dessous pour les tests qui définissent la phase)* | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test d'idempotence (DATA-06) — un re-run complet d'ingestion ne change aucune ligne (upsert onConflict)
- [ ] Test d'isolation des pannes (DATA-07) — une source en échec (mauvaise clé API) n'interrompt pas les autres
- [ ] Tests golden values des parsers Zod par source (OANDA, Binance, Finnhub, FRED, FairEconomy)
- [ ] Test de staleness — seuil 2× timeframe avec prise en compte des horaires de cotation (forex week-end ≠ stale)
- [ ] Test gap-fill — reprise depuis la dernière bougie en base (pas de doublon, pas de trou)

*Framework déjà installé (Phase 1) — aucune installation Wave 0 nécessaire.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Disponibilité WTICO_USD + instruments sur le compte démo OANDA réel | DATA-01 | Dépend du compte démo spécifique de l'utilisateur | Au 1er run réel : `GET /v3/accounts/{id}/instruments` — vérifier la présence des 7 instruments OANDA |
| Run réel via Task Scheduler (`run-job.cmd`) hors agent | DATA-04 | Exécution Windows réelle non simulable en CI | Lancer le `.cmd`, vérifier exit 0 + ligne `job_runs` cloud |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
