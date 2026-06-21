/**
 * /[locale]/tarifs — page tarifs publique (VITR-02, D-10/D-11/D-12).
 *
 * 2 offres : 9 $/mois (Standard) + 3 $/7 jours (Découverte, une seule fois).
 * Mention « payable en USDT (TRC-20) ». CTA « S'abonner » → /signup (auth au clic, D-12).
 * Tarifs publics (visibles sans compte). Aucune adresse USDT (le paiement réel = P4).
 *
 * Invariants : setRequestLocale (SSG, Pitfall 3) ; getTranslations('pricing') ;
 * navigation localisée via i18n/navigation ; prix en <bdi> + Intl.NumberFormat
 * (anti-inversion RTL) ; classes logiques uniquement (text-start, ms/me) ;
 * AUCUN vert/rouge (D-04) ; AUCUN % / promesse de gain (VITR-03).
 */
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { Link } from '../../../../i18n/navigation'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Eyebrow } from '@/components/nexa/Eyebrow'

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('pricing')

  return (
    <main className="mx-auto max-w-screen-xl px-4 py-16 text-start md:px-6 lg:px-8">
      <Eyebrow>{t('eyebrow')}</Eyebrow>
      <h1 className="mt-2 font-display text-2xl font-semibold">{t('title')}</h1>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {/* Offre Standard — 9 $/mois (D-11) */}
        <Card className="transition-shadow hover:shadow-md">
          <CardHeader>
            <CardTitle className="text-base">{t('plan1Title')}</CardTitle>
            <CardDescription>{t('plan1Usdt')}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              <bdi>{t('plan1Price')}</bdi>
            </p>
          </CardContent>
          <CardFooter>
            <Button asChild className="w-full">
              <Link href="/signup">{t('cta')}</Link>
            </Button>
          </CardFooter>
        </Card>

        {/* Offre Découverte — 3 $/7 jours, une seule fois (D-11) */}
        <Card className="transition-shadow hover:shadow-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">{t('plan2Title')}</CardTitle>
              {/* Seul badge accent autorisé (UI-SPEC §Color point 4) */}
              <Badge>{t('plan2Badge')}</Badge>
            </div>
            <CardDescription>{t('plan2Usdt')}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              <bdi>{t('plan2Price')}</bdi>
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{t('plan2Note')}</p>
          </CardContent>
          <CardFooter>
            <Button asChild className="w-full">
              <Link href="/signup">{t('cta')}</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </main>
  )
}
