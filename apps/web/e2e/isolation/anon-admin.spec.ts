/**
 * E2E-02 — Isolation back-office : un VISITEUR ANONYME reçoit 404 sur toutes les routes `(admin)`.
 *
 * Projet Playwright `anon` (playwright.config.ts) : AUCUN storageState → état non authentifié.
 * Le layout (admin) applique requireRole('superadmin') → notFound() : un non-superadmin (a
 * fortiori un anon) obtient un 404 DISCRET. JAMAIS 403, JAMAIS 200, JAMAIS une redirection —
 * l'existence du back-office ne doit pas fuir (threat T-21-07 / T-01-08, énumération).
 *
 * La VRAIE barrière DONNÉES cross-user reste prouvée par Vitest (packages/.../admin-rls.test.ts,
 * non réécrit, D-02) ; ce spec prouve la frontière HTTP. Tests DÉROULÉS (un test() par route)
 * pour que chaque chemin littéral et chaque `toBe(404)` apparaisse dans le fichier.
 *
 * NB : `/admin`, `/admin/signaux`, `/admin/signaux/[id]`, `/admin/sante` sont déjà couverts pour
 * des comptes JETABLES par gating.spec.ts. Valeur ajoutée ici : routes cockpit Phase 20
 * supplémentaires (/admin/membres, /admin/file, /admin/affiliation/payouts) sous le projet anon stable.
 */
import { test, expect } from '@playwright/test'

test.describe('E2E-02 anon → 404 sur toutes les routes (admin)', () => {
  test('anon · /admin → 404', async ({ page }) => {
    const response = await page.goto('/admin')
    expect(response?.status()).toBe(404)
  })

  test('anon · /admin/membres → 404', async ({ page }) => {
    const response = await page.goto('/admin/membres')
    expect(response?.status()).toBe(404)
  })

  test('anon · /admin/file → 404', async ({ page }) => {
    const response = await page.goto('/admin/file')
    expect(response?.status()).toBe(404)
  })

  test('anon · /admin/affiliation/payouts → 404', async ({ page }) => {
    const response = await page.goto('/admin/affiliation/payouts')
    expect(response?.status()).toBe(404)
  })

  test('anon · /admin/sante → 404', async ({ page }) => {
    const response = await page.goto('/admin/sante')
    expect(response?.status()).toBe(404)
  })

  test('anon · /admin/signaux → 404', async ({ page }) => {
    const response = await page.goto('/admin/signaux')
    expect(response?.status()).toBe(404)
  })

  // [id] concret quelconque : la garde du layout déclenche AVANT toute lecture de données,
  // un id inexistant exerce le segment de route sans dépendre d'un signal réel.
  test('anon · /admin/signaux/[id] → 404', async ({ page }) => {
    const response = await page.goto('/admin/signaux/00000000-0000-0000-0000-000000000000')
    expect(response?.status()).toBe(404)
  })
})
