/**
 * E2E-01 — Actions superadmin réversibles (groupe `(admin)`), sous le rôle `superadmin`.
 *
 * Convertit les 3 items d'ACTION de 20-UAT (7 offrir du temps · 8 suspendre/réactiver ·
 * 9 marquer commission payée) en preuve E2E (D-01, UAT manuel sauté). AUCUN login : le
 * projet Playwright `superadmin` (Plan 21-01) injecte `playwright/.auth/superadmin.json`.
 *
 * RÉVERSIBILITÉ (threat T-21-09) : toute mutation destructive cible le fixture `free`
 * (`e2e-fixture-free`, JAMAIS l'abonné utilisé par 21-02) et est RÉTABLIE avant la fin de
 * la suite (réactivation in-test + filet de sécurité `afterAll`). Le payout cible une
 * commission « due » seedée démo ; à défaut, le test est sauté (D-05, jamais de donnée
 * fabriquée). La barrière d'ÉCRITURE (is_superadmin() DANS le RPC) reste prouvée par
 * Vitest admin-rls.test.ts (T-21-08, non réécrit) — ici on prouve l'effet UI/DOM.
 *
 * Les RPC gated passent par les Server Actions (anon-client + RPC SECURITY DEFINER) ;
 * succès → toast sonner « Action effectuée » (admin.actionSuccess), échec → « Échec de
 * l'action… » (admin.actionError). Assertions web-first uniquement (pas de waitForTimeout).
 */
import { test, expect } from '@playwright/test'
import { FIXTURES } from '../fixtures/roles'

const FREE_EMAIL = FIXTURES.free.email
const BASE = process.env['PLAYWRIGHT_BASE_URL'] ?? 'http://localhost:3000'
const SUCCESS_TOAST = 'Action effectuée'

/** URL membres filtrée sur le fixture free → ligne unique ciblable. */
function freeMembersUrl(): string {
  return `/admin/membres?q=${encodeURIComponent(FREE_EMAIL)}`
}

test.describe('E2E-01 actions superadmin (réversibles)', () => {
  // UAT item 7 — « Offrir du temps gratuit » : dialog presets 7j/1mois/3mois + CTA
  // « Confirmer la prolongation ». Action ADDITIVE (prolonge) → non destructive, ciblée free.
  test('item7 · offrir du temps gratuit (presets + confirmation → toast)', async ({ page }) => {
    await page.goto(freeMembersUrl())
    const row = page.getByRole('row').filter({ hasText: FREE_EMAIL })
    await expect(row).toHaveCount(1)

    // Ouvre le menu d'actions de la ligne (trigger aria-label = « Offrir du temps gratuit »).
    await row.getByRole('button', { name: 'Offrir du temps gratuit' }).click()
    await page.getByRole('menuitem', { name: 'Offrir du temps gratuit' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Offrir du temps gratuit')).toBeVisible()
    await expect(dialog.getByText('Durée à offrir')).toBeVisible()

    // Presets whitelistés (T-20-10) exposés par le select.
    await dialog.getByRole('combobox').click()
    await expect(page.getByRole('option', { name: '7 jours' })).toBeVisible()
    await expect(page.getByRole('option', { name: '1 mois' })).toBeVisible()
    await expect(page.getByRole('option', { name: '3 mois' })).toBeVisible()
    await page.getByRole('option', { name: '7 jours' }).click()

    // CTA accent → RPC grant gated → toast de succès.
    await dialog.getByRole('button', { name: 'Confirmer la prolongation' }).click()
    await expect(page.getByText(SUCCESS_TOAST)).toBeVisible()
  })

  // UAT item 8 — Suspendre (destructive, motif REQUIS, CTA rouge) PUIS réactiver. Ciblé
  // EXPLICITEMENT sur le fixture free ; état final = actif (réversibilité garantie).
  test('item8 · suspendre puis réactiver le fixture free (état final actif)', async ({ page }) => {
    // --- Suspendre ---
    await page.goto(freeMembersUrl())
    const row = page.getByRole('row').filter({ hasText: FREE_EMAIL })
    await expect(row).toHaveCount(1)
    await row.getByRole('button', { name: 'Offrir du temps gratuit' }).click()
    await page.getByRole('menuitem', { name: 'Suspendre' }).click()

    const suspendDialog = page.getByRole('alertdialog')
    await expect(suspendDialog.getByText('Suspendre ce compte ?')).toBeVisible()

    // Motif REQUIS : le CTA destructif est désactivé tant que le motif est vide (D-17).
    const confirmSuspend = suspendDialog.getByRole('button', { name: 'Suspendre' })
    await expect(confirmSuspend).toBeDisabled()
    await suspendDialog.getByRole('textbox').fill('E2E réversible — suspension de test')
    await expect(confirmSuspend).toBeEnabled()
    await confirmSuspend.click()
    await expect(page.getByText(SUCCESS_TOAST)).toBeVisible()

    // --- Réactiver --- (recharge → l'état suspended re-rendu serveur expose « Réactiver »)
    await page.goto(freeMembersUrl())
    const row2 = page.getByRole('row').filter({ hasText: FREE_EMAIL })
    await row2.getByRole('button', { name: 'Offrir du temps gratuit' }).click()
    await page.getByRole('menuitem', { name: 'Réactiver' }).click()

    const reactivateDialog = page.getByRole('alertdialog')
    await expect(reactivateDialog.getByText('Réactiver ce compte ?')).toBeVisible()
    await reactivateDialog.getByRole('button', { name: 'Réactiver' }).click()
    await expect(page.getByText(SUCCESS_TOAST)).toBeVisible()
  })

  // UAT item 9 — « Marquer comme payé » : RPC admin_mark_commission_paid gated → toast +
  // état payé ; un second paiement est IMPOSSIBLE (le bouton de la ligne disparaît).
  test('item9 · marquer une commission payée (toast + pas de double-paiement)', async ({ page }) => {
    await page.goto('/admin/affiliation/payouts')
    await expect(page.getByRole('heading', { level: 1, name: 'Commissions à payer' })).toBeVisible()

    const payButtons = page.getByRole('button', { name: 'Marquer comme payé' })
    const before = await payButtons.count()
    // Pas de commission « due » seedée → action non exerçable sans fabriquer de donnée (D-05).
    test.skip(before === 0, 'Aucune commission « due » seedée — payout non exerçable (D-05)')

    await payButtons.first().click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog.getByText('Marquer la commission comme payée')).toBeVisible()

    // Saisie OBLIGATOIRE tx_hash + montant + date (D-15, traçabilité on-chain).
    await page.locator('input[id^="txhash-"]').first().fill(`e2e-tx-${Date.now()}`)
    await page.locator('input[id^="amount-"]').first().fill('1.00')
    await page.locator('input[id^="paidat-"]').first().fill('2026-06-27')

    await dialog.getByRole('button', { name: 'Marquer comme payé' }).click()
    await expect(page.getByText(SUCCESS_TOAST)).toBeVisible()

    // Anti double-paiement (D-15) : la commission passe à « payée » → son bouton disparaît.
    await expect(payButtons).toHaveCount(before - 1)
  })
})

// Filet de sécurité (T-21-09) : quoi qu'il advienne des assertions ci-dessus, le fixture free
// DOIT finir non suspendu pour rester réutilisable (idempotence inter-runs). Contexte dédié
// monté sur le storageState superadmin.
test.afterAll(async ({ browser }) => {
  const ctx = await browser.newContext({
    storageState: 'playwright/.auth/superadmin.json',
    baseURL: BASE,
  })
  const page = await ctx.newPage()
  try {
    await page.goto(`/admin/membres?q=${encodeURIComponent(FREE_EMAIL)}`)
    const row = page.getByRole('row').filter({ hasText: FREE_EMAIL })
    if ((await row.count()) === 0) return
    await row.getByRole('button', { name: 'Offrir du temps gratuit' }).click()
    const reactivate = page.getByRole('menuitem', { name: 'Réactiver' })
    if ((await reactivate.count()) > 0) {
      await reactivate.click()
      await page.getByRole('alertdialog').getByRole('button', { name: 'Réactiver' }).click()
      await page
        .getByText('Action effectuée')
        .waitFor({ timeout: 5000 })
        .catch(() => undefined)
    }
  } catch {
    // best-effort — ne jamais faire échouer la suite sur le nettoyage.
  } finally {
    await ctx.close()
  }
})
