/**
 * seed.test.ts — preuve d'IDEMPOTENCE du dataset démo (SEED-01 / D-06, Pitfall 3).
 *
 * Calque skipIf(!HAS_ENV) de affiliate-rls.test.ts. Prouve la mécanique purge+reseed :
 *   (a) un re-run du seed laisse le COUNT `source='demo'` IDENTIQUE (pas d'accumulation
 *       — D-06 : la purge en tête de seed rend le re-run sûr, N stable) ;
 *   (b) `count WHERE source='demo' > 0` après seed (SEED-02 : labellisation requêtable) ;
 *   (c) `count WHERE source='live'` INCHANGÉ entre les deux runs (la purge ne touche
 *       JAMAIS les données live — invariant de sécurité purge.ts).
 *
 * ⚠️ Mode N réduit : le seed est exécuté à `SEED_SCALE` minuscule (env posé dans le
 * test) pour tenir en CI/local. Le re-run À L'ÉCHELLE pleine reste une vérification
 * Manual-Only (VALIDATION.md). Le test automatisé valide la MÉCANIQUE (purge → reseed
 * → COUNT stable), pas le volume cible.
 *
 * ⚠️ COUNT via adminClient() (service_role) : ici c'est une LECTURE d'agrégat de
 * vérification, PAS une assertion RLS (≠ seed-rls.test.ts qui lit via anon). Compter
 * les lignes seedées exige le bypass (RLS masquerait `source='demo'` au compteur).
 *
 * skipIf(!HAS_ENV) : sans credentials/réseau (CI locale sans .env.test), le fichier
 * est SKIP — structure d'assertion complète, exécutable dès que .env.test (URL +
 * ANON_KEY + SERVICE_ROLE_KEY) + réseau + migrations 0018 sont disponibles.
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

/** Tables colonnées `source` dont on vérifie la stabilité du COUNT démo. */
const COUNTED_TABLES = [
  'profiles',
  'subscriptions',
  'payments',
  'trade_setups',
] as const

type CountedTable = (typeof COUNTED_TABLES)[number]

/** COUNT exact (head:true) des lignes d'une table filtrées par source. */
async function countBySource(
  client: ReturnType<typeof adminClient>,
  table: CountedTable,
  source: string,
): Promise<number> {
  const { count, error } = await client
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('source', source)
  if (error) throw new Error(`count ${table} (source=${source}): ${error.message}`)
  return count ?? 0
}

/**
 * Exécute le pipeline de seed à l'échelle réduite. Importé dynamiquement pour ne PAS
 * exécuter le module au chargement (le fichier seed.ts est un entrypoint qui boote
 * l'env et appelle main()). On rejoue ici les modules en mode test, scale minuscule.
 */
async function runReducedSeed(): Promise<void> {
  // SEED_SCALE minuscule AVANT l'import de config (lu une fois au module load).
  process.env['SEED_SCALE'] = '0.005' // ~50 users — assez pour FK-cohérence + COUNT stable
  const client = adminClient()
  const { purge } = await import('../../../../../apps/jobs/scripts/seed/purge')
  const { seedUsers } = await import('../../../../../apps/jobs/scripts/seed/users')
  const { seedSubscriptions } = await import('../../../../../apps/jobs/scripts/seed/subscriptions')
  const { seedPayments } = await import('../../../../../apps/jobs/scripts/seed/payments')
  const { seedSignals } = await import('../../../../../apps/jobs/scripts/seed/signals')
  const { seedAffiliation } = await import('../../../../../apps/jobs/scripts/seed/affiliation')

  await purge(client)
  const users = await seedUsers(client)
  const subs = await seedSubscriptions(client, users)
  await seedPayments(client, subs)
  await seedSignals(client, users)
  await seedAffiliation(client, users)
}

describe.skipIf(!HAS_ENV)('Idempotence dataset démo (SEED-01 / D-06)', () => {
  const counts1: Record<string, number> = {}
  const counts2: Record<string, number> = {}
  let liveCount1 = 0
  let liveCount2 = 0

  beforeAll(async () => {
    const admin = adminClient()

    // Run #1 (purge + reseed à l'échelle réduite).
    await runReducedSeed()
    for (const table of COUNTED_TABLES) counts1[table] = await countBySource(admin, table, 'demo')
    liveCount1 = await countBySource(admin, 'payments', 'live')

    // Run #2 (purge + reseed identique → DOIT laisser N stable, pas d'accumulation).
    await runReducedSeed()
    for (const table of COUNTED_TABLES) counts2[table] = await countBySource(admin, table, 'demo')
    liveCount2 = await countBySource(admin, 'payments', 'live')
  }, 120_000)

  afterAll(async () => {
    // Nettoyer la cohorte démo seedée par le test (re-purge).
    const { purge } = await import('../../../../../apps/jobs/scripts/seed/purge')
    await purge(adminClient())
  }, 60_000)

  it('COUNT source=demo identique entre 2 runs (idempotence, pas d’accumulation)', () => {
    for (const table of COUNTED_TABLES) {
      expect(counts2[table], `${table}: COUNT démo doit être stable au re-run`).toBe(counts1[table])
    }
  })

  it('count WHERE source=demo > 0 (SEED-02 : labellisation requêtable)', () => {
    expect(counts1['profiles']).toBeGreaterThan(0)
    expect(counts1['payments']).toBeGreaterThan(0)
  })

  it('count WHERE source=live INCHANGÉ (la purge n’efface jamais live)', () => {
    expect(liveCount2).toBe(liveCount1)
  })
})
