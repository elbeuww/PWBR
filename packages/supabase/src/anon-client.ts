/**
 * Fabriques de clients Supabase anonymes (clé anon uniquement).
 *
 * Pattern 1/3 : trois clients distincts selon le contexte d'exécution.
 * Pattern 3 : cookies via getAll/setAll (NON dépréciés) — jamais get/set/remove.
 * Source : 01-RESEARCH.md §Code Examples + §Pattern 1/3
 *
 * NE JAMAIS exporter le client service_role depuis ce fichier.
 */

import { createBrowserClient, createServerClient } from '@supabase/ssr'
import type { Database } from './database.types'

// ─── Browser client (Client Components) ─────────────────────────────────────

/**
 * Client Supabase pour les Client Components (navigateur).
 * À appeler UNIQUEMENT dans des composants marqués "use client".
 */
export function createBrowserSupabaseClient() {
  return createBrowserClient<Database>(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
  )
}

// ─── Server client (RSC / Server Actions / Route Handlers) ───────────────────

/**
 * Type des cookies passés aux fabriques server.
 * Compatible avec le ReadonlyRequestCookies de Next 15.
 */
export interface CookieStore {
  getAll(): Array<{ name: string; value: string }>
  set(name: string, value: string, options?: Record<string, unknown>): void
}

/**
 * Client Supabase pour les RSC, Server Actions et Route Handlers.
 *
 * cookieStore = le résultat de `await cookies()` (Next 15, async).
 * Pattern : getAll/setAll — le try/catch dans setAll absorbe les erreurs
 * quand appelé depuis un RSC en lecture seule (le middleware gère la mutation).
 */
export function createServerSupabaseClient(cookieStore: CookieStore) {
  return createServerClient<Database>(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as Record<string, unknown>),
            )
          } catch {
            // Appelé depuis un RSC en lecture seule — ignoré.
            // Le middleware (updateSession) gère le refresh des cookies.
          }
        },
      },
    },
  )
}

// Note : updateSession (middleware) n'est PAS exporté depuis ce package.
// Il dépend de 'next/server' (NextRequest/NextResponse) qui est propre à apps/web.
// La fonction est implémentée directement dans apps/web/src/lib/supabase/middleware.ts.
// Cela évite d'ajouter next comme dépendance du package @app/supabase.

