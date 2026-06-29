/**
 * E2E-01 — Navigation des 6 sous-routes du groupe `(dash)` sous le rôle `abonne`.
 *
 * Couvre les surfaces neuves de la Phase 19 (D-01/D-03 : flux navigation membre +
 * dashboard utilisateur). AUCUN re-signUp : le projet `abonne` (Plan 21-01) injecte
 * `playwright/.auth/abonne.json`. Assertions web-first uniquement (pas de waitForTimeout),
 * sélecteurs = en-têtes réellement rendus par les pages (namespace i18n `dash` / `payment`,
 * messages/fr.json). Bornées au rendu structurel, jamais au volume seed 10k (D-05).
 *
 * Chaque chemin littéral /fr/dashboard/<seg> apparaît dans un test déroulé (pas de boucle
 * opaque) — traçabilité 1 route ↔ 1 test.
 *
 * DEUX routes sont des ALIAS par conception (vérifié dans le code source des pages) :
 *   - /fr/dashboard/watchlist  → redirige vers /fr/dashboard/suivis (D-19-07-B, alias de
 *     la vue Suivis ; reste DANS /fr/dashboard).
 *   - /fr/dashboard/affiliation → redirige vers /affiliation/dashboard, lui-même gardé par
 *     requireRole('affiliate'). L'abonné fixture a le rôle `member` (roles.ts) → le gate
 *     renvoie vers la home `/fr`. On asserte donc le comportement RÉEL (redirection hors du
 *     dashboard membre), pas un en-tête affilié inatteignable par un member.
 */
import { test, expect } from '@playwright/test'

test.describe('E2E-01 navigation sous-routes (dash, abonné)', () => {
  test('/fr/dashboard/abonnement rend la gestion d’abonnement', async ({ page }) => {
    await page.goto('/fr/dashboard/abonnement')
    await expect(page).toHaveURL(/\/fr\/dashboard\/abonnement$/)
    // payment.planTitle = « Choisir une offre » (PlanCard réhébergée, 19-04/D-11).
    await expect(page.getByRole('heading', { level: 1, name: 'Choisir une offre' })).toBeVisible()
  })

  test('/fr/dashboard/historique rend la vue historique keyset', async ({ page }) => {
    await page.goto('/fr/dashboard/historique')
    await expect(page).toHaveURL(/\/fr\/dashboard\/historique$/)
    // dash.nav.historique = « Historique » (H1 + KeysetTabs, 19-07).
    await expect(page.getByRole('heading', { level: 1, name: 'Historique' })).toBeVisible()
  })

  test('/fr/dashboard/suivis rend la vue signaux suivis keyset', async ({ page }) => {
    await page.goto('/fr/dashboard/suivis')
    await expect(page).toHaveURL(/\/fr\/dashboard\/suivis$/)
    // dash.nav.suivis = « Suivis » (H1 + KeysetTabs, 19-07).
    await expect(page.getByRole('heading', { level: 1, name: 'Suivis' })).toBeVisible()
  })

  test('/fr/dashboard/watchlist est un alias qui mène à la vue Suivis (reste dans /fr/dashboard)', async ({
    page,
  }) => {
    await page.goto('/fr/dashboard/watchlist')
    // Alias localisé (WatchlistPage redirect → /dashboard/suivis) : ni 404 ni sortie du
    // dashboard membre ; on atterrit sur la surface Suivis.
    await expect(page).toHaveURL(/\/fr\/dashboard\/suivis$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Suivis' })).toBeVisible()
  })

  test('/fr/dashboard/parametres rend l’écran Paramètres de compte', async ({ page }) => {
    await page.goto('/fr/dashboard/parametres')
    await expect(page).toHaveURL(/\/fr\/dashboard\/parametres$/)
    // dash.nav.parametres = « Paramètres » (H1) + carte Compte (dash.settings.account).
    await expect(page.getByRole('heading', { level: 1, name: 'Paramètres' })).toBeVisible()
    await expect(page.getByText('Compte')).toBeVisible()
  })

  test('/fr/dashboard/affiliation (alias) redirige un member abonné hors du dashboard (gate affiliate)', async ({
    page,
  }) => {
    await page.goto('/fr/dashboard/affiliation')
    // DashAffiliationPage redirige vers /affiliation/dashboard ; requireRole('affiliate')
    // refuse un `member` et renvoie sur la home localisée. Comportement RÉEL attendu —
    // l'abonné fixture n'est pas affilié (roles.ts). Pas un 404, pas un 200 silencieux.
    await expect(page).toHaveURL(/\/fr\/?$/)
    await expect(page).not.toHaveURL(/\/dashboard\/affiliation$/)
  })
})
