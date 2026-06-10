/**
 * Page /signup — formulaire d'inscription (email + password)
 * Markup minimal (Phase 5 = design). Câblé aux Server Actions.
 * D-01 : email + mot de passe uniquement.
 */
import { signUp } from '../actions'

export default function SignupPage() {
  return (
    <main style={{ maxWidth: 400, margin: '80px auto', fontFamily: 'sans-serif' }}>
      <h1>Créer un compte</h1>
      <form action={signUp} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label>
          Email
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            style={{ display: 'block', width: '100%', padding: 8, marginTop: 4 }}
          />
        </label>
        <label>
          Mot de passe
          <input
            type="password"
            name="password"
            required
            minLength={6}
            autoComplete="new-password"
            style={{ display: 'block', width: '100%', padding: 8, marginTop: 4 }}
          />
        </label>
        <button type="submit" style={{ padding: '10px 20px', cursor: 'pointer' }}>
          S&apos;inscrire
        </button>
      </form>
      <p style={{ marginTop: 16 }}>
        Déjà un compte ? <a href="/login">Se connecter</a>
      </p>
    </main>
  )
}
