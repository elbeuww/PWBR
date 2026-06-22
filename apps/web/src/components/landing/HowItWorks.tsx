import { getTranslations } from 'next-intl/server'

import { Eyebrow } from '@/components/nexa/Eyebrow'
import { FloatingCards } from '@/components/hero/FloatingCards'

/**
 * HowItWorks — section vitrine « Comment ça marche » (3 étapes).
 *
 * RSC, copy via `landing.how`. Réutilise FloatingCards (cartes anonymisées i18n,
 * ZÉRO %) comme aperçu produit. Marqueurs numérotés 01/02/03 = vraie séquence
 * (justifiés). Propriétés logiques only (RTL-safe).
 */
export async function HowItWorks() {
  const t = await getTranslations('landing.how')
  const steps = [1, 2, 3].map((n) => ({
    title: t(`step${n}Title`),
    body: t(`step${n}Body`),
  }))

  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-screen-xl px-4 py-20 md:px-6 lg:px-8">
        <div className="nexa-reveal max-w-2xl">
          <Eyebrow tone="purple">{t('eyebrow')}</Eyebrow>
          <h2 className="mt-3 font-display text-3xl font-semibold md:text-4xl">{t('title')}</h2>
          <p className="mt-4 text-muted-foreground">{t('lede')}</p>
        </div>

        <div className="mt-12 grid gap-10 lg:grid-cols-2 lg:items-center">
          <div className="nexa-reveal rounded-2xl border border-border bg-card p-6 shadow-xl">
            <p className="font-accent text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('mockLabel')}
            </p>
            <div className="mt-4">
              <FloatingCards ariaLabel={t('mockLabel')} />
            </div>
          </div>

          <ol className="grid gap-8">
            {steps.map((s, i) => (
              <li key={i} className="nexa-reveal flex gap-5">
                <span className="font-mono text-2xl font-bold tabular-nums text-[var(--accent-brand)]">
                  <bdi>{`0${i + 1}`}</bdi>
                </span>
                <div>
                  <h3 className="font-display text-xl font-semibold">{s.title}</h3>
                  <p className="mt-2 text-muted-foreground">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
