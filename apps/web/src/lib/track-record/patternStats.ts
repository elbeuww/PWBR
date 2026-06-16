/**
 * Lecture anon des agrégats track record (TRACK-03, frontière producteur-unique).
 *
 * SELECT read-only sur la vue `pattern_stats` (migration 0014, lisible `anon`,
 * première lecture publique du projet). Prend un client Supabase ANON typé —
 * JAMAIS le service-client ni un repo service_role (@app/supabase écriture) :
 * la vitrine et le miroir membre ne lisent que des agrégats anonymes, jamais
 * une ligne par setup. `prediction_outcomes` n'est jamais requêté côté front.
 *
 * Le N (taille d'échantillon) est retourné BRUT par la vue (D-12) ; la décision
 * de seuil N≥30 est appliquée en couche applicative via threshold.ts (05-01),
 * jamais ici ni en DB.
 *
 * Source : 05-PATTERNS.md §lecture anon RSC ; 05-UI-SPEC §Producer-boundary law.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@app/supabase'

type AnonClient = SupabaseClient<Database>

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
 * Lit tous les agrégats de la vue pattern_stats via le client anon fourni.
 *
 * @param supabase Client Supabase ANON (RSC) — pas de service_role.
 * @returns Lignes d'agrégat (toutes dimensions/périodes) ; jamais d'exception
 *          remontée à l'UI : en cas d'erreur on renvoie une liste vide et
 *          l'erreur, à charge de l'appelant de rendre l'état error.
 */
export async function getPatternStats(
  supabase: AnonClient,
): Promise<{ rows: PatternStatRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from('pattern_stats')
    .select('dimension, bucket, period, n, win_rate, avg_r, expectancy')

  if (error) {
    return { rows: [], error: error.message }
  }

  return { rows: data ?? [], error: null }
}
