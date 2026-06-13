/**
 * Barrel @app/indicators — moteur de calcul déterministe.
 *
 * Wrappers d'indicateurs classiques (TECH-01), structure de marché maison
 * (TECH-02/03), schéma §3 LOCKED + hash de contenu (TECH-04, D-41).
 * Tout est golden-testé offline : mêmes bougies → mêmes valeurs ET même hash.
 * Convention .js sur chaque re-export relatif (ESM + moduleResolution Bundler).
 */

// Entrée : mapping bougies → colonnes
export { toOhlcv } from './ohlcv.js'
export type { Ohlcv } from './ohlcv.js'

// Wrappers (TECH-01)
export { rsi, rsiSeries, RSI_PERIOD } from './wrappers/rsi.js'
export { macd, macdSeries, MACD_FAST, MACD_SLOW, MACD_SIGNAL } from './wrappers/macd.js'
export type { MacdValue } from './wrappers/macd.js'
export { ema, emaSeries, EMA_PERIODS } from './wrappers/ema.js'
export { atr, atrSeries, ATR_PERIOD } from './wrappers/atr.js'
export { bollinger, bollingerSeries, BB_PERIOD, BB_STDDEV } from './wrappers/bollinger.js'
export type { BollingerValue } from './wrappers/bollinger.js'

// Structure maison (TECH-02/03)
export { detectSwings, SWING_N, SWING_K } from './structure/swings.js'
export type { Swings } from './structure/swings.js'
export { detectBosChoch } from './structure/structure.js'
export type { StructureState, BreakSignal } from './structure/structure.js'
export { clusterLevels, CLUSTER_C, W_TOUCHES, W_RECENCY, W_AGE } from './structure/levels.js'
export type { Level, LevelType } from './structure/levels.js'
export { computePoc, POC_BINS } from './structure/volume.js'
export type { Poc, VolumeSource } from './structure/volume.js'

// Snapshots (TECH-04, D-41)
export { snapshotContentHash, HASH_DECIMALS } from './snapshots/hash.js'
export {
  TechnicalSnapshotSchema,
  FundamentalContextSchema,
  NewsContextSchema,
  KeyLevelSchema,
} from './snapshots/schema.js'
export type {
  TechnicalSnapshot,
  FundamentalContext,
  NewsContext,
  KeyLevel,
} from './snapshots/schema.js'
