/**
 * Barrel @app/core — re-exporte toutes les capacités partagées du package.
 */

// Constantes temporelles
export { TIMEFRAMES, UTC_ZONE } from './time/constants.js'
export type { Timeframe } from './time/constants.js'

// Bougie clôturée (anti look-ahead)
export { lastClosedCandleStart } from './time/candle.js'

// Sessions de marché par source
export { DAILY_ANCHOR, dailyAnchorStart } from './time/sessions.js'
export type { DataSource } from './time/sessions.js'

// Conversion monétaire atomique BigInt zéro-float (Phase 4, PAY-01, T-04-PREC)
export { USDT_DECIMALS, SCALE, toAtomic, formatAtomic } from './money/atomic.js'

// Contrat JSON §3 de l'agent IA (Phase 4) — PERMISSIF (A1)
export { OutputSchema } from './schemas/output.js'
export type { Output } from './schemas/output.js'

// Replay first-touch déterministe des setups expirés (Phase 5, TRACK-01)
export { replayOutcome } from './replay/outcome.js'
export type { Outcome, ReplaySetup, ReplayCandle } from './replay/outcome.js'

// Seuil d'affichage track record (Phase 5/6, TRACK-03, D-11) — source unique vitrine ↔ Telegram
export { MIN_SAMPLE, applyThreshold } from './track-record/threshold.js'
export type {
  StatRow,
  SufficientStat,
  InsufficientStat,
  ThresholdResult,
} from './track-record/threshold.js'

// Formateur Telegram pur bilingue FR+AR (Phase 6, TG-02/LEGAL-01/D-03)
export { formatMessage, escapeHtml } from './telegram/format.js'
export type { FormatTrade, FormatInput, PostKind } from './telegram/format.js'

// Grille de paliers d'affiliation + commission BigInt (Phase 7, AFF-03, D-01/D-02)
// Source unique pure, miroir bit-à-bit du SQL affiliate_rate_bps (0016)
export { TIERS, affiliateRateBps, computeCommissionAtomic } from './affiliate/tiers.js'
export type { Tier } from './affiliate/tiers.js'

// Scoring déterministe §3 (Phase 4, D-42/46/48/50, SCORE-02/03)
export {
  scoreSetup,
  computeRiskReward,
  deriveRiskLevel,
  deriveConfidence,
  WEIGHTS,
  PENALTIES,
  INPUT_BOUNDS,
  hasStrongCatalyst,
} from './scoring/index.js'
export type {
  ScoreResult,
  ScoreBreakdown,
  ScoreStyle,
  CombinedSnapshot,
  RiskLevel,
  Confidence,
} from './scoring/index.js'
