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
export { createBrowserSupabaseClient, createServerSupabaseClient } from './anon-client.js'

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
} from './database.types.js'

// Repositories
export { listActiveInstruments } from './repositories/instruments.js'
export { getOwnProfile } from './repositories/profiles.js'
export { startRun, finishRun } from './repositories/jobRuns.js'
