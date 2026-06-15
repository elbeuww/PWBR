'use client'

/**
 * VerificationPolling (PAY-02/PAY-03, D-02) — vérification live par react-query.
 *
 * useQuery refetchInterval 4000 / staleTime 0, key sur payment_id, queryFn =
 * getPaymentStatus. Checklist steppée (transaction trouvée → montant/destinataire
 * → confirmations → activé). Stop sur état FINAL (verified/rejected/ambiguous) OU
 * ~120 s → repli DOUX « continuer en arrière-plan » (jamais erreur dure, D-02).
 *
 *   verified  → success + CTA « Accéder aux signaux ».
 *   rejected  → VerificationFailure (raison localisée depuis le typed code, re-soumission).
 *   ambiguous → message calme « revue manuelle » (D-06).
 *
 * prefers-reduced-motion honoré (pas de spin) ; focus déplacé vers le heading résultat.
 */
import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Loader2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Link } from '../../../../i18n/navigation'
import { getPaymentStatus, type StatusResult } from './actions'

interface VerificationPollingProps {
  paymentId: string
}

const POLL_MS = 4000
const TIMEOUT_MS = 120_000

type Status = StatusResult['status']
const FINAL: Status[] = ['verified', 'rejected', 'ambiguous']

export function VerificationPolling({ paymentId }: VerificationPollingProps) {
  const t = useTranslations('payment')
  const [timedOut, setTimedOut] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)

  const { data } = useQuery<StatusResult>({
    queryKey: ['payment-status', paymentId],
    queryFn: () => getPaymentStatus(paymentId),
    refetchInterval: (query) => {
      const s = query.state.data?.status
      return s && FINAL.includes(s) ? false : POLL_MS
    },
    staleTime: 0,
  })

  const status = data?.status ?? 'pending'
  const rejectReason = data && 'reject_reason' in data ? data.reject_reason : null

  // Timeout doux (jamais d'erreur dure) — uniquement tant que non final.
  useEffect(() => {
    if (FINAL.includes(status)) return
    const id = setTimeout(() => setTimedOut(true), TIMEOUT_MS)
    return () => clearTimeout(id)
  }, [status])

  // Déplace le focus vers le heading quand un état final/timeout est atteint (a11y).
  useEffect(() => {
    if (FINAL.includes(status) || timedOut) headingRef.current?.focus()
  }, [status, timedOut])

  // --- États finaux ---
  if (status === 'verified') {
    return (
      <section className="mx-auto max-w-screen-sm text-start">
        <h2 ref={headingRef} tabIndex={-1} className="text-xl font-semibold outline-none">
          {t('success.heading')}
        </h2>
        <p className="mt-2 text-muted-foreground">{t('success.body')}</p>
        <Button asChild className="mt-6 min-h-11 w-full">
          <Link href="/signaux">{t('success.cta')}</Link>
        </Button>
      </section>
    )
  }

  if (status === 'rejected') {
    const reasonKey = rejectReason ?? 'internal'
    return (
      <section className="mx-auto max-w-screen-sm text-start">
        <Alert variant="destructive">
          <AlertTitle ref={headingRef} tabIndex={-1} className="outline-none">
            {t('errors.resubmit')}
          </AlertTitle>
          <AlertDescription>
            <bdi>{t(`errors.${reasonKey}` as 'errors.internal')}</bdi>
          </AlertDescription>
        </Alert>
        <Button onClick={() => window.location.reload()} className="mt-6 min-h-11 w-full">
          {t('errors.resubmit')}
        </Button>
      </section>
    )
  }

  if (status === 'ambiguous') {
    return (
      <section className="mx-auto max-w-screen-sm text-start">
        <h2 ref={headingRef} tabIndex={-1} className="text-xl font-semibold outline-none">
          {t('polling.heading')}
        </h2>
        <p className="mt-2 text-muted-foreground">{t('errors.manual_review')}</p>
      </section>
    )
  }

  // --- En cours / timeout doux ---
  const steps = [
    { key: 'found', done: true },
    { key: 'verified', done: false },
    { key: 'confirmations', done: false },
    { key: 'activated', done: false },
  ] as const

  return (
    <section className="mx-auto max-w-screen-sm text-start" aria-live="polite">
      <h2 ref={headingRef} tabIndex={-1} className="text-xl font-semibold outline-none">
        {t('polling.heading')}
      </h2>
      <p className="mt-2 text-muted-foreground">{t('polling.subCopy')}</p>

      <ul className="mt-6 space-y-3">
        {steps.map((step) => (
          <li key={step.key} className="flex items-center gap-3">
            {step.done ? (
              <Check className="size-5 text-primary" aria-hidden />
            ) : (
              <Loader2
                className="size-5 motion-safe:animate-spin text-muted-foreground"
                aria-hidden
              />
            )}
            <span>{t(`polling.steps.${step.key}` as 'polling.steps.found')}</span>
          </li>
        ))}
      </ul>

      {timedOut && (
        <div className="mt-8 rounded-lg bg-card p-4 ring-1 ring-foreground/10">
          <p className="text-sm text-muted-foreground">{t('polling.timeout')}</p>
          <Button asChild variant="outline" className="mt-3 min-h-11">
            <Link href="/dashboard">{t('polling.background')}</Link>
          </Button>
        </div>
      )}
    </section>
  )
}
