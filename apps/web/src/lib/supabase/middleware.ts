/**
 * Helper middleware — rafraîchit la session utilisateur sur une response existante.
 *
 * Pattern 2 (composition) : le middleware racine produit d'abord la response
 * next-intl (handleI18n) — qui porte le rewrite de locale + le cookie NEXT_LOCALE —
 * puis updateSession MUTE cette response pour y propager les cookies de session
 * rafraîchis. On NE recrée JAMAIS NextResponse.next() dans setAll, sinon le rewrite
 * de locale est perdu (Pitfall 2).
 *
 * CRITIQUE : getUser() jamais getSession() côté serveur (T-03 / Pitfall 4).
 *
 * Source : 01-RESEARCH.md §Pattern 2 (middleware composé)
 */
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@app/supabase'
import { type NextRequest, type NextResponse } from 'next/server'

export async function updateSession(
  request: NextRequest,
  response: NextResponse,
): Promise<NextResponse> {
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
          // MUTER la response transmise (préserve le rewrite locale next-intl,
          // Pitfall 2) — ne PAS recréer NextResponse.next().
          // Forme objet typée (CR-04) : conserve httpOnly/secure/sameSite (les options
          // de @supabase/ssr sont structurellement compatibles avec ResponseCookie).
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set({ name, value, ...options }),
          )
        },
      },
    },
  )

  // IMPORTANT : getUser() — revalide le token auprès de Supabase Auth.
  // getUser() uniquement — jamais la variante session côté serveur (insécurisé, Pitfall 4 / T-03).
  await supabase.auth.getUser()

  return response
}
