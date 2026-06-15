/**
 * queries.ts — lecture seule des signaux actifs via le client anon + RLS
 * (Plan 03-02, Task 1 ; MEMB-01/02).
 *
 * Frontière producteur-unique (threat T-03-RLS, V1) : le front lit UNIQUEMENT
 * via le client anon (`createClient()` serveur @supabase/ssr). NE JAMAIS importer
 * un repo service_role ni instancier un client service_role ici. La RLS
 * `has_active_subscription()` (0009/0010) est la vraie barrière : un non-abonné
 * lit 0 ligne.
 *
 * Sécurité injection (T-03-05) : `params` provient de `parseSignalsParams`
 * (whitelist Zod, 03-01) — chaque filtre est une valeur paramétrée passée à
 * `.eq/.in`, jamais une string concaténée.
 *
 * Colonnes réelles (corrigées vs RESEARCH) : instruments expose
 * symbol/asset_class/precision/display_name (PAS canonical_symbol/price_decimals).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@app/supabase'
import type { SignalsParams } from './searchParams'

/** Forme d'instrument joint utilisée par la carte (sous-ensemble réel de 0001). */
export interface SignalInstrument {
  symbol: string
  asset_class: string
  precision: number
  display_name: string
}

/** Ligne signal lue côté front (sous-ensemble de trade_setups + join instruments). */
export interface SignalRow {
  id: string
  instrument_id: string
  direction: string
  opportunity_score: number
  risk_level: string
  risk_reward: number
  style: string
  valid_until: string | null
  created_at: string
  instruments: SignalInstrument
}

export interface FetchActiveSignalsResult {
  data: SignalRow[]
  error: string | null
}

const SELECT_COLUMNS =
  'id, instrument_id, direction, opportunity_score, risk_level, risk_reward, style, valid_until, created_at, instruments!inner(symbol, asset_class, precision, display_name)'

/**
 * Lit les trade_setups status=active filtrés/triés via le client anon (RLS).
 * Lecture seule : ne fait aucune écriture, n'instancie aucun client service_role.
 *
 * @param supabase client anon (RSC serveur ou navigateur) portant la session
 * @param params filtres+tri déjà validés par parseSignalsParams (whitelist Zod)
 */
export async function fetchActiveSignals(
  supabase: SupabaseClient<Database>,
  params: SignalsParams,
): Promise<FetchActiveSignalsResult> {
  // CR-02 : PostgREST ignore silencieusement `.eq('instruments.asset_class', …)`
  // (notation pointée non supportée sur un select standard) → tous les signaux
  // étaient retournés sans filtrage par classe/actif. On pré-résout les
  // instrument_ids correspondants via une requête séparée sur `instruments`
  // (client anon + RLS), puis on filtre les setups par `.in/.eq('instrument_id')`.
  // Lecture seule, AUCUN client service_role.
  if (params.class) {
    let instrQuery = supabase.from('instruments').select('id').eq('asset_class', params.class)
    if (params.asset) instrQuery = instrQuery.eq('symbol', params.asset)
    const { data: instrRows, error: instrError } = await instrQuery
    if (instrError) return { data: [], error: instrError.message }
    const ids = (instrRows ?? []).map((r) => r.id)
    if (ids.length === 0) return { data: [], error: null }
    return runSetupsQuery(supabase, params, (q) => q.in('instrument_id', ids))
  }

  if (params.asset) {
    const { data: instrRow, error: instrError } = await supabase
      .from('instruments')
      .select('id')
      .eq('symbol', params.asset)
      .maybeSingle()
    if (instrError) return { data: [], error: instrError.message }
    if (!instrRow) return { data: [], error: null }
    return runSetupsQuery(supabase, params, (q) => q.eq('instrument_id', instrRow.id))
  }

  return runSetupsQuery(supabase, params)
}

type SetupsQuery = ReturnType<ReturnType<SupabaseClient<Database>['from']>['select']>

/**
 * Construit et exécute la requête trade_setups (status=active + style/risk + tri),
 * avec un filtre instrument_id optionnel pré-résolu (CR-02). Factorisé pour éviter
 * la duplication entre les chemins class/asset/aucun filtre instrument.
 */
async function runSetupsQuery(
  supabase: SupabaseClient<Database>,
  params: SignalsParams,
  applyInstrumentFilter?: (q: SetupsQuery) => SetupsQuery,
): Promise<FetchActiveSignalsResult> {
  let query = supabase
    .from('trade_setups')
    .select(SELECT_COLUMNS)
    .eq('status', 'active') // D-02 : actifs uniquement
    .limit(100) // D-19 : plafond de sécurité, pas de pagination MVP

  // Filtres cumulables (D-06) — valeurs paramétrées issues de la whitelist Zod.
  if (params.style) query = query.eq('style', params.style)
  if (params.risk) query = query.eq('risk_level', params.risk)
  if (applyInstrumentFilter) query = applyInstrumentFilter(query)

  // Tri (D-08) : défaut = score décroissant.
  query =
    params.sort === 'recent'
      ? query.order('created_at', { ascending: false })
      : params.sort === 'rr'
        ? query.order('risk_reward', { ascending: false })
        : query.order('opportunity_score', { ascending: false })

  const { data, error } = await query

  if (error) {
    return { data: [], error: error.message }
  }

  // Le join !inner renvoie instruments en objet ; on normalise le type côté front.
  const rows = (data ?? []) as unknown as SignalRow[]
  return { data: rows, error: null }
}
