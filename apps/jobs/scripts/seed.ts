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
import { seedSubscriptions } from './seed/subscriptions'
import { seedPayments } from './seed/payments'
import { seedSignals } from './seed/signals'
import { seedAffiliation } from './seed/affiliation'

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

  // 3. Subscriptions : status/plan/period étalés (MRR/churn mesurables).
  console.log('③ subscriptions (status/plan/period étalés)…')
  const subscriptions = await seedSubscriptions(client, users)
  console.log(`   ${subscriptions.length} subscriptions payantes (active/expired) créées.`)

  // 4. Payments : verified atomiques, verified_at étalé sur ~12 mois.
  console.log('④ payments (verified, amount_atomic bigint, verified_at étalé)…')
  const paymentCount = await seedPayments(client, subscriptions)
  console.log(`   ${paymentCount} payments démo créés.`)

  // 5. Signaux : analyses → trade_setups → prediction_outcomes (outcomes BRUTS, D-02).
  console.log('⑤ signaux (analyses → trade_setups → prediction_outcomes bruts)…')
  const signals = await seedSignals(client, users)
  console.log(
    `   ${signals.analyses} analyses, ${signals.setups} setups, ${signals.outcomes} outcomes bruts.`,
  )

  // 6. Affiliation : affiliates → codes → referrals (longue traîne) → commissions
  //    via RPC compute_affiliate_commissions (jamais de calcul JS — D-05) → payouts.
  console.log('⑥ affiliation (affiliates/codes/referrals + commissions via RPC)…')
  const affiliation = await seedAffiliation(client, users)
  console.log(
    `   ${affiliation.affiliates} affiliés, ${affiliation.referrals} referrals, ` +
      `${affiliation.commissionRows} commissions (RPC), ${affiliation.payouts} payouts.`,
  )

  // 7. EN DERNIER : refresh de la matview MRR (service_role — Pitfall 5). Sans ce
  //    refresh, mv_mrr reste vide malgré les payments seedés (MRR mesuré = vide).
  //    Le REFRESH CONCURRENTLY exige l'index unique mv_mrr_month_idx (0017 Partie B,
  //    posé CONCURRENTLY hors transaction). S'il est absent LIVE, on NE masque PAS
  //    l'erreur : on logge un avertissement explicite invitant à le créer.
  console.log('⑦ refresh_mv_mrr (service_role, EN DERNIER — MRR mesuré)…')
  // refresh_mv_mrr est revoke pour public/anon/authenticated (0017) → absent des
  // types PostgREST générés ; appel via cast (service_role bypass le grant).
  const { error: refreshErr } = await (
    client.rpc as unknown as (fn: string) => Promise<{ error: { message: string } | null }>
  )('refresh_mv_mrr')
  if (refreshErr) {
    console.warn(
      `\n⚠️  refresh_mv_mrr a échoué : ${refreshErr.message}\n` +
        "   Vérifier que l'index UNIQUE mv_mrr_month_idx existe LIVE (0017 Partie B,\n" +
        '   `create unique index concurrently mv_mrr_month_idx on public.mv_mrr (month)`).\n' +
        '   Sans cet index, REFRESH MATERIALIZED VIEW CONCURRENTLY est impossible.\n',
    )
  } else {
    console.log('   mv_mrr rafraîchie (MRR mesuré non vide).')
  }

  console.log('\n✅ seed complet terminé (users + subs + payments + signaux + affiliation).')
  console.log('   MRR rafraîchi ; commissions calculées par le RPC.\n')
}

main().catch((e) => fail((e as Error).message))
