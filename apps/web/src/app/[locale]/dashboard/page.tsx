/**
 * /[locale]/dashboard — RSC authentifiée simple (HORS (member), RESEARCH Q1).
 *
 * Le dashboard ne lit que `instruments` (lecture authenticated, NON conditionnée
 * par abonnement) — il ne doit donc PAS vivre sous (member) (qui exigerait un abo
 * actif et bloquerait tout le monde en P1). Guard getUser() inline + redirect login
 * LOCALISÉ. Chaînes externalisées (namespace `dashboard`). Utilities logiques
 * uniquement (text-start) — aucune classe/style directionnel physique.
 */
import { getLocale, getTranslations } from 'next-intl/server'
import { listActiveInstruments } from '@app/supabase'
import { redirect } from '../../../i18n/navigation'
import { createClient } from '../../../lib/supabase/server'
import { signOut } from '../(auth)/actions'

export default async function DashboardPage() {
  const supabase = await createClient()
  const t = await getTranslations('dashboard')

  // Auth côté serveur (T-03 : getUser, pas la variante session).
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    const locale = await getLocale()
    redirect({ href: '/login', locale })
    return null
  }

  // Lecture des instruments (RLS : authenticated → SELECT autorisé).
  let instruments: Awaited<ReturnType<typeof listActiveInstruments>> = []
  let instrumentsError: string | null = null

  try {
    instruments = await listActiveInstruments(supabase)
  } catch {
    instrumentsError = t('loadError')
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-start">
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
            >
              {t('signOut')}
            </button>
          </form>
        </div>
        {/* Accent Tier 2 discret (filet token --primary) — surface dense : pas de voile ambiant. */}
        <div className="mt-2 h-px w-16 bg-primary/60" aria-hidden="true" />
      </header>

      <p className="mb-6 text-muted-foreground">{t('connectedAs', { email: user.email ?? '' })}</p>

      <section>
        <h2 className="text-lg font-medium">{t('instrumentsTitle')}</h2>
        {instrumentsError ? (
          <p className="text-destructive">{instrumentsError}</p>
        ) : instruments.length === 0 ? (
          <p>{t('instrumentsEmpty')}</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="border-b-2 px-3 py-2 text-start">{t('colSymbol')}</th>
                <th className="border-b-2 px-3 py-2 text-start">{t('colName')}</th>
                <th className="border-b-2 px-3 py-2 text-start">{t('colBroker')}</th>
                <th className="border-b-2 px-3 py-2 text-start">{t('colClass')}</th>
              </tr>
            </thead>
            <tbody>
              {instruments.map((inst) => (
                <tr key={inst.id}>
                  <td className="border-b px-3 py-2 font-mono">{inst.symbol}</td>
                  <td className="border-b px-3 py-2">{inst.display_name}</td>
                  <td className="border-b px-3 py-2">{inst.broker}</td>
                  <td className="border-b px-3 py-2">{inst.asset_class}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  )
}
