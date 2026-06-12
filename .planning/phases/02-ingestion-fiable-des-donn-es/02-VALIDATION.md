---
phase: 2
slug: ingestion-fiable-des-donn-es
status: draft
nyquist_compliant: true
wave_0_complete: true
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
| 01-T1 | 02-01 | 1 | DATA-06 | T-02-01..03 | RLS active sur les 4 tables d'ingestion | structural (grep RLS) | `grep -v '^--' supabase/migrations/0003_data_ingestion_tables.sql \| grep -c "enable row level security"` (≥ 4) | migration 0003 | ⬜ pending |
| 01-T2 | 02-01 | 1 | DATA-06 | T-02-02 | clés API jamais commitées (.env local) | manual (checkpoint blocking) | — (checkpoint:human-action — apply_migration + saisie clés) | .env / database.types.ts | ⬜ pending |
| 01-T3 | 02-01 | 1 | DATA-06 | T-02-03 | upsert idempotent (re-run = 0 doublon) | integration (Wave 0 idempotence) | `pnpm vitest run packages/supabase/__tests__/idempotency.test.ts` | idempotency.test.ts | ⬜ pending |
| 02-T1 | 02-02 | 2 | DATA-01, DATA-02 | T-02-04, T-02-07 | parse Zod frontière + anti look-ahead (complete:true) | golden (Wave 0 parsers OANDA/Binance) | `pnpm vitest run packages/data-sources` | binance/oanda schema.test.ts | ⬜ pending |
| 02-T2 | 02-02 | 2 | DATA-01, DATA-02, DATA-05, DATA-06 | T-02-06, T-02-07 | gap-fill borne exclusive + isolation par instrument | unit (Wave 0 gap-fill) | `pnpm vitest run apps/jobs/__tests__/gap-fill.test.ts` | gap-fill.test.ts | ⬜ pending |
| 03-T1 | 02-03 | 3 | DATA-03 | T-02-08, T-02-11 | parse Zod tolérant news/macro/calendrier (exclusion '.', enum impact) | golden (Wave 0 parsers Finnhub/FRED/FairEconomy) | `pnpm vitest run packages/data-sources` | finnhub/fred/faireconomy schema.test.ts | ⬜ pending |
| 04-T1 | 02-04 | 4 | DATA-04 | T-02-10, T-02-13 | dispatch + jobs compilent (imports résolus) | structural + typecheck | `grep -E "news-ingest\|macro-ingest\|calendar-ingest" apps/jobs/src/dispatch.ts \| grep -v '^#' \| grep -c ":"` (≥ 3) && `pnpm --filter @app/jobs exec tsc --noEmit` | dispatch.ts + 3 jobs | ⬜ pending |
| 04-T2 | 02-04 | 4 | DATA-07 | T-02-12 | source coupée n'interrompt pas les autres + staleness exposée | integration (Wave 0 fault-isolation) | `pnpm vitest run apps/jobs/__tests__/fault-isolation.test.ts` | fault-isolation.test.ts | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

> Tous les tests Wave 0 sont créés **inline** par les tasks des plans (aucune installation Wave 0 séparée — framework Phase 1).

- [x] Test d'idempotence (DATA-06) — un re-run complet d'ingestion ne change aucune ligne (upsert onConflict) → `idempotency.test.ts` (02-01 T3)
- [x] Test d'isolation des pannes (DATA-07) — une source en échec (mauvaise clé API) n'interrompt pas les autres → `fault-isolation.test.ts` (02-04 T2)
- [x] Tests golden values des parsers Zod par source (OANDA, Binance → 02-02 T1 ; Finnhub, FRED, FairEconomy → 02-03 T1)
- [x] Test de staleness — vue `v_data_freshness` interrogeable + colonne `is_stale` (forex week-end ≠ stale, géré par la vue de la migration 0003) → asserté dans `fault-isolation.test.ts` (02-04 T2) ; logique horaires de cotation dans la vue (02-01 T1)
- [x] Test gap-fill — reprise depuis la dernière bougie en base (fenêtre since/until correcte, 1er run = backfill) → `gap-fill.test.ts` (02-02 T2)

*Framework déjà installé (Phase 1) — aucune installation Wave 0 nécessaire.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Disponibilité WTICO_USD + instruments sur le compte démo OANDA réel | DATA-01 | Dépend du compte démo spécifique de l'utilisateur | Au 1er run réel : `GET /v3/accounts/{id}/instruments` — vérifier la présence des 7 instruments OANDA (RESEARCH §Open Questions RESOLVED Q1, mitigation D-20) |
| Run réel via Task Scheduler (`run-job.cmd`) hors agent | DATA-04 | Exécution Windows réelle non simulable en CI | Lancer le `.cmd`, vérifier exit 0 + ligne `job_runs` cloud |
| Application de la migration 0003 + saisie des clés API | DATA-06 | Secrets (clés OANDA/FRED/Finnhub) — action humaine | Checkpoint blocking 02-01 T2 : apply_migration cloud + saisie `.env` jobs |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (02-01 T2 = checkpoint blocking documenté ; toutes les autres ont une commande automatisée)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
</content>
