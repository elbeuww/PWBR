import { defineConfig, devices } from '@playwright/test'

/**
 * Config Playwright racine — plateforme trading "Vétéran"
 *
 * Refonte multi-rôles (Plan 21-01, E2E-01/02) : projet `setup` (login par rôle →
 * storageState) + un projet par rôle consommant le storageState via dependencies.
 * Les specs aval (e2e/dash/*, e2e/admin/*, e2e/isolation/*) ne re-signUp plus.
 *
 *   - setup      : login une fois par rôle → playwright/.auth/<role>.json
 *   - smoke      : specs de non-régression existantes (D-02, sans storageState)
 *   - anon       : isolation non authentifiée (sans storageState)
 *   - free       : storageState free,      isolation membre non abonné
 *   - abonne     : storageState abonne,    dashboard utilisateur (dash/*)
 *   - affilie    : storageState affilie,   surfaces affiliation
 *   - superadmin : storageState superadmin, cockpit admin (admin/*)
 */
const baseChrome = { ...devices['Desktop Chrome'] }

export default defineConfig({
  // Scanne e2e/ (auth, gating, i18n, dash, admin, isolation) ET tests/ (gardes Vitest-PW).
  testDir: 'apps/web',
  testMatch: ['e2e/**/*.spec.ts', 'tests/**/*.spec.ts'],

  // Timeouts raisonnables pour des tests d'intégration contre Supabase cloud.
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },

  // Retries en CI uniquement (RESEARCH Pitfall 6) ; trace conservée sur 1re reprise.
  retries: process.env['CI'] ? 2 : 0,

  // Rapport lisible en dev.
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },

  projects: [
    // Setup-project : authentifie chaque rôle et écrit playwright/.auth/<role>.json.
    {
      name: 'setup',
      use: { ...baseChrome },
      testMatch: /.*\.setup\.ts/,
    },
    // Non-régression : specs existantes préservées (D-02), aucun storageState.
    {
      name: 'smoke',
      use: { ...baseChrome },
      testMatch: [
        'e2e/auth.spec.ts',
        'e2e/gating.spec.ts',
        'e2e/academie.spec.ts',
        'e2e/i18n.spec.ts',
        'e2e/affiliation-attribution.spec.ts',
        'tests/**/*.spec.ts',
      ],
    },
    // Isolation non authentifiée (état vierge).
    {
      name: 'anon',
      use: { ...baseChrome },
      testMatch: ['e2e/isolation/anon-*.spec.ts'],
    },
    // Membre non abonné.
    {
      name: 'free',
      use: { ...baseChrome, storageState: 'playwright/.auth/free.json' },
      dependencies: ['setup'],
      testMatch: ['e2e/isolation/free-*.spec.ts'],
    },
    // Dashboard utilisateur (abonné actif).
    {
      name: 'abonne',
      use: { ...baseChrome, storageState: 'playwright/.auth/abonne.json' },
      dependencies: ['setup'],
      testMatch: ['e2e/dash/**/*.spec.ts'],
    },
    // Surfaces affiliation.
    {
      name: 'affilie',
      use: { ...baseChrome, storageState: 'playwright/.auth/affilie.json' },
      dependencies: ['setup'],
      testMatch: ['e2e/**/affilie-*.spec.ts'],
    },
    // Cockpit superadmin.
    {
      name: 'superadmin',
      use: { ...baseChrome, storageState: 'playwright/.auth/superadmin.json' },
      dependencies: ['setup'],
      testMatch: ['e2e/admin/**/*.spec.ts'],
    },
  ],

  // Serveur web : build + start (production) pour la CI. En local, réutilise un
  // serveur déjà lancé (reuseExistingServer) si présent.
  webServer: {
    command: 'pnpm --filter web build && pnpm --filter web start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
})
