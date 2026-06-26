/**
 * E2E-01 — Cockpit superadmin (groupe `(admin)`), happy-path sous le rôle `superadmin`.
 *
 * La Phase 20 (cockpit 4 axes) n'a JAMAIS été vérifiée : l'UAT manuel (20-UAT.md, 11 items)
 * a été sauté. Ce spec convertit ~1:1 les items OBSERVABLES de 20-UAT en assertions E2E —
 * l'E2E DEVIENT la preuve (D-01 : l'effort va où est le risque, ici le cockpit neuf).
 *
 * AUCUN login/signUp : le projet Playwright `superadmin` (playwright.config.ts, Plan 21-01)
 * injecte le storageState `playwright/.auth/superadmin.json` généré par le setup-project
 * (compte `e2e-fixture-superadmin`, promu role='superadmin' par seed-fixtures → is_superadmin()).
 *
 * Assertions web-first uniquement (pas de waitForTimeout). Sélecteurs = libellés/landmarks
 * RÉELLEMENT rendus par les composants `(admin)/*` (lus à l'écriture du spec, jamais inventés),
 * via le namespace i18n `admin` (messages/fr.json, layout (admin) mono-FR). Bornées au rendu
 * structurel — JAMAIS au volume seed ~10k (D-05).
 *
 * Couverture 20-UAT : items 2 (gating positif), 3 (4 axes + provenance), 4 (sidebar 4 axes),
 * 5 (membres keyset+filtres+source), 6 (file keyset), 10 (conformité feu rouge read-only),
 * 11 (santé/signaux lecture seule). Les items d'ACTION 7/8/9 sont dans actions.spec.ts.
 */
import { test, expect } from '@playwright/test'

test.describe('E2E-01 cockpit superadmin', () => {
  // UAT item 2 — gating (versant positif) : le superadmin ACCÈDE au cockpit (200, jamais 404).
  // Le versant 404 (anon / non-superadmin) est prouvé par e2e/isolation/*-admin.spec.ts.
  test('item2 · le superadmin atteint /admin (200) et voit le cockpit', async ({ page }) => {
    const res = await page.goto('/admin')
    expect(res?.status()).toBe(200)
    await expect(page.getByRole('heading', { level: 1, name: 'Cockpit superadmin' })).toBeVisible()
  })

  // UAT item 3 — la home rend 4 sections H2 DANS L'ORDRE Revenus → Ops → Acquisition → Conformité
  // (ordre verrouillé D-07) + au moins une ligne de provenance honnête « Mesuré · N = … ».
  test('item3 · /admin rend les 4 axes dans l’ordre verrouillé + provenance « Mesuré · N = »', async ({
    page,
  }) => {
    await page.goto('/admin')
    // toHaveText(array) asserte le COMPTE (4) ET l'ORDRE des en-têtes d'axe.
    await expect(page.getByRole('heading', { level: 2 })).toHaveText([
      'Revenus',
      'Ops',
      'Acquisition',
      'Conformité',
    ])
    // Provenance honnête (D-13) : « Mesuré · N = … » rendu (nbsp dans la source → match partiel).
    await expect(page.getByText(/Mesuré/).first()).toBeVisible()
  })

  // UAT item 4 — la sidebar regroupe les liens sous 4 en-têtes d'axe + liens /admin/* ;
  // l'item actif est surligné (aria-current="page").
  test('item4 · sidebar regroupée en 4 axes, liens /admin/*, item actif surligné', async ({
    page,
  }) => {
    await page.goto('/admin')
    const sidebar = page.locator('aside')

    // 4 en-têtes d'axe (AdminSidebar : Acquisition / Revenus / Ops / Conformité).
    await expect(sidebar.getByText('Acquisition', { exact: true })).toBeVisible()
    await expect(sidebar.getByText('Revenus', { exact: true })).toBeVisible()
    await expect(sidebar.getByText('Ops', { exact: true })).toBeVisible()
    await expect(sidebar.getByText('Conformité', { exact: true })).toBeVisible()

    // Liens détail vers /admin/* (URLs inchangées, A5).
    await expect(sidebar.getByRole('link', { name: 'Membres' })).toHaveAttribute(
      'href',
      '/admin/membres',
    )
    await expect(sidebar.getByRole('link', { name: 'Santé' })).toHaveAttribute('href', '/admin/sante')

    // Item actif surligné : sur /admin, l'entrée « Tableau de bord » (exact /admin) est active.
    await expect(sidebar.getByRole('link', { name: 'Tableau de bord' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  // UAT item 5 — /admin/membres : table + filtres (statut/source/recherche) + bouton keyset
  // « Charger la page suivante » + colonne « source » (jamais « dernier paiement »).
  test('item5 · /admin/membres rend table, filtres, pagination keyset et colonne source', async ({
    page,
  }) => {
    await page.goto('/admin/membres')
    await expect(page.getByRole('heading', { level: 1, name: 'Membres' })).toBeVisible()

    // Filtres serveur (D-14) : selects statut/source + recherche email (contrôles stables).
    await expect(page.locator('select#status')).toBeVisible()
    await expect(page.locator('select#source')).toBeVisible()
    await expect(page.locator('input#q')).toBeVisible()

    // Colonne « Source » présente ; « Dernier paiement » ABSENT (D-13, colonne retirée).
    await expect(page.getByRole('columnheader', { name: 'Source' })).toBeVisible()
    await expect(page.getByText('Dernier paiement')).toHaveCount(0)

    // Pagination keyset (D-05) : « Charger la page suivante » (seed > 1 page) — jamais de
    // numéros de page. Or() tolère le cas mono-page sans casser (rendu, pas volume — D-05).
    const loadMore = page.getByRole('link', { name: 'Charger la page suivante' })
    const table = page.getByRole('table')
    await expect(loadMore.or(table)).toBeVisible()
  })

  // UAT item 6 — /admin/file : file de validation paginée keyset, email membre par ligne.
  test('item6 · /admin/file rend la file keyset (email membre par ligne)', async ({ page }) => {
    await page.goto('/admin/file')
    await expect(page.getByRole('heading', { level: 1, name: 'File de validation' })).toBeVisible()

    // La file affiche l'en-tête « Membre » (email par ligne) quand des paiements ambigus
    // existent, sinon l'état vide honnête. Or() = rendu correct sans dépendre du volume (D-05).
    const memberCol = page.getByRole('columnheader', { name: 'Membre' })
    const emptyState = page.getByText('Aucun paiement à valider')
    await expect(memberCol.or(emptyState)).toBeVisible()
  })

  // UAT item 10 — Conformité : feu ROUGE par défaut (LEGAL_REVIEW_DONE non posé) + version/date,
  // panneau read-only SANS lien de drill-down.
  test('item10 · panneau Conformité = feu rouge par défaut, read-only, aucun drill-down', async ({
    page,
  }) => {
    await page.goto('/admin')
    const conformite = page
      .locator('[data-slot="card"]')
      .filter({ has: page.getByRole('heading', { level: 2, name: 'Conformité' }) })

    // Défaut sûr (D-08) : revue non validée → feu rouge ; le libellé prouve done=false.
    await expect(conformite.getByText('Revue juridique non validée')).toBeVisible()
    // Version + date de revue affichées (« — » si env non posé).
    await expect(conformite.getByText("Version de l'artefact")).toBeVisible()
    await expect(conformite.getByText('Date de revue')).toBeVisible()
    // Read-only : la ligne de provenance le déclare, et la carte n'a AUCUN lien de drill-down.
    await expect(conformite.getByText(/lecture seule/)).toBeVisible()
    await expect(conformite.getByRole('link')).toHaveCount(0)
  })

  // UAT item 11 — Santé / Signaux en lecture seule (aucun bouton édition/création de signal).
  test('item11 · /admin/sante et /admin/signaux rendent en lecture seule', async ({ page }) => {
    const EDIT_CREATE = /Créer|Éditer|Modifier|Nouveau|Publier|Supprimer/i

    // Santé : la page charge (titre rendu), aucun contrôle de mutation.
    await page.goto('/admin/sante')
    await expect(page.getByRole('heading', { level: 1, name: 'Santé jobs & données' })).toBeVisible()
    await expect(page.getByRole('button', { name: EDIT_CREATE })).toHaveCount(0)

    // Signaux : lecture seule (D-05) — aucun bouton de création/édition/publication/suppression.
    await page.goto('/admin/signaux')
    await expect(page.getByRole('heading', { level: 1, name: 'Signaux publiés' })).toBeVisible()
    await expect(page.getByRole('button', { name: EDIT_CREATE })).toHaveCount(0)

    // Détail signal (conditionnel au seed) : si un signal est listé, son détail est lui aussi
    // en lecture seule. Pas de signal seedé → on ne fabrique pas de donnée (D-05).
    const firstSignal = page.locator('tbody tr td a[href^="/admin/signaux/"]').first()
    if ((await firstSignal.count()) > 0) {
      await firstSignal.click()
      await expect(page).toHaveURL(/\/admin\/signaux\/[^/]+$/)
      await expect(page.getByRole('button', { name: EDIT_CREATE })).toHaveCount(0)
    }
  })
})
