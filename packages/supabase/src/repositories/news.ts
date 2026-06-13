/**
 * Repository news — écriture via service_role (bypass RLS).
 *
 * Idempotence : upsert onConflict (url_hash)
 * correspond à l'index unique `news_uniq` de la migration 0003.
 * Un re-run du même lot ne crée aucun doublon (DATA-06).
 *
 * JAMAIS importé depuis apps/web.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, NewsInsert } from '../database.types'

type ServiceClient = SupabaseClient<Database>

/**
 * Upsert un lot d'articles de news.
 * Idempotent : un appel avec les mêmes url_hash laisse le count inchangé.
 */
export async function upsertNews(client: ServiceClient, rows: NewsInsert[]): Promise<void> {
  if (rows.length === 0) return

  const { error } = await client
    .from('news')
    .upsert(rows, { onConflict: 'url_hash', ignoreDuplicates: false })

  if (error) {
    throw new Error(`upsertNews failed: ${error.message}`)
  }
}
