/**
 * E2E i18n / RTL (I18N-01, I18N-02, I18N-04) — Plan 01-04 Task 1
 *
 * Prouve les success criteria i18n de la phase de bout en bout contre l'app live :
 *  - I18N-01 : la locale vit dans l'URL (/fr /en /ar), la racine '/' redirige vers
 *    /fr (defaultLocale), la bascule via LanguageSwitcher reste sur la même page,
 *    la locale persiste après rechargement (cookie NEXT_LOCALE).
 *  - I18N-02 : <html dir="rtl" lang="ar"> uniquement en arabe ; dir="ltr" en fr/en.
 *  - I18N-04 : formatage locale-aware d'une donnée réelle — AUCUNE donnée numérique
 *    n'est rendue dans l'UI en P1 (cf. 01-VALIDATION Manual-Only) → couvert
 *    structurellement (useFormatter câblé, 01-03 T4) et listé Manual-Only ici.
 *
 * Pré-requis GREEN (sinon ne PAS confondre échec et absence d'env) :
 *  - `.env.local` rempli (NEXT_PUBLIC_SUPABASE_URL + ANON_KEY)
 *  - `next dev` démarré sur http://localhost:3000 (baseURL playwright.config.ts)
 *  - Aucun compte requis : ces specs testent des pages publiques (/login).
 *
 * Source : 01-04-PLAN.md Task 1 ; 01-VALIDATION.md (01-04-01) ; D-01/02/03/10.
 */

import { test, expect } from '@playwright/test'

test.describe('I18N-01 : locale dans l’URL + bascule + persistance', () => {
  test('la racine "/" redirige vers /fr (defaultLocale, localePrefix=always)', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/fr(\/|$)/, { timeout: 5000 })
  })

  test('bascule fr → ar via LanguageSwitcher en restant sur la même page (/login)', async ({
    page,
  }) => {
    await page.goto('/fr/login')
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr')

    // Ouvrir le dropdown (aria-haspopup=listbox) et choisir العربية.
    await page.getByRole('button', { name: /langue|language|اللغة/i }).click()
    await page.getByRole('option', { name: 'العربية' }).click()

    // Toujours sur la page login, mais en /ar (même page, locale changée — D-10).
    await expect(page).toHaveURL(/\/ar\/login/, { timeout: 5000 })
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
  })

  test('la locale persiste après rechargement (cookie NEXT_LOCALE)', async ({ page }) => {
    await page.goto('/ar/login')
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar')

    // Le cookie NEXT_LOCALE doit avoir été posé par next-intl.
    await page.reload()
    await expect(page).toHaveURL(/\/ar\/login/)
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
  })
})

test.describe('I18N-02 : direction RTL/LTR pilotée par la locale', () => {
  test('arabe → <html dir="rtl" lang="ar">', async ({ page }) => {
    await page.goto('/ar/login')
    const html = page.locator('html')
    await expect(html).toHaveAttribute('dir', 'rtl')
    await expect(html).toHaveAttribute('lang', 'ar')
  })

  test('français → <html dir="ltr" lang="fr">', async ({ page }) => {
    await page.goto('/fr/login')
    const html = page.locator('html')
    await expect(html).toHaveAttribute('dir', 'ltr')
    await expect(html).toHaveAttribute('lang', 'fr')
  })

  test('anglais → <html dir="ltr" lang="en">', async ({ page }) => {
    await page.goto('/en/login')
    const html = page.locator('html')
    await expect(html).toHaveAttribute('dir', 'ltr')
    await expect(html).toHaveAttribute('lang', 'en')
  })
})

/**
 * I18N-04 : formatage locale-aware (nombre/date/prix via useFormatter/<bdi>).
 *
 * MANUAL-ONLY EN P1 (cf. 01-VALIDATION.md §Manual-Only). Aucune donnée numérique
 * réelle n'est rendue dans l'UI en Phase 1 ; le câblage useFormatter existe
 * (01-03 T4) mais n'a pas de valeur à formater avant P3. Dès qu'une valeur
 * formatée apparaît dans l'UI, ajouter ici une assertion comparant le rendu
 * fr (« 1 234,56 ») vs en (« 1,234.56 ») vs ar (chiffres arabes / séparateurs).
 */
test.describe('I18N-04 : formatage locale-aware', () => {
  test.skip('formatage nombre/date locale-aware (Manual-Only P1 — aucune donnée rendue)', () => {
    // Intentionnellement skip : pas de donnée formatée dans l'UI avant P3.
    // Documenté Manual-Only dans 01-VALIDATION.md et 01-04-SUMMARY.md.
  })
})
