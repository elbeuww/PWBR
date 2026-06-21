/**
 * no-flash.spec.ts — garde Wave-0 de DESIGN-03 (Phase 10).
 *
 * Behavior gardé : quand un thème est stocké (localStorage.theme='dark'), le script
 * pré-paint de next-themes doit appliquer ce thème AVANT le premier rendu — `<html>`
 * porte la classe `dark` dès le premier paint, sans frame clair (no-flash). La garde
 * vérifie ce comportement dans les 3 locales fr/en/ar (le shell RTL ne doit pas le
 * casser). next-themes est conservé tel quel (D-06 mono-marque, 10-CONTEXT).
 *
 * Méthode : `context.addInitScript` pose localStorage.theme='dark' AVANT toute
 * navigation, puis on visite /{locale}/login et on asserte que `<html>` a la classe
 * `dark` au chargement (preuve que le thème stocké est rendu sans flash clair).
 *
 * Pré-requis GREEN (sinon ne PAS confondre échec et absence d'env) :
 *  - `pnpm --filter web dev` démarré sur http://localhost:3000 (baseURL playwright).
 *  - implémentation des plans 02/03 (tokens + thème) mergée.
 * Ce plan ne fait que CRÉER la spec (parse + --list) ; le GREEN est porté au merge
 * de la wave aval, serveur dev requis.
 *
 * Source : 10-VALIDATION.md §DESIGN-03 (no-flash) ; 10-PATTERNS.md §Wave-0 Test
 * Files ; mirror de la boucle locale de apps/web/e2e/i18n.spec.ts.
 */
import { test, expect } from '@playwright/test'

const LOCALES = ['fr', 'en', 'ar'] as const

test.describe('DESIGN-03 : thème stocké rendu sans flash (fr/en/ar)', () => {
  for (const locale of LOCALES) {
    test(`thème "dark" stocké → <html class="dark"> au premier rendu (${locale})`, async ({
      context,
      page,
    }) => {
      // Pose le thème stocké AVANT navigation : le script pré-paint next-themes doit
      // le lire et poser .dark sur <html> avant le premier paint (no light-frame).
      await context.addInitScript(() => {
        window.localStorage.setItem('theme', 'dark')
      })

      await page.goto(`/${locale}/login`)

      // <html> doit porter la classe dark dès le rendu initial (preuve no-flash).
      await expect(page.locator('html')).toHaveAttribute('class', /dark/)
    })
  }
})
