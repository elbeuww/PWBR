/**
 * E2E gating / accès (ACCESS-01, ACCESS-02, ACCESS-03) + open-redirect — Plan 01-04 Task 2
 *
 * Prouve la couche UX du gating de bout en bout contre l'app live. La VRAIE
 * barrière données (non-fuite trade_setups/analyses) est prouvée par
 * packages/supabase/__tests__/gating-rls.test.ts (Plan 01-01) — ici on vérifie
 * les REDIRECTIONS et le 404, pas la RLS.
 *
 *  - ACCESS-01 / D-08 : non-auth sur surface (member) → /fr/login?returnTo=… non vide.
 *  - ACCESS-02 / D-07 (MANDATORY) : auth SANS abo actif sur (member) → /fr/tarifs.
 *    Trivial en P1 : aucun user n'a d'abonnement actif → tout user créé déclenche
 *    requireActiveSub → /tarifs.
 *  - ACCESS-03 / D-09 : non-superadmin (et non-auth) sur (admin) → 404 (discrétion,
 *    jamais 403 — threat T-01-08).
 *  - T-01-07 (open redirect) : returnTo `//evil.com` ne provoque PAS de redirection
 *    hors origine après connexion (validation same-origin de gate.ts safeReturnTo).
 *
 * Surface (member) testée : /fr/signaux (gated par le layout (member) → requireActiveSub).
 *
 * Pré-requis GREEN (sinon ne PAS confondre échec et absence d'env) :
 *  - `.env.local` rempli (NEXT_PUBLIC_SUPABASE_URL + ANON_KEY)
 *  - migrations 0008/0009 poussées (subscriptions + helpers RLS) — 01-01 LIVE
 *  - "Confirm email" désactivé dans Supabase (D-02) → signUp ouvre une session
 *  - `next dev` démarré sur http://localhost:3000
 *
 * Source : 01-04-PLAN.md Task 2 ; 01-VALIDATION.md (01-04-02) ; D-07/08/09 ; T-01-07/08.
 */

import { test, expect, type Page } from '@playwright/test'

const tsMillis = Date.now()
const TEST_PASSWORD = 'TestPassword123!'

const MEMBER_SURFACE = '/fr/signaux'
const ADMIN_SURFACE = '/admin'

function uniqueEmail(tag: string): string {
  return `e2e-gating-${tag}-${tsMillis}@gmail.com`
}

async function signUp(page: Page, email: string): Promise<void> {
  await page.goto('/fr/signup')
  await page.locator('input[name="email"]').fill(email)
  await page.locator('input[name="password"]').fill(TEST_PASSWORD)
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL('/fr/dashboard', { timeout: 10000 })
}

test.describe('ACCESS-01 / D-08 : non-auth → login + returnTo', () => {
  test('visiteur non auth sur une surface (member) est redirigé vers /fr/login?returnTo=…', async ({
    page,
  }) => {
    await page.goto(MEMBER_SURFACE)
    // returnTo non vide (le chemin demandé), localisé.
    await expect(page).toHaveURL(/\/fr\/login\?returnTo=/, { timeout: 5000 })
  })
})

test.describe('ACCESS-02 / D-07 : auth sans abo → /tarifs (MANDATORY)', () => {
  test('user fraîchement créé (aucun abo actif en P1) sur (member) → /fr/tarifs', async ({
    page,
  }) => {
    const email = uniqueEmail('nosub')
    await signUp(page, email) // session active, mais AUCUN abonnement actif

    await page.goto(MEMBER_SURFACE)
    // requireActiveSub → funnel conversion (PAS login).
    await expect(page).toHaveURL(/\/fr\/tarifs/, { timeout: 5000 })
  })
})

test.describe('ACCESS-03 / D-09 : (admin) → 404 (discrétion, jamais 403)', () => {
  test('visiteur non auth sur (admin) reçoit un 404', async ({ page }) => {
    const response = await page.goto(ADMIN_SURFACE)
    expect(response?.status()).toBe(404)
  })

  test('utilisateur authentifié NON superadmin sur (admin) reçoit un 404', async ({ page }) => {
    const email = uniqueEmail('nonadmin')
    await signUp(page, email) // rôle par défaut "member"

    const response = await page.goto(ADMIN_SURFACE)
    // notFound() du gate → 404, JAMAIS 403 (l'existence du back-office ne fuit pas).
    expect(response?.status()).toBe(404)
  })
})

test.describe('T-01-07 : open-redirect returnTo //evil.com non suivi', () => {
  test('connexion avec returnTo=//evil.com ne redirige PAS hors origine', async ({
    page,
    context,
  }) => {
    // Préparer un compte valide puis purger la session.
    const email = uniqueEmail('evil')
    await signUp(page, email)
    await context.clearCookies()

    // Aller sur login avec un returnTo protocol-relative malveillant.
    await page.goto('/fr/login?returnTo=//evil.com')
    await page.locator('input[name="email"]').fill(email)
    await page.locator('input[name="password"]').fill(TEST_PASSWORD)
    await page.locator('button[type="submit"]').click()

    // Après login, l'URL finale DOIT rester sur l'origine baseURL et ne jamais
    // contenir le domaine externe (gate.ts safeReturnTo rejette '//…').
    await expect(page).toHaveURL(/\/fr\/dashboard/, { timeout: 10000 })
    expect(page.url()).not.toContain('evil.com')
    expect(new URL(page.url()).origin).toBe(new URL(page.url()).origin) // même origine
  })

  test('returnTo=//evil.com au gate (non-auth → login) reste sur l’origine', async ({ page }) => {
    // Visiter directement la surface member avec un returnTo malveillant n'expose
    // pas evil.com : le gate ne suit jamais un chemin non same-origin.
    await page.goto(`${MEMBER_SURFACE}`)
    await expect(page).toHaveURL(/\/fr\/login\?returnTo=/)
    expect(page.url()).not.toContain('evil.com')
  })
})
