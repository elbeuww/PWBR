import { getTranslations } from 'next-intl/server'

import { Eyebrow } from '@/components/nexa/Eyebrow'
import { ScoreRing } from '@/components/nexa/ScoreRing'

/**
 * SignalDemo — section vitrine « Un exemple concret » (carte signal démo).
 *
 * RSC, copy via `landing.demo`. Données d'EXEMPLE éducatives (note explicite « pas
 * un signal réel »), jamais issues de la DB. Couleurs via tokens de signal
 * (stop = bearish, objectifs = bullish), JAMAIS de HEX en dur (no-hardcoded-signal-hex).
 * ScoreRing : couleur = risque. `<bdi>` autour des chiffres (RTL-safe).
 */
export async function SignalDemo() {
  const t = await getTranslations('landing.demo')
  const levels = [
    { k: t('kEntry'), v: t('vEntry'), tone: 'text-foreground' },
    { k: t('kStop'), v: t('vStop'), tone: 'text-[var(--signal-bearish)]' },
    { k: t('kTargets'), v: t('vTargets'), tone: 'text-[var(--signal-bullish)]' },
    { k: t('kRr'), v: t('vRr'), tone: 'text-[var(--accent-brand)]' },
  ]

  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-screen-xl px-4 py-20 md:px-6 lg:px-8">
        <div className="nexa-reveal mx-auto max-w-xl text-center">
          <Eyebrow tone="purple">{t('eyebrow')}</Eyebrow>
          <h2 className="mt-3 font-display text-3xl font-semibold md:text-4xl">{t('title')}</h2>
        </div>

        <div className="nexa-reveal mx-auto mt-10 max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-xl md:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-display text-xl font-semibold">
                <bdi>{t('instrument')}</bdi>
              </p>
              <p className="mt-1 font-accent text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('meta')}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex rounded-full border border-[var(--signal-bullish)] px-3 py-1 text-xs font-semibold text-[var(--signal-bullish)]">
                {t('direction')}
              </span>
              <ScoreRing score={92} risk="faible" size={56} label={t('ariaScore')} />
            </div>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">{t('note')}</p>

          <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {levels.map((l, i) => (
              <div key={i} className="rounded-xl border border-border bg-background/60 p-3">
                <dt className="font-accent text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {l.k}
                </dt>
                <dd className={`mt-1 font-mono text-sm font-semibold tabular-nums ${l.tone}`}>
                  <bdi>{l.v}</bdi>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  )
}
