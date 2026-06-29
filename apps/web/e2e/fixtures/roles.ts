/**
 * roles.ts — comptes fixtures E2E déterministes par rôle (Plan 21-01, E2E-01/02, D-04).
 *
 * SOURCE DE VÉRITÉ des identités fixtures consommées par :
 *   - apps/web/e2e/auth.setup.ts  (login → storageState par rôle)
 *   - apps/jobs/scripts/seed-fixtures.ts (provisioning service_role idempotent)
 *
 * Convention d'isolation (Pitfall 2) : préfixe `e2e-fixture-` + domaine `@nexa-e2e.invalid`
 * (RFC 2606 — jamais routable). C'est la clé de la purge ciblée du seed-fixtures :
 * elle ne touche JAMAIS `source='demo'` ni `source='live'`.
 *
 * NE PAS utiliser `@gmail.com` ici : ce domaine est réservé aux comptes jetables
 * interactifs des specs existantes (auth.spec.ts). Les fixtures sont des comptes
 * service STABLES (réutilisés via storageState entre runs).
 *
 * `superadmin` est promu `role='superadmin'` par seed-fixtures (teste is_superadmin()).
 * Les 3 autres restent `role='member'`. `abonne` reçoit en plus une subscription active.
 * Aucune entrée `anon` : l'état non authentifié est l'absence de storageState.
 */

/** Mot de passe partagé des fixtures. Surchargeable via GitHub Secret en CI (21-04). */
export const FIXTURE_PASSWORD = process.env['E2E_FIXTURE_PW'] ?? 'TestPassword123!'

/** Rôles authentifiés provisionnés (anon exclu — pas de compte). */
export const FIXTURES = {
  free: { email: 'e2e-fixture-free@nexa-e2e.invalid', role: 'member' },
  abonne: { email: 'e2e-fixture-abonne@nexa-e2e.invalid', role: 'member' },
  affilie: { email: 'e2e-fixture-affilie@nexa-e2e.invalid', role: 'member' },
  superadmin: { email: 'e2e-fixture-superadmin@nexa-e2e.invalid', role: 'superadmin' },
} as const

/** Clé de rôle authentifié (free | abonne | affilie | superadmin). */
export type FixtureRole = keyof typeof FIXTURES
