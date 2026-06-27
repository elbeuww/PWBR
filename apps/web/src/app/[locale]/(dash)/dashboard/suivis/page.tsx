/**
 * /[locale]/dashboard/suivis — surface SUIVIS (UDASH-02, Plan 19-07 Task 2 ;
 * D-03/D-04/D-05).
 *
 * Setups OUVERTS (status=active) bookmarkés, source UNIQUE `user_followed_setups ⋈
 * trade_setups!inner` (D-04), paginés par CURSEUR keyset (D-05, jamais de décalage).
 * La requête est DÉLÉGUÉE à `fetchFollowedSetups` (19-03) — aucune réimplémentation,
 * aucune requête de table inline sur la watchlist (T-19-30). Lecture anon-client RLS,
 * jamais service_role (frontière producteur-unique).
 *
 * 4 ÉTATS (UI-SPEC §135) :
 *   - loading  : <KeysetSkeleton/> via <Suspense> pendant le fetch RSC ;
 *   - error    : bloc dash.error.* + réessayer (recharge la RSC) ;
 *   - empty    : copy dash.suivis.* (jamais suivi) — rendu par <KeysetList/> ;
 *   - renewal  : abonné EXPIRÉ (D-03) → le `!inner` gardé par has_active_subscription()
 *                a filtré toutes les lignes (0 ligne) ; on affiche dash.renewal.* +
 *                CTA « Renouveler » (→ /tarifs), JAMAIS un upsell compte gratuit.
 *
 * Le gate du groupe (dash) = requireUser (layout) : un abonné expiré ENTRE pour
 * renouveler. La vraie barrière reste la RLS, pas le chrome (T-19-26).
 *
 * Historique = sous-vue interne atteinte via <KeysetTabs/> (D-19-02-A).
 */
import { Suspense } from 'react'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { createClient } from '@/lib/supabase/server'
import { parseWatchlistParams } from '@/lib/signals/searchParams'
import { fetchFollowedSetups } from '@/lib/watchlist/queries'
import { KeysetList, KeysetTabs, KeysetSkeleton } from '@/components/dash/KeysetList'

interface SuivisPageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function SuivisPage({ params, searchParams }: SuivisPageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dash')

  // Curseur lu de l'URL via le schéma whitelisté (19-03) — anti-injection, jamais brut.
  const { cursor } = parseWatchlistParams(await searchParams)

  return (
    <main className="mx-auto max-w-screen-lg px-4 py-8 text-start md:px-6">
      <h1 className="font-heading text-2xl font-semibold">{t('nav.suivis')}</h1>
      <KeysetTabs active="suivis" />
      {/* loading (état 1) : la clé=curseur relance le fallback à chaque page suivante. */}
      <Suspense key={cursor ?? 'first'} fallback={<KeysetSkeleton />}>
        <SuivisContent {...(cursor !== undefined ? { cursor } : {})} locale={locale} />
      </Suspense>
    </main>
  )
}

/** Contenu data-dépendant isolé sous <Suspense> → vrai état de chargement RSC. */
async function SuivisContent({ cursor, locale }: { cursor?: string; locale: string }) {
  const t = await getTranslations('dash')
  const supabase = await createClient()

  const { data, nextCursor, error } = await fetchFollowedSetups(supabase, {
    status: 'suivis',
    ...(cursor !== undefined ? { cursor } : {}),
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
  // has_active_subscription() = MÊME source de vérité que le !inner RLS (CR-05).
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

  // empty (état 3, rows.length===0 + abonné actif) OU contenu — rendu par KeysetList.
  return (
    <KeysetList
      rows={data}
      nextCursor={nextCursor}
      basePath="/dashboard/suivis"
      locale={locale}
      variant="suivis"
    />
  )
}
