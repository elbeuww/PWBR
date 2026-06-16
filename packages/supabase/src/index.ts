/**
 * Barrel @app/supabase
 *
 * Exports publics : clients anon + repositories + types.
 * Le service-client (service_role) N'EST PAS ré-exporté ici pour rester sous la
 * garde ESLint. Il s'importe via son chemin exact :
 *   import { serviceClient } from '@app/supabase/service-client'
 *
 * D-07 : le barrel ne doit jamais exposer service-client.ts.
 */

// Clients anon (browser + server)
// Note : updateSession (middleware) est implémenté dans apps/web/src/lib/supabase/middleware.ts
// car il dépend de next/server (NextRequest/NextResponse).
export { createBrowserSupabaseClient, createServerSupabaseClient } from './anon-client'

// Types
export type {
  Database,
  ProfileRow,
  ProfileInsert,
  InstrumentRow,
  InstrumentInsert,
  JobRunRow,
  JobRunInsert,
  JobRunUpdate,
  JobRunStatus,
  Json,
  // Phase 2 — ingestion
  CandleRow,
  CandleInsert,
  NewsRow,
  NewsInsert,
  MacroSeriesRow,
  MacroSeriesInsert,
  EconomicCalendarRow,
  EconomicCalendarInsert,
  DataFreshnessRow,
  Timeframe,
  QuoteHours,
  CalendarImpact,
  // Phase 3 — moteur déterministe
  SnapshotRow,
  SnapshotInsert,
  AssetDriverRow,
  AssetDriverInsert,
  // Phase 4 — moteur IA vétéran & scoring
  AnalysisRow,
  AnalysisInsert,
  TradeSetupRow,
  TradeSetupInsert,
  TradeDirection,
  RiskLevel,
  Confidence,
  SetupStatus,
  // Phase 5 — track record
  PredictionOutcomeRow,
  PredictionOutcomeInsert,
  PredictionOutcomeUpdate,
} from './database.types'

// Repositories
export { listActiveInstruments } from './repositories/instruments'
export { getOwnProfile } from './repositories/profiles'
export { startRun, finishRun } from './repositories/jobRuns'
// Phase 2 — ingestion repositories
export { upsertCandles, getLastCandleTs, getCandlesForReplay } from './repositories/candles'
export type { ReplayCandleRow } from './repositories/candles'
export { upsertNews } from './repositories/news'
export { upsertMacroSeries } from './repositories/macroSeries'
export { upsertEconomicCalendar } from './repositories/economicCalendar'
// Phase 3 — moteur déterministe repositories
export { upsertSnapshot, getSnapshotByHash } from './repositories/snapshots'
export { getAssetDrivers } from './repositories/assetDrivers'
// Phase 4 — moteur IA vétéran & scoring repositories
export { insertAnalysis } from './repositories/analyses'
export { insertTradeSetups, expirePriorSetups } from './repositories/tradeSetups'
export type { ImmutabilityKey } from './repositories/tradeSetups'
// Phase 5 — track record (TRACK-01) — écriture service_role idempotente prediction_outcomes
export { insertOutcomes, getResolvedSetupIds } from './repositories/predictionOutcomes'
// Phase 4 — paiement USDT & abonnement repositories (service_role)
export {
  OFFSET_RESERVATION_MINUTES,
  RESERVATION_EXPIRED_REASON,
  ReplayError,
  OffsetExhaustedError,
  reserveOffset,
  insertPendingPayment,
  getByHash,
  transitionPayment,
  releaseExpiredReservations,
} from './repositories/payments'
export type {
  ReserveOffsetInput,
  ReserveOffsetResult,
  InsertPendingPaymentInput,
  TransitionPaymentExtra,
} from './repositories/payments'
export {
  activateForPayment,
  expireDue,
  changePlan,
} from './repositories/subscriptions'
export type {
  ActivateForPaymentInput,
  ChangePlanInput,
} from './repositories/subscriptions'
