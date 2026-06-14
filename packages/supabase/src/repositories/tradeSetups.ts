/**
 * Repository trade_setups — écriture via service_role (bypass RLS).
 *
 * Immuabilité (D-45 / SCORE-05) : un seul setup `active` par clé d'immuabilité
 * (instrument_id, style, session, session_day). Seul `status` transitionne
 * (active → expired / invalidated) ; les champs de prédiction ne sont JAMAIS
 * mis à jour (T-04-03).
 *
 * `expirePriorSetups` est le miroir EXACT de l'index unique partiel
 * `trade_setups_versionkey_idx` (migration 0006) : la clé inclut OBLIGATOIREMENT
 * `session_day` (concern revue #1). L'index unique partiel sert de filet DB
 * contre la race expire→insert (D-43, T-04-13).
 *
 * JAMAIS importé depuis apps/web (D-07 — service_role réservé aux jobs).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, TradeSetupInsert } from '../database.types'

type ServiceClient = SupabaseClient<Database>

/**
 * Clé d'immuabilité D-45 — les 4 dimensions, miroir exact de l'index unique
 * partiel `trade_setups_versionkey_idx`.
 */
export interface ImmutabilityKey {
  instrument_id: string
  style: string
  session: string
  session_day: string
}

/**
 * Insère un ou plusieurs trade_setups (rattachés à une analyse).
 */
export async function insertTradeSetups(
  client: ServiceClient,
  rows: TradeSetupInsert[],
): Promise<void> {
  const { error } = await client.from('trade_setups').insert(rows)

  if (error) {
    throw new Error(`insertTradeSetups failed: ${error.message}`)
  }
}

/**
 * Expire les setups `active` de la même clé d'immuabilité (D-45 / SCORE-05).
 * Seul `status` passe à `expired` — aucun champ de prédiction n'est touché.
 * Filtre sur les 4 dimensions (dont `session_day`) + `status = 'active'`,
 * miroir exact de l'index unique partiel `trade_setups_versionkey_idx`.
 */
export async function expirePriorSetups(
  client: ServiceClient,
  key: ImmutabilityKey,
): Promise<void> {
  const { error } = await client
    .from('trade_setups')
    .update({ status: 'expired' })
    .eq('instrument_id', key.instrument_id)
    .eq('style', key.style)
    .eq('session', key.session)
    .eq('session_day', key.session_day)
    .eq('status', 'active')

  if (error) {
    throw new Error(`expirePriorSetups failed: ${error.message}`)
  }
}
