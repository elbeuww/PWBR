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

// Contrat JSON §3 de l'agent IA (Phase 4) — PERMISSIF (A1)
export { OutputSchema } from './schemas/output.js'
export type { Output } from './schemas/output.js'
