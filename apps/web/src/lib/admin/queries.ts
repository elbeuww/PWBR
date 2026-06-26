/**
 * queries.ts — lecture de la table utilisateurs du cockpit superadmin via le
 * client anon + RLS « superadmin voit tout » (0021). Plan 20-03, Task 1
 * (ADASH-02/04).
 *
 * Frontière producteur-unique (threat T-20-13, miroir lib/watchlist/queries.ts) :
 * le front lit UNIQUEMENT via le client anon (`createClient()` serveur
 * @supabase/ssr). NE JAMAIS importer `admin-service` (service_role) ni instancier
 * un client privilégié ici. La RLS `is_superadmin()` (0021) est la seule frontière
 * de données ; un non-superadmin lit 0 ligne.
 *
 * Pagination keyset (calque watchlist 19-03) : tri `(created_at desc, id desc)`
 * couvert par `profiles_keyset_idx` (0017) → Index Scan, pas OFFSET. Tuple-compare
 * complet `.or(created_at.lt.X,and(created_at.eq.X,id.lt.Y))` (Pitfall 4) évite
 * trous/doublons sur timestamps égaux. Le curseur est validé par `sanitizeCursor`
 * (ISO+UUID) AVANT interpolation dans `.or()` — PostgREST ne paramètre pas `.or()`.
 *
 * Filtres serveur (jamais en mémoire JS) : `source` → `.eq`, `q` → `.ilike` (valeur
 * paramétrée), `status` traduit sur la jointure `subscriptions` (indexée
 * `subscriptions_active_idx`).
 */
import type { AdminUsersParams } from './searchParams'
import { decodeCursor, encodeCursor, type Cursor } from '../keyset/cursor'
import { createClient } from '../supabase/server'

/** Taille de page keyset. +1 ligne sentinelle pour détecter « page suivante ». */
export const PAGE_SIZE = 50

/** Abonnement embarqué (sous-ensemble de subscriptions). */
export interface AdminUserSubscription {
  status: string
  plan: string
  current_period_end: string | null
}

/** Ligne utilisateur lue côté cockpit. `id`/`created_at` = colonnes keyset. */
export interface AdminUserRow {
  id: string
  email: string
  created_at: string
  source: string
  role: string
  suspended: boolean
  subscriptions: AdminUserSubscription[]
}

export interface FetchAdminUsersResult {
  rows: AdminUserRow[]
  nextCursor: string | null
  error: string | null
}

// Garde-fous de forme (anti-injection T-20-13) : les valeurs du curseur sont
// décodées depuis une URL non fiable puis interpolées dans le filtre `.or()`
// (PostgREST ne paramètre pas .or()). Un id non-UUID ou un timestamp non-ISO
// pourrait porter une virgule/parenthèse et altérer l'expression de filtre. On
// rejette tout curseur dont la forme ne correspond pas → première page. Une
// virgule/parenthèse ne PEUT PAS survivre à ces deux validations.
// (regex copiées verbatim depuis lib/watchlist/queries.ts.)
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T[\d:.]+(?:[+-]\d{2}:?\d{2}|Z)?$/
const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

/** Valide la forme d'un curseur décodé ; toute forme suspecte → null (1re page). */
export function sanitizeCursor(c: Cursor | null): Cursor | null {
  if (!c) return null
  if (!ISO_TIMESTAMP.test(c.createdAt) || !UUID.test(c.id)) return null
  return c
}

// Colonnes utilisateur + abonnement embarqué. `!inner` n'est utilisé que pour les
// filtres status active/expired (filtre les lignes racine) ; sinon embed nullable.
const SUBS = 'subscriptions(status, plan, current_period_end)'
const SUBS_INNER = 'subscriptions!inner(status, plan, current_period_end)'
const baseColumns = (inner: boolean) =>
  `id, email, created_at, source, role, suspended, ${inner ? SUBS_INNER : SUBS}`

/**
 * Lit la page d'utilisateurs (keyset) avec filtres serveur. Client anon only —
 * la RLS « superadmin voit tout » (0021) est la seule frontière de données.
 *
 * @param params filtres déjà whitelistés par parseAdminUsersParams (20-01) +
 *               curseur opaque (revalidé ici par sanitizeCursor).
 */
export async function fetchAdminUsers(
  params: AdminUsersParams,
): Promise<FetchAdminUsersResult> {
  const supabase = await createClient()

  // active/expired filtrent les lignes racine via le join inner ; none = absence.
  const needInner = params.status === 'active' || params.status === 'expired'

  let query = supabase
    .from('profiles')
    .select(baseColumns(needInner))
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(PAGE_SIZE + 1)

  // Filtres serveur (jamais en mémoire JS). Valeurs paramétrées par supabase-js.
  if (params.source) query = query.eq('source', params.source)
  if (params.q) query = query.ilike('email', `%${params.q}%`)

  if (params.status === 'active') {
    query = query.eq('subscriptions.status', 'active')
  } else if (params.status === 'expired') {
    query = query.eq('subscriptions.status', 'expired')
  } else if (params.status === 'none') {
    // Parents sans abonnement : filtre top-level sur la ressource embarquée
    // (relation absente du type colonne généré → cast de forme borné).
    const nullable = query as unknown as {
      is(column: string, value: null): typeof query
    }
    query = nullable.is('subscriptions', null)
  }

  // Keyset (Pitfall 4) : tuple-compare complet, posé SEULEMENT après sanitize.
  const cursor = sanitizeCursor(decodeCursor(params.cursor))
  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    )
  }

  const { data, error } = await query
  if (error) {
    return { rows: [], nextCursor: null, error: error.message }
  }

  const all = (data ?? []) as unknown as AdminUserRow[]

  // Détection de page suivante via la (PAGE_SIZE+1)-ième ligne sentinelle.
  const hasNext = all.length > PAGE_SIZE
  const rows = hasNext ? all.slice(0, PAGE_SIZE) : all
  const last = rows[rows.length - 1]
  const nextCursor =
    hasNext && last ? encodeCursor({ createdAt: last.created_at, id: last.id }) : null

  return { rows, nextCursor, error: null }
}
