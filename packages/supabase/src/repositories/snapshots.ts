/**
 * Repository snapshots — écriture via service_role (bypass RLS).
 *
 * Idempotence : upsert onConflict (instrument_id, style, kind, computed_for_ts)
 * correspond à l'index unique `snapshots_uniq` de la migration 0005.
 * Un re-run du même snapshot ne crée aucun doublon (D-41).
 *
 * content_hash (= raw_indicators_ref, D-41) est référencé par la Phase 4
 * via getSnapshotByHash.
 *
 * JAMAIS importé depuis apps/web.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, SnapshotInsert, SnapshotRow } from '../database.types'

type ServiceClient = SupabaseClient<Database>

/**
 * Upsert un snapshot.
 * Idempotent : un appel avec le même (instrument_id, style, kind, computed_for_ts)
 * laisse le count inchangé.
 */
export async function upsertSnapshot(client: ServiceClient, row: SnapshotInsert): Promise<void> {
  const { error } = await client
    .from('snapshots')
    .upsert([row], {
      onConflict: 'instrument_id,style,kind,computed_for_ts',
      ignoreDuplicates: false,
    })

  if (error) {
    throw new Error(`upsertSnapshot failed: ${error.message}`)
  }
}

/**
 * Retourne le snapshot dont le content_hash correspond, ou null (D-41).
 * Référencé par la Phase 4 pour résoudre un snapshot par son hash de contenu.
 */
export async function getSnapshotByHash(
  client: ServiceClient,
  hash: string,
): Promise<SnapshotRow | null> {
  const { data, error } = await client
    .from('snapshots')
    .select('*')
    .eq('content_hash', hash)
    .maybeSingle()

  if (error) {
    throw new Error(`getSnapshotByHash failed: ${error.message}`)
  }

  return data ?? null
}

/** Triplet des derniers snapshots séparés d'un (instrument, style) — un par kind. */
export interface LatestSnapshotsByKind {
  technical: SnapshotRow | null
  fundamental: SnapshotRow | null
  news: SnapshotRow | null
}

/** Kinds séparés produits par les 3 engines (assemblés ensuite en 'combined'). */
const SEPARATE_KINDS = ['technical', 'fundamental', 'news'] as const

/**
 * Lit le snapshot le PLUS RÉCENT (computed_for_ts DESC) de CHAQUE kind séparé
 * (technical/fundamental/news) pour un (instrument, style) donné.
 *
 * Chaque kind est requêté indépendamment avec `.limit(1).maybeSingle()` :
 * `.limit(1)` borne explicitement la lecture (anti cap implicite PostgREST 1000,
 * BUGFIX-CAP1000). Un kind sans aucun snapshot → `null` pour ce kind (jamais un
 * throw, jamais une ligne fabriquée). Le combine-engine (TROU #2) s'en sert pour
 * n'assembler que les triplets COMPLETS (cohérence temporelle par instrument×style).
 */
export async function getLatestSnapshotsByKind(
  client: ServiceClient,
  instrumentId: string,
  style: string,
): Promise<LatestSnapshotsByKind> {
  const [technical, fundamental, news] = await Promise.all(
    SEPARATE_KINDS.map(async (kind) => {
      const { data, error } = await client
        .from('snapshots')
        .select('*')
        .eq('instrument_id', instrumentId)
        .eq('style', style)
        .eq('kind', kind)
        .order('computed_for_ts', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        throw new Error(`getLatestSnapshotsByKind failed: ${error.message}`)
      }

      return data ?? null
    }),
  )

  return { technical, fundamental, news }
}
