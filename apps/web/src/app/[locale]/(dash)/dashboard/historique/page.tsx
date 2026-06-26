/**
 * /[locale]/dashboard/historique — surface HISTORIQUE (UDASH-02, Plan 19-07 Task 2 ;
 * D-03/D-04/D-05/D-09).
 *
 * Les MÊMES setups suivis, une fois CLÔTURÉS (status ∈ invalidated/expired), avec leur
 * ISSUE MESURÉE (`prediction_outcomes` : outcome hit_tp/hit_sl/flat + realized_r) —
 * JAMAIS un % de gain agrégé fabriqué (D-09/VITR-03). Source UNIQUE jointe (D-04),
 * pagination CURSEUR keyset (D-05). Requête DÉLÉGUÉE à `fetchFollowedSetups` (19-03) —
 * aucune requête de table inline sur la watchlist (T-19-30). Anon-client RLS, jamais
 * service_role.
 *
 * 4 ÉTATS identiques à Suivis (UI-SPEC §135) : loading / error / empty / renewal
 * (abonné expiré → 0 ligne via le !inner RLS, D-03). Sous-vue interne de Suivis,
 * atteinte via <KeysetTabs/> (D-19-02-A) ; pas un onglet du chrome de nav principal.
 */
import { Suspense } from 'react'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { createClient } from '@/lib/supabase/server'
import { parseWatchlistParams } from '@/lib/signals/searchParams'
import { fetchFollowedSetups } from '@/lib/watchlist/queries'
import { KeysetList, KeysetTabs, KeysetSkeleton } from '@/components/dash/KeysetList'

interface HistoriquePageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function HistoriquePage({ params, searchParams }: HistoriquePageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dash')

  // Curseur lu de l'URL via le schéma whitelisté (19-03) — anti-injection, jamais brut.
  const { cursor } = parseWatchlistParams(await searchParams)

  return (
    <main className="mx-auto max-w-screen-lg px-4 py-8 text-start md:px-6">
      <h1 className="font-heading text-2xl font-semibold">{t('nav.historique')}</h1>
      <KeysetTabs active="historique" />
      {/* loading (état 1) : la clé=curseur relance le fallback à chaque page suivante. */}
      <Suspense key={cursor ?? 'first'} fallback={<KeysetSkeleton />}>
        <HistoriqueContent cursor={cursor} locale={locale} />
      </Suspense>
    </main>
  )
}

/** Contenu data-dépendant isolé sous <Suspense> → vrai état de chargement RSC. */
async function HistoriqueContent({ cursor, locale }: { cursor?: string; locale: string }) {
  const t = await getTranslations('dash')
  const supabase = await createClient()

  const { data, nextCursor, error } = await fetchFollowedSetups(supabase, {
    status: 'historique',
    cursor,
  })

  // error (état 2).
  if (error) {
    return (
      <section className="mt-6 rounded-xl bg-[var(--card)] p-6 ring-1 ring-[var(--border)]">
        <h2 className="text-lg font-semibold">{t('error.title')}</h2>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">{t('error.body')}</p>
        <a
          href="."
          className="mt-4 inline-flex min-h-11 w-fit items-center rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          {t('error.retry')}
        </a>
      </section>
    )
  }

  // renewal (état 4) : 0 ligne ET pas d'abonnement actif → abonné expiré (D-03).
  if (data.length === 0) {
    const { data: hasActive, error: rpcError } = await supabase.rpc('has_active_subscription')
    // On RPC error, fall through to empty state — better UX than false renewal banner.
    if (!rpcError && hasActive === false) {
      return (
        <section className="mt-6 rounded-xl bg-[var(--card)] p-8 ring-1 ring-[var(--border)]">
          <h2 className="text-lg font-semibold">{t('renewal.title')}</h2>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">{t('renewal.body')}</p>
          <Link
            href="/tarifs"
            className="mt-4 inline-flex min-h-11 w-fit items-center rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            {t('renewal.cta')}
          </Link>
        </section>
      )
    }
  }

  // empty (état 3) OU contenu (avec issue mesurée) — rendu par KeysetList variant historique.
  return (
    <KeysetList
      rows={data}
      nextCursor={nextCursor}
      basePath="/dashboard/historique"
      locale={locale}
      variant="historique"
    />
  )
}
