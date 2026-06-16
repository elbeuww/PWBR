/**
 * /[locale]/(member)/signaux — surface LISTE membre (RSC, Plan 03-02 Task 1).
 *
 * Lecture serveur gated : createClient() anon + cookies → la RLS
 * has_active_subscription() (0009/0010) tranche réellement (T-03-RLS). AUCUN
 * guard inline ici : le gate d'abonnement est posé par le layout (member)
 * (D-07/08). AUCUN repo service_role (frontière producteur-unique, V1).
 *
 * Pipeline : parseSignalsParams (whitelist Zod, anti-injection T-03-05) →
 * fetchActiveSignals (status=active, tri/filtre, limit 100). États soignés D-18 :
 * error → bloc réessayer ; 0 ligne → vide rassurant ; sinon FilterBar +
 * QueryProvider>SignalList (overlay react-query + Realtime) + bandeau disclaimer.
 *
 * Chaînes via next-intl (namespace `signals`, I18N-03). Classes logiques (text-start).
 */
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { createClient } from '../../../../lib/supabase/server'
import { parseSignalsParams } from '../../../../lib/signals/searchParams'
import { fetchActiveSignals } from '../../../../lib/signals/queries'
import { FilterBar } from '../../../../components/signals/FilterBar'
import { SignalList } from '../../../../components/signals/SignalList'
import { SignalsDisclaimerBanner } from '../../../../components/signals/SignalsDisclaimerBanner'
import { QueryProvider } from '../../../../components/providers/QueryProvider'
import { TrackRecordBlock } from '@/components/track-record/TrackRecordBlock'

interface SignalsPageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function SignalsPage({ params, searchParams }: SignalsPageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('signals')

  const supabase = await createClient()
  const sp = await searchParams
  const filters = parseSignalsParams(sp)

  const { data, error } = await fetchActiveSignals(supabase, filters)

  return (
    <main className="mx-auto max-w-screen-xl px-4 py-10 text-start md:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="font-heading text-2xl font-semibold">{t('title')}</h1>
      </header>

      <SignalsDisclaimerBanner />

      <FilterBar />

      {error ? (
        <section className="mt-8 rounded-xl bg-card p-6 ring-1 ring-foreground/10">
          <h2 className="text-lg font-semibold">{t('error.heading')}</h2>
          <p className="mt-2 text-muted-foreground">{t('error.body')}</p>
          {/* Le rechargement de la page relance la requête RSC (repli sans état client). */}
          <a
            href="."
            className="mt-4 inline-flex min-h-11 items-center rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground"
          >
            {t('error.retry')}
          </a>
        </section>
      ) : data.length === 0 ? (
        <section className="mt-8 rounded-xl bg-card p-8 text-center ring-1 ring-foreground/10">
          <h2 className="text-lg font-semibold">{t('emptyHeading')}</h2>
          <p className="mx-auto mt-2 max-w-prose text-muted-foreground">{t('emptyBody')}</p>
        </section>
      ) : (
        <QueryProvider>
          <SignalList initialData={data} filters={filters} locale={locale} />
        </QueryProvider>
      )}

      {/* Miroir du track record mesuré (D-13) — même source/composant que la vitrine. */}
      <section className="mt-12 border-t border-border pt-10">
        <TrackRecordBlock />
      </section>
    </main>
  )
}
