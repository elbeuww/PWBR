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

## 07-04 — E2E attribution affiliation au signup (Playwright, human-verify)

- **Fichier** : `apps/web/e2e/affiliation-attribution.spec.ts`
- **Statut** : authoré, assertions réelles (cookie aff_ref posé, code invalide ignoré, signup → ligne `referrals` via service_role). `npx playwright test --list affiliation-attribution.spec.ts` parse les 3 tests. AUCUN GREEN fabriqué (D-01-04-C).
- **Prouve** : AFF-01 bout en bout — visiteur `/fr/signup?ref=TESTCODE` → cookie `aff_ref` (httpOnly) → signup → une ligne `referrals` attribue le filleul à TESTCODE ; redirect `/fr/paiement-bientot`.
- **Préconditions GREEN (human-verify)** :
  1. Dev server lancé sur `http://localhost:3000` (`pnpm --filter @app/web dev` ou webServer Playwright).
  2. Table `affiliate_codes` pré-populée avec `TESTCODE`, rattaché à un affilié seedé (`affiliates.user_id` ≠ compte de test signup) via service_role. Sinon `attributeReferral` résout un code inconnu → no-op, aucune ligne `referrals`.
  3. `.env` chargé : `SUPABASE_URL` (ou `NEXT_PUBLIC_SUPABASE_URL`) + `SUPABASE_SERVICE_ROLE_KEY` (assertion DB cross-user de la ligne `referrals`). « Confirm email » OFF (D-02), emails `@gmail.com`.
- **Non bloquant** : le test unitaire `captureRef` (8 cas) est GREEN ; le typecheck (0) et `lint:i18n` (0) passent. Ce E2E passe GREEN dès que les 3 préconditions ci-dessus sont fournies.
