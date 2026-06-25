/**
 * seed.ts — orchestrateur du seed démo (Phase 18, SEED-01).
 *
 * Entrypoint `tsx` (`pnpm --filter jobs seed`). Boote l'environnement depuis
 * apps/jobs/.env (miroir freeze-nile-fixture.ts), fail-fast sur les secrets
 * manquants (CLAUDE.md sécurité), puis enchaîne dans l'ORDRE TOPOLOGIQUE strict
 * (parents → enfants) :
 *
 *   1. purge()             — supprime la cohorte source='demo' (ordre FK inverse, D-06)
 *   2. seedUsers()         — auth.admin.createUser borné + profiles role/source='demo' (Plan 18-02 Task 2)
 *   3. seedSubscriptions() — abonnements démo (status/plan/period étalés) (Task 3)
 *   4. seedPayments()      — paiements verified atomiques, verified_at étalé (Task 3)
 *   (signals / affiliation / market + refresh_mv_mrr → Plan 18-03, non câblés ici)
 *
 * Idempotence (D-06) : la purge en tête rend le re-run sûr (N stable) sans jamais
 * toucher source='live'. faker.seed() (dans users.ts) garantit le déterminisme.
 *
 * Sécurité : le service_role reste dans apps/jobs (jamais côté web). La clé n'est
 * JAMAIS loggée. Les emails démo utilisent le domaine .invalid (RFC 2606, T-18-06).
 *
 * AVERTISSEMENT : ce script ÉCRIT en base avec bypass RLS. Il cible exclusivement
 * source='demo'. NE PAS le lancer contre une base contenant des données live sans
 * avoir vérifié que la purge n'affecte que source='demo'.
 */
import { config } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@app/supabase'
import { SEED_VERSION } from './seed/config'
import { purge } from './seed/purge'
import { seedUsers } from './seed/users'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const ENV_PATH = resolve(SCRIPT_DIR, '../.env') // apps/jobs/.env

config({ path: ENV_PATH })

function fail(msg: string): never {
  console.error(`\n❌ seed: ${msg}\n`)
  process.exit(1)
}

// ─── Fail-fast secrets (CLAUDE.md : valider la présence au démarrage) ──────────
const url = process.env['SUPABASE_URL']?.trim()
const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY']?.trim()

if (!url) {
  fail('SUPABASE_URL manquante dans apps/jobs/.env (requis pour le seed).')
}
if (!serviceRoleKey) {
  // La clé elle-même n'est JAMAIS affichée — uniquement le nom de la variable.
  fail('SUPABASE_SERVICE_ROLE_KEY manquante dans apps/jobs/.env (requis pour le seed).')
}

// Client service_role (bypass RLS — écriture seed uniquement, stateless).
const client = createClient<Database>(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function main(): Promise<void> {
  console.log(`\n🌱 seed démo — version ${SEED_VERSION}`)
  console.log(`   cible : ${url}\n`)

  // 1. Purge idempotente (D-06) : supprime la cohorte source='demo' en ordre FK inverse.
  console.log('① purge (source=demo, ordre FK inverse)…')
  await purge(client)

  // 2. Users : auth.admin.createUser borné → profiles role/source='demo'.
  console.log('② users (auth.admin.createUser borné, faker déterministe)…')
  const users = await seedUsers(client)
  console.log(`   ${users.length} users démo créés.`)

  // ─── Étapes câblées en Task 3 (ne PAS inventer ici) ──────────────────────────
  // 3. const subscriptions = await seedSubscriptions(client, users)  // Task 3
  // 4. const paymentCount = await seedPayments(client, subscriptions) // Task 3
  // ─── Plan 18-03 (non câblé ici) ──────────────────────────────────────────────
  // await seedSignals(client, users)        // analyses → trade_setups → prediction_outcomes
  // await seedAffiliation(client, users)     // affiliates → referrals → commissions → payouts
  // await seedMarket(client)                 // candles / snapshots / job_runs / telegram volume
  // await refreshMvMrr(client)               // REFRESH MATERIALIZED VIEW CONCURRENTLY mv_mrr

  console.log('\n✅ purge terminée. (users/subscriptions/payments câblés en Task 2-3)\n')
}

main().catch((e) => fail((e as Error).message))
