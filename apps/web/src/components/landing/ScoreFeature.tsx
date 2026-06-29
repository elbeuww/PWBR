import { getTranslations } from 'next-intl/server'

import { Eyebrow } from '@/components/nexa/Eyebrow'
import { BigGauge } from './BigGauge'

/**
 * ScoreFeature — section vitrine « Le score d'opportunité » (gros gauge + bénéfice).
 *
 * RSC, copy via `landing.score`. Le gauge est un EXEMPLE (risque modéré → amber,
 * jamais « vert = bon »). Les 3 stats sont FACTUELLES (marchés/horizons/styles),
 * JAMAIS un taux de réussite (le % mesuré vit dans TrackRecordBlock). Aucun %.
 */
export async function ScoreFeature() {
  const t = await getTranslations('landing.score')
  const stats = [1, 2, 3].map((n) => ({
    value: t(`stat${n}Value`),
    label: t(`stat${n}Label`),
  }))

  return (
    <section className="border-t border-border bg-card/40">
      <div className="mx-auto grid max-w-screen-xl items-center gap-12 px-4 py-20 md:grid-cols-2 md:px-6 lg:px-8">
        <div className="nexa-reveal grid place-items-center">
          <BigGauge score={78} risk="modere" label={t('exampleLabel')} />
        </div>
        <div className="nexa-reveal">
          <Eyebrow tone="purple">{t('eyebrow')}</Eyebrow>
          <h2 className="mt-3 font-display text-3xl font-semibold md:text-4xl">{t('title')}</h2>
          <p className="mt-4 max-w-xl text-muted-foreground">{t('lede')}</p>
          <dl className="mt-8 grid grid-cols-3 gap-6">
            {stats.map((s, i) => (
              <div key={i}>
                <dt className="font-mono text-xl font-bold tabular-nums text-foreground md:text-2xl">
                  <bdi>{s.value}</bdi>
                </dt>
                <dd className="mt-1 text-sm text-muted-foreground">{s.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  )
}
