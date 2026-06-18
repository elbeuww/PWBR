/**
 * Grille de paliers d'affiliation + calcul de commission BigInt (AFF-03, D-01/D-02).
 *
 * SOURCE UNIQUE TS, miroir bit-à-bit de la fonction SQL `affiliate_rate_bps`
 * (migration 0016, déjà LIVE). La grille existait en double (SQL pour le calcul
 * de commission, TS pour l'affichage du dashboard) : les figer toutes deux sur la
 * MÊME table de bornes golden-testée empêche toute dérive — un palier mal affiché
 * vs payé serait un bug financier (T-07-DRIFT).
 *
 * Le palier (et donc le taux en basis points) est dérivé du NOMBRE D'INSCRITS via
 * le code (audience, D-02), PAS des abonnés actifs.
 *
 * Logique PURE zéro I/O : aucune dépendance Supabase/réseau/fs. Réutilisable par le
 * dashboard (apps/web, affichage palier/progression) et alignée bit-à-bit sur le RPC
 * `compute_affiliate_commissions`.
 *
 * Montants atomiques en BigInt exclusif (×10⁶, zéro float, T-07-FLOAT) : une coercion
 * vers Number sur un montant atomique > 2⁵³ perd de la précision. Au contrat (CR-02) ces montants
 * transitent en `string` ; ici, côté calcul pur, ce sont des `bigint`.
 */

/** Un palier de la grille D-01 : plage d'inscrits → taux en basis points. */
export interface Tier {
  /** Rang du palier (1 = base 8 %, 8 = plafond 20 %). */
  readonly tier: number
  /** Borne basse incluse du nombre d'inscrits. */
  readonly minSignups: number
  /** Borne haute incluse, ou null pour le palier plafond (≥50000). */
  readonly maxSignups: number | null
  /** Taux appliqué en basis points (800 = 8 %, 2000 = 20 %). */
  readonly rateBps: number
}

/**
 * Grille des 8 paliers D-01 — table source, identique aux bornes SQL de
 * `affiliate_rate_bps` (0016). `affiliateRateBps` la parcourt du plafond vers la base.
 */
export const TIERS: readonly Tier[] = [
  { tier: 1, minSignups: 1, maxSignups: 99, rateBps: 800 }, //  8 %
  { tier: 2, minSignups: 100, maxSignups: 500, rateBps: 1200 }, // 12 %
  { tier: 3, minSignups: 501, maxSignups: 1000, rateBps: 1400 }, // 14 %
  { tier: 4, minSignups: 1001, maxSignups: 5000, rateBps: 1500 }, // 15 %
  { tier: 5, minSignups: 5001, maxSignups: 10000, rateBps: 1600 }, // 16 %
  { tier: 6, minSignups: 10001, maxSignups: 25000, rateBps: 1700 }, // 17 %
  { tier: 7, minSignups: 25001, maxSignups: 50000, rateBps: 1800 }, // 18 %
  { tier: 8, minSignups: 50001, maxSignups: null, rateBps: 2000 }, // 20 % plafond
] as const

/**
 * Taux d'affiliation en basis points pour un nombre d'inscrits donné (D-01/D-02).
 *
 * Miroir EXACT du `case` SQL de `affiliate_rate_bps` (0016) : on évalue du plus
 * haut palier vers le plus bas et on retourne le premier dont la borne basse est
 * atteinte. 0 inscrit (ou négatif) → 0 bps (aucun palier).
 *
 * Note bornes : le SQL teste `>= 50000 → 2000` puis `>= 25001 → 1800`. La table
 * TIERS pose le palier plafond à `minSignups: 50001`, mais 50000 retombe alors sur
 * le palier 7 (25001..50000 → 1800), ce qui DIVERGERAIT du SQL (50000 → 2000).
 * On garde donc le seuil plafond à 50000 dans le parcours pour rester bit-à-bit
 * identique au SQL (50000 → 2000). Le test golden verrouille les deux cas.
 *
 * @param signups Nombre d'inscrits via le code (audience).
 * @returns       Taux en basis points (0, 800, 1200, 1400, 1500, 1600, 1700, 1800, 2000).
 */
export function affiliateRateBps(signups: number): number {
  if (signups >= 50000) return 2000 // 20 % — plafond (miroir SQL `>= 50000`)
  if (signups >= 25001) return 1800 // 18 %
  if (signups >= 10001) return 1700 // 17 %
  if (signups >= 5001) return 1600 // 16 %
  if (signups >= 1001) return 1500 // 15 %
  if (signups >= 501) return 1400 // 14 %
  if (signups >= 100) return 1200 // 12 %
  if (signups >= 1) return 800 //  8 %
  return 0
}

/**
 * Commission atomique = `(baseAtomic × rateBps) / 10000` en division entière BigInt
 * (troncature/floor, Q3 — miroir du `/` sur bigint Postgres, arrondi = troncature).
 *
 * Zéro float, aucune coercion vers Number : exact même sur des montants atomiques > 2⁵³
 * (T-07-FLOAT). La division BigInt tronque vers zéro ; les montants étant toujours
 * positifs (≥ 0), troncature ≡ floor.
 *
 * @param baseAtomic Σ revenu atomique du filleul (×10⁶), bigint ≥ 0n.
 * @param rateBps    Taux en basis points (issu de `affiliateRateBps`).
 * @returns          Commission atomique (bigint), arrondie au floor.
 */
export function computeCommissionAtomic(baseAtomic: bigint, rateBps: number): bigint {
  return (baseAtomic * BigInt(rateBps)) / 10000n
}
