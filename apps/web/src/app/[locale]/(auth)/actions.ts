'use server'

/**
 * Server Actions : signup + signin + signout (email + mot de passe — D-01)
 * Pas de confirmation email (D-02 : désactivée dans Supabase Dashboard)
 *
 * Redirections LOCALISÉES via i18n/navigation (RESEARCH Q3) — requis pour que le
 * gating soit testable de bout en bout (plus de chemin nu '/dashboard').
 * La locale courante est résolue serveur via getLocale().
 *
 * Les actions retournent void/redirect — erreurs loggées côté serveur.
 * La gestion fine des erreurs (feedback UI) est prévue en Phase 5 (design).
 */
import { getLocale } from 'next-intl/server'
import { redirect as nextRedirect } from 'next/navigation'
import { redirect } from '../../../i18n/navigation'
import { createClient } from '../../../lib/supabase/server'
import { safeReturnTo } from '../../../lib/auth/gate'

/**
 * Mappe un message d'erreur Supabase brut vers une clé i18n opaque (CR-03) —
 * ne JAMAIS exposer error.message en query param (énumération d'emails, fuite
 * d'implémentation, vecteur XSS réflectif). La page lit cette clé dans `auth`.
 */
function toSafeErrorKey(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('already registered') || m.includes('already exists')) return 'email-taken'
  if (m.includes('invalid login') || m.includes('invalid credentials')) return 'invalid-credentials'
  if (m.includes('rate limit')) return 'rate-limited'
  return 'auth-error'
}

export async function signUp(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const locale = await getLocale()

  const email = String(formData.get('email') ?? '')
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    redirect({ href: { pathname: '/signup', query: { error: 'missing-fields' } }, locale })
  }

  const { error } = await supabase.auth.signUp({ email, password })

  if (error) {
    redirect({ href: { pathname: '/signup', query: { error: toSafeErrorKey(error.message) } }, locale })
  }

  // Session déjà active (D-02 : pas de confirmation). D-09 : le funnel d'abonnement
  // s'arrête sur l'écran honnête « paiement bientôt » (pas de flux de paiement en P2).
  // Seule la cible de succès change — l'auth (signUp / getUser côté gate) est inchangée.
  redirect({ href: '/paiement-bientot', locale })
}

export async function signIn(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const locale = await getLocale()

  const email = String(formData.get('email') ?? '')
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    redirect({ href: { pathname: '/login', query: { error: 'missing-fields' } }, locale })
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    redirect({ href: { pathname: '/login', query: { error: toSafeErrorKey(error.message) } }, locale })
  }

  // Honore returnTo validé same-origin (WR-02). returnTo est DÉJÀ localisé
  // (capturé depuis x-pathname par le gate) → redirect Next brut, pas i18n
  // (sinon double préfixe /fr/fr/…). Invalide/absent → /dashboard localisé.
  const rawReturnTo = formData.get('returnTo')
  if (typeof rawReturnTo === 'string' && rawReturnTo) {
    const safe = safeReturnTo(rawReturnTo)
    if (safe !== '/') {
      nextRedirect(safe)
    }
  }

  redirect({ href: '/dashboard', locale })
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  const locale = await getLocale()
  await supabase.auth.signOut()
  redirect({ href: '/login', locale })
}
