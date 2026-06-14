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
import { redirect } from '../../../i18n/navigation'
import { createClient } from '../../../lib/supabase/server'

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
    redirect({ href: { pathname: '/signup', query: { error: error.message } }, locale })
  }

  // Session déjà active (D-02 : pas de confirmation) → dashboard.
  redirect({ href: '/dashboard', locale })
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
    redirect({ href: { pathname: '/login', query: { error: error.message } }, locale })
  }

  redirect({ href: '/dashboard', locale })
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  const locale = await getLocale()
  await supabase.auth.signOut()
  redirect({ href: '/login', locale })
}
