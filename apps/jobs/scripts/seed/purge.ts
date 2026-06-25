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
import type { Database } from '@app/supabase'
import { SEED_SOURCE, DEMO_EMAIL_DOMAIN } from './config'

type Client = SupabaseClient<Database>

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
 * Liste paginée des users auth, filtre le domaine démo, deleteUser un par un.
 * `auth.admin.listUsers` pagine par défaut (perPage borné) — on boucle jusqu'à
 * épuisement. Aucune erreur si 0 user démo (boucle vide).
 */
async function purgeDemoAuthUsers(client: Client): Promise<void> {
  const suffix = `@${DEMO_EMAIL_DOMAIN}`
  const perPage = 1000
  let page = 1

  for (;;) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage })
    if (error) {
      throw new Error(`purge auth.users (listUsers page ${page}): ${error.message}`)
    }

    const users = data?.users ?? []
    if (users.length === 0) break

    for (const user of users) {
      const email = user.email ?? ''
      if (!email.endsWith(suffix)) continue
      const { error: delErr } = await client.auth.admin.deleteUser(user.id)
      if (delErr) {
        throw new Error(`purge auth.users (deleteUser ${email}): ${delErr.message}`)
      }
    }

    // Dernière page atteinte (lot incomplet) → stop.
    if (users.length < perPage) break
    page += 1
  }
}
