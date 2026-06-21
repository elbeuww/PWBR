/**
 * /[locale] — page d'accueil de la vitrine (VITR-01).
 *
 * Bénéfice-first (D-06) : hero → comment ça marche → [proof slot masqué D-08] →
 * aperçu tarifs (D-05). CTA hero → /tarifs (D-07).
 *
 * Track record mesuré : le slot D-08 est ACTIVÉ en Phase 5 (SHOW_PROOF=true). Le
 * bloc lit la vue pattern_stats via anon-client et n'affiche un % QUE mesuré
 * (jamais inventé) ; sous N=30 il rend « échantillon insuffisant — N trades ».
 * Vert/rouge réservés aux résultats mesurés (D-04). Classes logiques, nav localisée.
 */
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { Link } from '../../../i18n/navigation'
import { Button } from '@/components/ui/button'
import { Hero } from '@/components/hero/Hero'
import { TrackRecordBlock } from '@/components/track-record/TrackRecordBlock'

// D-08 : la section track record mesuré est ACTIVÉE en Phase 5 (TRACK-03).
const SHOW_PROOF = true

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('home')
  // D-08a : bloc funnel « Apprenez les bases » → /academie (libellé i18n academy.*).
  const tAcademy = await getTranslations('academy')

  return (
    <main className="mx-auto max-w-screen-xl px-4 text-start md:px-6 lg:px-8">
      {/* HERO — vitrine animée NEXA greenfield (UI-02, D-01..05). Remplace le hero
          statique : globe filaire + cartes anonymisées + data-rain + tilt, fond
          ink fixe, reduced-motion respecté. Copy via namespace `hero`. */}
      <section className="py-12 md:py-16">
        <Hero />
      </section>

      {/* COMMENT ÇA MARCHE — méthode (D-06) */}
      <section className="border-t border-border py-16">
        <h2 className="text-2xl font-semibold">{t('methodTitle')}</h2>
        <p className="mt-4 max-w-2xl text-muted-foreground">{t('methodBody')}</p>
        {/* Métrique FACTUELLE non-perf (marchés couverts) — jamais un taux de réussite */}
        <div className="mt-8">
          <h3 className="text-base font-semibold">{t('marketsTitle')}</h3>
          <p className="mt-2 text-muted-foreground">{t('marketsBody')}</p>
        </div>
      </section>

      {/* PROOF SLOT — track record mesuré, activé en Phase 5 (D-08 / TRACK-03) */}
      {SHOW_PROOF && (
        <section className="border-t border-border py-16">
          <TrackRecordBlock />
        </section>
      )}

      {/* APPRENEZ LES BASES — funnel Académie (D-08a) → /academie, lien localisé i18n. */}
      <section className="border-t border-border py-16">
        <h2 className="text-2xl font-semibold">{tAcademy('navAcademy')}</h2>
        <p className="mt-4 max-w-2xl text-muted-foreground">{tAcademy('subtitle')}</p>
        <div className="mt-6">
          <Button asChild variant="outline">
            <Link href="/academie">{tAcademy('learnBasicsCta')}</Link>
          </Button>
        </div>
      </section>

      {/* APERÇU TARIFS — renvoie vers /tarifs (D-05) */}
      <section className="border-t border-border py-16">
        <h2 className="text-2xl font-semibold">{t('pricingTeaserTitle')}</h2>
        <p className="mt-4 max-w-2xl text-muted-foreground">{t('pricingTeaserBody')}</p>
        <div className="mt-6">
          <Button asChild variant="outline">
            <Link href="/tarifs">{t('pricingTeaserCta')}</Link>
          </Button>
        </div>
      </section>
    </main>
  )
}
