/**
 * Client Supabase côté navigateur (Client Components uniquement).
 * Re-exporte la fabrique depuis @app/supabase.
 */
import { createBrowserSupabaseClient } from '@app/supabase'

export const createClient = createBrowserSupabaseClient
