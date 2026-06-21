---
phase: 12
slug: routines-d-analyse-claude-planifi-es-sans-api
status: ready
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-21
updated: 2026-06-21
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> ⚠️ Phase nature : CONFIGURATION + ACTIVATION + 1 run réel + monitoring. La majorité des
> livrables sont des étapes de config cloud (hors git) gatées par des checkpoints manuels
> avec des outcomes observables. Le code committé se limite à 3 tests Wave-0 (plan 01),
> 1 runbook doc (plan 02) et 1 vérif .gitignore.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.8 (+ Playwright 1.60 pour /admin/sante) |
| **Config file** | `apps/jobs` vitest config (existant) |
| **Quick run command** | `pnpm --filter jobs exec vitest run <fichier>` |
| **Full suite command** | `pnpm --filter jobs exec vitest run` |
| **Estimated runtime** | ~20-30 secondes (suite jobs) |

---

## Sampling Rate

- **After every task commit:** `pnpm --filter jobs exec vitest run` (jobs) — < 30 s
- **After every plan wave:** suite jobs complète + (Wave 3+) vérif /admin/sante
- **Before `/gsd:verify-work`:** suite jobs verte ET 1 run réel newyork end-to-end vert (≥1 setup) + egress confirmé AVANT élargissement asia/london
- **Max feedback latency:** 30 secondes (tests automatisés) ; gates manuels = à la fenêtre de run cloud

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command / Observable | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------------------|-------------|--------|
| 12-01-01 | 01 | 1 | ROUTINE-03 | T-12-01 | true-empty (no_artifacts) ≠ erreur pipeline ; all-rejected (rejected>0) throw WR-04 ; insertAnalysis non appelé sur vide | unit | `pnpm --filter jobs exec vitest run __tests__/routine-persist-empty.test.ts` | ❌ W0 (créé plan 01) | ⬜ pending |
| 12-01-02 | 01 | 1 | ROUTINE-04 | T-12-03 | expirePriorSetups AVANT insert ; session_day stable au re-run (pas de doublon) | unit | `pnpm --filter jobs exec vitest run __tests__/routine-idempotence.test.ts` | ❌ W0 (créé plan 01) | ⬜ pending |
| 12-01-03 | 01 | 1 | ROUTINE-05 | T-12-02 | aucun import MCP / @anthropic-ai/sdk / ANTHROPIC_API_KEY dans apps/jobs/src (commentaires exclus) ; createClient présent | static-check | `pnpm --filter jobs exec vitest run __tests__/routine-no-mcp.test.ts` | ❌ W0 (créé plan 01) | ⬜ pending |
| 12-02-01 | 02 | 1 | ROUTINE-01 | T-12-06 | runbook documente Custom + *.supabase.co obligatoire ; chaînes stale supprimées | doc-grep | `grep -v '^#' docs/routines-claude.md \| grep -c 'supabase.co'` ≥1 ; chaînes stale = 0 | ✅ (edit) | ⬜ pending |
| 12-02-02 | 02 | 1 | ROUTINE-05 | T-12-04 / T-12-05 | runbook documente single-run, RUN_ID, P-SECRET, P-MCP, sémantique calme | doc-grep | `grep -v '^#' docs/routines-claude.md \| grep -cE 'RUN_ID\|single-run\|SERVICE_ROLE'` ≥1 | ✅ (edit) | ⬜ pending |
| 12-02-03 | 02 | 1 | ROUTINE-01 | — | run-artifacts/ gitignoré ; aucun artefact tracké | config-grep | `grep -c '^run-artifacts/$' .gitignore` =1 ; `git ls-files run-artifacts/` vide | ✅ (verify) | ⬜ pending |
| 12-03-01 | 03 | 2 | ROUTINE-01 / ROUTINE-05 | T-12-07 / T-12-09 | Environment Custom + 2 secrets + *.supabase.co ; aucun connecteur MCP Supabase | manual-gate | Dashboard : Environment Custom existe, allowlist contient *.supabase.co, 0 connecteur MCP | ❌ W2 (cloud, hors git) | ⬜ pending |
| 12-03-02 | 03 | 2 | ROUTINE-01 | T-12-08 | run de fumée heartbeat Remote → job_runs success, aucun 403/host_not_allowed | manual-gate | `select status,error from job_runs where job_name='heartbeat' order by started_at desc limit 1` → success, error null | ❌ W2 (cloud) | ⬜ pending |
| 12-04-01 | 04 | 2 | ROUTINE-03 | T-12-10 / T-12-11 | prompt revu fondateur ; version semver valide ; garde <market_data> intacte | manual-gate + grep | `grep -E '^version:\s*[0-9]+\.[0-9]+\.[0-9]+' apps/jobs/prompts/veteran.md` ; `grep -c market_data` ≥1 ; persist.test.ts vert | ✅ (file) + ❌ W2 (review) | ⬜ pending |
| 12-05-01 | 05 | 3 | ROUTINE-02 | — | 2 routines Remote newyork(30 12)/eod-swing(00 21) crons ⊆ sessions.ts, single-run | manual-gate | Dashboard : 2 routines Remote, crons UTC corrects, Environment lié ; asia/london absentes | ❌ W3 (cloud) | ⬜ pending |
| 12-05-02 | 05 | 3 | ROUTINE-03 | T-12-12 / T-12-13 | ≥1 setup persisté via D-43 ; score recalculé (≠ agent) ; R:R≥1.2 ; handoff single-run | integration + manual-gate | `select count(*) from trade_setups where session='newyork' and session_day=<jour>` ≥1, status='active' ; score=scoreSetup | ✅ (persist.test.ts) + ❌ W3 (run réel) | ⬜ pending |
| 12-05-03 | 05 | 3 | ROUTINE-04 | T-12-14 / T-12-15 | re-run même session_day → pas de doublon actif ; /admin/sante reflète run + is_stale (jamais re-dérivé) ; quota <~15/j | e2e + manual-gate | `select status,count(*) ... group by status` (1 jeu actif) ; /admin/sante affiche job_runs + feu fraîcheur ; `fault-isolation.test.ts` vert | ✅ (fault-isolation) + ❌ W3 (run) | ⬜ pending |
| 12-06-01 | 06 | 4 | ROUTINE-02 | — | asia(00 23)/london(00 07) créées APRÈS validation 05 ; Environment réutilisé | manual-gate | Dashboard : 4 routines Remote, crons ⊆ sessions.ts, aucun nouveau secret/réseau | ❌ W4 (cloud) | ⬜ pending |
| 12-06-02 | 06 | 4 | ROUTINE-04 | T-12-16 | asia+london tracent job_runs sans 403 ; 4 fenêtres sous quota ~15/j | manual-gate | `select distinct job_name,session from job_runs` couvre les 4 sessions ; usage <~15/j | ❌ W4 (cloud) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Sampling continuity check:** aucune séquence de 3 tâches consécutives sans verify automatisé OU outcome observable. Les 3 tâches Wave-1 (12-01-*) ont des commandes vitest ; les tâches Wave-1 doc (12-02-*) ont des greps ; toutes les tâches cloud (Wave 2-4) ont un outcome SQL/dashboard observable précis.

---

## Wave 0 Requirements

- [ ] `apps/jobs/__tests__/routine-persist-empty.test.ts` — D-12-02 true-empty (no_artifacts) vs all-rejected (WR-04 throw) — ROUTINE-03
- [ ] `apps/jobs/__tests__/routine-idempotence.test.ts` — expirePriorSetups AVANT insert, session_day stable — ROUTINE-04
- [ ] `apps/jobs/__tests__/routine-no-mcp.test.ts` — static-check pas de MCP / pas de clé Anthropic — ROUTINE-05

Infrastructure existante (vitest jobs config, fixtures __fixtures__/run-artifacts, analog fault-isolation.test.ts) couvre le reste. Aucun framework à installer.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions (outcome observable) |
|----------|-------------|------------|----------------------------------------|
| Environment Custom + secrets + *.supabase.co | ROUTINE-01 | Dashboard-only (hors git, no secrets store) | claude.ai/code/routines : Environment Custom, allowlist `*.supabase.co`, 2 env vars, 0 connecteur MCP |
| Run de fumée egress | ROUTINE-01 | Cloud-only, non automatisable depuis le repo | heartbeat Remote → `job_runs.status='success'`, aucun `403`/`host_not_allowed` dans logs+error |
| Revue fondateur veteran.md | ROUTINE-03 | Jugement humain (qualité du raisonnement produit) | Fondateur valide le prompt ; version semver préservée/bumpée ; garde `<market_data>` intacte |
| Création routines Remote (crons) | ROUTINE-02 | Dashboard/`/schedule`, config hors git | Dashboard : routines Remote, crons UTC ⊆ sessions.ts, Environment lié |
| Run réel end-to-end ≥1 setup | ROUTINE-03 | Cloud-only ; phase gate avant élargissement | `select count(*) from trade_setups where session='newyork' and session_day=<jour>` ≥1 ; fondateur inspecte 1 setup |
| Idempotence run + stale /admin/sante | ROUTINE-04 | Re-run cloud + rendu RSC superadmin | re-run → pas de doublon actif ; /admin/sante montre run + feu fraîcheur (is_stale lu de la vue) |
| Quota 4 fenêtres | ROUTINE-04 | Métrique compte Anthropic | claude.ai/settings/usage : conso <~15/j |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify OR Wave 0 dependency OR precise observable outcome (cloud gates)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify or observable outcome
- [x] Wave 0 covers all MISSING references (3 tests plan 01)
- [x] No watch-mode flags
- [x] Feedback latency < 30s (automated) ; cloud gates bounded by run windows
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-21
