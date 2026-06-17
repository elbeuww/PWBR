/**
 * middleware.ts — DANS src/ (Next.js exige le middleware au même niveau que app/,
 * donc src/middleware.ts quand un dossier src/ existe ; placé à la racine de
 * apps/web il n'est PAS détecté → pas de redirect /→/fr, racine en 404).
 *
 * Compose deux responsabilités sur UNE seule response (Pattern 2) :
 *   1. handleI18n(request) → next-intl résout la locale depuis l'URL brute,
 *      applique le rewrite /[locale]/… et pose le cookie NEXT_LOCALE.
 *   2. updateSession(request, response) → rafraîchit la session Supabase
 *      (getUser()) en MUTANT cette même response (Pitfall 2).
 *
 * Le header x-pathname est posé pour que le gate RSC (gate.ts) reconstruise
 * le returnTo (D-08) — RSC n'a pas accès direct à l'URL demandée.
 *
 * Source : 01-RESEARCH.md §Pattern 2 ; Q2 (returnTo via header)
 */
import createMiddleware from 'next-intl/middleware'
import { type NextRequest } from 'next/server'
import { routing } from './i18n/routing'
import { updateSession } from './lib/supabase/middleware'

const handleI18n = createMiddleware(routing)

export async function middleware(request: NextRequest) {
  // 1. Locale d'abord : produit la response (rewrite + cookie NEXT_LOCALE).
  const response = handleI18n(request)
  // Header consommé par le gate RSC pour le returnTo (D-08).
  response.headers.set('x-pathname', request.nextUrl.pathname)
  // 2. Session ensuite : MUTE la response next-intl (ne la recrée pas).
  return await updateSession(request, response)
}

export const config = {
  matcher: [
    /*
     * Exclure les routes internes Next, l'API et les assets statiques.
     * Appliquer le middleware à toutes les routes UI (next-intl recommande
     * son propre matcher incluant l'exclusion de `api`).
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
