/**
 * queries.ts — lecture seule de la watchlist (suivis/historique) via le client
 * anon + RLS (Plan 19-03, Task 3 ; UDASH-02).
 *
 * Frontière producteur-unique (threat T-19-12, miroir lib/signals/queries.ts) :
 * le front lit UNIQUEMENT via le client anon (`createClient()` serveur
 * @supabase/ssr). NE JAMAIS importer un repo à privilèges élevés ni instancier
 * un client privilégié (service-role) ici. L'user EST le producteur de sa watchlist ;
 * la RLS `user_id = (select auth.uid())` (0020) scope tout à lui.
 *
 * Source unique (D-04) : une SEULE table jointe — `user_followed_setups ⋈
 * trade_setups!inner` — filtrée par statut. Pas de table view-log.
 *   - Suivis     = trade_setups.status = 'active'
 *   - Historique = trade_setups.status ∈ ('invalidated','expired') + l'issue
 *                  (prediction_outcomes) en embed nullable.
 *
 * Barrière renouvellement (D-03) GRATUITE : le join `trade_setups!inner` reste
 * gardé par `has_active_subscription()`. Un abonné expiré lit ses lignes
 * `user_followed_setups`, mais le `!inner` les filtre toutes (trade_setups
 * invisible) → 0 ligne. La RLS, pas un gate UX, applique l'état « renouvelle »
 * (T-19-11, A2 à vérifier live — gate manuel).
 *
 * Pagination keyset (D-05) : tri `(created_at desc, id desc)` sur la table
 * racine, couvert par `user_followed_setups_keyset_idx` (0020) → Index Scan,
 * pas OFFSET. Le tuple-compare complet `.or(created_at.lt.X,and(created_at.eq.X,
 * id.lt.Y))` (Pitfall 4) évite trous/doublons sur timestamps égaux.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@app/supabase'
import type { SignalInstrument } from '../signals/queries'
import { decodeCursor, encodeCursor, type Cursor } from '../keyset/cursor'

/** Onglet watchlist → statut(s) de trade_setups (source unique D-04). */
export type WatchlistStatus = 'suivis' | 'historique'

/** Issue mesurée d'un setup résolu (historique) — embed nullable. */
export interface FollowedOutcome {
  outcome: string
  realized_r: number
}

/** Setup joint (sous-ensemble de trade_setups + instruments + issue). */
export interface FollowedSetup {
  id: string
  instrument_id: string
  direction: string
  opportunity_score: number
  risk_level: string
  risk_reward: number
  style: string
  valid_until: string | null
  created_at: string
  status: string
  instruments: SignalInstrument
  prediction_outcomes: FollowedOutcome | null
}

/** Ligne watchlist lue côté front. `id`/`created_at` = colonnes keyset (racine). */
export interface FollowedRow {
  id: string
  created_at: string
  setup_id: string
  trade_setups: FollowedSetup
}

export interface FetchFollowedSetupsParams {
  status: WatchlistStatus
  cursor?: string
}

export interface FetchFollowedSetupsResult {
  data: FollowedRow[]
  nextCursor: string | null
  error: string | null
}

/** Taille de page keyset. +1 ligne sentinelle pour détecter « page suivante ». */
const PAGE_SIZE = 20

// Colonnes du setup joint. instruments!inner = carte ; prediction_outcomes en
// embed nullable (l'issue n'existe que pour les setups résolus).
const SETUP_COLUMNS =
  'id, instrument_id, direction, opportunity_score, risk_level, risk_reward, style, valid_until, created_at, status, instruments!inner(symbol, asset_class, precision, display_name), prediction_outcomes(outcome, realized_r)'

const SELECT_COLUMNS = `id, created_at, setup_id, trade_setups!inner(${SETUP_COLUMNS})`

// Garde-fous de forme (anti-injection T-19-09) : les valeurs du curseur sont
// décodées depuis une URL non fiable puis interpolées dans le filtre `.or()`
// (PostgREST ne paramètre pas .or()). Un id non-UUID ou un timestamp non-ISO
// pourrait porter une virgule/parenthèse et altérer l'expression de filtre. On
// rejette tout curseur dont la forme ne correspond pas → première page. Une
// virgule/parenthèse ne PEUT PAS survivre à ces deux validations.
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T[\d:.]+(?:[+-]\d{2}:?\d{2}|Z)?$/
const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

/** Valide la forme d'un curseur décodé ; toute forme suspecte → null (1re page). */
function sanitizeCursor(c: Cursor | null): Cursor | null {
  if (!c) return null
  if (!ISO_TIMESTAMP.test(c.createdAt) || !UUID.test(c.id)) return null
  return c
}

/**
 * Lit les setups suivis paginés par curseur keyset, via le client anon (RLS).
 * Lecture seule : aucune écriture, aucun client privilégié (service-role).
 *
 * @param supabase client anon (RSC serveur ou navigateur) portant la session
 * @param params   onglet (statut) + curseur opaque (déjà whitelistés, 19-03 T2)
 */
export async function fetchFollowedSetups(
  supabase: SupabaseClient<Database>,
  params: FetchFollowedSetupsParams,
): Promise<FetchFollowedSetupsResult> {
  const cursor = sanitizeCursor(decodeCursor(params.cursor))

  // Source unique : user_followed_setups ⋈ trade_setups!inner. Le filtre statut
  // s'applique sur l'embed inner → filtre aussi les lignes racine (D-04).
  let query = supabase
    .from('user_followed_setups')
    .select(SELECT_COLUMNS)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(PAGE_SIZE + 1)

  query =
    params.status === 'suivis'
      ? query.eq('trade_setups.status', 'active')
      : query.in('trade_setups.status', ['invalidated', 'expired'])

  // Keyset (Pitfall 4) : tuple-compare complet avec tiebreaker id sur les
  // timestamps égaux. Valeurs validées par sanitizeCursor → jamais d'injection.
  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    )
  }

  const { data, error } = await query
  if (error) {
    return { data: [], nextCursor: null, error: error.message }
  }

  // Le join !inner renvoie les embeds en objet ; on normalise le type front.
  const rows = (data ?? []) as unknown as FollowedRow[]

  // Détection de page suivante via la (PAGE_SIZE+1)-ième ligne sentinelle.
  const hasNext = rows.length > PAGE_SIZE
  const pageRows = hasNext ? rows.slice(0, PAGE_SIZE) : rows
  const last = pageRows[pageRows.length - 1]
  const nextCursor =
    hasNext && last ? encodeCursor({ createdAt: last.created_at, id: last.id }) : null

  return { data: pageRows, nextCursor, error: null }
}

/**
 * Retourne le Set des `setup_id` suivis par l'utilisateur courant (état initial
 * du toggle follow, consommé par 19-05). RLS scope auto à auth.uid(). Lecture
 * seule, aucun client privilégié (service-role). En cas d'erreur → Set vide (jamais d'erreur
 * propagée : un toggle non hydraté est dégradé, pas cassant).
 */
export async function fetchFollowedSetupIds(
  supabase: SupabaseClient<Database>,
): Promise<Set<string>> {
  const { data, error } = await supabase.from('user_followed_setups').select('setup_id')
  if (error) return new Set<string>()
  return new Set<string>((data ?? []).map((r) => r.setup_id))
}
