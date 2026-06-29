/**
 * E2E-01 — Vue d'ensemble du dashboard utilisateur `/fr/dashboard` sous le rôle `abonne`.
 *
 * Couvre la home « Cockpit personnel » livrée en Phase 19 (19-04), jamais testée en E2E
 * (D-01 : l'effort va où est le risque). AUCUN login/signUp ici : le projet Playwright
 * `abonne` (playwright.config.ts, Plan 21-01) injecte le storageState
 * `playwright/.auth/abonne.json` généré par le setup-project. Les specs réutilisent donc
 * une session abonné réelle (subscription active déterministe seedée par seed-fixtures).
 *
 * Assertions web-first uniquement (pas de waitForTimeout) — calquées sur auth.spec.ts.
 * Sélecteurs stables = en-têtes réellement rendus par
 * apps/web/src/app/[locale]/(dash)/dashboard/page.tsx via le namespace i18n `dash`
 * (messages/fr.json). On ne dépend PAS du volume seed 10k (D-05) : seules des sections
 * structurelles déterministes sont vérifiées, jamais un compte exact de lignes.
 */
import { test, expect } from '@playwright/test'

test.describe('E2E-01 dashboard overview (abonné)', () => {
  test("l'abonné atteint /fr/dashboard et voit la vue d'ensemble (pas de redirection)", async ({
    page,
  }) => {
    await page.goto('/fr/dashboard')

    // L'abonné a une subscription active → pas de redirection vers /tarifs (requireActiveSub)
    // ni vers /login (requireUser). L'URL reste la home dashboard.
    await expect(page).toHaveURL(/\/fr\/dashboard$/)

    // Titre H1 de la vue d'ensemble (dash.overview.title = « Cockpit personnel »).
    await expect(page.getByRole('heading', { level: 1, name: 'Cockpit personnel' })).toBeVisible()
  })

  test("les sections clés de l'overview sont rendues (statut, signaux, raccourcis)", async ({
    page,
  }) => {
    await page.goto('/fr/dashboard')

    // Ordre vertical FIGÉ (D-08) — trois sections H2 réellement rendues par page.tsx.
    await expect(
      page.getByRole('heading', { level: 2, name: "Statut de l'abonnement" }),
    ).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'Derniers signaux' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'Raccourcis' })).toBeVisible()

    // L'abonné actif voit l'état « abonnement actif » (dash.overview.activeUntil), JAMAIS
    // le bloc RENOUVELLEMENT (dash.renewal.title). Borné au rendu, pas au volume seed (D-05).
    await expect(page.getByText('Abonnement actif —')).toBeVisible()
    await expect(page.getByText('Votre abonnement a expiré')).toHaveCount(0)
  })
})
