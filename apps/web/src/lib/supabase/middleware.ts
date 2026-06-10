/**
 * Helper middleware — rafraîchit la session utilisateur.
 *
 * Pattern 2 : seul endroit qui rafraîchit la session (middleware.ts racine).
 * Pattern 3 : getAll/setAll sur les cookies.
 * CRITIQUE : getUser() jamais getSession() côté serveur (T-03 / Pitfall 1).
 *
 * Source : 01-RESEARCH.md §Code Examples §Middleware (refresh session)
 */
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@app/supabase'
import { type NextRequest, NextResponse } from 'next/server'

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Propager à la request (pour les RSC en aval)
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          // Recréer la response pour inclure les cookies rafraîchis
          response = NextResponse.next({ request })
          // Propager à la response (pour le navigateur)
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options as Record<string, unknown>),
          )
        },
      },
    },
  )

  // IMPORTANT : getUser() — revalide le token auprès de Supabase Auth.
  // getUser() uniquement — jamais la variante session côté serveur (insécurisé, Pitfall 1 / T-03).
  await supabase.auth.getUser()

  return response
}
