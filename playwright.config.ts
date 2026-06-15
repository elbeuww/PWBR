import { defineConfig, devices } from '@playwright/test'

/**
 * Config Playwright racine — plateforme trading "Vétéran"
 *
 * Les fichiers de test métier (auth.spec.ts, rls.test.ts) seront créés
 * dans leurs plans respectifs :
 *   - auth.spec.ts, rls.test.ts → plan 02 (auth/RLS)
 *   - runJob.test.ts            → plan 03 (jobs)
 *
 * Ce plan pose uniquement l'infrastructure de test Playwright pour que
 * les plans aval puissent y déposer leurs tests sans recréer d'infra (D-13).
 */
export default defineConfig({
  // Scanne e2e/ (auth, gating, i18n) ET tests/ (signals-rls, Plan 03-02 Task 4).
  testDir: 'apps/web',
  testMatch: ['e2e/**/*.spec.ts', 'tests/**/*.spec.ts'],

  // Timeouts raisonnables pour des tests d'intégration contre Supabase cloud
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },

  // Rapport lisible en dev
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // webServer optionnel : commenté car le serveur dev est lancé manuellement en Phase 1.
  // À décommenter + configurer pour CI (Phase Déploiement).
  //
  // webServer: {
  //   command: 'pnpm --filter web dev',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env['CI'],
  // },
})
