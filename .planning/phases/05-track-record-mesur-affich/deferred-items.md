# Deferred Items — Phase 05

Out-of-scope discoveries logged during execution. NOT fixed (SCOPE BOUNDARY).

## Plan 05-01

- **Tests d'intégration Supabase rouges hors scope** (découvert au run de la full suite après Task 3) :
  - `apps/jobs/__tests__/runJob.test.ts` > « écrit job_runs status=success … » (1 fail)
  - `packages/supabase/__tests__/idempotency.test.ts` > « upsert candles DATA-06 » (1 fail)
  - `packages/supabase/__tests__/snapshots-rls.test.ts` (skipped/flakey)
  - **Cause** : ces tests frappent la base Supabase **live** (insertions `job_runs`/`candles`/`snapshots`), dépendent du réseau + `.env.test`. Échec par timeout/connexion réseau, pas par régression de code.
  - **Pourquoi hors scope** : aucun de ces fichiers n'est touché par le plan 05-01 (plan 100% logique pure, zéro I/O). Mes 17 tests neufs (11 replay + 6 threshold) sont 100% verts ; `pnpm typecheck` propre.
  - **Action** : non corrigé. À traiter dans le plan d'intégration job (05-02) où l'env Supabase de test est requis.
