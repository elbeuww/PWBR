/**
 * /[locale]/dashboard — overview « cockpit personnel » (UDASH-01, D-08/D-09).
 *
 * RSC montée dans le shell (dash) (layout = requireUser, ExpiryBanner J-3/J-1 déjà en
 * tête). Ordre vertical FIGÉ (D-08) :
 *   1. Statut d'abonnement (actif → date d'accès ; expiré/absent → état RENOUVELLEMENT
 *      + CTA « Renouveler » → /tarifs, JAMAIS un upsell compte gratuit, D-03).
 *   2. Les 3-4 DERNIERS signaux : `fetchActiveSignals({ sort:'recent' }).slice(0,4)`,
 *      rendus via le composant existant `SignalCard` (montage, pas de réimplémentation,
 *      D-02). États error / vide soignés (namespace `signals`).
 *   3. Raccourcis : watchlist, paramètres, et `<AffiliateSummaryCard/>` (conditionnelle).
 *
 * INTERDIT (D-09 / VITR-03) : aucune courbe de capital, aucun résultat net, aucun
 * rendement chiffré, aucun pourcentage de performance fabriqué. L'overview aligne le
 * membre sur la valeur abonnement, pas sur des chiffres de gain inventés. Lecture
 * anon-client (RLS), jamais service_role.
 */
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { requireUser } from '@/lib/auth/gate'
import { createClient } from '@/lib/supabase/server'
import { fetchActiveSignals } from '@/lib/signals/queries'
import { fetchFollowedSetupIds } from '@/lib/watchlist/queries'
import { SignalCard } from '@/components/signals/SignalCard'
import { QueryProvider } from '@/components/providers/QueryProvider'
import { AffiliateSummaryCard } from '@/components/dash/AffiliateSummaryCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface OverviewPageProps {
  params: Promise<{ locale: string }>
}

export default async function DashOverviewPage({ params }: OverviewPageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dash')
  const tSignals = await getTranslations('signals')

  const user = await requireUser()
  const supabase = await createClient()

  // Statut d'abonnement : abonnement actif le plus récent (RLS scope user_id). Un abonné
  // expiré n'a pas de ligne 'active' → sub null → état RENOUVELLEMENT (D-03).
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('current_period_end')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('current_period_end', { ascending: false })
    .limit(1)
    .maybeSingle()

  const periodEnd = sub?.current_period_end ?? null
  const isActive = periodEnd !== null && new Date(periodEnd).getTime() > Date.now()
  const activeUntilLabel =
    periodEnd !== null
      ? new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date(periodEnd))
      : ''

  // 3-4 derniers signaux (tri récent), via la requête existante + RLS. Lecture seule.
  const { data: signals, error: signalsError } = await fetchActiveSignals(supabase, {
    sort: 'recent',
  })
  const latestSignals = signals.slice(0, 4)

  // État initial des étoiles : UNE seule requête RLS-scopée (jamais N+1). Échec → Set
  // vide (dégradation gracieuse). Identique au pipeline de la liste signaux (19-06).
  const followedSet = await fetchFollowedSetupIds(supabase)

  return (
    <main className="mx-auto max-w-screen-lg px-4 py-8 text-start md:px-6">
      <h1 className="font-heading text-2xl font-semibold">{t('overview.title')}</h1>

      {/* 1. Statut d'abonnement (D-08, en tête) */}
      <section className="mt-6">
        <h2 className="text-lg font-semibold">{t('overview.subscriptionStatus')}</h2>
        {isActive ? (
          <Card className="mt-3">
            <CardContent className="pt-(--card-spacing) text-sm text-muted-foreground">
              <bdi>{t('overview.activeUntil', { date: activeUntilLabel })}</bdi>
            </CardContent>
          </Card>
        ) : (
          <Card className="mt-3">
            <CardHeader>
              <CardTitle>{t('renewal.title')}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 pt-(--card-spacing)">
              <p className="text-sm text-muted-foreground">{t('renewal.body')}</p>
              <Link
                href="/tarifs"
                className="inline-flex min-h-11 w-fit items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {t('renewal.cta')}
              </Link>
            </CardContent>
          </Card>
        )}
      </section>

      {/* 2. Derniers signaux (D-08) — montage SignalCard, jamais réimplémenté (D-02) */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">{t('overview.latestSignals')}</h2>
        {signalsError ? (
          <div className="mt-3 rounded-xl bg-card p-6 ring-1 ring-foreground/10">
            <p className="font-semibold">{tSignals('error.heading')}</p>
            <p className="mt-2 text-sm text-muted-foreground">{tSignals('error.body')}</p>
          </div>
        ) : latestSignals.length === 0 ? (
          <div className="mt-3 rounded-xl bg-card p-6 text-center ring-1 ring-foreground/10">
            <p className="font-semibold">{tSignals('emptyHeading')}</p>
            <p className="mx-auto mt-2 max-w-prose text-sm text-muted-foreground">
              {tSignals('emptyBody')}
            </p>
          </div>
        ) : (
          <QueryProvider>
            <div className="mt-3 grid grid-cols-1 gap-6 md:grid-cols-2">
              {latestSignals.map((signal) => (
                <SignalCard
                  key={signal.id}
                  signal={signal}
                  locale={locale}
                  followed={followedSet.has(signal.id)}
                />
              ))}
            </div>
          </QueryProvider>
        )}
        {/* Accès à la liste COMPLÈTE des signaux actifs (l'overview n'en montre que 4). */}
        {!signalsError && latestSignals.length > 0 ? (
          <div className="mt-4">
            <Link
              href="/dashboard/signaux"
              className="inline-flex min-h-11 items-center rounded-md text-sm font-semibold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {t('overview.viewAllSignals')}
            </Link>
          </div>
        ) : null}
      </section>

      {/* 3. Raccourcis (D-08) — watchlist · paramètres · affiliation conditionnelle */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">{t('overview.shortcuts')}</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/dashboard/watchlist"
            className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Card className="h-full transition-shadow hover:ring-foreground/20">
              <CardContent className="pt-(--card-spacing) text-sm font-semibold text-primary">
                {t('nav.watchlist')}
              </CardContent>
            </Card>
          </Link>
          <Link
            href="/dashboard/parametres"
            className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Card className="h-full transition-shadow hover:ring-foreground/20">
              <CardContent className="pt-(--card-spacing) text-sm font-semibold text-primary">
                {t('nav.parametres')}
              </CardContent>
            </Card>
          </Link>
          {/* Conditionnelle : rend null si l'utilisateur n'est pas affilié (D-10). */}
          <AffiliateSummaryCard />
        </div>
      </section>
    </main>
  )
}
