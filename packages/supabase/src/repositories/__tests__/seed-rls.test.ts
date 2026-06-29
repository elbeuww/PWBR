/**
 * seed-rls.test.ts — preuve d'isolation RLS du dataset démo (SEED-03 / D-07, Pitfall 3).
 *
 * Calque EXACT de affiliate-rls.test.ts. Prouve la barrière de DONNÉES (pas le gate
 * UX) sur deux invariants critiques du seed :
 *   (a) un non-abonné lit 0 `trade_setups`  (barrière `has_active_subscription()`)
 *   (b) un user A ne lit AUCUN `payments` de user B (RLS scopée user_id)
 *
 * ⚠️ La LECTURE assertée passe TOUJOURS par un anon/auth-client (PAS service_role) :
 * SEULE la RLS tranche. Lire via service_role serait un faux vert (bypass RLS,
 * Pitfall 3 / T-18-02). Le seeding des fixtures (création du payment de B) utilise
 * service_role — mais jamais la lecture asserted.
 *
 * skipIf(!HAS_ENV) : sans credentials/réseau (CI locale sans .env.test), le fichier
 * est SKIP — mais la structure d'assertion est complète et exécutable dès que
 * .env.test (NEXT_PUBLIC_SUPABASE_URL + ANON_KEY + SUPABASE_SERVICE_ROLE_KEY) et le
 * réseau sont disponibles. Pré-requis GREEN :
 *   - migration 0018 appliquée (colonne `source` sur les 8 tables)
 *   - RLS trade_setups gatée par has_active_subscription()
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
describe.skipIf(!HAS_ENV)('RLS isolation dataset démo (SEED-03)', () => {
  const tsMillis = Date.now()
  const emailA = `seed-rls-a-${tsMillis}@gmail.com`
  const emailB = `seed-rls-b-${tsMillis}@gmail.com`
  const password = 'TestPassword123!'

  let clientA: ReturnType<typeof createClient<Database>>
  let userIdA: string
  let userIdB: string
  let paymentIdB: string | undefined

  beforeAll(async () => {
    const a = await signUpAndGetClient(emailA, password)
    clientA = a.client
    userIdA = a.userId
    const b = await signUpAndGetClient(emailB, password)
    userIdB = b.userId

    const admin = adminClient()

    // Semer un paiement appartenant à B uniquement (source 'demo', montant atomique
    // en string, status verified). Service_role = seeding, jamais lu en assertion.
    const { data: pay, error: pErr } = await admin
      .from('payments')
      .insert({
        user_id: userIdB,
        plan: 'standard',
        tx_hash: `seed-rls-${tsMillis}`,
        expected_amount_atomic: '9000000',
        amount_atomic: '9000000',
        status: 'verified',
        source: 'demo',
      })
      .select('id')
      .single()
    if (pErr) throw new Error(`seed payment B: ${pErr.message}`)
    paymentIdB = pay?.id
  })

  afterAll(async () => {
    const admin = adminClient()
    if (paymentIdB) await admin.from('payments').delete().eq('id', paymentIdB)
    if (userIdA) await deleteUser(userIdA)
    if (userIdB) await deleteUser(userIdB)
  })

  it('un non-abonné (A) lit 0 trade_setups (barrière has_active_subscription, D-07)', async () => {
    // Lecture via clientA (anon/auth-client, auth.uid()=A, AUCUN abonnement actif)
    // — JAMAIS service_role. La RLS gatée par has_active_subscription() doit rendre
    // l'ensemble des trade_setups invisible.
    const { data, error } = await clientA.from('trade_setups').select('id')
    expect(error, `SELECT trade_setups: ${error?.message}`).toBeNull()
    expect(data ?? []).toHaveLength(0)
  })

  it('A ne lit AUCUN payment de B (isolation RLS user_id, D-07)', async () => {
    // Lecture via clientA (anon/auth-client, auth.uid()=A) — JAMAIS service_role.
    const { data, error } = await clientA.from('payments').select('user_id')
    expect(error, `SELECT payments: ${error?.message}`).toBeNull()
    // Aucune ligne appartenant à B ne doit apparaître dans le résultat scopé sur A.
    const fromB = (data ?? []).filter((r) => r.user_id === userIdB)
    expect(fromB).toHaveLength(0)
  })
})
