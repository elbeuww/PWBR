/**
 * Barrel scoring — cœur déterministe /100 (D-42/46/48/50, SCORE-02/03).
 *
 * scoreSetup orchestre : R:R bord conservateur → opportunity_score décomposable
 * (cap 45 + clamp inputs) → confidence → risk_level (ordre figé). Tout pur,
 * golden-testé. Convention .js sur les re-exports (ESM + NodeNext).
 */
export { computeRiskReward } from './rr.js'
export type { RiskRewardResult } from './rr.js'

export { deriveRiskLevel, RISK_THRESHOLDS } from './risk.js'
export type { RiskLevel } from './risk.js'

export { deriveConfidence, CONFIDENCE_THRESHOLDS } from './confidence.js'
export type { Confidence } from './confidence.js'

export {
  WEIGHTS,
  PENALTIES,
  INPUT_BOUNDS,
  RR_TARGETS,
  EXTREME_VOL_PERCENTILE,
  HTF_CONTRADICT_CAP,
  hasStrongCatalyst,
} from './weights.js'

export { scoreSetup } from './score.js'
export type { ScoreResult, ScoreBreakdown, ScoreStyle, ScoreOptions } from './score.js'

// Types d'entrée §3 (miroir structurel local — anti-cycle, voir snapshot-input.ts)
export type {
  CombinedSnapshot,
  TechnicalSnapshotInput,
  FundamentalContextInput,
  NewsContextInput,
  KeyLevelInput,
  TrendState,
} from './snapshot-input.js'
