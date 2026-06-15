/**
 * E2E RLS signaux (T-03-RLS, MEMB-01) — Plan 03-02 Task 4.
 *
 * Prouve la barrière payante au NIVEAU DONNÉES : un utilisateur authentifié SANS
 * abonnement actif qui interroge directement trade_setups via le client anon lit
 * 0 ligne (RLS has_active_subscription(), 0009/0010). L'abonné lit la liste sans
 * erreur RLS. Et au niveau UX, le non-abonné sur /signaux est redirigé (gate).
 *
 * Mirroir du test gating P1 (apps/web/e2e/gating.spec.ts) pour la couche UX +
 * lecture anon directe pour la couche données (équivalent gating-rls.test.ts P1).
 *
 * SÉCURITÉ TEST : AUCUN service_role côté front. La lecture se fait via le client
 * anon (@supabase/supabase-js) authentifié par signIn — exactement le chemin du
 * navigateur. L'injection éventuelle d'un trade_setup de fixture (pour prouver
 * que l'abonné voit >=1 ligne) relèverait d'un util service_role HORS apps/web ;
 * ici on assert l'invariant d'isolement (non-abonné = 0), robuste même base vide.
 *
 * Pré-requis GREEN (sinon ne PAS confondre échec et absence d'env) :
 *  - .env.local rempli (NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY)
 *  - migrations 0009/0010 (RLS) + 0011 (realtime) LIVE
 *  - "Confirm email" désactivé (signUp ouvre une session)
 *  - next dev sur http://localhost:3000
 *
 * Source : 03-02-PLAN.md Task 4 ; 03-RESEARCH.md §Validation ; 03-VALIDATION.md.
 */
import { test, expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const tsMillis = Date.now()
const TEST_PASSWORD = 'TestPassword123!'
const MEMBER_SURFACE = '/fr/signaux'

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL']
const SUPABASE_ANON_KEY = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']

function uniqueEmail(tag: string): string {
  return `e2e-signals-rls-${tag}-${tsMillis}@gmail.com`
}

async function signUp(page: Page, email: string): Promise<void> {
  await page.goto('/fr/signup')
  await page.locator('input[name="email"]').fill(email)
  await page.locator('input[name="password"]').fill(TEST_PASSWORD)
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL('/fr/dashboard', { timeout: 10000 })
}

test.describe('T-03-RLS / MEMB-01 : non-abonné lit 0 trade_setup (barrière données)', () => {
  test('client anon authentifié SANS abo → SELECT trade_setups renvoie 0 ligne', async () => {
    test.skip(
      !SUPABASE_URL || !SUPABASE_ANON_KEY,
      'NEXT_PUBLIC_SUPABASE_URL / ANON_KEY requis pour le test RLS données',
    )

    // Client anon « nu » (= chemin navigateur), JAMAIS service_role.
    const supabase = createClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string)
    const email = uniqueEmail('nosub-data')

    // Crée un utilisateur authentifié mais SANS abonnement actif.
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password: TEST_PASSWORD,
    })
    expect(signUpError, 'signUp ne doit pas échouer').toBeNull()

    // Lecture directe trade_setups : la RLS doit renvoyer 0 ligne (pas une erreur).
    const { data, error } = await supabase
      .from('trade_setups')
      .select('id')
      .eq('status', 'active')
      .limit(100)

    expect(error, 'la RLS filtre silencieusement (pas d’erreur)').toBeNull()
    expect(data ?? [], 'un non-abonné ne lit AUCUN trade_setup').toHaveLength(0)
  })
})

test.describe('T-03-RLS / MEMB-01 : non-abonné redirigé hors de /signaux (gate UX)', () => {
  test('user authentifié sans abo sur /fr/signaux → redirigé (URL finale ≠ /signaux)', async ({
    page,
  }) => {
    const email = uniqueEmail('nosub-ux')
    await signUp(page, email) // session active, aucun abo actif en P1

    await page.goto(MEMBER_SURFACE)
    // requireActiveSub → /tarifs (funnel) ; l'URL finale n'est PAS la surface signaux.
    await expect(page).not.toHaveURL(/\/fr\/signaux$/, { timeout: 5000 })
    await expect(page).toHaveURL(/\/fr\/tarifs/, { timeout: 5000 })
  })

  test('visiteur non authentifié sur /fr/signaux → login + returnTo (jamais la liste)', async ({
    page,
  }) => {
    await page.goto(MEMBER_SURFACE)
    await expect(page).toHaveURL(/\/fr\/login\?returnTo=/, { timeout: 5000 })
  })
})
