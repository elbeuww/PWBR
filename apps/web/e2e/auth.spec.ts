/**
 * E2E : auth signup → login → session persiste (AUTH-01)
 *
 * Pré-requis GREEN :
 *  - .env.local rempli (NEXT_PUBLIC_SUPABASE_URL + ANON_KEY)
 *  - Migration 0001 poussée sur le projet Supabase cloud
 *  - "Confirm email" désactivé dans le Dashboard (D-02)
 *  - `next dev` démarré (ou webServer Playwright configuré)
 *
 * Notes d'ajustement (Task 4 GREEN) :
 *  - Supabase Auth rejette les domaines réservés (example.com) → @gmail.com ;
 *    aucun email n'est envoyé (Confirm email OFF), comptes de test jetables.
 *  - Chaque test utilise un email unique : un second signUp avec le même email
 *    échoue ("User already registered") et casserait l'isolation des tests.
 *
 * Source : 01-PLAN.md §behavior Task 3
 */

import { test, expect, type Page } from '@playwright/test'

const tsMillis = Date.now()
const TEST_PASSWORD = 'TestPassword123!'

function uniqueEmail(tag: string): string {
  return `e2e-auth-${tag}-${tsMillis}@gmail.com`
}

async function signUp(page: Page, email: string): Promise<void> {
  await page.goto('/fr/signup')
  await page.locator('input[name="email"]').fill(email)
  await page.locator('input[name="password"]').fill(TEST_PASSWORD)
  await page.locator('button[type="submit"]').click()
  // D-09 : succès du signup → écran honnête « paiement bientôt » (pas de flux de
  // paiement en P2). La session est active ; /dashboard reste accessible (auth-only).
  await expect(page).toHaveURL('/fr/paiement-bientot', { timeout: 10000 })
}

test.describe('AUTH-01 : signup → login → session persiste', () => {
  test('signup crée un compte et redirige vers /paiement-bientot (D-09)', async ({ page }) => {
    const email = uniqueEmail('signup')
    await signUp(page, email)

    // Session active : /dashboard (auth-only) affiche l'email de l'utilisateur.
    await page.goto('/fr/dashboard')
    await expect(page.getByText(email)).toBeVisible()
  })

  test('session persiste après rechargement de la page', async ({ page }) => {
    const email = uniqueEmail('reload')
    await signUp(page, email)

    // Rechargement sur /dashboard : la session doit persister (cookies httpOnly).
    await page.goto('/fr/dashboard')
    await page.reload()
    await expect(page).toHaveURL('/fr/dashboard')
    await expect(page.getByText(email)).toBeVisible()
  })

  test('visiteur non authentifié sur /fr/dashboard est redirigé vers /fr/login', async ({
    page,
  }) => {
    // Accès direct sans session
    await page.goto('/fr/dashboard')
    await expect(page).toHaveURL('/fr/login', { timeout: 5000 })
  })

  test('login avec des credentials valides connecte et redirige', async ({ page, context }) => {
    // Créer le compte, puis purger la session pour tester le login réel
    const email = uniqueEmail('login')
    await signUp(page, email)
    await context.clearCookies()

    await page.goto('/fr/login')
    await page.locator('input[name="email"]').fill(email)
    await page.locator('input[name="password"]').fill(TEST_PASSWORD)
    await page.locator('button[type="submit"]').click()
    await expect(page).toHaveURL('/fr/dashboard', { timeout: 10000 })
  })

  test('/dashboard affiche au moins un instrument (seed)', async ({ page }) => {
    const email = uniqueEmail('seed')
    await signUp(page, email)

    // Session active → /dashboard (auth-only). La table instruments doit afficher
    // au moins une ligne de seed (12 instruments seedés au MVP, cf. CLAUDE.md).
    await page.goto('/fr/dashboard')
    const rows = page.locator('table tbody tr')
    await expect(rows.first()).toBeVisible({ timeout: 5000 })
    expect(await rows.count()).toBeGreaterThanOrEqual(1)
  })
})
