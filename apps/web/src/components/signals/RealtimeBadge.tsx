'use client'

/**
 * RealtimeBadge — badge non-intrusif « N nouveaux signaux — afficher »
 * (Plan 03-02 Task 3 ; D-13).
 *
 * Affiché uniquement quand count > 0. Au clic, applique les nouveaux signaux
 * (callback onReveal côté SignalList) — l'insertion n'a JAMAIS lieu pendant la
 * lecture sans action de l'utilisateur (anti-reflow, D-13). Brand-blue subtil,
 * tap target ≥44px. Libellé pluralisé via next-intl (signals.realtimeBadge),
 * count en <bdi>.
 */
import { useTranslations } from 'next-intl'

interface RealtimeBadgeProps {
  count: number
  onReveal: () => void
}

export function RealtimeBadge({ count, onReveal }: RealtimeBadgeProps) {
  const t = useTranslations('signals')

  if (count <= 0) return null

  return (
    <div className="mt-6 flex justify-center">
      <button
        type="button"
        onClick={onReveal}
        className="inline-flex min-h-11 items-center rounded-4xl bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <bdi>{t('realtimeBadge', { count })}</bdi>
      </button>
    </div>
  )
}
