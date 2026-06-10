/**
 * E2E : auth signup → login → session persiste (AUTH-01)
 *
 * Ces tests sont RED tant que :
 *  - .env.local n'est pas rempli (NEXT_PUBLIC_SUPABASE_URL + ANON_KEY)
 *  - La migration 0001 n'est pas poussée sur le projet Supabase cloud
 *  - "Confirm email" n'est pas désactivé dans le Dashboard (D-02)
 *  - `next dev` n'est pas démarré (ou webServer Playwright configuré)
 *
 * Ils deviendront GREEN en Task 4 après les checkpoints human-action + human-verify.
 *
 * Source : 01-PLAN.md §behavior Task 3
 */

import { test, expect } from '@playwright/test'

const tsMillis = Date.now()
const TEST_EMAIL = `e2e-auth-${tsMillis}@example.com`
const TEST_PASSWORD = 'TestPassword123!'

test.describe('AUTH-01 : signup → login → session persiste', () => {
  test('signup crée un compte et redirige vers /dashboard', async ({ page }) => {
    await page.goto('/signup')

    // Remplir le formulaire
    await page.locator('input[name="email"]').fill(TEST_EMAIL)
    await page.locator('input[name="password"]').fill(TEST_PASSWORD)
    await page.locator('button[type="submit"]').click()

    // Doit être redirigé vers /dashboard après signup
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 })

    // Le dashboard doit afficher l'email de l'utilisateur
    await expect(page.locator('p')).toContainText(TEST_EMAIL)
  })

  test('session persiste après rechargement de la page', async ({ page }) => {
    // Signup d'abord
    await page.goto('/signup')
    await page.locator('input[name="email"]').fill(TEST_EMAIL)
    await page.locator('input[name="password"]').fill(TEST_PASSWORD)
    await page.locator('button[type="submit"]').click()
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 })

    // Rechargement : la session doit persister (cookies httpOnly)
    await page.reload()
    await expect(page).toHaveURL('/dashboard')
    await expect(page.locator('p')).toContainText(TEST_EMAIL)
  })

  test('visiteur non authentifié sur /dashboard est redirigé vers /login', async ({ page }) => {
    // Accès direct sans session
    await page.goto('/dashboard')
    await expect(page).toHaveURL('/login', { timeout: 5000 })
  })

  test('/dashboard affiche au moins un instrument (seed)', async ({ page }) => {
    // Login d'abord
    await page.goto('/login')
    await page.locator('input[name="email"]').fill(TEST_EMAIL)
    await page.locator('input[name="password"]').fill(TEST_PASSWORD)
    await page.locator('button[type="submit"]').click()
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 })

    // La table instruments doit afficher au moins une ligne (seed)
    const rows = page.locator('table tbody tr')
    await expect(rows).toHaveCount(3, { timeout: 5000 }) // 3 seeds : XAU_USD, EUR_USD, BTCUSDT
  })

  test('login avec des credentials valides connecte et redirige', async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[name="email"]').fill(TEST_EMAIL)
    await page.locator('input[name="password"]').fill(TEST_PASSWORD)
    await page.locator('button[type="submit"]').click()
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 })
  })
})
