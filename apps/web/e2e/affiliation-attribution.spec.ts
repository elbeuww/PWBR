/**
 * E2E : attribution affiliation au signup (AFF-01).
 *
 * Flux : visiteur arrive ?ref=TESTCODE → cookie aff_ref posé → s'inscrit →
 * une ligne `referrals` est créée (attribution figée au signup, D-11).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PRÉCONDITIONS HUMAN-VERIFY (le run GREEN ne peut PAS être validé automatiquement —
 * précédent D-01-04-C). Sans ces 3 préconditions, le GREEN est non vérifiable :
 *
 *   1. Dev server lancé sur http://localhost:3000 (`pnpm --filter @app/web dev`,
 *      ou webServer Playwright configuré).
 *   2. Table `affiliate_codes` pré-populée avec le code `TESTCODE`, rattaché à un
 *      affilié seedé (affiliates.user_id distinct du compte de test signup) — via
 *      service_role (la RLS interdit l'écriture front). Sinon attributeReferral
 *      résout un code inconnu → no-op silencieux, aucune ligne referrals.
 *   3. `.env` chargé pour l'assertion DB de la ligne referrals :
 *        - SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL)
 *        - SUPABASE_SERVICE_ROLE_KEY (lecture cross-user de referrals, bypass RLS).
 *      "Confirm email" désactivé dans le Dashboard (D-02), domaine @gmail.com.
 *
 * NE PAS fabriquer un GREEN : ce spec est AUTHORÉ avec des assertions réelles. Son
 * exécution verte relève de la vérification humaine (cf. 07-04-SUMMARY.md + deferred-items.md).
 * `npx playwright test --list affiliation-attribution.spec.ts` DOIT parser le test.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Source : 07-04-PLAN.md Task 2 ; 07-RESEARCH.md §Validation Architecture (Test Map AFF-01).
 */

import { test, expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const TEST_CODE = 'TESTCODE'
const TEST_PASSWORD = 'TestPassword123!'
const tsMillis = Date.now()

function uniqueEmail(tag: string): string {
  return `e2e-aff-${tag}-${tsMillis}@gmail.com`
}

/** Client service_role pour l'assertion DB (précondition 3). */
function serviceClient() {
  const url = process.env['SUPABASE_URL'] ?? process.env['NEXT_PUBLIC_SUPABASE_URL']
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!url || !key) {
    throw new Error(
      'affiliation-attribution.spec: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY requis (précondition 3 human-verify)',
    )
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function visitWithRef(page: Page, code: string): Promise<void> {
  // Navigation top-level avec ?ref → le middleware pose aff_ref (sameSite=lax, A1).
  await page.goto(`/fr/signup?ref=${code}`)
}

async function signUp(page: Page, email: string): Promise<void> {
  await page.locator('input[name="email"]').fill(email)
  await page.locator('input[name="password"]').fill(TEST_PASSWORD)
  await page.locator('button[type="submit"]').click()
  // Cible de succès D-02-03-B (le funnel s'arrête sur l'écran honnête).
  await expect(page).toHaveURL('/fr/paiement-bientot', { timeout: 10000 })
}

test.describe('AFF-01 : attribution ?ref figée au signup', () => {
  test('?ref=TESTCODE pose le cookie aff_ref', async ({ page, context }) => {
    await visitWithRef(page, TEST_CODE)

    const cookies = await context.cookies()
    const aff = cookies.find((c) => c.name === 'aff_ref')
    expect(aff?.value).toBe(TEST_CODE)
    expect(aff?.httpOnly).toBe(true)
  })

  test('un code non conforme ne pose aucun cookie aff_ref', async ({ page, context }) => {
    await page.goto('/fr/signup?ref=bad%20code!')
    const cookies = await context.cookies()
    expect(cookies.find((c) => c.name === 'aff_ref')).toBeUndefined()
  })

  test('signup après ?ref crée une ligne referrals', async ({ page, context }) => {
    const email = uniqueEmail('attrib')
    await visitWithRef(page, TEST_CODE)
    await signUp(page, email)

    // Le cookie a été consommé (delete au signup).
    const cookies = await context.cookies()
    expect(cookies.find((c) => c.name === 'aff_ref')).toBeUndefined()

    // Assertion DB : une ligne referrals existe pour le nouvel utilisateur.
    const admin = serviceClient()
    const { data: user } = await admin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()
    expect(user?.id, 'le compte signup doit exister').toBeTruthy()

    const { data: referral } = await admin
      .from('referrals')
      .select('id, affiliate_id, user_id')
      .eq('user_id', user!.id)
      .maybeSingle()
    expect(referral, 'une ligne referrals doit attribuer le filleul à TESTCODE').toBeTruthy()
  })
})
