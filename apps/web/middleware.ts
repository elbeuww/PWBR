/**
 * middleware.ts — racine de apps/web
 *
 * Rafraîchit la session Supabase à chaque requête via updateSession.
 * Obligatoire pour que les RSC voient la session à jour.
 *
 * Source : 01-RESEARCH.md §Pattern 2
 */
import { type NextRequest } from 'next/server'
import { updateSession } from './src/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Exclure les assets statiques et les routes internes Next.
     * Appliquer le middleware à toutes les routes UI et API.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
