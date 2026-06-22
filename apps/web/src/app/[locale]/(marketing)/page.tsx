/**
 * /[locale] — page d'accueil de la vitrine NEXA (VITR-01).
 *
 * Bénéfice-first (D-06) : hero animé → marquee → comment ça marche → le score →
 * exemple concret → [proof mesuré D-08] → Telegram → tarifs → académie.
 *
 * Track record mesuré : le bloc D-08 (SHOW_PROOF) lit la vue pattern_stats via
 * anon-client et n'affiche un % QUE mesuré (jamais inventé ; sous N=30 → « échantillon
 * insuffisant »). Aucune promesse de gain (VITR-03). Sections riches en composants
 * NEXA, copy i18n fr/en/ar, RTL via propriétés logiques.
 */
import { setRequestLocale, getTranslations } from 'next-intl/server'

import { Link } from '../../../i18n/navigation'
import { Button } from '@/components/ui/button'
import { Hero } from '@/components/hero/Hero'
import { Marquee } from '@/components/nexa/Marquee'
import { HowItWorks } from '@/components/landing/HowItWorks'
import { ScoreFeature } from '@/components/landing/ScoreFeature'
import { SignalDemo } from '@/components/landing/SignalDemo'
import { TelegramBand } from '@/components/landing/TelegramBand'
import { PricingTiers } from '@/components/landing/PricingTiers'
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
  // D-08a : bloc funnel « Apprenez les bases » → /academie (libellé i18n academy.*).
  const tAcademy = await getTranslations('academy')

  return (
    <main className="flex flex-col">
      {/* HERO — vitrine animée NEXA (globe filaire + cartes + data-rain + aura/grille). */}
      <div className="mx-auto w-full max-w-screen-xl px-4 py-10 md:px-6 md:py-14 lg:px-8">
        <Hero />
      </div>

      {/* MARQUEE — bande instruments/sessions (neutre, zéro %). */}
      <div className="border-y border-border bg-card/40 py-4">
        <Marquee />
      </div>

      {/* COMMENT ÇA MARCHE — 3 étapes + aperçu cartes. */}
      <HowItWorks />

      {/* LE SCORE — gros gauge d'exemple + stats factuelles. */}
      <ScoreFeature />

      {/* EXEMPLE CONCRET — carte signal démo. */}
      <SignalDemo />

      {/* PROOF SLOT — track record mesuré, activé en Phase 5 (D-08 / TRACK-03). */}
      {SHOW_PROOF && (
        <section className="border-t border-border">
          <div className="mx-auto max-w-screen-xl px-4 py-20 md:px-6 lg:px-8">
            <TrackRecordBlock />
          </div>
        </section>
      )}

      {/* TELEGRAM — preuve avant promesse. */}
      <TelegramBand />

      {/* TARIFS — 2 paliers (prix réels). */}
      <PricingTiers />

      {/* APPRENEZ LES BASES — funnel Académie (D-08a) → /academie. */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-screen-xl px-4 py-20 md:px-6 lg:px-8">
          <h2 className="font-display text-2xl font-semibold">{tAcademy('navAcademy')}</h2>
          <p className="mt-4 max-w-2xl text-muted-foreground">{tAcademy('subtitle')}</p>
          <div className="mt-6">
            <Button asChild variant="outline">
              <Link href="/academie">{tAcademy('learnBasicsCta')}</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  )
}
