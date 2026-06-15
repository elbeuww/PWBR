/**
 * Repository candles — écriture via service_role (bypass RLS).
 *
 * Idempotence : upsert onConflict (instrument_id, timeframe, ts)
 * correspond à l'index unique `candles_uniq` de la migration 0003.
 * Un re-run du même lot ne crée aucun doublon (DATA-06).
 *
 * JAMAIS importé depuis apps/web.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { CandleInsert, Database } from '../database.types'

type ServiceClient = SupabaseClient<Database>

/**
 * Upsert un lot de candles.
 * Idempotent : un appel avec les mêmes lignes laisse le count inchangé.
 */
export async function upsertCandles(client: ServiceClient, rows: CandleInsert[]): Promise<void> {
  if (rows.length === 0) return

  const { error } = await client
    .from('candles')
    .upsert(rows, { onConflict: 'instrument_id,timeframe,ts', ignoreDuplicates: false })

  if (error) {
    throw new Error(`upsertCandles failed: ${error.message}`)
  }
}

/**
 * Retourne l'ISO string du dernier ts pour (instrumentId, timeframe),
 * ou null si aucune candle n'existe encore.
 */
export async function getLastCandleTs(
  client: ServiceClient,
  instrumentId: string,
  timeframe: string,
): Promise<string | null> {
  const { data, error } = await client
    .from('candles')
    .select('ts')
    .eq('instrument_id', instrumentId)
    .eq('timeframe', timeframe)
    .order('ts', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`getLastCandleTs failed: ${error.message}`)
  }

  return data?.ts ?? null
}

/** Bougie H1 minimale nécessaire au replay first-touch (TRACK-01, miroir ReplayCandle de @app/core). */
export interface ReplayCandleRow {
  ts: string
  open: number
  high: number
  low: number
  close: number
}

/**
 * Charge les bougies H1 d'un instrument dans la fenêtre [from, to], ordonnées par
 * ts croissant (anti look-ahead — l'appelant borne à valid_until). Modèle getLastCandleTs.
 *
 * Filtre timeframe='H1' (D-03) ; ordre `ts asc` requis par replayOutcome (@app/core).
 */
export async function getCandlesForReplay(
  client: ServiceClient,
  instrumentId: string,
  from: string,
  to: string,
): Promise<ReplayCandleRow[]> {
  const { data, error } = await client
    .from('candles')
    .select('ts, open, high, low, close')
    .eq('instrument_id', instrumentId)
    .eq('timeframe', 'H1')
    .gte('ts', from)
    .lte('ts', to)
    .order('ts', { ascending: true })

  if (error) {
    throw new Error(`getCandlesForReplay failed: ${error.message}`)
  }

  return (data ?? []) as ReplayCandleRow[]
}
