/**
 * Test d'intégration RLS cross-user (AUTH-02)
 *
 * Ce test est RED tant que la migration n'est pas poussée sur Supabase cloud.
 * Il deviendra GREEN en Task 4 après le checkpoint human-action + human-verify.
 *
 * Stratégie :
 *  - Crée deux comptes via signUp (clés chargées depuis .env)
 *  - Vérifie avec deux clients anon distincts que :
 *    1. User A lit sa propre ligne profiles
 *    2. User A ne lit PAS la ligne profiles de User B (RLS id = auth.uid())
 *    3. Un SELECT instruments retourne des lignes (RLS to authenticated)
 *    4. Un SELECT job_runs retourne des lignes (lecture autorisée)
 *    5. Un INSERT job_runs avec la clé anon retourne une erreur (pas de policy write)
 *
 * Pré-requis (pour GREEN) :
 *  - NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.test ou process.env
 *  - Migration 0001 appliquée sur le projet cloud
 *  - "Confirm email" OFF dans Supabase Dashboard (D-02)
 */

import { createClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Database } from '../src/database.types.js'

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

// ─── tests ──────────────────────────────────────────────────────────────────

describe('RLS isolation cross-user (AUTH-02)', () => {
  const tsMillis = Date.now()
  const emailA = `rls-test-a-${tsMillis}@example.com`
  const emailB = `rls-test-b-${tsMillis}@example.com`
  const password = 'TestPassword123!'

  let clientA: ReturnType<typeof createClient<Database>>
  let clientB: ReturnType<typeof createClient<Database>>
  let userIdA: string
  let userIdB: string

  beforeAll(async () => {
    // Les tests sont RED si SUPABASE_URL n'est pas configurée
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.warn(
        '[rls.test] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY manquantes — ' +
          'tests RED (attendu avant push schéma + remplissage .env)',
      )
      return
    }

    const resultA = await signUpAndGetClient(emailA, password)
    clientA = resultA.client
    userIdA = resultA.userId

    const resultB = await signUpAndGetClient(emailB, password)
    clientB = resultB.client
    userIdB = resultB.userId
  })

  afterAll(async () => {
    if (userIdA) await deleteUser(userIdA)
    if (userIdB) await deleteUser(userIdB)
  })

  it('échoue si les variables d'environnement Supabase ne sont pas configurées', () => {
    // Cette assertion est volontairement RED tant que .env n'est pas rempli.
    // Elle documente explicitement l'état attendu : ces tests ne peuvent pas
    // passer sans les credentials Supabase (checkpoint human-action requis).
    expect(
      SUPABASE_URL,
      'NEXT_PUBLIC_SUPABASE_URL doit être configurée dans .env.test ou process.env',
    ).toBeTruthy()
    expect(
      SUPABASE_ANON_KEY,
      'NEXT_PUBLIC_SUPABASE_ANON_KEY doit être configurée dans .env.test ou process.env',
    ).toBeTruthy()
  })

  it('user A lit sa propre ligne profiles', async () => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return
    const { data, error } = await clientA
      .from('profiles')
      .select('id, email')
      .eq('id', userIdA)
    expect(error, `SELECT profiles user A: ${error?.message}`).toBeNull()
    expect(data).toHaveLength(1)
    expect(data![0]!.id).toBe(userIdA)
    expect(data![0]!.email).toBe(emailA)
  })

  it('user A ne lit pas la ligne profiles de user B (isolation RLS)', async () => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return
    const { data, error } = await clientA
      .from('profiles')
      .select('id')
      .eq('id', userIdB)
    // RLS doit retourner 0 ligne, pas d'erreur (deny silencieux)
    expect(error, `SELECT cross-user profiles: ${error?.message}`).toBeNull()
    expect(data).toHaveLength(0)
  })

  it('user A peut lire les instruments (RLS to authenticated)', async () => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return
    const { data, error } = await clientA.from('instruments').select('symbol')
    expect(error, `SELECT instruments: ${error?.message}`).toBeNull()
    // La seed doit contenir au moins 1 instrument
    expect(data!.length).toBeGreaterThanOrEqual(1)
  })

  it('user A peut lire job_runs (RLS lecture authenticated)', async () => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return
    const { data, error } = await clientA.from('job_runs').select('id')
    // Peut retourner 0 ligne si aucun job n'a encore tourné — c'est OK
    expect(error, `SELECT job_runs: ${error?.message}`).toBeNull()
    expect(data).toBeDefined()
  })

  it('un INSERT job_runs avec la clé anon échoue (aucune policy write)', async () => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return
    const { error } = await clientA.from('job_runs').insert({
      job_name: 'rls-test-forbidden',
      status: 'running',
    })
    // Doit échouer : no policy for insert with authenticated role
    expect(error).not.toBeNull()
    expect(error!.code).toMatch(/42501|PGRST301/)
  })
})
