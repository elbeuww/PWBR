/**
 * E2E-02 — Isolation back-office : un AUTHENTIFIÉ NON-superadmin (fixture `free`, role member)
 * reçoit 404 sur les routes `(admin)`, ET est redirigé vers /fr/tarifs sur surface member.
 *
 * Projet Playwright `free` (playwright.config.ts) : storageState `playwright/.auth/free.json`
 * (compte `e2e-fixture-free`, role='member', AUCUNE subscription active — seed-fixtures 21-01).
 *
 * (a) Routes (admin) → 404 : requireRole('superadmin') → notFound() même pour un authentifié.
 *     JAMAIS 403/200/redirect (T-21-07 : un membre légitime ne doit pas DÉDUIRE l'existence du
 *     back-office). Tests déroulés (1 route ↔ 1 test, chaque chemin + chaque toBe(404) littéral).
 * (b) Surface member /fr/signaux → /fr/tarifs : requireActiveSub redirige un authentifié SANS
 *     abonnement actif vers le funnel de conversion (ACCESS-02/D-07), JAMAIS vers /login.
 *
 * La barrière DONNÉES reste prouvée par Vitest admin-rls.test.ts (D-02, non réécrit).
 */
import { test, expect } from '@playwright/test'

test.describe('E2E-02 non-superadmin (free) → 404 sur les routes (admin)', () => {
  test('free · /admin → 404', async ({ page }) => {
    const response = await page.goto('/admin')
    expect(response?.status()).toBe(404)
  })

  test('free · /admin/membres → 404', async ({ page }) => {
    const response = await page.goto('/admin/membres')
    expect(response?.status()).toBe(404)
  })

  test('free · /admin/file → 404', async ({ page }) => {
    const response = await page.goto('/admin/file')
    expect(response?.status()).toBe(404)
  })

  test('free · /admin/affiliation/payouts → 404', async ({ page }) => {
    const response = await page.goto('/admin/affiliation/payouts')
    expect(response?.status()).toBe(404)
  })

  test('free · /admin/sante → 404', async ({ page }) => {
    const response = await page.goto('/admin/sante')
    expect(response?.status()).toBe(404)
  })

  test('free · /admin/signaux → 404', async ({ page }) => {
    const response = await page.goto('/admin/signaux')
    expect(response?.status()).toBe(404)
  })

  test('free · /admin/signaux/[id] → 404', async ({ page }) => {
    const response = await page.goto('/admin/signaux/00000000-0000-0000-0000-000000000000')
    expect(response?.status()).toBe(404)
  })
})

test.describe('E2E-02 non-abonné (free) → redirection /fr/tarifs sur surface member', () => {
  test('free · /fr/signaux (member, sans abo actif) → /fr/tarifs', async ({ page }) => {
    await page.goto('/fr/signaux')
    // requireActiveSub : authentifié SANS subscription active → funnel conversion (PAS login).
    await expect(page).toHaveURL(/\/fr\/tarifs/, { timeout: 5000 })
  })
})
