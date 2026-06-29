import { getTranslations } from 'next-intl/server'

import { Link } from '../../i18n/navigation'
import { Button } from '@/components/ui/button'
import { Eyebrow } from '@/components/nexa/Eyebrow'
import { DataRain } from './DataRain'
import { FloatingCards } from './FloatingCards'
import { HeroTilt } from './HeroTilt'
import { WireframeGlobe } from './WireframeGlobe'

/**
 * Hero — vitrine animée greenfield NEXA (UI-02, D-01..05).
 *
 * Shell RSC : Eyebrow (accroche) + h1 + lede + 2 CTA (Button asChild + Link
 * localisé), plus les îlots décoratifs (globe filaire + data-rain en z-index bas)
 * et les cartes flottantes anonymisées enveloppées dans HeroTilt (z-index haut).
 *
 * D-04 : fond sombre INK FIXE via `var(--nexa-ink)` — indépendant du thème (reste
 * une vitrine cyber même en clair). Le texte est forcé clair pour le contraste sur
 * ce fond fixe (les tokens de thème ne s'appliquent pas ici, fond figé).
 *
 * Animations : toute la mécanique vit en CSS (globals.css) gardée
 * reduced-motion + le tilt vanilla TS gardé matchMedia (HeroTilt). CSS + vanilla
 * TS uniquement (D-05). Propriétés logiques only (RTL-safe). Baseline affichée
 * (D-16).
 */
export async function Hero() {
  const t = await getTranslations('hero')
  const tBaseline = await getTranslations('baseline')

  return (
    <section
      data-slot="hero"
      aria-labelledby="hero-title"
      className="relative isolate overflow-hidden rounded-2xl"
      // D-04 : fond ink FIXE, theme-indépendant.
      style={{ backgroundColor: 'var(--nexa-ink)' }}
    >
      {/* Ambiance NEXA — aura radiale + grille filaire (décoratif, z-0). */}
      <div aria-hidden className="nexa-hero-aura" />
      <div aria-hidden className="nexa-hero-grid" />
      {/* Couche décorative lointaine — data-rain (z-0). */}
      <DataRain />

      <div className="relative z-10 grid items-center gap-10 px-6 py-16 md:grid-cols-2 md:px-10 md:py-24">
        {/* Colonne texte. */}
        <div className="max-w-xl text-start">
          <Eyebrow tone="purple">{tBaseline('text')}</Eyebrow>
          <h1
            id="hero-title"
            className="mt-4 font-display text-[40px] leading-tight font-semibold text-white md:text-[56px]"
          >
            {t('title')}
          </h1>
          <p className="mt-6 text-base text-white/70">{t('lede')}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/methodologie">{t('ctaPrimary')}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/tarifs">{t('ctaSecondary')}</Link>
            </Button>
          </div>
        </div>

        {/* Colonne visuelle — globe filaire (fond) + cartes flottantes (tilt). */}
        <div className="relative grid place-items-center">
          <WireframeGlobe className="pointer-events-none absolute inset-0 -z-0 opacity-70" />
          <HeroTilt className="relative z-10 w-full">
            <FloatingCards ariaLabel={t('cardsLabel')} />
          </HeroTilt>
        </div>
      </div>
    </section>
  )
}
