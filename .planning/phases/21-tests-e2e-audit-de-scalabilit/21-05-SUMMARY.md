---
phase: 21-tests-e2e-audit-de-scalabilit
plan: 05
subsystem: database
tags: [audit, explain-analyze, postgres, supabase, rls, keyset, advisors, scalability, scale-06]

# Dependency graph
requires:
  - phase: 17-fondation-db-scalable
    provides: "policies RLS wrappées (select …) + index keyset (trade_setups/profiles/payments) + matview mv_mrr + get_mrr()"
  - phase: 18-seed-donnees-realistes
    provides: "seed ~10k source='demo' (volume réaliste de l'audit, D-05)"
  - phase: 19-dashboard-utilisateur
    provides: "user_followed_setups + user_followed_setups_keyset_idx (0020)"
  - phase: 20-dashboard-superadmin-cockpit-4-axes
    provides: "policies superadmin + RPC KPI gated get_acquisition_funnel/get_churn/get_plan_mix (0021)"
provides:
  - "21-AUDIT.md : harnais d'audit SCALE-06 prêt-à-exécuter (catalogue Q1-Q11, SQL exact, rubrique de lecture des plans, plans attendus par conception)"
  - "Procédure baseline->delta get_advisors + médianes N=5 + preuve InitPlan via set-role"
affects: [solde-dette-0022, verification-phase-21, milestone-v3.0-cloture]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Audit EXPLAIN (ANALYZE, BUFFERS) via MCP execute_sql (lectures uniquement, Pitfall 4)"
    - "Preuve InitPlan RLS via set local role authenticated + request.jwt.claims dans begin;…rollback;"
    - "Verdict perf relatif: médiane N=5 (run froid jeté) + seuil ×3 par requête"

key-files:
  created:
    - .planning/phases/21-tests-e2e-audit-de-scalabilit/21-AUDIT.md
    - .planning/todos/pending/21-05-scale06-measured-run-via-mcp.md
  modified: []

key-decisions:
  - "Fallback méthodologie (plan <mcp_tools>) : canal MCP Supabase inaccessible à l'exécuteur séquentiel -> harnais prêt-à-exécuter, aucune mesure fabriquée (T-21-16)"
  - "VERDICT D-06 = PENDING-MEASUREMENT (PASS/FAIL émis après exécution du catalogue via MCP)"
  - "Preuve InitPlan exige set local role authenticated + jwt.claims (sinon RLS non appliquée en rôle privilégié MCP)"

patterns-established:
  - "Catalogue d'audit versionné: chaque requête D-07 = SQL exact + critère + plan attendu par conception + cellule [À MESURER]"

requirements-completed: []  # SCALE-06 partiellement adressé (harnais livré) — verdict mesuré PENDING

# Metrics
duration: ~20min
completed: 2026-06-26
---

# Phase 21 Plan 05: Audit DB scalabilité SCALE-06 (harnais + méthodologie) Summary

**Harnais d'audit SCALE-06 versionné (catalogue Q1-Q11 avec SQL exact, rubrique Index Scan/InitPlan, plans attendus par conception 0017/0020/0021) — verdict D-06 PENDING car le canal MCP Supabase est inaccessible à l'exécuteur séquentiel (aucune mesure fabriquée).**

## Performance
- **Duration:** ~20 min
- **Started:** 2026-06-26T23:33:52Z
- **Completed:** 2026-06-26
- **Tasks:** 2 (en mode fallback méthodologie — 1 artefact documentaire)
- **Files modified:** 2 créés (audit + todo)

## Accomplishments
- `21-AUDIT.md` : harnais d'audit complet, prêt-à-exécuter, honnête (verdict `PENDING-MEASUREMENT`).
- Catalogue D-07 chiffré : Q1-Q5 paginations keyset (index réels `trade_setups_keyset_idx`/`profiles_keyset_idx`/`payments_keyset_idx`/`user_followed_setups_keyset_idx`), Q6-Q7 RLS wrappées (preuve InitPlan via `set role`), Q8-Q11 RPC KPI gated.
- Méthodologie temps (N=5, run froid jeté, médiane, seuil ×3) + baseline->delta advisors + Pitfall 5 (faux positif `auth_rls_initplan`).
- Todo de solde créé pour l'exécution mesurée via MCP.

## Task Commits

1. **Task 1+2 (fallback méthodologie): harnais d'audit SCALE-06** - `0f132f4` (docs)

**Plan metadata:** voir commit final (docs: complete plan)

## Files Created/Modified
- `.planning/phases/21-tests-e2e-audit-de-scalabilit/21-AUDIT.md` - Harnais d'audit SCALE-06 (env + baseline + catalogue Q1-Q11 + delta advisors + verdict D-06 PENDING)
- `.planning/todos/pending/21-05-scale06-measured-run-via-mcp.md` - Solde : exécution mesurée via canal MCP

## Decisions Made
- **Mode fallback méthodologie** : le plan `<mcp_tools>` autorise explicitement « si MCP inaccessible, documenter la méthodologie ». Le canal MCP Supabase n'est pas exposé à l'exécuteur séquentiel (outils `mcp__supabase__*` absents du schéma ; HTTP inline bloqué par hook context-mode ; aucun `psql`/`pg`/chaîne PG directe). Aucune requête live exécutable.
- **Honnêteté > complétude (T-21-16)** : aucune valeur de mesure fabriquée ; chaque cellule mesurée = `[À MESURER — canal MCP]` ; verdict D-06 = `PENDING-MEASUREMENT`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking / capability gate] Canal MCP Supabase inaccessible -> fallback méthodologie**
- **Found during:** Task 1 (préparation environnement d'audit)
- **Issue:** Les tâches exigent `mcp__supabase__execute_sql` + `get_advisors` pour mesurer les plans. Ces outils ne sont pas dans le schéma d'outils de l'exécuteur ; HTTP inline (test PostgREST plan) est bloqué par un hook context-mode ; aucun `psql`, paquet `pg`, ni chaîne de connexion Postgres directe n'est disponible. Mesure live impossible.
- **Fix:** Application du fallback prévu par le plan (`<mcp_tools>` : « fall back to documenting the methodology »). Production d'un harnais d'audit complet et exact (index/policies/RPC lus dans 0017/0020/0021), avec plans attendus par conception et cellules de mesure marquées. Création d'un todo de solde pour l'exécution mesurée via MCP.
- **Files modified:** 21-AUDIT.md, 21-05-scale06-measured-run-via-mcp.md
- **Verification:** Les 2 scripts `<verify>` du plan passent (Task 1: Baseline/advisor/seed ; Task 2: Index Scan/InitPlan/get_mrr/delta/VERDICT).
- **Committed in:** 0f132f4

---

**Total deviations:** 1 (capability gate — fallback prévu par le plan).
**Impact on plan:** Le harnais d'audit (méthodologie + catalogue exact) est livré et versionné (D-10). La preuve **mesurée** SCALE-06 (verdict D-06 PASS/FAIL) reste à produire via le canal MCP — voir Known Limitations.

## Issues Encountered
- Test du contournement PostgREST EXPLAIN (`Accept: application/vnd.pgrst.plan`) avec service_role : impossible — HTTP inline bloqué par le hook context-mode ; pas de canal alternatif. Confirme la nécessité du canal MCP.

## Known Limitations / Stubs

> **SCALE-06 n'est PAS clos par mesure.** `21-AUDIT.md` contient un verdict `PENDING-MEASUREMENT`
> et des cellules `[À MESURER — canal MCP]`. C'est intentionnel et documenté (honnêteté T-21-16),
> pas un faux PASS. L'exécution mesurée (baseline advisors, Q1-Q11, delta, médianes, verdict
> D-06) doit être lancée via `mcp__supabase__execute_sql`/`get_advisors` — todo
> `.planning/todos/pending/21-05-scale06-measured-run-via-mcp.md`. Le harnais rend cette étape
> = remplissage des cellules + verdict.

## User Setup Required
None - no external service configuration required. (L'exécution mesurée requiert le canal MCP Supabase, déjà connecté à l'orchestrateur.)

## Next Phase Readiness
- Harnais SCALE-06 prêt ; l'exécution mesurée via MCP close la preuve de scalabilité v3.0.
- Blocker de complétude : verdict D-06 mesuré outstanding (gate D-11 « audit sans régression » non confirmable tant que PENDING).

## Self-Check: PASSED
- FOUND: 21-AUDIT.md
- FOUND: 21-05-SUMMARY.md
- FOUND: 21-05-scale06-measured-run-via-mcp.md (todo)
- FOUND commit: 0f132f4

---
*Phase: 21-tests-e2e-audit-de-scalabilit*
*Completed: 2026-06-26*
