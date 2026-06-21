'use client'

/**
 * ExpiryBanner — rappel d'expiration in-app (PAY-05, D-09/D-10/D-11).
 *
 * Affiché UNIQUEMENT à J-3 / J-2 / J-1 avant `current_period_end` (fenêtre actionnable,
 * pas du bruit). ICU plural via payment.expiryBanner. CTA « Renouveler » → parcours
 * paiement (D-11 : même parcours, PAS d'auto-renew). In-app uniquement, AUCUN email (D-09).
 * Coupe nette à current_period_end (D-10) : à 0 jour restant, plus de bandeau (l'accès est
 * coupé par la RLS, pas de grâce).
 *
 * Note (déviation Plan 06) : le diff de jours est calculé en JS natif UTC (pas luxon) —
 * luxon n'est pas une dépendance de apps/web et un simple écart de jours ne le justifie pas.
 * RTL : hérite du `dir` du document. prefers-reduced-motion : aucune animation déclenchée.
 */
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Alert, AlertDescription, AlertAction } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

interface ExpiryBannerProps {
  /** Fin de période de l'abonnement (ISO timestamptz). null → rien à afficher. */
  currentPeriodEnd: string | null
  /** Fenêtre d'alerte (jours). Défaut J-3. */
  windowDays?: number
}

/** Jours pleins restants (UTC, plancher) entre maintenant et la fin de période. */
function daysUntil(iso: string): number {
  const end = new Date(iso).getTime()
  const now = Date.now()
  if (Number.isNaN(end)) return Number.POSITIVE_INFINITY
  return Math.ceil((end - now) / 86_400_000)
}

export function ExpiryBanner({ currentPeriodEnd, windowDays = 3 }: ExpiryBannerProps) {
  const t = useTranslations('payment')
  if (!currentPeriodEnd) return null

  const remaining = daysUntil(currentPeriodEnd)
  // Hors fenêtre J-3/J-1 : avant J-3 (>windowDays) ou déjà échu (<=0, coupe nette D-10).
  if (remaining <= 0 || remaining > windowDays) return null

  // Conteneur aligné sur la largeur de contenu de la surface membre. Porté ici (et non
  // dans le layout) pour que l'état hors-fenêtre (null ci-dessus) ne laisse AUCUN DOM —
  // pas d'espacement vide parasite au-dessus des pages.
  return (
    <div className="mx-auto max-w-screen-xl px-4 pt-6 text-start md:px-6 lg:px-8">
      <Alert variant="warning">
        <AlertDescription>{t('expiryBanner', { n: remaining })}</AlertDescription>
        <AlertAction>
          <Button asChild size="sm" variant="outline">
            <Link href="/tarifs">{t('renew')}</Link>
          </Button>
        </AlertAction>
      </Alert>
    </div>
  )
}
