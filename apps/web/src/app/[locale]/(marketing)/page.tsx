/**
 * /[locale] — page d'accueil de la vitrine (VITR-01).
 *
 * Bénéfice-first (D-06) : hero → comment ça marche → [proof slot masqué D-08] →
 * aperçu tarifs (D-05). CTA hero → /tarifs (D-07).
 *
 * ⛔ Aucune allégation de performance ni promesse de gain (VITR-03, Pitfall A) :
 * zéro pourcentage, zéro terme de rendement chiffré. Le slot de track record mesuré
 * est CONSTRUIT mais MASQUÉ jusqu'en Phase 5 (D-08) — zéro chiffre rendu.
 * Vert/rouge bannis (D-04). Classes logiques uniquement, navigation localisée.
 */
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { Link } from '../../../i18n/navigation'
import { Button } from '@/components/ui/button'

// D-08 : la section track record mesuré sera activée en Phase 5.
// En P2 le slot reste vide — aucun nombre, aucun taux rendu (Pitfall 8).
const SHOW_PROOF = false

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('home')

  return (
    <main className="mx-auto max-w-screen-xl px-4 text-start md:px-6 lg:px-8">
      {/* HERO — bénéfice-first (D-06) */}
      <section className="py-16 md:py-24">
        <h1 className="max-w-3xl text-[40px] leading-tight font-semibold md:text-[56px]">
          {t('heroTitle')}
        </h1>
        <p className="mt-6 max-w-2xl text-base text-muted-foreground">{t('heroLede')}</p>
        <div className="mt-8">
          <Button asChild size="lg">
            <Link href="/tarifs">{t('heroCta')}</Link>
          </Button>
        </div>
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

      {/* PROOF SLOT — construit mais MASQUÉ jusqu'en Phase 5 (D-08), zéro chiffre */}
      {SHOW_PROOF && null}

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
