/**
 * Client Supabase côté serveur (RSC / Server Actions / Route Handlers).
 *
 * Pattern 1/3 : client server Next 15 — cookies() async + getAll/setAll.
 * Implémenté directement ici car ReadonlyRequestCookies (next/headers)
 * ne peut pas être typé depuis packages/supabase sans dépendance next.
 *
 * Source : 01-RESEARCH.md §Code Examples §Client server @supabase/ssr
 */
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@app/supabase'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies() // Next 15 : cookies() est async

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
              cookieStore.set(name, value, options),
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
