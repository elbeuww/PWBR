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
} from './database.types'

// Repositories
export { listActiveInstruments } from './repositories/instruments'
export { getOwnProfile } from './repositories/profiles'
export { startRun, finishRun } from './repositories/jobRuns'
// Phase 2 — ingestion repositories
export { upsertCandles, getLastCandleTs } from './repositories/candles'
export { upsertNews } from './repositories/news'
export { upsertMacroSeries } from './repositories/macroSeries'
export { upsertEconomicCalendar } from './repositories/economicCalendar'
