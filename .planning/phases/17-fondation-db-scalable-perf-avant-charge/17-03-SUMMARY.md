---
phase: 17-fondation-db-scalable-perf-avant-charge
plan: 03
subsystem: database
tags: [supabase, migration, rls, initplan, matview, mrr, broadcast, realtime, keyset-index, concurrently, advisors, live, mcp]

# Dependency graph
requires:
  - phase: 17 (plan 01)
    provides: "migration 0017 authored (Partie A transactionnelle + Partie B CONCURRENTLY commentée + script de gate)"
  - phase: 17 (plan 02)
    provides: "SignalList -> Broadcast (postgres_changes retiré du code actif) + mrr-gating.test.ts Wave-0"
provides:
  - "0017 appliquée LIVE (project csotpitrjxryjkadyiml) : 21 policies RLS wrappées InitPlan + matview mv_mrr gated + trigger Broadcast + 5 index keyset/policy"
  - "database.types.ts réconcilié (mv_mrr View + get_mrr Function + alias MvMrrRow, revenue_atomic string)"
  - "publication supabase_realtime ne contient plus trade_setups ; REPLICA IDENTITY DEFAULT (Broadcast actif)"
affects: [19-dashboard-user, 20-dashboard-superadmin, 21-audit]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Application LIVE via MCP : apply_migration (Partie A DDL transactionnel) puis execute_sql un-statement-par-appel pour CREATE INDEX CONCURRENTLY (hors tx, Pitfall 1 / err 25001)"
    - "Gate INVALID après CONCURRENTLY : requête pg_index indisvalid=false → 0 ligne attendu"
    - "Durcissement matview : REVOKE ALL anon/authenticated (le grant par défaut Supabase expose la matview via PostgREST — advisor materialized_view_in_api) ; seule lecture = wrapper get_mrr() gated"
    - "Trigger function = REVOKE EXECUTE public/anon/authenticated (convention repo 0002, advisor *_security_definer_function_executable)"

key-files:
  created:
    - ".planning/phases/17-fondation-db-scalable-perf-avant-charge/17-HUMAN-UAT.md"
  modified:
    - "packages/supabase/src/database.types.ts"
    - "supabase/migrations/0017_scalable_foundation.sql"

key-decisions:
  - "D-17-03-A1 : mv_mrr = cash encaissé (option B fondateur) — Σ amount_atomic where status='verified' group by month(verified_at), les 2 plans, pas de dédup (gelé dans 0017 par 17-01)"
  - "D-17-03-A5 : subscriptions_user_id_idx NON créé (subscriptions_active_idx (user_id,...) couvre user_id en tête) ; payments_user_id_idx créé (aucun index dédié préexistant)"
  - "D-17-03-A3 : trade_setups retiré de la publication supabase_realtime + REPLICA IDENTITY DEFAULT (seul consommateur postgres_changes = badge, migré Broadcast en 17-02 ; grep client confirmé)"
  - "D-17-03-SEC : 2 fuites introduites par 0017 fermées LIVE + dans le fichier — mv_mrr selectable anon/authenticated (REVOKE ALL) et broadcast_trade_setup_changes() exposée en RPC (REVOKE EXECUTE)"

patterns-established:
  - "Séquence LIVE D-05 reproductible : apply_migration Partie A → execute_sql/CONCURRENTLY per-statement + check indisvalid → retrait publication après vérif A3 → gen-types réconciliés → get_advisors(perf+sec) → EXPLAIN/REFRESH → tests"
  - "Validation index keyset sur table à faible volume : EXPLAIN par défaut peut montrer Seq Scan (artefact row-count) ; prouver l'usabilité via SET LOCAL enable_seqscan=off → Index Scan sans Sort"

requirements-completed: [SCALE-04, SCALE-01, SCALE-02, SCALE-03, SCALE-05]

# Metrics
duration: ~25min
completed: 2026-06-25
---

# Phase 17 Plan 03 : Application LIVE 0017 + gates Summary

**La migration 0017 est appliquée LIVE via MCP (apply_migration Partie A + 5 index CONCURRENTLY un-par-un, 0 INVALID) : 21 policies RLS wrappées InitPlan (advisor 0 auth_rls_initplan), matview mv_mrr « cash encaissé » gated get_mrr(), trigger Broadcast topic:new-signals. Deux fuites de sécurité introduites par 0017 (matview exposée en API, fonction de trigger appelable en RPC) détectées au gate advisors et fermées LIVE + dans le fichier. Types réconciliés, typecheck vert, suite 617 verte (mrr-gating assertif). Broadcast live = gate Manual-Only documenté.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-06-25
- **Completed:** 2026-06-25
- **Tasks:** 1 checkpoint human-action (A1 + autorisation LIVE, déjà résolu) + 2 auto + 1 checkpoint human-verify (gates D-05)
- **Files modified:** 2 modifiés, 1 créé (hors tracking)

## Accomplishments

- **Task 0 (checkpoint human-action) :** A1 résolu en 17-01 (option B fondateur), autorisation LIVE confirmée par le fondateur, compréhension CONCURRENTLY un-par-un actée → « go ».
- **Task 1 — Application LIVE :**
  - **Partie A** via `apply_migration("0017_scalable_foundation", ...)` — succès, aucune erreur de NOM EXACT de policy (les 21 drop/recreate ont matché). Section 1 (wrap RLS), Section 2 (mv_mrr + get_mrr + refresh_mv_mrr), Section 3 (broadcast_trade_setup_changes + trigger + policy realtime.messages).
  - **Partie B** — 5 `CREATE INDEX CONCURRENTLY` via `execute_sql` isolés : `mv_mrr_month_idx` (UNIQUE), `trade_setups_keyset_idx`, `profiles_keyset_idx`, `payments_keyset_idx`, `payments_user_id_idx`. `subscriptions_user_id_idx` **sauté** (A5 : couvert par le préfixe de `subscriptions_active_idx`). Gate `indisvalid=false` → 0 ligne (aucun index INVALID).
  - **Retrait publication (A3)** — vérif `pg_publication_tables` (trade_setups seule table) + grep client (aucun consommateur postgres_changes restant) → `alter publication supabase_realtime drop table public.trade_setups;` + `alter table public.trade_setups replica identity default;`.
- **Task 2 — Types :** `database.types.ts` réconcilié à la main (procédure repo projet non-linké) : ajout de la View `mv_mrr` (month string|null, payments_count number|null, revenue_atomic string|null — override *_atomic), de la Function `get_mrr` (Returns tableau du Row mv_mrr), de l'alias `MvMrrRow`. `pnpm typecheck` vert (0 erreur).
- **Task 3 (checkpoint human-verify) — gates D-05 :** voir tableau ci-dessous. Gates 1-6 PASS ; gate 7 (Broadcast live) Manual-Only → `17-HUMAN-UAT.md`.

## Gates D-05

| # | Gate | Résultat |
|---|------|----------|
| 1 | get_advisors(performance) 0 auth_rls_initplan | ✅ aucune policy réévaluée par ligne |
| 2 | get_advisors(security) aucune NOUVELLE alerte | ✅ après fermeture de 2 fuites (cf. Déviations) ; restent get_mrr/has_active_subscription/is_superadmin (WARN gated EXPECTED) + pré-existants |
| 3 | EXPLAIN keyset Index Scan sans Sort | ✅ profiles/payments Index Scan direct ; trade_setups (5 lignes) Seq Scan par défaut → Index Scan prouvé via enable_seqscan=off (sans Sort) |
| 4 | REFRESH CONCURRENTLY mv_mrr | ✅ succès (prouve mv_mrr_month_idx UNIQUE) |
| 5 | pg_index indisvalid=false → 0 | ✅ 0 index INVALID |
| 6 | pnpm test (gating anon-client) | ✅ 617 passed / 4 skipped / 0 failed ; mrr-gating ASSERTIF (anon get_mrr() → 0 ligne) |
| 7 | Broadcast live (badge abonné / non-abonné) | ⏳ Manual-Only → 17-HUMAN-UAT.md |

## Task Commits

(commit unique de finalisation — l'application LIVE passe par MCP, sans commit de code ; les artefacts modifiés sont committés ensemble)

## Files Created/Modified

- `supabase/migrations/0017_scalable_foundation.sql` (modifié) — ajout des 2 REVOKE de durcissement (mv_mrr REVOKE ALL anon/authenticated ; broadcast_trade_setup_changes REVOKE EXECUTE) pour cohérence fichier↔LIVE (fidélité replay).
- `packages/supabase/src/database.types.ts` (modifié) — View mv_mrr + Function get_mrr + alias MvMrrRow réconciliés.
- `.planning/phases/.../17-HUMAN-UAT.md` (créé) — gates Manual-Only, dont Broadcast live.

## Decisions Made

- **D-17-03-A5 (index redondant)** : `subscriptions_active_idx = (user_id, status, current_period_end)` couvre les égalités sur `user_id` via son préfixe → `subscriptions_user_id_idx` non créé (éviter doublon). `payments.user_id` n'avait aucun index dédié → `payments_user_id_idx` créé.
- **D-17-03-A3 (publication)** : `trade_setups` était la seule table de `supabase_realtime` et son unique consommateur postgres_changes (badge) a migré vers Broadcast en 17-02 (grep client : plus aucune souscription active). Retrait de la publication + REPLICA IDENTITY DEFAULT exécutés.
- **D-17-03-SEC (durcissement, gap-closure au gate)** : deux fuites introduites par 0017, détectées par `get_advisors(security)`, fermées LIVE et dans le fichier (voir Déviations).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2/Sécurité - Blocking] Matview mv_mrr exposée via PostgREST (advisor materialized_view_in_api)**
- **Found during:** Task 3, gate 2 (get_advisors security)
- **Issue:** Supabase accorde par défaut SELECT à anon/authenticated sur les objets de `public`. La matview `mv_mrr` était donc lisible directement via `/rest/v1/mv_mrr`, **contournant le wrapper gated `get_mrr()`** — fuite du CA (menace T-17-MV). Le plan 17-01 avait évité tout GRANT direct mais n'avait pas RÉVOQUÉ le grant par défaut.
- **Fix:** `revoke all on public.mv_mrr from anon, authenticated;` LIVE + ajout dans 0017 Section 2. La lecture passe désormais exclusivement par `get_mrr()` (SECURITY DEFINER, bypass + gating is_superadmin()).
- **Verification:** re-run get_advisors(security) → alerte mv_mrr disparue.

**2. [Convention repo 0002 - Blocking] Fonction de trigger broadcast_trade_setup_changes() appelable en RPC**
- **Found during:** Task 3, gate 2 (get_advisors security)
- **Issue:** `broadcast_trade_setup_changes()` (SECURITY DEFINER) était exposée en RPC à anon ET authenticated (advisors 0028/0029). Une fonction de trigger ne doit jamais être appelable directement. La convention repo (migration 0002 `revoke_execute_trigger_functions`) impose le REVOKE ; 0017 l'avait omis.
- **Fix:** `revoke execute on function public.broadcast_trade_setup_changes() from public, anon, authenticated;` LIVE + ajout dans 0017 Section 3.
- **Verification:** re-run get_advisors(security) → alertes broadcast (anon + authenticated) disparues.

---

**Total deviations:** 2 auto-fixed (2 blocking — sécurité). Détectées par le gate advisors (D-05 fonctionne comme conçu : l'apply LIVE révèle ce que le build seul ne peut pas). Aucune extension de périmètre — durcissement direct des objets créés par 0017.
**Impact on plan:** Le fichier 0017 reflète désormais l'état LIVE (les 2 REVOKE manquaient à l'authoring 17-01). Note de fidélité : la migration 0017 a été enregistrée LIVE via apply_migration AVANT ces REVOKE ; ceux-ci ont été appliqués via execute_sql et ajoutés au fichier — l'état LIVE et le fichier sont équivalents, mais un replay sur DB vierge produira directement l'état correct.

## Issues Encountered

- **EXPLAIN trade_setups Seq Scan (non-bloquant)** : table à 5 lignes → le planner préfère Seq Scan+Sort (moins cher). L'index `trade_setups_keyset_idx` existe, est valide, et est choisi dès qu'on force `enable_seqscan=off` (Index Scan sans Sort). Comportement attendu, l'index servira à l'échelle (profiles/payments avec 300+ lignes l'utilisent déjà directement).
- **advisor `multiple_permissive_policies` (WARN, hors scope)** : tables avec policies « lire le sien » + « superadmin voit tout » coexistantes — pré-existant (les policies existaient avant 0017, juste wrappées). Non traité (consolidation = décision produit séparée).

## User Setup Required

None — aucun install. L'unique action restante est le gate Manual-Only Broadcast (`17-HUMAN-UAT.md`), à exécuter par le fondateur avec une vraie session navigateur.

## Next Phase Readiness

- **Fondation DB scalable LIVE** : RLS InitPlan (gain >100× à l'échelle), index keyset prêts pour la pagination curseur (Phases 19/20), matview MRR de référence + infra refresh, Broadcast fan-out (postgres_changes goulot retiré).
- **mv_mrr** : la matview est vide tant qu'il n'y a pas de paiements `verified` ; l'ordonnanceur du `refresh_mv_mrr()` (pg_cron/Edge/job) reste HORS scope P17 (Open Question 1, à câbler quand le dashboard superadmin/MRR arrive — Phase 20).
- **Gate 7 Broadcast** : à valider manuellement (badge live abonné + shape payload A4 + non-abonné silencieux).
- **SCALE-06 (audit chiffré)** : déféré Phase 21 (exige le seed Phase 18).

## Self-Check: PASSED

- FOUND: supabase/migrations/0017_scalable_foundation.sql (LIVE + REVOKE de durcissement)
- FOUND: packages/supabase/src/database.types.ts (mv_mrr + get_mrr + MvMrrRow)
- FOUND: 17-HUMAN-UAT.md
- LIVE: migration 0017 appliquée (advisors perf 0 auth_rls_initplan, security 0 nouvelle alerte, 0 index INVALID, REFRESH CONCURRENTLY OK, typecheck + 617 tests verts)

---
*Phase: 17-fondation-db-scalable-perf-avant-charge*
*Completed: 2026-06-25*
