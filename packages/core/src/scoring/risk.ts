/**
 * deriveRiskLevel (D-46) — niveau de risque dérivé par règle code (golden).
 *
 * Facteurs §3 (ARCHITECTURE lignes 120-121) :
 *  - distance du stop en ATR : trop serré = fragile (bruit le déclenche) → risque
 *  - atr_percentile : volatilité extrême → risque
 *  - news_risk (D-40) : événement fort imminent → risque
 *  - contre-tendance HTF : trade à contre-courant du timeframe dominant → risque
 *
 * Système de points additif (data-not-magic, seuils nommés). Fonction PURE.
 */
import type { Output } from '../schemas/output.js'
import type { TechnicalSnapshotInput, CombinedSnapshot } from './snapshot-input.js'

export type RiskLevel = 'low' | 'medium' | 'high' | 'extreme'

/** Seuils nommés (data-not-magic). */
const RISK_THRESHOLDS = {
  /** SL serré : distance en ATR sous laquelle on relève le risque. */
  slTightAtr: 1.0,
  /** SL moyen : 1.0-1.5 ATR = légèrement serré. */
  slMediumAtr: 1.5,
  /** atr_percentile (0-100) : vol extrême / élevée. */
  pctileExtreme: 90,
  pctileHigh: 80,
} as const

/** Points → enum (figé golden). */
function pointsToLevel(points: number): RiskLevel {
  if (points <= 0) return 'low'
  if (points === 1) return 'medium'
  if (points <= 3) return 'high'
  return 'extreme'
}

/** Le HTF contredit-il la direction du setup ? */
function htfContradicts(technical: TechnicalSnapshotInput, direction: Output['direction']): boolean {
  const wanted = direction === 'long' ? 'bullish' : 'bearish'
  // contredit = HTF a une tendance opposée franche (pas range)
  return technical.trend_htf !== 'range' && technical.trend_htf !== wanted
}

/** Entrée conservatrice (miroir de rr.ts, D-50) pour la distance ATR du stop. */
function conservativeEntry(output: Output): number {
  const [zMin, zMax] = output.entry.zone
  return output.direction === 'long' ? zMax : zMin
}

export interface RiskInput {
  snapshot: CombinedSnapshot
  output: Output
  /** R:R global déjà recalculé (computeRiskReward) — réservé extensions futures. */
  rr: number
}

export function deriveRiskLevel({ snapshot, output }: RiskInput): RiskLevel {
  const { technical } = snapshot
  const atr = technical.volatility.atr
  let points = 0

  // 1) Distance du stop en ATR (sur bord conservateur)
  if (atr > 0) {
    const slDistAtr = Math.abs(conservativeEntry(output) - output.stop_loss) / atr
    if (slDistAtr < RISK_THRESHOLDS.slTightAtr) points += 2
    else if (slDistAtr < RISK_THRESHOLDS.slMediumAtr) points += 1
  }

  // 2) Volatilité (atr_percentile)
  if (technical.volatility.atr_percentile >= RISK_THRESHOLDS.pctileExtreme) points += 2
  else if (technical.volatility.atr_percentile >= RISK_THRESHOLDS.pctileHigh) points += 1

  // 3) news_risk imminent (D-40)
  if (snapshot.news.news_risk) points += 1

  // 4) Contre-tendance HTF
  if (htfContradicts(technical, output.direction)) points += 1

  return pointsToLevel(points)
}

export { RISK_THRESHOLDS }
