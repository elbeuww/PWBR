/**
 * purge.ts — nettoyage idempotent de la cohorte démo (D-06, SEED-01).
 *
 * Supprime EXCLUSIVEMENT les lignes `source='demo'` en ordre FK INVERSE strict
 * (enfants d'abord), puis purge les users démo de `auth.users` par pattern d'email
 * (`*@demo.nexa.invalid`) — auth.users n'a pas de colonne `source`, la suppression
 * cascade vers profiles + enfants.
 *
 * INVARIANTS DE SÉCURITÉ (anti T-18-05) :
 *   - JAMAIS de TRUNCATE (détruirait source='live').
 *   - JAMAIS de delete sans `.eq('source', 'demo')` sur les tables colonnées.
 *   - Sûre à vide : 0 ligne démo → no-op silencieux (chaque delete sur 0 ligne
 *     ne renvoie pas d'erreur PostgREST).
 *
 * Ordre FK inverse (RESEARCH §"Ordre de purge FK-inverse", D-06) :
 *   commissions → affiliates → prediction_outcomes → trade_setups → analyses
 *   → payments → subscriptions → profiles → (auth.users via deleteUser)
 *
 * Les tables filles non colonnées (affiliate_codes, referrals, payouts) disparaissent
 * par `on delete cascade` quand leur parent colonné (affiliates/commissions) est purgé.
 * profiles purgé en dernier nettoie tout résiduel FK user ; la suppression auth.users
 * (deleteUser) referme la boucle (auth.users n'a pas de colonne source).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import pRetry from 'p-retry'
import type { Database } from '@app/supabase'
import { SEED_SOURCE, DEMO_EMAIL_DOMAIN } from './config'

type Client = SupabaseClient<Database>

/** Pool de promesses borné (p-limit maison — p-limit absent du workspace, miroir users.ts). */
function createLimiter(concurrency: number) {
  let active = 0
  const queue: Array<() => void> = []
  const next = () => {
    active -= 1
    const run = queue.shift()
    if (run) run()
  }
  return function limit<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolvePromise, rejectPromise) => {
      const run = () => {
        active += 1
        fn().then(resolvePromise, rejectPromise).finally(next)
      }
      if (active < concurrency) run()
      else queue.push(run)
    })
  }
}

/**
 * Tables colonnées `source`, dans l'ordre de SUPPRESSION (enfants → parents).
 * Chaque entrée est purgée par `delete().eq('source','demo')`.
 */
const PURGE_ORDER = [
  'commissions',
  'affiliates',
  'prediction_outcomes',
  'trade_setups',
  'analyses',
  'payments',
  'subscriptions',
  'profiles',
] as const

/**
 * Supprime la cohorte démo. Idempotent et sûr à vide. Lève sur toute erreur DB.
 */
export async function purge(client: Client): Promise<void> {
  // 1. Tables colonnées : delete WHERE source='demo' en ordre FK inverse.
  for (const table of PURGE_ORDER) {
    const { error } = await client
      .from(table)
      .delete()
      .eq('source', SEED_SOURCE)
    if (error) {
      throw new Error(`purge ${table} (source=${SEED_SOURCE}): ${error.message}`)
    }
  }

  // 2. auth.users : pas de colonne source → filtrer les emails démo (.invalid)
  //    et deleteUser (cascade vers profiles résiduels). Pagination défensive.
  await purgeDemoAuthUsers(client)
}

/**
 * Purge les users démo de `auth.users`. En DEUX temps pour la robustesse :
 *   1. COLLECTE paginée des ids démo (lecture pure, SANS suppression → pagination
 *      stable : supprimer pendant qu'on pagine décale les pages et saute des users).
 *   2. SUPPRESSION bornée + résiliente (p-retry backoff exponentiel → un timeout
 *      réseau transitoire `fetch failed` ne tue plus tout le seed ; pLimit borne la
 *      charge sur l'API Auth). Sûre à vide : 0 user démo → boucles vides, no-op.
 */
async function purgeDemoAuthUsers(client: Client): Promise<void> {
  const suffix = `@${DEMO_EMAIL_DOMAIN}`
  const perPage = 1000

  // 1. Collecte (lecture seule, pagination stable). listUsers retryé (transitoire).
  const demoUserIds: string[] = []
  for (let page = 1; ; page += 1) {
    const { data, error } = await pRetry(
      () => client.auth.admin.listUsers({ page, perPage }),
      { retries: 3 },
    )
    if (error) {
      throw new Error(`purge auth.users (listUsers page ${page}): ${error.message}`)
    }
    const users = data?.users ?? []
    if (users.length === 0) break
    for (const user of users) {
      if ((user.email ?? '').endsWith(suffix)) demoUserIds.push(user.id)
    }
    if (users.length < perPage) break // dernière page (lot incomplet)
  }

  // 2. Suppression bornée + résiliente (retry sur fetch failed / 5xx transitoires).
  const limit = createLimiter(5)
  await Promise.all(
    demoUserIds.map((userId) =>
      limit(() =>
        pRetry(
          async () => {
            const { error: delErr } = await client.auth.admin.deleteUser(userId)
            if (delErr) throw new Error(delErr.message)
          },
          { retries: 5 },
        ).catch((e: unknown) => {
          throw new Error(`purge auth.users (deleteUser ${userId}): ${(e as Error).message}`)
        }),
      ),
    ),
  )
}
