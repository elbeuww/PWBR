/**
 * /[locale]/dashboard/signaux — module SIGNAUX intégré au dashboard.
 *
 * Liste TOUS les signaux actifs (pas seulement l'aperçu de 4 de l'overview) : FilterBar
 * + SignalList (react-query + Realtime), via `fetchActiveSignals` (status=active, tri/
 * filtre, limit 100). Rendu DANS le chrome (dash) — la sidebar est conservée, contrairement
 * à `/signaux` (groupe member, chrome global). Gate = requireUser (layout dash) ; la RLS
 * `has_active_subscription()` (0009/0010) reste la vraie barrière : un non-abonné lit 0
 * ligne → état RENOUVELLEMENT (D-03), JAMAIS un upsell gratuit. Lecture anon-client,
 * jamais service_role (frontière producteur-unique). Composants MONTÉS, pas réimplémentés (D-02).
 *
 * Bas de page : `TrackRecordBlock` = track record MESURÉ des trades clôturés (« anciens
 * trades »), même source/composant que la vitrine — aucun chiffre de gain inventé (D-09/VITR-03).
 */
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { createClient } from '@/lib/supabase/server'
import { parseSignalsParams } from '@/lib/signals/searchParams'
import { fetchActiveSignals } from '@/lib/signals/queries'
import { fetchFollowedSetupIds } from '@/lib/watchlist/queries'
import { FilterBar } from '@/components/signals/FilterBar'
import { SignalList } from '@/components/signals/SignalList'
import { SignalsDisclaimerBanner } from '@/components/signals/SignalsDisclaimerBanner'
import { QueryProvider } from '@/components/providers/QueryProvider'
import { TrackRecordBlock } from '@/components/track-record/TrackRecordBlock'

interface SignauxPageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function DashSignauxPage({ params, searchParams }: SignauxPageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('signals')
  const tDash = await getTranslations('dash')

  const supabase = await createClient()
  const filters = parseSignalsParams(await searchParams)

  const { data, error } = await fetchActiveSignals(supabase, filters)

  // État initial des étoiles : UNE seule requête RLS-scopée (jamais N+1). Échec → Set
  // vide (dégradation gracieuse) — identique au pipeline overview/liste (19-06).
  const followedIds = Array.from(await fetchFollowedSetupIds(supabase))

  // 0 ligne + pas d'abonnement actif → abonné expiré/non-abonné (D-03) : on affiche
  // l'état RENOUVELLEMENT plutôt qu'un simple « vide ». has_active_subscription() =
  // MÊME source de vérité que le filtre RLS (CR-05). Sur erreur RPC → état vide (meilleure UX).
  let renewal = false
  if (!error && data.length === 0) {
    const { data: hasActive, error: rpcError } = await supabase.rpc('has_active_subscription')
    renewal = !rpcError && hasActive === false
  }

  return (
    <main className="mx-auto max-w-screen-lg px-4 py-8 text-start md:px-6">
      <h1 className="font-heading text-2xl font-semibold">{tDash('nav.signaux')}</h1>

      <div className="mt-4">
        <SignalsDisclaimerBanner />
      </div>

      <FilterBar />

      {error ? (
        <section className="mt-8 rounded-xl bg-card p-6 ring-1 ring-foreground/10">
          <h2 className="text-lg font-semibold">{t('error.heading')}</h2>
          <p className="mt-2 text-muted-foreground">{t('error.body')}</p>
          {/* Le rechargement de la page relance la requête RSC (repli sans état client). */}
          <a
            href="."
            className="mt-4 inline-flex min-h-11 items-center rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {t('error.retry')}
          </a>
        </section>
      ) : renewal ? (
        <section className="mt-8 rounded-xl bg-card p-8 ring-1 ring-foreground/10">
          <h2 className="text-lg font-semibold">{tDash('renewal.title')}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{tDash('renewal.body')}</p>
          <Link
            href="/tarifs"
            className="mt-4 inline-flex min-h-11 w-fit items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {tDash('renewal.cta')}
          </Link>
        </section>
      ) : data.length === 0 ? (
        <section className="mt-8 rounded-xl bg-card p-8 text-center ring-1 ring-foreground/10">
          <h2 className="text-lg font-semibold">{t('emptyHeading')}</h2>
          <p className="mx-auto mt-2 max-w-prose text-muted-foreground">{t('emptyBody')}</p>
        </section>
      ) : (
        <QueryProvider>
          <SignalList initialData={data} filters={filters} locale={locale} followedIds={followedIds} />
        </QueryProvider>
      )}

      {/* « Anciens trades » : track record MESURÉ des trades clôturés (même composant que la vitrine). */}
      <section className="mt-12 border-t border-border pt-10">
        <TrackRecordBlock />
      </section>
    </main>
  )
}
