/**
 * lib/admin/freshness.ts — feux de fraîcheur des données (ADMIN-04, D-06).
 *
 * Aucun I/O : pas d'import Supabase/next/fetch. La page RSC lit v_data_freshness
 * (candles) + max(published_at)/max(ts) (news/macro) et appelle ces mappeurs pour
 * dériver un feu vert/ambre/rouge. Seuils approuvés par le fondateur (RESEARCH Q1).
 */

export type FreshnessColor = 'green' | 'amber' | 'red'

/** Seuils d'âge (heures) par source. ambre = limite (>), rouge = périmé (>). */
export interface AgeThresholds {
  amberHours: number
  redHours: number
}

/** News basse-fréquence : ambre > 6h / rouge > 24h. */
export const NEWS_THRESHOLDS: AgeThresholds = { amberHours: 6, redHours: 24 }

/** Macro très basse-fréquence : ambre > 36h / rouge > 72h. */
export const MACRO_THRESHOLDS: AgeThresholds = { amberHours: 36, redHours: 72 }

/**
 * Feu candles à partir du booléen is_stale (v_data_freshness) + bande ambre dérivée.
 * - rouge SSI is_stale (over threshold côté DB)
 * - ambre SSI !is_stale && age > 1.5× le seuil (timeframe-hours) — « approche du stale »
 * - vert sinon
 */
export function candleColor(
  isStale: boolean,
  ageHours: number,
  thresholdHours: number,
): FreshnessColor {
  if (isStale) return 'red'
  if (ageHours > 1.5 * thresholdHours) return 'amber'
  return 'green'
}

/**
 * Feu générique par âge (news/macro). Bornes strictement supérieures.
 * - rouge si age > redHours
 * - ambre si age > amberHours (et <= redHours)
 * - vert sinon
 */
export function ageColor(ageHours: number, amberHours: number, redHours: number): FreshnessColor {
  if (ageHours > redHours) return 'red'
  if (ageHours > amberHours) return 'amber'
  return 'green'
}
