/**
 * Seuil d'affichage du track record (TRACK-03, D-09/D-12).
 *
 * Décision d'affichage PURE : sous le seuil minimal d'échantillon, on n'affiche
 * JAMAIS de pourcentage (« échantillon insuffisant ») ; au-dessus, on expose le
 * win rate en %. Le N (taille d'échantillon) figure TOUJOURS dans la sortie,
 * suffisant ou non (D-12, honnêteté produit « jamais inventé »).
 *
 * Aucun formatage Intl ici (réservé au composant) — uniquement la décision seuil.
 * La vue DB retourne N brut ; le seuil est appliqué en couche applicative TS pour
 * ne jamais masquer N côté base.
 */

/** Seuil minimal de trades terminés avant d'afficher un pourcentage (D-09). */
export const MIN_SAMPLE = 30

/** Ligne agrégée brute lue depuis la vue pattern_stats. */
export type StatRow = {
  n: number
  win_rate: number | null
  expectancy: number | null
  avg_r?: number | null
}

/** Sortie quand l'échantillon atteint le seuil : pourcentage affichable + N. */
export type SufficientStat = {
  sufficient: true
  n: number
  winRatePct: number
  expectancy: number | null
  avgR: number | null
}

/** Sortie quand l'échantillon est sous le seuil : aucun %, N toujours présent. */
export type InsufficientStat = {
  sufficient: false
  n: number
}

export type ThresholdResult = SufficientStat | InsufficientStat

/**
 * Applique le seuil N≥30 à une ligne d'agrégat.
 *
 * @param row Ligne brute de pattern_stats (N + métriques nullables).
 * @returns   Union discriminée : { sufficient:true, %, N } ou { sufficient:false, N }.
 */
export function applyThreshold(row: StatRow): ThresholdResult {
  if (row.n >= MIN_SAMPLE) {
    return {
      sufficient: true,
      n: row.n,
      winRatePct: Math.round((row.win_rate ?? 0) * 100),
      expectancy: row.expectancy,
      avgR: row.avg_r ?? null,
    }
  }
  return { sufficient: false, n: row.n }
}
