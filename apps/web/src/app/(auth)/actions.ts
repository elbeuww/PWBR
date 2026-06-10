'use server'

/**
 * Server Actions : signup + signin (email + mot de passe — D-01)
 * Pas de confirmation email (D-02 : désactivée dans Supabase Dashboard)
 *
 * Les actions retournent void/redirect — erreurs loggées côté serveur.
 * La gestion fine des erreurs (feedback UI) est prévue en Phase 5 (design).
 */
import { redirect } from 'next/navigation'
import { createClient } from '../../lib/supabase/server'

export async function signUp(formData: FormData): Promise<void> {
  const supabase = await createClient()

  const email = String(formData.get('email') ?? '')
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    // Phase 5 : afficher l'erreur dans l'UI ; pour l'instant redirect vers signup avec param
    redirect('/signup?error=missing-fields')
  }

  const { error } = await supabase.auth.signUp({ email, password })

  if (error) {
    // Phase 5 : feedback UI ; pour l'instant redirect avec code d'erreur
    redirect(`/signup?error=${encodeURIComponent(error.message)}`)
  }

  // Redirect vers le dashboard après inscription (session déjà active — D-02 : pas de confirmation)
  redirect('/dashboard')
}

export async function signIn(formData: FormData): Promise<void> {
  const supabase = await createClient()

  const email = String(formData.get('email') ?? '')
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    redirect('/login?error=missing-fields')
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  redirect('/dashboard')
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
