/**
 * Page /dashboard — RSC protégée
 *
 * 1. Vérifie l'authentification via getUser() (jamais getSession(), Pitfall 1)
 * 2. Redirige vers /login si non authentifié
 * 3. Lit les instruments actifs via RLS (authenticated → SELECT autorisé)
 *
 * AUTH-02 : prouve la lecture d'instruments depuis un utilisateur authentifié.
 */
import { redirect } from 'next/navigation'
import { createClient } from '../../lib/supabase/server'
import { listActiveInstruments } from '@app/supabase'
import { signOut } from '../(auth)/actions'

export default async function DashboardPage() {
  const supabase = await createClient()

  // Vérification d'authentification côté serveur (T-03 : getUser, pas getSession)
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  // Lecture des instruments (RLS : authenticated → SELECT autorisé)
  let instruments: Awaited<ReturnType<typeof listActiveInstruments>> = []
  let instrumentsError: string | null = null

  try {
    instruments = await listActiveInstruments(supabase)
  } catch (e) {
    instrumentsError = e instanceof Error ? e.message : 'Erreur de chargement des instruments'
  }

  return (
    <main style={{ maxWidth: 800, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 32,
        }}
      >
        <h1>Dashboard — Vétéran Trading</h1>
        <form action={signOut}>
          <button type="submit" style={{ padding: '6px 14px', cursor: 'pointer' }}>
            Déconnexion
          </button>
        </form>
      </header>

      <p style={{ color: '#888', marginBottom: 24 }}>Connecté : {user.email}</p>

      <section>
        <h2>Instruments actifs</h2>
        {instrumentsError ? (
          <p style={{ color: 'red' }}>Erreur : {instrumentsError}</p>
        ) : instruments.length === 0 ? (
          <p>Aucun instrument actif.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '2px solid #ddd' }}>Symbole</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '2px solid #ddd' }}>Nom</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '2px solid #ddd' }}>Broker</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '2px solid #ddd' }}>Classe</th>
              </tr>
            </thead>
            <tbody>
              {instruments.map((inst) => (
                <tr key={inst.id}>
                  <td style={{ padding: '8px 12px', borderBottom: '1px solid #eee', fontFamily: 'monospace' }}>
                    {inst.symbol}
                  </td>
                  <td style={{ padding: '8px 12px', borderBottom: '1px solid #eee' }}>{inst.display_name}</td>
                  <td style={{ padding: '8px 12px', borderBottom: '1px solid #eee' }}>{inst.broker}</td>
                  <td style={{ padding: '8px 12px', borderBottom: '1px solid #eee' }}>{inst.asset_class}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  )
}
