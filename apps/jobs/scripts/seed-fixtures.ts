/**
 * seed-fixtures.ts — provisioning idempotent des comptes fixtures E2E (Plan 21-01, D-04).
 *
 * DISTINCT du seed démo ~10k (seed.ts) : ce script ne crée QUE les 4 comptes service
 * stables consommés par les tests Playwright multi-rôles (free/abonne/affilie/superadmin).
 * Entrypoint `tsx` : `pnpm --filter jobs seed:fixtures`.
 *
 * Structure calquée sur seed.ts : boot dotenv apps/jobs/.env, fail-fast secrets
 * (le NOM de la variable est loggé, JAMAIS la valeur — CLAUDE.md sécurité), client
 * service_role stateless (bypass RLS, jamais côté web).
 *
 * Idempotence (D-04, T-21-01) : purge BORNÉE au préfixe `e2e-fixture-` / domaine
 * `.invalid` AVANT recreate. La suppression d'un user auth cascade vers profiles +
 * subscriptions (on delete cascade). Re-run sûr, N stable. Ne touche JAMAIS
 * `source='demo'` ni `source='live'` (purge filtrée par email, jamais par source).
 *
 * Post-création : superadmin → profiles.role='superadmin' (teste is_superadmin()) ;
 * abonne → subscription active déterministe (forme empruntée à seed/subscriptions.ts).
 *
 * Les identités sont la copie EXACTE de apps/web/e2e/fixtures/roles.ts (source de
 * vérité). Redéfinies ici localement pour éviter un import cross-app (apps/web →
 * apps/jobs casserait le rootDir du tsconfig jobs). Valeurs IDENTIQUES obligatoires.
 */
import { config } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { DateTime } from 'luxon'
import type { Database } from '@app/supabase'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const ENV_PATH = resolve(SCRIPT_DIR, '../.env') // apps/jobs/.env

config({ path: ENV_PATH })

function fail(msg: string): never {
  console.error(`\n❌ seed-fixtures: ${msg}\n`)
  process.exit(1)
}

// ─── Fail-fast secrets (CLAUDE.md : valider la présence au démarrage, NOM seul) ────
const url = process.env['SUPABASE_URL']?.trim()
const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY']?.trim()

if (!url) {
  fail('SUPABASE_URL manquante dans apps/jobs/.env (requis pour le seed des fixtures).')
}
if (!serviceRoleKey) {
  // La clé elle-même n'est JAMAIS affichée — uniquement le nom de la variable.
  fail('SUPABASE_SERVICE_ROLE_KEY manquante dans apps/jobs/.env (requis pour le seed des fixtures).')
}

// ─── Identités fixtures (copie EXACTE de apps/web/e2e/fixtures/roles.ts) ───────────
const FIXTURE_PASSWORD = process.env['E2E_FIXTURE_PW'] ?? 'TestPassword123!'

/** Préfixe d'isolation : clé de la purge ciblée (ne touche jamais demo/live). */
const FIXTURE_EMAIL_PREFIX = 'e2e-fixture-'

const FIXTURES = {
  free: { email: 'e2e-fixture-free@nexa-e2e.invalid', role: 'member' },
  abonne: { email: 'e2e-fixture-abonne@nexa-e2e.invalid', role: 'member' },
  affilie: { email: 'e2e-fixture-affilie@nexa-e2e.invalid', role: 'member' },
  superadmin: { email: 'e2e-fixture-superadmin@nexa-e2e.invalid', role: 'superadmin' },
} as const

type FixtureSpec = (typeof FIXTURES)[keyof typeof FIXTURES]

// Client service_role (bypass RLS — écriture fixtures uniquement, stateless).
const client = createClient<Database>(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

/**
 * Purge idempotente BORNÉE au préfixe fixture. Lit auth.users paginé, supprime les
 * comptes dont l'email commence par `e2e-fixture-` (cascade profiles/subscriptions).
 * Ne filtre JAMAIS par `source` → aucun risque pour demo/live. Sûre à vide.
 */
async function purgeFixtures(): Promise<number> {
  const perPage = 1000
  const fixtureIds: string[] = []
  for (let page = 1; ; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage })
    if (error) {
      throw new Error(`purge fixtures (listUsers page ${page}): ${error.message}`)
    }
    const users = data?.users ?? []
    if (users.length === 0) break
    for (const user of users) {
      if ((user.email ?? '').startsWith(FIXTURE_EMAIL_PREFIX)) fixtureIds.push(user.id)
    }
    if (users.length < perPage) break
  }
  for (const id of fixtureIds) {
    // `admin_audit_log.actor_id → profiles` est en NO ACTION (la piste d'audit est
    // préservée par design quand un user est supprimé). Si un fixture a généré des
    // lignes d'audit (ex. superadmin testant les actions gated), la cascade
    // `auth.users → profiles` est BLOQUÉE → "Database error deleting user".
    // On purge donc d'abord l'audit généré par CE fixture (borné à son id, jamais
    // les vrais users). service_role bypass RLS. cf. seed:fixtures idempotent.
    const { error: auditErr } = await client
      .from('admin_audit_log')
      .delete()
      .eq('actor_id', id)
    if (auditErr) {
      throw new Error(`purge fixtures (admin_audit_log ${id}): ${auditErr.message}`)
    }
    const { error } = await client.auth.admin.deleteUser(id)
    if (error) throw new Error(`purge fixtures (deleteUser ${id}): ${error.message}`)
  }
  return fixtureIds.length
}

/**
 * Crée un compte fixture (email_confirm: true car « Confirm email » peut être ON,
 * RESEARCH Pitfall 3). Retourne l'id du user créé.
 */
async function createFixture(spec: FixtureSpec): Promise<string> {
  const { data, error } = await client.auth.admin.createUser({
    email: spec.email,
    password: FIXTURE_PASSWORD,
    email_confirm: true,
    user_metadata: { e2e_fixture: true },
  })
  if (error || !data?.user) {
    throw new Error(`createUser ${spec.email}: ${error?.message ?? 'no user'}`)
  }
  return data.user.id
}

async function main(): Promise<void> {
  console.log('\n🔧 seed-fixtures — comptes E2E déterministes par rôle')
  console.log(`   cible : ${url}\n`)

  // 1. Purge idempotente (préfixe fixture uniquement).
  console.log('① purge (préfixe e2e-fixture-, cascade)…')
  const purged = await purgeFixtures()
  console.log(`   ${purged} compte(s) fixture supprimé(s).`)

  // 2. (Re)création des 4 comptes + post-traitement par rôle.
  console.log('② création des 4 fixtures + promotion/subscription…')
  for (const spec of Object.values(FIXTURES)) {
    const userId = await createFixture(spec)

    // superadmin → promotion role (le trigger handle_new_user a créé profiles).
    if (spec.role === 'superadmin') {
      const { error } = await client
        .from('profiles')
        .update({ role: 'superadmin' })
        .eq('id', userId)
      if (error) throw new Error(`promote superadmin ${spec.email}: ${error.message}`)
    }

    // abonne → subscription ACTIVE déterministe (forme empruntée à seed/subscriptions.ts).
    if (spec.email === FIXTURES.abonne.email) {
      const periodEnd = DateTime.utc(2026, 6, 25).plus({ days: 30 }).toISO() as string
      const { error } = await client.from('subscriptions').insert({
        user_id: userId,
        status: 'active',
        plan: 'standard',
        current_period_end: periodEnd,
        source: 'demo', // étiquette de provenance (jamais 'live' — compte de test)
      })
      if (error) throw new Error(`subscription active ${spec.email}: ${error.message}`)
    }

    console.log(`   ✓ ${spec.email} (${spec.role})`)
  }

  console.log('\n✅ seed-fixtures terminé : 4 comptes provisionnés (idempotent).')
  console.log('   superadmin promu ; abonne avec subscription active.\n')
}

main().catch((e) => fail((e as Error).message))
