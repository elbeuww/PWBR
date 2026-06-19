/**
 * lib/admin/signals.ts — mappeurs purs du statut de publication Telegram (ADMIN-03, D-03).
 *
 * Aucun I/O : pas d'import Supabase/next/fetch. La page RSC charge les lignes
 * telegram_posts et trade_setups, puis appelle ces fonctions pour dériver l'état.
 *
 * Contrat 2-états (Pitfall 3) : il n'y a PAS de FK entre telegram_posts et
 * trade_setups. Un setup est « posté » SSI une ligne telegram_posts existe avec
 * dedupe_key === 'notable:' + setup.id. Les échecs ne sont PAS persistés
 * (releasePost supprime la réservation) → seuls 'posted' | 'unpublished' sont
 * dérivables, jamais un état d'échec persistant.
 */

const NOTABLE_PREFIX = 'notable:'

/**
 * Réduit une liste de telegram_posts à l'ensemble des setup ids effectivement postés.
 * Ne garde que les dedupe_key commençant par `notable:`, en strippe le préfixe.
 * Les clés non-notable (recap:, winrate:, …) sont ignorées. Entrée vide/undefined → set vide.
 */
export function postedSetupIdSet(posts: { dedupe_key: string }[]): Set<string> {
  const set = new Set<string>()
  for (const post of posts ?? []) {
    if (post.dedupe_key.startsWith(NOTABLE_PREFIX)) {
      set.add(post.dedupe_key.slice(NOTABLE_PREFIX.length))
    }
  }
  return set
}

export type TelegramStatus = 'posted' | 'unpublished'

/**
 * Statut de publication d'un setup : 'posted' s'il est dans le set des ids postés,
 * 'unpublished' sinon. Ne retourne jamais d'état d'échec (non persisté, Pitfall 3).
 */
export function telegramStatusFor(setupId: string, postedIds: Set<string>): TelegramStatus {
  return postedIds.has(setupId) ? 'posted' : 'unpublished'
}
