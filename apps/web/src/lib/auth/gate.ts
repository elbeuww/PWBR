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

  // Branche suspension (D-17) — COUCHE UX complémentaire, PAS la barrière réelle.
  // La vraie barrière données est la RLS : has_active_subscription() étendu
  // `and not suspended` (0021) → un compte suspendu lit déjà 0 ligne. Ici on
  // déconnecte proactivement pour ne pas laisser une session suspendue errer
  // sur une UI vide. Lecture calquée sur requireRole (profiles après getUser).
  const { data: profile } = await supabase
    .from('profiles')
    .select('suspended')
    .eq('id', user!.id) // non-null: redirect() above throws NEXT_REDIRECT when user is null
    .single()

  if (profile?.suspended === true) {
    await supabase.auth.signOut()
    const locale = await getLocale()
    redirect({ href: { pathname: '/login', query: { suspended: '1' } }, locale })
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
  // superadmin = back-office CACHÉ (D-09 / threat T-04-ADMIN-ELEV). TOUT accès non
  // superadmin — y compris un visiteur ANONYME — reçoit notFound() (404 discrétion),
  // JAMAIS une redirection /login (qui révélerait l'existence du back-office) ni un 403.
  // On ne passe donc PAS par authedClient() (qui, lui, redirige l'anon vers /login).
  // Contrat prouvé par e2e/isolation/anon-admin.spec.ts + e2e/gating.spec.ts.
  if (role === 'superadmin') {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser() // token revalidé serveur (Pitfall 4)
    if (!user) notFound() // anon → 404, jamais redirect login (discrétion)

    const { data } = await supabase
      .from('profiles')
      .select('role, suspended')
      .eq('id', user.id)
      .single()

    // Profil introuvable, rôle insuffisant OU compte suspendu = 404 discret (WR-01).
    if (!data || data.role !== 'superadmin' || data.suspended === true) {
      notFound()
    }

    return user
  }

  // affiliate : accès réservé mais NON dissimulé → comportement existant (authedClient
  // redirige l'anon vers /login), et un rôle insuffisant donne une redirection NEUTRE.
  const { user, supabase } = await authedClient()

  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!data || data.role !== role) {
    const locale = await getLocale()
    redirect({ href: '/', locale }) // affiliate : redirection neutre
  }

  return user
}
