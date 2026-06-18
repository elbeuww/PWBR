/**
 * Test d'isolation RLS cross-user affiliation (AFF-02 — « isolation RLS prouvée », Pitfall 6).
 *
 * Miroir de gating-rls.test.ts. Prouve la barrière de DONNÉES (pas le gate UX) :
 * un affilié A authentifié via anon-client (auth.uid()=A) ne lit AUCUNE ligne
 * appartenant à un affilié B sur :
 *   - referrals          (D-11, RLS using affiliate_id ∈ mes affiliates)
 *   - commissions        (D-05, RLS idem)
 *   - affiliate_dashboard (D-13/D-14, vue security_invoker=true scopée auth.uid())
 * et un superadmin (service_role bypass) voit A ET B.
 *
 * ⚠️ La LECTURE testée passe par un anon/auth-client (PAS service_role) : SEULE la RLS
 * tranche. Le seeding (création des 2 affiliés + leurs lignes) utilise service_role —
 * mais jamais la lecture asserted.
 *
 * skipIf(!SERVICE_ROLE_KEY) : sans credentials/réseau (CI locale, D-05-01-DEFER), le
 * fichier est SKIP — mais la structure d'assertion cross-user est présente et exécutable
 * dès que .env.test (NEXT_PUBLIC_SUPABASE_URL + ANON_KEY + SUPABASE_SERVICE_ROLE_KEY)
 * et 2 users seedés sont disponibles. Pré-requis GREEN :
 *   - migration 0016 appliquée (tables + RLS + vue affiliate_dashboard)
 *   - "Confirm email" OFF (D-02)
 */
import { createClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Database } from '../../database.types'

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? ''
const SUPABASE_ANON_KEY = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ?? ''
const SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? ''

const HAS_ENV = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SERVICE_ROLE_KEY)

function adminClient() {
  return createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function signUpAndGetClient(email: string, password: string) {
  const client = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY)
  const { data, error } = await client.auth.signUp({ email, password })
  if (error) throw new Error(`signUp failed for ${email}: ${error.message}`)
  if (!data.user) throw new Error(`signUp: no user returned for ${email}`)
  return { client, userId: data.user.id }
}

async function deleteUser(userId: string) {
  if (!SERVICE_ROLE_KEY) return
  await adminClient().auth.admin.deleteUser(userId)
}

// describe.skipIf : sans credentials/réseau, on SKIP (miroir des tests réseau existants).
describe.skipIf(!HAS_ENV)('RLS isolation affiliation cross-user (AFF-02)', () => {
  const tsMillis = Date.now()
  const emailA = `aff-rls-a-${tsMillis}@gmail.com`
  const emailB = `aff-rls-b-${tsMillis}@gmail.com`
  const password = 'TestPassword123!'

  let clientA: ReturnType<typeof createClient<Database>>
  let userIdA: string
  let userIdB: string
  let affiliateIdA: string | undefined
  let affiliateIdB: string | undefined

  beforeAll(async () => {
    const a = await signUpAndGetClient(emailA, password)
    clientA = a.client
    userIdA = a.userId
    const b = await signUpAndGetClient(emailB, password)
    userIdB = b.userId

    const admin = adminClient()

    // Promouvoir A et B en affiliés (service_role — seeding).
    const { data: affA, error: errA } = await admin
      .from('affiliates')
      .insert({ user_id: userIdA })
      .select('id')
      .single()
    if (errA) throw new Error(`seed affiliate A: ${errA.message}`)
    affiliateIdA = affA?.id

    const { data: affB, error: errB } = await admin
      .from('affiliates')
      .insert({ user_id: userIdB })
      .select('id')
      .single()
    if (errB) throw new Error(`seed affiliate B: ${errB.message}`)
    affiliateIdB = affB?.id

    // Semer une commission appartenant à B uniquement (referral_id null = pas de PII filleul).
    const { error: cErr } = await admin.from('commissions').insert({
      affiliate_id: affiliateIdB!,
      referral_id: null,
      period: '2026-06',
      rate_bps: 800,
      base_atomic: '1000000',
      amount_atomic: '80000',
      status: 'due',
    })
    if (cErr) throw new Error(`seed commission B: ${cErr.message}`)
  })

  afterAll(async () => {
    const admin = adminClient()
    if (affiliateIdB) await admin.from('affiliates').delete().eq('id', affiliateIdB)
    if (affiliateIdA) await admin.from('affiliates').delete().eq('id', affiliateIdA)
    if (userIdA) await deleteUser(userIdA)
    if (userIdB) await deleteUser(userIdB)
  })

  it('A ne lit AUCUNE commission de B (referral/commission isolation, D-05)', async () => {
    // Lecture via clientA (anon/auth-client, auth.uid()=A) — JAMAIS service_role.
    const { data, error } = await clientA.from('commissions').select('affiliate_id')
    expect(error, `SELECT commissions: ${error?.message}`).toBeNull()
    // Aucune ligne de B ne doit apparaître dans le résultat scopé sur A.
    const fromB = (data ?? []).filter((r) => r.affiliate_id === affiliateIdB)
    expect(fromB).toHaveLength(0)
  })

  it('A ne lit AUCUN referral de B', async () => {
    const { data, error } = await clientA.from('referrals').select('affiliate_id')
    expect(error, `SELECT referrals: ${error?.message}`).toBeNull()
    const fromB = (data ?? []).filter((r) => r.affiliate_id === affiliateIdB)
    expect(fromB).toHaveLength(0)
  })

  it('A ne voit QUE sa ligne dans affiliate_dashboard (vue no-PII scopée, D-13)', async () => {
    const { data, error } = await clientA.from('affiliate_dashboard').select('affiliate_id')
    expect(error, `SELECT affiliate_dashboard: ${error?.message}`).toBeNull()
    // La vue security_invoker scope sur auth.uid() : la ligne de B n'apparaît jamais.
    const fromB = (data ?? []).filter((r) => r.affiliate_id === affiliateIdB)
    expect(fromB).toHaveLength(0)
  })

  it('le superadmin (service_role bypass) voit A ET B', async () => {
    const { data, error } = await adminClient().from('affiliates').select('id')
    expect(error, `SELECT affiliates (admin): ${error?.message}`).toBeNull()
    const ids = (data ?? []).map((r) => r.id)
    expect(ids).toContain(affiliateIdA)
    expect(ids).toContain(affiliateIdB)
  })
})
