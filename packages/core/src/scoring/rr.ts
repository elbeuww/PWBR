/**
 * Recalcul déterministe du R:R sur le BORD CONSERVATEUR de la zone (D-50).
 *
 * Pitfall 1 (04-RESEARCH) : ne JAMAIS utiliser entry.price ni le bord favorable
 * de la zone — sinon le R:R est surestimé (T-04-05). On prend le pire prix
 * d'entrée réaliste :
 *   - long  → entry.zone[1] (max de la zone = on achète plus cher)
 *   - short → entry.zone[0] (min de la zone = on vend moins cher)
 *
 * Fonction PURE : aucun IO, aucun Date.now(). Sorties arrondies à 6 décimales
 * (patron hash.ts HASH_DECIMALS) pour figer le bruit flottant cross-plateforme
 * (T-04-04, golden stable).
 */
import type { Output } from '../schemas/output.js'

/** Décimales conservées (miroir de HASH_DECIMALS indicateurs). */
const RR_DECIMALS = 6

/** Arrondi déterministe à RR_DECIMALS (évite -0 et 1.230000001). */
function round6(x: number): number {
  return Math.round(x * 1e6) / 1e6
}

/** Prix d'entrée conservateur selon la direction (D-50). */
function conservativeEntry(output: Output): number {
  const [zMin, zMax] = output.entry.zone
  return output.direction === 'long' ? zMax : zMin
}

export interface RiskRewardResult {
  /** R:R par take-profit, calculé sur le bord conservateur. */
  perTp: Array<{ price: number; alloc_pct: number; rr: number }>
  /** R:R global = somme pondérée par alloc_pct des rr par TP. */
  global: number
}

/**
 * Recalcule le R:R d'un output sur le bord conservateur de la zone d'entrée.
 *
 * @throws Error('zero_sl_distance') si l'entrée conservatrice == stop_loss
 *         (distance de risque nulle → R:R indéfini, bug à remonter).
 */
export function computeRiskReward(output: Output): RiskRewardResult {
  const entryCons = conservativeEntry(output)
  const riskDist = Math.abs(entryCons - output.stop_loss)
  if (riskDist === 0) {
    throw new Error('zero_sl_distance')
  }

  const perTp = output.take_profits.map((tp) => ({
    price: tp.price,
    alloc_pct: tp.alloc_pct,
    rr: round6(Math.abs(tp.price - entryCons) / riskDist),
  }))

  // global calculé sur les rr BRUTS (non pré-arrondis) puis arrondi une fois.
  const rawGlobal = output.take_profits.reduce((sum, tp) => {
    const rrRaw = Math.abs(tp.price - entryCons) / riskDist
    return sum + rrRaw * (tp.alloc_pct / 100)
  }, 0)

  return { perTp, global: round6(rawGlobal) }
}

export { RR_DECIMALS }
