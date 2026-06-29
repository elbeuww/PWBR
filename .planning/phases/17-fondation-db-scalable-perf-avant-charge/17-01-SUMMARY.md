---
phase: 17-fondation-db-scalable-perf-avant-charge
plan: 01
subsystem: database
tags: [postgres, supabase, rls, materialized-view, realtime, broadcast, keyset, concurrently, mrr]

# Dependency graph
requires:
  - phase: 01 (subscriptions-gating)
    provides: "helpers SECURITY DEFINER is_superadmin()/has_active_subscription() + policies RLS existantes"
  - phase: 07 (affiliation)
    provides: "6 tables d'affiliation + leurs policies RLS a wrapper"
provides:
  - "Migration 0017_scalable_foundation.sql (Partie A active + Partie B commentee) — AUTHORING uniquement, NON appliquee LIVE"
  - "Partie A1 : toutes les policies RLS reecrites en wrap (select ...) InitPlan (perf >100x par conception)"
  - "Partie A2 : matview mv_mrr (cash encaisse/mois) + wrapper get_mrr() gated is_superadmin() + refresh_mv_mrr() lockee service_role"
  - "Partie A3 : trigger Broadcast trg_trade_setups_broadcast (topic fixe new-signals) + policy RLS realtime.messages"
  - "Partie B : 6 index CONCURRENTLY documentes (mv_mrr_month_idx UNIQUE + 3 keyset + 2 colonnes de policy) + script de gate INVALID/EXPLAIN/advisors"
affects: [17-02, 17-03, 18-seed, 19-dashboard-user, 20-dashboard-superadmin, 21-e2e-audit]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wrap RLS InitPlan : (select fn()) sur fonction non correlee, jamais sur la comparaison de colonne"
    - "Matview gated : wrapper SECURITY DEFINER + revoke public/anon + grant authenticated (les matviews n'ont pas de RLS)"
    - "Broadcast from Database : trigger realtime.broadcast_changes + policy realtime.messages repliquant la barriere abonne"
    - "Decoupage migration : Partie A transactionnelle (apply_migration) vs Partie B CONCURRENTLY (execute_sql per-statement)"

key-files:
  created:
    - "supabase/migrations/0017_scalable_foundation.sql"
  modified: []

key-decisions:
  - "D-17-01-A1 : mv_mrr = cash encaisse (Option B) — sum(amount_atomic) WHERE status='verified' GROUP BY date_trunc('month', verified_at), 2 plans, sans dedup"
  - "D-17-01-PROFILES : 'profiles: modifier le sien' aussi wrappee (Rule 2) pour atteindre le critere d'arret D-01 (advisor vert COMPLET)"
  - "D-17-01-PUBLI : retrait publication supabase_realtime + REPLICA IDENTITY differe au plan 17-03 (apres verif LIVE A3)"

patterns-established:
  - "Wrap RLS (select ...) : InitPlan natif du planner, mecanisme zero-code (advisor auth_rls_initplan)"
  - "Wrapper matview SECURITY DEFINER gated : seul chemin de lecture d'une matview (pas de RLS native)"
  - "Trigger Broadcast topic fixe + canal prive : fan-out global servi par realtime.messages, parite securite via policy RLS"

requirements-completed: [SCALE-01, SCALE-02, SCALE-03, SCALE-05]

# Metrics
duration: ~20min
completed: 2026-06-25
---

# Phase 17 Plan 01 : Fondation DB scalable — migration 0017 (authoring) Summary

**Migration 0017 complete authoree : wrap RLS InitPlan de 21 policies + matview MRR (cash encaisse) gated is_superadmin() + bascule Realtime vers Broadcast + Partie B index CONCURRENTLY/script de gate documentes — aucune application LIVE (deferee au plan 17-03).**

## Performance

- **Duration:** ~20 min (incluant pause checkpoint A1)
- **Started:** 2026-06-25
- **Completed:** 2026-06-25
- **Tasks:** 4 auto + 1 checkpoint resolu
- **Files modified:** 1 (cree)

## Accomplishments
- Section 1 : drop/recreate par NOM EXACT de toutes les policies RLS existantes (profiles, trade_setups, analyses, candles, payments, subscriptions, 6 tables d'affiliation) en wrap `(select ...)` — 21 expressions InitPlan. prediction_outcomes (`using (true)`) laissee telle quelle (rien a wrapper).
- Section 2 : matview `mv_mrr` avec la formule metier verrouillee au checkpoint A1 (cash encaisse par mois), wrapper `get_mrr()` SECURITY DEFINER gated `is_superadmin()`, fonction `refresh_mv_mrr()` lockee service_role.
- Section 3 : fonction trigger `broadcast_trade_setup_changes()` (topic fixe `topic:new-signals`) + trigger `trg_trade_setups_broadcast` + policy RLS sur `realtime.messages` repliquant la barriere abonne. Retrait publication/REPLICA IDENTITY differe (commente) au plan 17-03.
- Partie B : 6 statements `CREATE INDEX CONCURRENTLY` documentes en commentaire (mv_mrr_month_idx UNIQUE + 3 keyset `(created_at desc, id desc)` + 2 colonnes de policy) + script de gate reutilisable (detection INVALID, drop concurrently, EXPLAIN gabarit, REFRESH, get_advisors).

## Task Commits

1. **Task 1 : En-tete + wrap RLS InitPlan toutes policies** - `4d49832` (feat)
2. **Task 2 : Matview MRR + get_mrr() gated + refresh_mv_mrr()** - `188d69d` (feat)
3. **Task 3 : Broadcast trigger + policy realtime.messages** - `443dd41` (feat)
4. **Task 4 : Partie B index CONCURRENTLY + script de gate** - `166aadd` (feat)

## Files Created/Modified
- `supabase/migrations/0017_scalable_foundation.sql` - Migration scalabilite : Partie A transactionnelle (wraps RLS + matview MRR + trigger Broadcast) + Partie B CONCURRENTLY documentee en commentaire + script de gate. AUTHORING uniquement — application LIVE = plan 17-03.

## Decisions Made
- **Checkpoint A1 (mv_mrr) RESOLU** : Option B « cash encaisse » confirmee par decision fondateur relayee — `sum(payments.amount_atomic) WHERE status='verified' GROUP BY date_trunc('month', verified_at)`. Source de verite = `amount_atomic` (constate on-chain), periode = `verified_at`, les 2 plans inclus, PAS de deduplication (plusieurs paiements/mois s'additionnent). Note semantique : vue cash encaisse, pas un MRR recurrent dedupe — comportement voulu.
- **Topic Broadcast** : topic FIXE `topic:new-signals` + canal prive (Open Question 2 tranchee — fan-out global du badge).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Wrap de la policy "profiles: modifier le sien"**
- **Found during:** Task 1 (wrap RLS InitPlan)
- **Issue:** L'inventaire du plan ne listait que `"profiles: lire le sien"`, mais `profiles` porte une SECONDE policy `"profiles: modifier le sien"` (0001 L.24-27) qui reference aussi `auth.uid()` non wrappee. Le critere d'arret D-01 exige `get_advisors(performance)` vert COMPLET sur TOUTES les policies — laisser celle-ci non wrappee laisserait une alerte `auth_rls_initplan` residuelle au gate.
- **Fix:** Drop/recreate `"profiles: modifier le sien"` (for update) en `using (id = (select auth.uid()))`, en parite avec `"lire le sien"`.
- **Files modified:** supabase/migrations/0017_scalable_foundation.sql
- **Verification:** grep des expressions wrappees = 21 (inclut les 2 policies profiles) ; aligne sur D-01 « TOUTES les policies ».
- **Committed in:** 4d49832 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical / Rule 2)
**Impact on plan:** Auto-fix necessaire pour le critere d'arret D-01 (advisor vert complet). Aucun scope creep — meme table, meme pattern de wrap.

## Issues Encountered
- **Checkpoint A1 bloquant** : la definition metier de `mv_mrr` n'etait verrouillee nulle part dans CONTEXT.md. Conformement a `autonomous:false`, execution stoppee apres Task 1, checkpoint retourne au coordinateur, decision fondateur recue (Option B), puis Tasks 2-4 ecrites avec la formule confirmee. Aucune supposition de formule (anti re-travail / re-ouverture 0017).

## User Setup Required
None - aucune configuration de service externe. SQL natif, aucun install npm.

## Next Phase Readiness
- **Plan 17-03 (application LIVE)** : 0017 prete a etre appliquee via MCP `apply_migration` (Partie A) puis `execute_sql` per-statement (Partie B index CONCURRENTLY), apres checkpoint humain. Le script de gate (detection INVALID + EXPLAIN + REFRESH + get_advisors) est embarque en commentaire dans le fichier.
- **Garde A3** : avant de retirer la publication/REPLICA IDENTITY de `trade_setups` (commente en section 3), verifier LIVE via `pg_publication_tables` qu'aucun autre consommateur postgres_changes n'en depend.
- **Plan 17-02 (client)** : la reecriture de `SignalList.tsx` (postgres_changes → canal prive Broadcast) consomme le topic `topic:new-signals` pose ici (shape payload `payload.payload.record`, Assumption A4 a verifier runtime).
- **Note types** : apres application LIVE (17-03), regenerer `database.types.ts` et reappliquer l'override string sur `mv_mrr.revenue_atomic` (bigint → string).

## Self-Check: PASSED

- FOUND: supabase/migrations/0017_scalable_foundation.sql
- FOUND: 17-01-SUMMARY.md
- FOUND commits: 4d49832, 188d69d, 443dd41, 166aadd

---
*Phase: 17-fondation-db-scalable-perf-avant-charge*
*Completed: 2026-06-25*
