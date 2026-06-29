import { getTranslations } from 'next-intl/server'

import { Link } from '../../i18n/navigation'
import { Button } from '@/components/ui/button'
import { Eyebrow } from '@/components/nexa/Eyebrow'

/**
 * TelegramBand — section vitrine « Canal Telegram public » (preuve avant promesse).
 *
 * RSC, copy via `landing.telegram`. Aucun chiffre de réussite inventé (le % mesuré
 * vit dans TrackRecordBlock). Le CTA pointe vers le funnel /tarifs en attendant le
 * câblage du canal réel (TG, Phase 6). Dégradé de marque via `.nexa-band` (tokens).
 */
export async function TelegramBand() {
  const t = await getTranslations('landing.telegram')

  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-screen-xl px-4 py-20 md:px-6 lg:px-8">
        <div className="nexa-band nexa-reveal flex flex-col items-start gap-6 rounded-2xl border border-border p-8 md:flex-row md:items-center md:justify-between md:p-12">
          <div className="max-w-xl">
            <Eyebrow tone="purple">{t('eyebrow')}</Eyebrow>
            <h2 className="mt-3 font-display text-2xl font-semibold md:text-3xl">{t('title')}</h2>
            <p className="mt-3 text-muted-foreground">{t('lede')}</p>
          </div>
          <Button asChild size="lg">
            <Link href="/tarifs">{t('cta')}</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
