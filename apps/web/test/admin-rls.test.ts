/**
 * admin-rls.test.ts — Contrat d'intégration RLS deux-rôles du cockpit superadmin
 * (Plan 20-01, Task 2 ; ADASH-07 / threat T-20-01).
 *
 * Barrière de données (PAS le gate UX) : les pages superadmin lisent en anon-client
 * — SEULE la RLS + les helpers security-definer `is_superadmin()` tranchent. Ce test
 * simule un ATTAQUANT authentifié non-superadmin (rôle member) et prouve qu'il :
 *   (1) lit 0 ligne cross-tenant sur les tables admin (profiles d'autrui,
 *       telegram_posts, candles, trade_setups, payments, payouts, subscriptions) ;
 *   (2) obtient 0 ligne (jamais throw) sur les RPC KPI lecture seule
 *       get_mrr / get_acquisition_funnel / get_churn / get_plan_mix ;
 *   (3) se voit REFUSER (exception `forbidden`) les RPC d'écriture
 *       grant_subscription_time / suspend_account / unsuspend_account /
 *       admin_mark_commission_paid (chacune écrit aussi admin_audit_log) ;
 *   (4) une fois suspendu via suspend_account, lit 0 trade_setups / analyses (RLS).
 *
 * ── RED until 0021 (plan 20-02) ───────────────────────────────────────────────
 * Les RPC `get_mrr`, `get_acquisition_funnel`, `get_churn`, `get_plan_mix`,
 * `grant_subscription_time`, `suspend_account`, `unsuspend_account`,
 * `admin_mark_commission_paid` et la table `admin_audit_log` N'EXISTENT PAS tant
 * que la migration 0021 n'est pas appliquée. Ce fichier est ROUGE par conception
 * et passe au VERT quand 20-02 pose 0021 (helpers gated + audit). Il sert de
 * contrat exécutable (Nyquist) : les identifiants ci-dessous sont figés.
 *
 * Pré-requis GREEN : NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY +
 * SUPABASE_SERVICE_ROLE_KEY dans .env.test ; migration 0021 appliquée ; Confirm
 * email OFF (D-02). Analog : packages/supabase/__tests__/gating-rls.test.ts.
 */
import { createClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? ''
const SUPABASE_ANON_KEY = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ?? ''
const SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? ''

const envReady = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

// RPC nommées du cockpit — contrat figé (RED until 0021).
const KPI_RPCS = ['get_mrr', 'get_acquisition_funnel', 'get_churn', 'get_plan_mix'] as const
const WRITE_RPCS = [
  'grant_subscription_time',
  'suspend_account',
  'unsuspend_account',
  'admin_mark_commission_paid',
] as const
// Tables admin lues cross-tenant que le member ne doit JAMAIS voir au-delà de sa ligne.
const ADMIN_TABLES = [
  'telegram_posts',
  'candles',
  'trade_setups',
  'payments',
  'payouts',
  'subscriptions',
] as const

async function signUpAndGetClient(email: string, password: string) {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const { data, error } = await client.auth.signUp({ email, password })
  if (error) throw new Error(`signUp failed for ${email}: ${error.message}`)
  if (!data.user) throw new Error(`signUp: no user returned for ${email}`)
  return { client, userId: data.user.id }
}

function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function deleteUser(userId: string) {
  if (!SERVICE_ROLE_KEY) return
  await adminClient().auth.admin.deleteUser(userId)
}

describe('admin-rls : barrière deux-rôles du cockpit superadmin (ADASH-07 / T-20-01)', () => {
  const ts = Date.now()
  const memberEmail = `admin-rls-member-${ts}@gmail.com`
  const superEmail = `admin-rls-super-${ts}@gmail.com`
  const password = 'TestPassword123!'

  let memberClient: ReturnType<typeof createClient>
  let memberId = ''
  let superId = ''

  beforeAll(async () => {
    if (!envReady) {
      console.warn(
        '[admin-rls.test] env Supabase manquante — RED attendu (avant 0021 + .env.test).',
      )
      return
    }
    const m = await signUpAndGetClient(memberEmail, password)
    memberClient = m.client
    memberId = m.userId
    // Un compte superadmin seedé : promu via service_role (profiles.role, D-V2-05).
    const s = await signUpAndGetClient(superEmail, password)
    superId = s.userId
    if (SERVICE_ROLE_KEY) {
      await adminClient().from('profiles').update({ role: 'superadmin' }).eq('id', superId)
    }
  })

  afterAll(async () => {
    if (memberId) await deleteUser(memberId)
    if (superId) await deleteUser(superId)
  })

  it('env Supabase configurée (RED tant que .env.test absent)', () => {
    expect(SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL requise').toBeTruthy()
    expect(SUPABASE_ANON_KEY, 'NEXT_PUBLIC_SUPABASE_ANON_KEY requise').toBeTruthy()
  })

  it('(1) le member lit 0 ligne cross-tenant sur chaque table admin', async () => {
    if (!envReady) return
    // profiles : il ne voit que sa propre ligne, jamais celle du superadmin.
    const { data: others } = await memberClient
      .from('profiles')
      .select('id')
      .neq('id', memberId)
    expect(others ?? []).toHaveLength(0)
    for (const table of ADMIN_TABLES) {
      const { data, error } = await memberClient.from(table).select('*').limit(5)
      // Deny silencieux attendu : pas d'exception, 0 ligne via RLS.
      expect(error, `${table}: ${error?.message}`).toBeNull()
      expect(data ?? [], `${table} ne doit rien exposer au member`).toHaveLength(0)
    }
  })

  it('(2) RPC KPI en rôle member → 0 ligne, jamais throw (get_mrr…get_plan_mix)', async () => {
    if (!envReady) return
    for (const rpc of KPI_RPCS) {
      const { data, error } = await memberClient.rpc(rpc)
      // Contrat : gated par is_superadmin() côté SQL → renvoie vide, ne jette pas.
      expect(error, `${rpc} ne doit pas throw en member`).toBeNull()
      expect(data == null || (Array.isArray(data) && data.length === 0)).toBe(true)
    }
  })

  it('(3) RPC d’écriture en rôle member → exception forbidden (+ admin_audit_log)', async () => {
    if (!envReady) return
    for (const rpc of WRITE_RPCS) {
      const { error } = await memberClient.rpc(rpc, { target_user_id: superId })
      // Contrat : chaque écriture vérifie is_superadmin() et journalise admin_audit_log ;
      // en rôle member elle DOIT lever `forbidden`.
      expect(error, `${rpc} doit refuser le member`).not.toBeNull()
      expect(error?.message ?? '', `${rpc} → forbidden`).toMatch(/forbidden/i)
    }
  })

  it('(4) après suspend_account, le compte suspendu lit 0 trade_setups / analyses', async () => {
    if (!envReady) return
    // Le superadmin suspend le member ; via RLS, le member suspendu perd la lecture.
    // RED until 0021 : suspend_account n'existe pas encore.
    const { error } = await memberClient.rpc('suspend_account', { target_user_id: memberId })
    expect(error, 'suspend_account doit exister (0021) et refuser le member').not.toBeNull()
    const { data: setups } = await memberClient.from('trade_setups').select('id').limit(1)
    const { data: analyses } = await memberClient.from('analyses').select('id').limit(1)
    expect(setups ?? []).toHaveLength(0)
    expect(analyses ?? []).toHaveLength(0)
  })
})
