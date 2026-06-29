import { getTranslations } from 'next-intl/server'

import { Link } from '../../i18n/navigation'
import { Button } from '@/components/ui/button'
import { Eyebrow } from '@/components/nexa/Eyebrow'

/**
 * PricingTiers — section vitrine « Tarifs » (2 paliers).
 *
 * RSC. Les PRIX réels viennent du namespace `pricing` (source unique : Découverte
 * 3 $/7j, Standard 9 $/mois) — jamais réinventés. Chrome/features via `landing.pricing`.
 * Les CTA pointent vers /tarifs (funnel). Badge « popular » positionné en logique (RTL-safe).
 */
export async function PricingTiers() {
  const t = await getTranslations('landing.pricing')
  const tp = await getTranslations('pricing')
  const feats = [t('feat1'), t('feat2'), t('feat3'), t('feat4')]

  return (
    <section className="border-t border-border bg-card/40">
      <div className="mx-auto max-w-screen-xl px-4 py-20 md:px-6 lg:px-8">
        <div className="nexa-reveal mx-auto max-w-xl text-center">
          <Eyebrow tone="purple">{t('eyebrow')}</Eyebrow>
          <h2 className="mt-3 font-display text-3xl font-semibold md:text-4xl">{t('title')}</h2>
          <p className="mt-4 text-muted-foreground">{t('lede')}</p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 md:items-stretch">
          {/* Découverte */}
          <div className="nexa-reveal flex flex-col rounded-2xl border border-border bg-card p-8 shadow-lg">
            <p className="font-display text-lg font-semibold">{tp('plan2Title')}</p>
            <p className="mt-2 font-mono text-3xl font-bold tabular-nums">
              <bdi>{tp('plan2Price')}</bdi>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{tp('plan2Note')}</p>
            <ul className="mt-6 grid flex-1 gap-3 text-sm">
              {[feats[0], feats[1], feats[2]].map((f, i) => (
                <li key={i} className="flex gap-2">
                  <span aria-hidden className="font-bold text-[var(--accent-brand)]">
                    ›
                  </span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <Button asChild variant="outline" className="w-full">
                <Link href="/tarifs">{t('discoveryCta')}</Link>
              </Button>
            </div>
          </div>

          {/* Standard — mis en avant */}
          <div className="nexa-reveal relative flex flex-col rounded-2xl border-2 border-primary bg-card p-8 shadow-xl">
            <span
              className="absolute -top-3 inline-flex rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
              style={{ insetInlineEnd: '1.5rem' }}
            >
              {t('popularBadge')}
            </span>
            <p className="font-display text-lg font-semibold">{tp('plan1Title')}</p>
            <p className="mt-2 font-mono text-3xl font-bold tabular-nums">
              <bdi>{tp('plan1Price')}</bdi>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{tp('plan1Usdt')}</p>
            <ul className="mt-6 grid flex-1 gap-3 text-sm">
              {feats.map((f, i) => (
                <li key={i} className="flex gap-2">
                  <span aria-hidden className="font-bold text-[var(--accent-brand)]">
                    ›
                  </span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <Button asChild className="w-full">
                <Link href="/tarifs">{t('standardCta')}</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
