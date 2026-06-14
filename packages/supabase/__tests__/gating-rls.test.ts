/**
 * Test d'intégration RLS gating (ACCESS-02 / ACCESS-03 / ACCESS-04)
 *
 * Ce test est RED tant que les migrations 0008/0009 ne sont pas poussées sur le
 * cloud Supabase ET que .env.test n'est pas rempli (checkpoint human-action Task 3).
 * Il deviendra GREEN une fois le push appliqué + types régénérés.
 *
 * Stratégie (barrière de données, PAS le gate UX) :
 *  - Le front lit en anon-client : SEULE la RLS tranche (Pitfall #5).
 *  - Un user authentifié SANS abonnement actif doit lire 0 ligne de signaux.
 *    1. non-abonné lit 0 trade_setup           (ACCESS-02, has_active_subscription)
 *    2. non-abonné lit 0 analyses              (ACCESS-04)
 *    3. isolation subscriptions cross-user     (ACCESS-03/04 — A ne voit pas l'abo de B)
 *
 * Pré-requis (pour GREEN) :
 *  - NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY + SUPABASE_SERVICE_ROLE_KEY
 *    dans .env.test ou process.env
 *  - Migrations 0008 + 0009 appliquées sur le projet cloud
 *  - "Confirm email" OFF dans Supabase Dashboard (D-02)
 */

import { createClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Database } from '../src/database.types'

// ─── helpers ────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? ''
const SUPABASE_ANON_KEY = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ?? ''
const SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? ''

/**
 * Crée un utilisateur test via signUp côté client.
 * Retourne le client authentifié.
 */
async function signUpAndGetClient(email: string, password: string) {
  const client = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY)
  const { data, error } = await client.auth.signUp({ email, password })
  if (error) throw new Error(`signUp failed for ${email}: ${error.message}`)
  if (!data.user) throw new Error(`signUp: no user returned for ${email}`)
  return { client, userId: data.user.id }
}

/**
 * Supprime un utilisateur via service_role (cleanup).
 */
async function deleteUser(userId: string) {
  if (!SERVICE_ROLE_KEY) return // pas de clé = skip cleanup (CI sans service_role)
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  await admin.auth.admin.deleteUser(userId)
}

/**
 * Client service_role (bypass RLS) pour seed/cleanup des subscriptions.
 */
function adminClient() {
  return createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// ─── tests ──────────────────────────────────────────────────────────────────

describe('RLS gating signaux (ACCESS-02/03/04)', () => {
  // Supabase Auth rejette les domaines réservés (example.com) — utiliser un
  // domaine réel ; aucun email n'est envoyé (Confirm email OFF, D-02) et les
  // comptes sont supprimés en afterAll via service_role.
  const tsMillis = Date.now()
  const emailA = `gating-test-a-${tsMillis}@gmail.com`
  const emailB = `gating-test-b-${tsMillis}@gmail.com`
  const password = 'TestPassword123!'

  let clientA: ReturnType<typeof createClient<Database>>
  let userIdA: string
  let userIdB: string
  let subscriptionIdB: string | undefined

  beforeAll(async () => {
    // Les tests sont RED si SUPABASE_URL n'est pas configurée
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.warn(
        '[gating-rls.test] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY manquantes — ' +
          'tests RED (attendu avant push 0008/0009 + remplissage .env.test)',
      )
      return
    }

    const resultA = await signUpAndGetClient(emailA, password)
    clientA = resultA.client
    userIdA = resultA.userId

    // user B : seul son userId est nécessaire (l'isolation se teste depuis clientA)
    const resultB = await signUpAndGetClient(emailB, password)
    userIdB = resultB.userId

    // Seed via service_role : un abonnement ACTIF pour B (current_period_end futur).
    // clientA (non-abonné) ne doit PAS pouvoir le lire (isolation RLS).
    if (SERVICE_ROLE_KEY) {
      const oneYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      const { data, error } = await adminClient()
        .from('subscriptions')
        .insert({
          user_id: userIdB,
          status: 'active',
          plan: 'standard',
          current_period_end: oneYear,
        })
        .select('id')
        .single()
      if (error) throw new Error(`seed subscription B: ${error.message}`)
      subscriptionIdB = data?.id
    }
  })

  afterAll(async () => {
    // Les subscriptions sont supprimées en cascade via on delete cascade de profiles,
    // mais on nettoie explicitement la ligne seedée par sécurité.
    if (subscriptionIdB && SERVICE_ROLE_KEY) {
      await adminClient().from('subscriptions').delete().eq('id', subscriptionIdB)
    }
    if (userIdA) await deleteUser(userIdA)
    if (userIdB) await deleteUser(userIdB)
  })

  it("echoue si les variables d'environnement Supabase ne sont pas configurees", () => {
    // Volontairement RED tant que .env.test n'est pas rempli (checkpoint human-action).
    expect(
      SUPABASE_URL,
      'NEXT_PUBLIC_SUPABASE_URL doit être configurée dans .env.test ou process.env',
    ).toBeTruthy()
    expect(
      SUPABASE_ANON_KEY,
      'NEXT_PUBLIC_SUPABASE_ANON_KEY doit être configurée dans .env.test ou process.env',
    ).toBeTruthy()
  })

  it('non-abonné lit 0 trade_setup via anon-client (ACCESS-02, has_active_subscription)', async () => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return
    const { data, error } = await clientA.from('trade_setups').select('id')
    // Deny silencieux : pas d'erreur, mais 0 ligne (RLS using has_active_subscription()).
    expect(error, `SELECT trade_setups: ${error?.message}`).toBeNull()
    expect(data).toHaveLength(0)
  })

  it('non-abonné lit 0 analyses via anon-client (ACCESS-04)', async () => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return
    const { data, error } = await clientA.from('analyses').select('id')
    expect(error, `SELECT analyses: ${error?.message}`).toBeNull()
    expect(data).toHaveLength(0)
  })

  it('isolation subscriptions cross-user : A ne voit pas l\'abo de B (ACCESS-03/04)', async () => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return
    // clientA lit subscriptions : il ne possède aucun abo et ne doit PAS voir celui de B.
    const { data, error } = await clientA.from('subscriptions').select('id')
    expect(error, `SELECT subscriptions cross-user: ${error?.message}`).toBeNull()
    expect(data).toHaveLength(0)
  })
})
