import 'server-only'

/**
 * lib/auth/gate.ts — primitive d'accès (3 portes), porte UX du gating.
 *
 * Défense en profondeur : ces portes redirigent AVANT le rendu (Pattern 3),
 * mais la non-fuite des données dépend de la RLS Postgres (Plan 01), pas du gate.
 *
 * - requireUser()       : getUser() (token revalidé serveur, Pitfall 4). Si non auth →
 *                         redirect login avec returnTo validé same-origin (D-08).
 * - requireActiveSub()  : abonnement actif sinon redirect /tarifs (funnel, D-07).
 * - requireRole(role)   : profiles.role lu après getUser() (jamais JWT). superadmin
 *                         absent → notFound() 404 (discrétion, D-09) ; affiliate → '/'.
 *
 * Source : 01-RESEARCH.md §Pattern 4 ; D-07/08/09 ; threat T-01-06/07/08
 */
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getLocale } from 'next-intl/server'
import type { User } from '@supabase/supabase-js'
import { redirect } from '../../i18n/navigation'
import { createClient } from '../supabase/server'

/**
 * Valide returnTo comme chemin relatif same-origin (anti open-redirect, T-01-07).
 * Décode d'abord (neutralise %2F%2F, %5C…), normalise les antislash en slash, puis
 * n'accepte qu'un chemin démarrant par un SEUL '/' (ex: /fr/membre).
 * Rejette : '//evil.com' (protocol-relative), '/\\evil.com', 'http(s)://…',
 * 'javascript:'… et toute entrée non décodable. Fallback : '/'.
 * Exporté : source unique de vérité, réutilisé par les Server Actions (signIn).
 */
export function safeReturnTo(raw: string | null): string {
  if (!raw) return '/'
  let decoded: string
  try {
    decoded = decodeURIComponent(raw)
  } catch {
    return '/' // séquence d'échappement invalide → refus
  }
  // Antislash → slash (neutralise /\\evil.com et %5C), trim espaces/contrôles.
  const normalized = decoded.replace(/\\/g, '/').trim()
  // Chemin relatif strict : un seul '/' en tête (pas '//' protocol-relative).
  if (!normalized.startsWith('/') || normalized.startsWith('//')) {
    return '/'
  }
  // Rejette toute forme avec un schéma (http:, javascript:, data:…).
  if (/^[a-z][a-z0-9+.-]*:/i.test(normalized)) {
    return '/'
  }
  return raw
}

/**
 * Crée UN client Supabase et exige une session valide (getUser, Pitfall 4).
 * Retourne user + le MÊME client pour éviter une double instanciation (CR-02 :
 * deux createClient() pouvaient diverger sur les cookies rafraîchis).
 */
async function authedClient(): Promise<{
  user: User
  supabase: Awaited<ReturnType<typeof createClient>>
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser() // token revalidé serveur (Pitfall 4)

  if (!user) {
    const path = safeReturnTo((await headers()).get('x-pathname'))
    const locale = await getLocale()
    // redirect localisé (i18n/navigation) — D-08, open-redirect mitigé.
    // redirect() lève NEXT_REDIRECT (ne retourne jamais).
    redirect({ href: { pathname: '/login', query: { returnTo: path } }, locale })
  }

  return { user: user as User, supabase }
}

export async function requireUser(): Promise<User> {
  const { user } = await authedClient()
  return user
}

export async function requireActiveSub(): Promise<User> {
  const { user, supabase } = await authedClient()

  // Source unique de vérité avec la RLS : appelle le helper SQL has_active_subscription()
  // (security definer) plutôt que de répliquer la requête — gère current_period_end NULL
  // exactement comme la barrière données (CR-05).
  const { data: hasActive } = await supabase.rpc('has_active_subscription')

  if (!hasActive) {
    const locale = await getLocale()
    redirect({ href: '/tarifs', locale }) // D-07 (funnel conversion, PAS login)
  }

  return user
}

export async function requireRole(role: 'superadmin' | 'affiliate'): Promise<User> {
  const { user, supabase } = await authedClient()

  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // Profil introuvable OU rôle insuffisant = accès refusé (WR-01 : pas de 200 silencieux).
  if (!data || data.role !== role) {
    if (role === 'superadmin') {
      notFound() // 404 discrétion (D-09), jamais 403
    }
    const locale = await getLocale()
    redirect({ href: '/', locale }) // affiliate : redirection neutre
  }

  return user
}
