/**
 * auth.setup.ts — projet Playwright `setup` : login UNE FOIS par rôle authentifié,
 * persiste l'état de session dans playwright/.auth/<role>.json (Plan 21-01, E2E-01).
 *
 * Les projets par rôle (abonne/affilie/superadmin/free) consomment ces storageState
 * via `use.storageState` + `dependencies: ['setup']` — aucun re-signUp par test
 * (préalable strict des vagues 2-3, sinon pattern lent re-signUp de auth.spec.ts).
 *
 * Sélecteurs login répliqués VERBATIM de auth.spec.ts (L.73-77, flux prouvé). Le
 * compte est provisionné en amont par `pnpm --filter jobs seed:fixtures`.
 *
 * Sécurité (V3 ASVS) : playwright/.auth/ est gitignoré — ces fichiers contiennent
 * des cookies de session impersonnables.
 */
import { test as setup } from '@playwright/test'
import { FIXTURES, FIXTURE_PASSWORD, type FixtureRole } from './fixtures/roles'

const ROLES: readonly FixtureRole[] = ['free', 'abonne', 'affilie', 'superadmin']

for (const role of ROLES) {
  setup(`auth ${role}`, async ({ page }) => {
    await page.goto('/fr/login')
    await page.locator('input[name="email"]').fill(FIXTURES[role].email)
    await page.locator('input[name="password"]').fill(FIXTURE_PASSWORD)
    await page.locator('button[type="submit"]').click()
    // Redirection post-login prouvée (auth.spec.ts) : /fr/dashboard.
    await page.waitForURL('/fr/dashboard', { timeout: 10_000 })
    await page.context().storageState({ path: `playwright/.auth/${role}.json` })
  })
}
