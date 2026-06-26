/**
 * user-followed-rls.test.ts — preuve anti-IDOR de la watchlist membre
 * `user_followed_setups` (UDASH-03 / T-19-01/02/03, migration 0020).
 *
 * Calque EXACT de seed-rls.test.ts / affiliate-rls.test.ts. Prouve la barrière de
 * DONNÉES (pas le gate UX) — la `user_followed_setups` est la SEULE écriture front
 * membre du milestone, donc la RLS est la vraie barrière anti-IDOR :
 *   (a) anti-IDOR (T-19-01) : A ne peut PAS insérer une ligne au nom de B
 *       — `with check (user_id = (select auth.uid()))` rejette (error non null).
 *   (b) nominal : A insère SANS passer user_id (default auth.uid()) → succès ;
 *       A lit sa ligne ; A supprime sa ligne.
 *   (c) isolation (T-19-02) : B ne lit AUCUNE ligne de A (RLS scopée user_id).
 *
 * ⚠️ La LECTURE/ÉCRITURE assertée passe TOUJOURS par un anon/auth-client (PAS
 * service_role) : SEULE la RLS tranche. Écrire/lire via service_role serait un
 * faux vert (bypass RLS, T-19-03). Le seeding des fixtures (création d'un
 * trade_setup actif + 2 users A/B) utilise service_role — mais jamais l'assertion.
 *
 * skipIf(!HAS_ENV) : sans credentials/réseau (CI locale sans .env.test), le fichier
 * est SKIP — mais la structure d'assertion est complète et exécutable dès que
 * .env.test (NEXT_PUBLIC_SUPABASE_URL + ANON_KEY + SUPABASE_SERVICE_ROLE_KEY) et le
 * réseau sont disponibles. Pré-requis GREEN :
 *   - migration 0020 appliquée LIVE (table + 3 policies RLS)
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
describe.skipIf(!HAS_ENV)('RLS anti-IDOR watchlist user_followed_setups (UDASH-03)', () => {
  const tsMillis = Date.now()
  const emailA = `ufs-rls-a-${tsMillis}@gmail.com`
  const emailB = `ufs-rls-b-${tsMillis}@gmail.com`
  const password = 'TestPassword123!'

  let clientA: ReturnType<typeof createClient<Database>>
  let clientB: ReturnType<typeof createClient<Database>>
  let userIdA: string
  let userIdB: string
  let setupId: string | undefined
  // dépendances du trade_setup seedé (FK analyses → instruments)
  let instrumentId: string | undefined
  let analysisId: string | undefined

  beforeAll(async () => {
    const a = await signUpAndGetClient(emailA, password)
    clientA = a.client
    userIdA = a.userId
    const b = await signUpAndGetClient(emailB, password)
    clientB = b.client
    userIdB = b.userId

    const admin = adminClient()

    // Seeding (service_role) : un trade_setup actif que A/B pourront « suivre ».
    // Réutilise un instrument existant si présent, sinon en crée un.
    const { data: existingInstr } = await admin
      .from('instruments')
      .select('id')
      .limit(1)
      .maybeSingle()

    if (existingInstr?.id) {
      instrumentId = existingInstr.id
    } else {
      const { data: instr, error: iErr } = await admin
        .from('instruments')
        .insert({
          broker: 'binance',
          symbol: `UFSRLS${tsMillis}`,
          asset_class: 'crypto',
          quote_hours: '24/7',
        })
        .select('id')
        .single()
      if (iErr) throw new Error(`seed instrument: ${iErr.message}`)
      instrumentId = instr?.id
    }

    const { data: ana, error: aErr } = await admin
      .from('analyses')
      .insert({
        run_id: `ufs-rls-${tsMillis}`,
        session: 'london',
        style: 'day',
        instrument_id: instrumentId!,
        snapshot: {},
        model: 'test',
        prompt_version: 'test',
        schema_version: 'test',
      })
      .select('id')
      .single()
    if (aErr) throw new Error(`seed analysis: ${aErr.message}`)
    analysisId = ana?.id

    const { data: setup, error: sErr } = await admin
      .from('trade_setups')
      .insert({
        analysis_id: analysisId!,
        instrument_id: instrumentId!,
        style: 'day',
        session: 'london',
        session_day: new Date().toISOString().slice(0, 10),
        direction: 'long',
        opportunity_score: 70,
        risk_level: 'medium',
        confidence: 'moderate',
        entry_price: 100,
        stop_loss: 95,
        take_profits: [110],
        risk_reward: 2,
        payload: {},
        valid_until: new Date(Date.now() + 86_400_000).toISOString(),
      })
      .select('id')
      .single()
    if (sErr) throw new Error(`seed trade_setup: ${sErr.message}`)
    setupId = setup?.id
  })

  afterAll(async () => {
    const admin = adminClient()
    // Cascade auth.users → user_followed_setups (on delete cascade) nettoie les follows.
    if (userIdA) await deleteUser(userIdA)
    if (userIdB) await deleteUser(userIdB)
    if (setupId) await admin.from('trade_setups').delete().eq('id', setupId)
    if (analysisId) await admin.from('analyses').delete().eq('id', analysisId)
  })

  it('anti-IDOR : A ne peut PAS insérer un follow au nom de B (with check, T-19-01)', async () => {
    // Écriture via clientA (anon/auth-client, auth.uid()=A) — JAMAIS service_role.
    // user_id usurpé = userIdB → la with check (user_id = auth.uid()) rejette.
    const { error } = await clientA
      .from('user_followed_setups')
      .insert({ user_id: userIdB, setup_id: setupId! })
    expect(error, 'insert usurpé doit être rejeté par la RLS (with check)').not.toBeNull()
  })

  it('nominal : A insère SA watchlist sans passer user_id (default auth.uid()) puis la lit', async () => {
    // Pas de user_id → default (select auth.uid()) = A. Écriture via clientA.
    const { error: insErr } = await clientA
      .from('user_followed_setups')
      .insert({ setup_id: setupId! })
    expect(insErr, `insert nominal A: ${insErr?.message}`).toBeNull()

    const { data, error: selErr } = await clientA
      .from('user_followed_setups')
      .select('user_id, setup_id')
    expect(selErr, `select A: ${selErr?.message}`).toBeNull()
    const mine = (data ?? []).filter((r) => r.setup_id === setupId)
    expect(mine).toHaveLength(1)
    expect(mine[0]?.user_id).toBe(userIdA)
  })

  it('isolation : B ne lit AUCUNE ligne de A (using user_id, T-19-02)', async () => {
    // Lecture via clientB (auth.uid()=B) — la ligne de A ne doit jamais apparaître.
    const { data, error } = await clientB
      .from('user_followed_setups')
      .select('user_id')
    expect(error, `select B: ${error?.message}`).toBeNull()
    const fromA = (data ?? []).filter((r) => r.user_id === userIdA)
    expect(fromA).toHaveLength(0)
  })

  it('nominal : A supprime SA propre ligne (delete using, T-19-01)', async () => {
    const { error: delErr } = await clientA
      .from('user_followed_setups')
      .delete()
      .eq('setup_id', setupId!)
    expect(delErr, `delete A: ${delErr?.message}`).toBeNull()

    const { data, error: selErr } = await clientA
      .from('user_followed_setups')
      .select('setup_id')
      .eq('setup_id', setupId!)
    expect(selErr, `select after delete: ${selErr?.message}`).toBeNull()
    expect(data ?? []).toHaveLength(0)
  })
})
