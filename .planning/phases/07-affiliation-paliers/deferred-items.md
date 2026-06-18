# Deferred items — Phase 07 (affiliation-paliers)

## 07-03 — Test d'isolation RLS cross-user (réseau, human-verify)

- **Fichier** : `packages/supabase/src/repositories/__tests__/affiliate-rls.test.ts`
- **Statut** : authoré, assertions cross-user réelles présentes et exécutables ; `describe.skipIf(!HAS_ENV)` → SKIP en CI/local sans credentials (aucun GREEN fabriqué — règle D-05-01-DEFER / D-04-02).
- **Prouve** : AFF-02 — un affilié A (anon/auth-client, auth.uid()=A) ne lit AUCUNE ligne d'un affilié B sur `commissions`, `referrals`, et la vue `affiliate_dashboard` ; le superadmin (service_role bypass) voit A et B.
- **Préconditions GREEN** :
  1. `.env.test` (ou process.env) : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
  2. Migration `0016_affiliation` appliquée LIVE (déjà fait — tables + RLS + vue `affiliate_dashboard`).
  3. « Confirm email » OFF dans Supabase Dashboard (D-02) pour le signUp des 2 users de test.
  4. 2 users seedables (A et B) + promotion affilié via service_role (le test le fait dans `beforeAll`).
- **Non bloquant** : le typecheck et la suite exécutable sont verts ; ce test passe GREEN dès que l'environnement réseau est fourni.
