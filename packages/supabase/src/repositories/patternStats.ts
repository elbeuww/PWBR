/**
 * Repository pattern_stats — lecture des agrégats track record (TRACK-03).
 *
 * SELECT read-only sur la vue `pattern_stats` (migration 0014, lisible `anon`,
 * première lecture publique du projet ; service_role bypass aussi). Source UNIQUE
 * partagée : la vitrine P5 (apps/web re-export) ET le job Telegram P6 (import
 * direct @app/supabase) lisent ces agrégats — aucun import cross-app jobs→web (D-49).
 *
 * La vue n'expose QUE des agrégats anonymes, jamais une ligne par setup ;
 * `prediction_outcomes` n'est jamais requêté côté front/job public.
 *
 * Le N (taille d'échantillon) est retourné BRUT par la vue (D-12) ; la décision
 * de seuil N≥30 est appliquée en couche applicative via @app/core threshold,
 * jamais ici ni en DB.
 *
 * Ce repo ne throw JAMAIS : en cas d'erreur il renvoie une liste vide + le message,
 * à charge de l'appelant (RSC ou job) de rendre l'état error.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../database.types'

/** Ligne d'agrégat lue depuis la vue pattern_stats (colonnes sélectionnées). */
export interface PatternStatRow {
  dimension: string | null
  bucket: string | null
  period: string | null
  n: number | null
  win_rate: number | null
  avg_r: number | null
  expectancy: number | null
}

/**
 * Lit tous les agrégats de la vue pattern_stats via le client fourni.
 *
 * @param supabase Client Supabase typé (anon RSC OU service_role job) — la vue
 *                 grant SELECT anon+authenticated, service_role bypass aussi.
 * @returns Lignes d'agrégat (toutes dimensions/périodes) ; jamais d'exception :
 *          en cas d'erreur, { rows: [], error: message }.
 */
export async function getPatternStats(
  supabase: SupabaseClient<Database>,
): Promise<{ rows: PatternStatRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from('pattern_stats')
    .select('dimension, bucket, period, n, win_rate, avg_r, expectancy')

  if (error) {
    return { rows: [], error: error.message }
  }

  return { rows: data ?? [], error: null }
}
