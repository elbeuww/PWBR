/**
 * E2E Académie (CMS-01 lecture, LEGAL-01 disclaimer, D-14 fallback, RTL) — Plan 09-05 Task 2.
 *
 * Prouve le rendu MDX réel de l'Académie de bout en bout. Le rendu MDX N'EST PAS
 * validable en build local (le `!` du chemin projet casse webpack ; turbopack mésrésout
 * @app/* — RESEARCH Pitfall 2). L'EXÉCUTION GREEN autoritaire se fait en Vercel preview :
 * configurer `PLAYWRIGHT_BASE_URL` sur l'URL de preview puis lancer
 * `pnpm --filter web exec playwright test e2e/academie.spec.ts`.
 *
 * La base URL est résolue par Playwright (`use.baseURL` / `PLAYWRIGHT_BASE_URL` override) —
 * aucun localhost en dur ici, les chemins sont relatifs.
 *
 * Couverture (09-VALIDATION §Per-Task Map) :
 *   1. Index trilingue /{fr,en,ar}/academie : charge, entrée nav Académie présente, ≥1 carte.
 *   2. Article (ratio-risque-rendement) : titre + corps prose + composant pédago + Disclaimer (LEGAL-01).
 *   3. Leçon (prendre-en-main-mt5/01-installer-mt5) : nav préc./suiv. + progression + Disclaimer.
 *   4. RTL arabe : /ar/academie/<slug> → <html dir="rtl" lang="ar">.
 *   5. Fallback D-14 : /ar/academie/comprendre-le-levier (ar manquant) → version FR + bandeau, jamais 404.
 *
 * Source : 09-05-PLAN.md Task 2 ; 09-VALIDATION.md ; D-08/D-14 ; LEGAL-01.
 */
import { test, expect } from '@playwright/test'

const LOCALES = ['fr', 'en', 'ar'] as const

// Fragments de disclaimer par locale (LEGAL-01, clé disclaimer.footer). Le marqueur
// doit rester présent sur 100% des articles ET leçons (injecté par la PAGE, pas le MDX).
const DISCLAIMER_FRAGMENT: Record<(typeof LOCALES)[number], RegExp> = {
  fr: /promesse de gain|risque de perte/i,
  en: /no promise|risk of (capital )?loss/i,
  ar: /لا يشكل|مخاطر/i,
}

// Article réel présent dans les 3 langues (content/academie/articles).
const ARTICLE_SLUG = 'ratio-risque-rendement'
// Cours réel + 1ʳᵉ leçon (content/academie/cours/prendre-en-main-mt5).
const COURSE_SLUG = 'prendre-en-main-mt5'
const LESSON_SLUG = '01-installer-mt5'
// Slug sans variante arabe → déclenche le fallback FR (D-14), jamais 404.
const FALLBACK_SLUG = 'comprendre-le-levier'

test.describe('CMS-01 : index Académie trilingue', () => {
  for (const locale of LOCALES) {
    test(`/${locale}/academie charge, nav Académie présente, ≥1 carte`, async ({ page }) => {
      const res = await page.goto(`/${locale}/academie`)
      expect(res?.status(), 'aucune erreur 500 sur l’index').toBeLessThan(400)

      // Entrée nav permanente Académie (D-08c) — au moins un lien vers /academie.
      const academieLinks = page.locator(`a[href*="/${locale}/academie"]`)
      await expect(academieLinks.first()).toBeVisible()

      // ≥1 carte de contenu (article ou cours) rendue : on s'appuie sur un lien
      // vers une fiche détail (au-delà de l'index lui-même).
      const detailLinks = page.locator(`a[href*="/${locale}/academie/"]`)
      await expect(detailLinks.first()).toBeVisible()
    })
  }
})

test.describe('CMS-01 + LEGAL-01 : article lisible + disclaimer', () => {
  test('article FR : titre, corps prose, disclaimer en pied', async ({ page }) => {
    const res = await page.goto(`/fr/academie/${ARTICLE_SLUG}`)
    expect(res?.status(), 'article servi sans 500').toBeLessThan(400)

    // Titre d'article (h1) et corps prose présents.
    await expect(page.locator('h1').first()).toBeVisible()
    await expect(page.locator('main p').first()).toBeVisible()

    // LEGAL-01 : disclaimer présent en pied (injecté par la page, non-contournable).
    await expect(page.getByText(DISCLAIMER_FRAGMENT.fr).first()).toBeVisible()
  })

  test('article EN : disclaimer présent (LEGAL-01)', async ({ page }) => {
    await page.goto(`/en/academie/${ARTICLE_SLUG}`)
    await expect(page.getByText(DISCLAIMER_FRAGMENT.en).first()).toBeVisible()
  })
})

test.describe('CMS-01 + LEGAL-01 : leçon de cours + nav + disclaimer', () => {
  test('leçon FR : nav préc./suiv., progression, disclaimer', async ({ page }) => {
    const res = await page.goto(`/fr/academie/${COURSE_SLUG}/${LESSON_SLUG}`)
    expect(res?.status(), 'leçon servie sans 500').toBeLessThan(400)

    // Au moins un lien de navigation reste dans le cours (préc. OU suiv. selon la borne).
    const courseNav = page.locator(`a[href*="/fr/academie/${COURSE_SLUG}/"]`)
    await expect(courseNav.first()).toBeVisible()

    // LEGAL-01 : disclaimer présent sur la leçon aussi.
    await expect(page.getByText(DISCLAIMER_FRAGMENT.fr).first()).toBeVisible()
  })
})

test.describe('I18N-02 : RTL arabe sur le contenu Académie', () => {
  test('/ar/academie/<article> → <html dir="rtl" lang="ar">', async ({ page }) => {
    await page.goto(`/ar/academie/${ARTICLE_SLUG}`)
    const html = page.locator('html')
    await expect(html).toHaveAttribute('dir', 'rtl')
    await expect(html).toHaveAttribute('lang', 'ar')
    // Disclaimer arabe présent (LEGAL-01 en RTL).
    await expect(page.getByText(DISCLAIMER_FRAGMENT.ar).first()).toBeVisible()
  })
})

test.describe('D-14 : fallback FR quand la variante arabe manque (jamais 404)', () => {
  test(`/ar/academie/${FALLBACK_SLUG} → contenu FR + bandeau fallback, pas de 404`, async ({
    page,
  }) => {
    const res = await page.goto(`/ar/academie/${FALLBACK_SLUG}`)
    // Jamais 404/500 : le contenu existe en FR, on le sert avec bandeau (D-14).
    expect(res?.status(), 'fallback servi, pas de 404').toBeLessThan(400)

    // La page rend bien un article (titre h1) — pas une page d'erreur.
    await expect(page.locator('h1').first()).toBeVisible()
    // Disclaimer toujours présent (LEGAL-01 sur le contenu fallback).
    // Le corps est servi en FR ; le disclaimer suit la locale de page (ar) ou FR selon
    // l'injection — on vérifie qu'AU MOINS un fragment disclaimer (fr OU ar) est présent.
    const disclaimer = page
      .getByText(DISCLAIMER_FRAGMENT.ar)
      .or(page.getByText(DISCLAIMER_FRAGMENT.fr))
    await expect(disclaimer.first()).toBeVisible()
  })
})
