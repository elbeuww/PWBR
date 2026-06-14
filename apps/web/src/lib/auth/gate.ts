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
 * Valide returnTo comme chemin relatif same-origin.
 * Accepte uniquement un chemin démarrant par un SEUL '/' (ex: /fr/membre).
 * Rejette : '//evil.com' (protocol-relative), 'http(s)://…' (absolu),
 * tout ce qui n'est pas un chemin relatif. Fallback : '/'.
 */
function safeReturnTo(raw: string | null): string {
  if (!raw) return '/'
  // Doit commencer par '/' mais pas '//' (protocol-relative) ni '/\' (variante).
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) {
    return '/'
  }
  // Rejette toute forme absolue qui aurait passé (défensif).
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    return '/'
  }
  return raw
}

export async function requireUser(): Promise<User> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser() // token revalidé serveur (Pitfall 4)

  if (!user) {
    const path = safeReturnTo((await headers()).get('x-pathname'))
    const locale = await getLocale()
    // redirect localisé (i18n/navigation) — D-08, open-redirect mitigé.
    // redirect() lève NEXT_REDIRECT (ne retourne jamais) ; ce return est inatteignable.
    redirect({ href: { pathname: '/login', query: { returnTo: path } }, locale })
    return user as never
  }

  return user
}

export async function requireActiveSub(): Promise<User> {
  const user = await requireUser()
  const supabase = await createClient()

  // RLS : l'user ne lit que ses propres subscriptions.
  const { data } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('status', 'active')
    .gt('current_period_end', new Date().toISOString())
    .limit(1)

  if (!data || data.length === 0) {
    const locale = await getLocale()
    redirect({ href: '/tarifs', locale }) // D-07 (funnel conversion, PAS login)
  }

  return user
}

export async function requireRole(role: 'superadmin' | 'affiliate'): Promise<User> {
  const user = await requireUser()
  const supabase = await createClient()

  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (data?.role !== role) {
    if (role === 'superadmin') {
      notFound() // 404 discrétion (D-09), jamais 403
    }
    const locale = await getLocale()
    redirect({ href: '/', locale }) // affiliate : redirection neutre
  }

  return user
}
