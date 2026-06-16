---
phase: 05-track-record-mesur-affich
plan: 02
subsystem: database
tags: [supabase, postgres, rls, replay, track-record, idempotent-job, vitest]

# Dependency graph
requires:
  - phase: 05-01
    provides: replayOutcome (cœur déterministe), threshold.ts (seuil N>=30), ReplayCandle/Outcome types
  - phase: 04
    provides: trade_setups (0006), pattern repo idempotent (candles), job idempotent (subscription-expiry), dispatch/runJob
provides:
  - Migration 0014 appliquée LIVE — table prediction_outcomes (RLS authenticated, write service_role bypass) + vue pattern_stats
  - PREMIÈRE policy/grant anon du projet (lecture publique des agrégats pattern_stats uniquement)
  - Repo predictionOutcomes (insertOutcomes idempotent onConflict setup_id, getResolvedSetupIds)
  - Job outcome-tracker (replay des setups expirés/invalidated, idempotent 2 niveaux, enregistré dispatch)
  - Vue pattern_stats : win_rate + avg_r (gagnants) + expectancy (tous) + N brut, all_time + 90d, par dimension D-06
affects: [05-03 page track record public, dashboard métriques]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Vue agrégée security_invoker=false + grant anon = première lecture publique du projet (agrégats SEULEMENT)"
    - "Idempotence job 2 niveaux : sélection bornée (getResolvedSetupIds) + filet DB UNIQUE(setup_id) onConflict ignoreDuplicates"
    - "Convenance aliases database.types.ts maintenus à la main, à réappliquer après chaque gen-types"

key-files:
  created:
    - supabase/migrations/0014_prediction_outcomes_pattern_stats.sql
    - packages/supabase/src/repositories/predictionOutcomes.ts
    - apps/jobs/src/jobs/outcome-tracker.ts
    - apps/jobs/src/jobs/__tests__/outcome-tracker.test.ts
  modified:
    - packages/supabase/src/database.types.ts
    - packages/supabase/src/index.ts
    - packages/supabase/src/repositories/candles.ts
    - apps/jobs/src/dispatch.ts

key-decisions:
  - "A1 honoré : setups 'invalidated' rejoués pleinement par replayOutcome (jamais présumés hit_sl)"
  - "A2 honoré : expectancy = AVG(realized_r) sur TOUS ; avg_r = AVG(realized_r) FILTER outcome='hit_tp' (gagnants)"
  - "asset_class joint depuis instruments (colonne réelle) via JOIN, PAS depuis trade_setups (déviation plan)"
  - "Migration appliquée LIVE via MCP apply_migration (JAMAIS db push) ; types régénérés depuis la base"
  - "security_definer_view sur pattern_stats = advisor INTENTIONNEL (agrège du public via security_invoker=false), pas un défaut"

patterns-established:
  - "Frontière producteur-unique : repo predictionOutcomes JAMAIS importé par apps/web ; écriture service_role uniquement"
  - "N brut jamais masqué côté DB (D-12) ; le seuil 30 est appliqué côté front (threshold.ts 05-01)"

requirements-completed: [TRACK-01, TRACK-02]

# Metrics
duration: ~30min (continuation de finalisation)
completed: 2026-06-16
---

# Phase 5 Plan 02 : Pipeline de données track record (TRACK-01/02) Summary

**Table prediction_outcomes + vue pattern_stats appliquées LIVE (première lecture anon du projet), job outcome-tracker idempotent rejouant les setups expirés via replayOutcome, gate get_advisors PASS (aucune fuite par setup).**

## Performance

- **Duration:** ~30 min (agent de finalisation, après Tasks 1-3 et l'application MCP de Task 4)
- **Completed:** 2026-06-16
- **Tasks:** 4 (3 auto + 1 checkpoint:human-verify résolu)
- **Files modified:** 8

## Accomplishments
- Migration 0014 appliquée LIVE via MCP : table `prediction_outcomes` (PK setup_id, FK trade_setups on delete cascade, RLS authenticated, AUCUNE policy write) + vue `pattern_stats` (security_invoker=false, grant SELECT anon).
- PREMIÈRE policy/grant `anon` du projet : seuls les agrégats pattern_stats traversent la frontière publique, jamais une ligne par setup.
- Job `outcome-tracker` GREEN et idempotent à 2 niveaux ; enregistré dans dispatch JOB_REGISTRY, tracé via runJob (job_runs).
- Repos `insertOutcomes` / `getResolvedSetupIds` (service_role) + `getCandlesForReplay` (lecture H1 bornée, anti look-ahead).
- Types régénérés depuis la base + casts temporaires retirés ; typecheck vert.

## Task Commits

1. **Task 1 (RED): test idempotence + getCandlesForReplay** - `f931623` (test)
2. **Task 2: migration 0014 + repos predictionOutcomes + barrel** - `1584c7c` (feat)
3. **Task 3 (GREEN): job outcome-tracker + dispatch** - `374a5bb` (feat)
4. **Task 4: apply migration LIVE + regen types + drop temp casts** - `542a1f7` (feat)

**Plan metadata:** _(commit final de tracking après ce SUMMARY)_

## Files Created/Modified
- `supabase/migrations/0014_prediction_outcomes_pattern_stats.sql` - Table prediction_outcomes + vue pattern_stats + RLS anon (première du projet).
- `packages/supabase/src/repositories/predictionOutcomes.ts` - insertOutcomes (onConflict setup_id ignoreDuplicates) + getResolvedSetupIds (Set), types générés, aucun cast.
- `apps/jobs/src/jobs/outcome-tracker.ts` - Job I/O replay des setups expirés/invalidated, idempotent, miroir subscription-expiry.
- `apps/jobs/src/jobs/__tests__/outcome-tracker.test.ts` - Idempotence (2e run = 0 insert), sélection bornée, invalidated rejoué pleinement.
- `packages/supabase/src/database.types.ts` - Régénéré (prediction_outcomes Row/Insert/Update + vue pattern_stats) + aliases de convenance restaurés + PredictionOutcome{Row,Insert,Update}.
- `packages/supabase/src/index.ts` - Re-export des types PredictionOutcome depuis database.types ; insertOutcomes/getResolvedSetupIds.
- `packages/supabase/src/repositories/candles.ts` - getCandlesForReplay (H1, ts asc, fenêtre [from,to]).
- `apps/jobs/src/dispatch.ts` - Enregistrement 'outcome-tracker': outcomeTracker.

## Decisions Made
- **A1 (RESEARCH Open Q2)** : setups `invalidated` rejoués pleinement comme `expired` — replayOutcome décide hit_tp/hit_sl/flat, jamais de présomption hit_sl.
- **A2 (RESEARCH Open Q3)** : `expectancy` = AVG(realized_r) sur TOUS les trades ; `avg_r` = AVG(realized_r) FILTER WHERE outcome='hit_tp' (R moyen des gagnants). Figé dans la vue.
- **Application LIVE via MCP** `apply_migration` (jamais `supabase db push`), conformément à B-04-02 / D-01-01-D.
- **Gate sécurité PASS** : `get_advisors` (security) confirme que prediction_outcomes n'est PAS exposé à anon (rls_enabled, select authenticated only, aucune policy write). Le seul nouvel advisor est `security_definer_view` sur `pattern_stats` — design INTENTIONNEL (la vue agrège du public via security_invoker=false). Non corrigé : c'est voulu.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] asset_class joint depuis `instruments`, pas `trade_setups`**
- **Found during:** Task 2 (migration 0014)
- **Issue:** Le plan référençait `instrument_class` / `trade_setups.instrument_class` pour la dimension `asset_class`, colonne inexistante sur trade_setups.
- **Fix:** La vue pattern_stats joint `public.instruments i on i.id = ts.instrument_id` et lit `i.asset_class` (colonne réelle).
- **Files modified:** supabase/migrations/0014_prediction_outcomes_pattern_stats.sql
- **Verification:** Migration appliquée LIVE sans erreur ; list_tables confirme pattern_stats ; typecheck vert.
- **Committed in:** 1584c7c (Task 2)

**2. [Rule 3 - Blocking] Aliases de convenance database.types.ts restaurés après gen-types**
- **Found during:** Task 4 (régénération des types)
- **Issue:** La régénération MCP `generate_typescript_types` a écrasé tout le fichier source, supprimant le bloc d'aliases maintenus à la main (CandleInsert, TradeSetupInsert, ProfileRow, Timeframe, etc.) que index.ts et les repos importent → typecheck cassé.
- **Fix:** Bloc d'aliases réappliqué à la fin de database.types.ts (source de vérité = dist/.d.ts précédent) + ajout des aliases PredictionOutcome{Row,Insert,Update}.
- **Files modified:** packages/supabase/src/database.types.ts, packages/supabase/src/index.ts
- **Verification:** pnpm typecheck vert (0 erreur).
- **Committed in:** 542a1f7 (Task 4)

---

**Total deviations:** 2 auto-fixed (1 bug schéma, 1 blocking régénération)
**Impact on plan:** Les deux corrections étaient nécessaires à la justesse (dimension asset_class réelle) et à la compilation (aliases). Aucun scope creep.

## Issues Encountered
- La régénération des types a un effet de bord destructif sur les aliases manuels du fichier. Documenté comme pattern à réappliquer après chaque `supabase gen types`.

## Threat Flags
Aucun nouveau surface non couvert par le threat_model. T-05-03/04/05/06 tous mitigés et vérifiés (get_advisors PASS, idempotence test, frontière producteur-unique).

## Security Advisors — hors scope (préexistants)
- `security_definer_view` sur `pattern_stats` : INTENTIONNEL (agrège du public), pas à corriger.
- 2 advisors préexistants non liés à cette phase : `has_active_subscription`, `is_superadmin`.
- WARN `leaked-password protection` : configuration projet préexistante, hors scope phase 5.

## User Setup Required
None - aucune configuration de service externe requise.

## Next Phase Readiness
- Pipeline de données track record en place et live. 05-03 peut consommer `pattern_stats` en lecture anon pour la page publique + appliquer le seuil N>=30 (threshold.ts de 05-01).
- Le job outcome-tracker est exécutable via Windows Task Scheduler (`run-job.cmd outcome-tracker`) ou agent Claude Code.

## Self-Check: PASSED

---
*Phase: 05-track-record-mesur-affich*
*Completed: 2026-06-16*
