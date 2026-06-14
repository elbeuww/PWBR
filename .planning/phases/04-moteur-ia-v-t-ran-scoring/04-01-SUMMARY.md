---
phase: 04-moteur-ia-v-t-ran-scoring
plan: 01
wave: 1
completed_at: 2026-06-14
status: complete
requirements: [SCORE-01, SCORE-05]
commits: [8e585a5, 1ac3970, 026097c, 9f4788f, c74b32f]
---

# SUMMARY 04-01 — Fondation persistante + contrat de sortie

## Objectif atteint

Socle persistant + contrat JSON de la Phase 4 posés : migration `0006` (tables
`analyses` + `trade_setups`) **appliquée à la base live**, `OutputSchema` Zod §3
PERMISSIF golden-testé, repos typés `analyses`/`trade_setups` exportés du barrel
`@app/supabase`.

## Tâches

| Task | Statut | Commits |
| ---- | ------ | ------- |
| 1 — OutputSchema §3 PERMISSIF (A1) | ✅ | `8e585a5` (RED), `1ac3970` (GREEN) |
| 2 — Migration 0006 SQL + test cross-platform | ✅ | `026097c` (RED), `9f4788f` (GREEN) |
| 3 — [BLOCKING] Appliquer migration + types + repos | ✅ | `c74b32f` |

## Ce qui a été construit

- **`packages/core/src/schemas/output.ts`** — `OutputSchema` Zod v4 PERMISSIF
  (`z.object` sans `.strict()`) encodant le contrat §3 champ par champ. Exclut
  volontairement `opportunity_score`/`risk_level`/`confidence`/`risk_reward`/
  `atr_distance_sl` (produits par le code, D-42/46/48/50). Clés en trop émises par
  l'agent → stripped, pas de rejet (A1). Réexporté du barrel `@app/core` + type `Output`.
- **`supabase/migrations/0006_analyses_trade_setups.sql`** — appliquée live (MCP
  `apply_migration`, D-17). `analyses` (traçabilité D-51) + `trade_setups` avec
  `style`/`session` dénormalisés (A2), **`session_day date not null`** (concern revue #1),
  RLS select-only authenticated + AUCUNE write policy (D-05), `trade_setups_score_idx`,
  et `trade_setups_versionkey_idx` UNIQUE partiel `(instrument_id, style, session,
  session_day) where status='active'` (filet DB race expire→insert, D-43/T-04-13).
- **`packages/supabase/src/database.types.ts`** — régénéré, `analyses`/`trade_setups`
  (avec `session_day`) présents + alias `AnalysisRow/Insert`, `TradeSetupRow/Insert`,
  unions littérales `TradeDirection/RiskLevel/Confidence/SetupStatus`.
- **`packages/supabase/src/repositories/analyses.ts`** — `insertAnalysis` (retourne id).
- **`packages/supabase/src/repositories/tradeSetups.ts`** — `insertTradeSetups` +
  `expirePriorSetups(client, { instrument_id, style, session, session_day })`
  (UPDATE status='expired', miroir exact de l'index unique partiel — seul status
  transitionne, D-45/SCORE-05) + type `ImmutabilityKey`.

## Vérification

- `pnpm vitest run packages/core` → **35/35 verts** (OutputSchema 12 dont test A1
  clés-en-trop + migration-0006 7 cross-platform + tests existants 16).
- Migration appliquée ; `get_advisors` (security) → **0 alerte RLS** sur
  analyses/trade_setups (seul WARN global non lié : auth_leaked_password_protection).
- `list_tables` → `analyses` (RLS on, 0 rows) + `trade_setups` (RLS on, 0 rows).
- `pnpm --filter @app/supabase exec tsc --noEmit` → **exit 0**.

## Concerns revue tranchés ici

- **#1 (HIGH consensus)** clé d'immuabilité « jour » : matérialisée par colonne
  `session_day`, cohérente entre index unique partiel SQL et signature
  `expirePriorSetups`. Contradiction 04-01↔04-03 levée.
- **A1 (quality HIGH)** : `OutputSchema` PERMISSIF + test « parse réussit avec clés
  supplémentaires » (l'exemple §3 contient score/risk/confidence).
- **race archi [HIGH]** : index UNIQUE partiel = filet DB (RPC atomique reportée P1, documenté).
- **grep Windows-hostile** : remplacé par test `fs.readFileSync` cross-platform.

## Notes pour la suite

- 04-02 (scoring) consomme `OutputSchema`/`Output` depuis `@app/core`.
- 04-03 (persist.ts) consomme `insertAnalysis`/`insertTradeSetups`/`expirePriorSetups`
  + dérive `session_day` = `DateTime.fromISO(generated_at,{zone:'utc'}).toISODate()`.

## Self-Check: PASSED
