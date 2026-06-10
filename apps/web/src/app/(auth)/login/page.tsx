/**
 * Page /login — formulaire de connexion (email + password)
 * Markup minimal (Phase 5 = design). Câblé aux Server Actions.
 * D-01 : email + mot de passe uniquement.
 */
import { signIn } from '../actions'

export default function LoginPage() {
  return (
    <main style={{ maxWidth: 400, margin: '80px auto', fontFamily: 'sans-serif' }}>
      <h1>Se connecter</h1>
      <form action={signIn} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
            autoComplete="current-password"
            style={{ display: 'block', width: '100%', padding: 8, marginTop: 4 }}
          />
        </label>
        <button type="submit" style={{ padding: '10px 20px', cursor: 'pointer' }}>
          Se connecter
        </button>
      </form>
      <p style={{ marginTop: 16 }}>
        Pas encore de compte ? <a href="/signup">S&apos;inscrire</a>
      </p>
    </main>
  )
}
