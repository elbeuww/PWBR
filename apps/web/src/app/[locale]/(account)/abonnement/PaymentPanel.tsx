'use client'

/**
 * PaymentPanel (PAY-01, PAY-02, D-01/D-03/D-05) — écran adresse/QR/montant.
 *
 * Décision fondateur (mobile-first), ordre vertical imposé :
 *   1. Bloc réseau « Réseau : TRC-20 (TRON) » en grand, au-dessus du QR.
 *   2. QR SVG MAISON (encode l'adresse PUBLIQUE seule, jamais le montant/secret).
 *   3. Adresse + copie 1-tap (tabular <bdi>).
 *   4. Montant exact unique + copie (Display brand-blue <bdi>, formatAtomic+Intl).
 *      Sur mobile, le bouton COPIER est l'action PRIMAIRE (wallet sur le même appareil).
 *   5. Compte à rebours de réservation (OFFSET_RESERVATION_MINUTES).
 *   6. HashForm puis VerificationPolling (au submit).
 *
 * Le montant n'est JAMAIS calculé côté client : il vient de reservePayment
 * (expected_amount_atomic posé par reserveOffset, service_role, D-05).
 */
import { useMemo, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { formatAtomic } from '@app/core'
import { QrCode } from '../../../../lib/qr/QrCode'
import { CopyButton } from './CopyButton'
import { HashForm } from './HashForm'
import { VerificationPolling } from './VerificationPolling'

interface PaymentPanelProps {
  paymentId: string
  /** Montant atomique attendu (string, BigInt sérialisé) — posé serveur (D-05). */
  expectedAmountAtomic: string
  /** Adresse publique de réception (env serveur, jamais saisie user). */
  receiveAddress: string
  /** Minutes de validité de la réservation (OFFSET_RESERVATION_MINUTES). */
  reservationMinutes: number
}

/** Formate un montant atomique en décimal lisible via Intl (jamais de float). */
function useFormattedAmount(atomic: string, locale: string): string {
  return useMemo(() => {
    const decimal = formatAtomic(BigInt(atomic)) // "9.020000"
    // Intl.NumberFormat capable 6 décimales, sans zéros superflus (min 2, max 6).
    const nf = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
      useGrouping: false,
    })
    return nf.format(Number.parseFloat(decimal))
  }, [atomic, locale])
}

export function PaymentPanel({
  paymentId,
  expectedAmountAtomic,
  receiveAddress,
  reservationMinutes,
}: PaymentPanelProps) {
  const t = useTranslations('payment')
  const locale = useLocale()
  const [submittedHash, setSubmittedHash] = useState<string | null>(null)

  const amountDisplay = useFormattedAmount(expectedAmountAtomic, locale)
  // Montant brut pour la copie (chaîne canonique, jamais arrondie).
  const amountRaw = useMemo(() => {
    const d = formatAtomic(BigInt(expectedAmountAtomic))
    return d.replace(/0+$/, '').replace(/\.$/, '')
  }, [expectedAmountAtomic])

  if (submittedHash) {
    return <VerificationPolling paymentId={paymentId} />
  }

  return (
    <section className="mx-auto max-w-screen-sm text-start" aria-labelledby="pay-heading">
      <h2 id="pay-heading" className="text-xl font-semibold">
        {t('title')}
      </h2>

      {/* 1. Réseau en grand (D-01 « réseau en grand ») */}
      <p className="mt-2 text-lg font-semibold text-primary">{t('networkLabel')}</p>

      {/* 2. QR SVG maison — encode l'adresse PUBLIQUE seule */}
      <div className="mt-6 flex justify-center">
        <div className="rounded-xl bg-white p-4 ring-1 ring-foreground/10">
          <QrCode value={receiveAddress} ariaLabel={t('qrAlt')} size={200} />
        </div>
      </div>

      {/* 3. Adresse + copie */}
      <div className="mt-6 rounded-lg bg-card p-4 ring-1 ring-foreground/10">
        <p className="text-sm text-muted-foreground">{t('addressLabel')}</p>
        <p className="mt-1 break-all font-mono text-sm tabular-nums">
          <bdi dir="ltr">{receiveAddress}</bdi>
        </p>
        <div className="mt-3">
          <CopyButton
            value={receiveAddress}
            label={t('copyAddress')}
            successToast={t('copyAddressToast')}
            failToast={t('copyFailed')}
          />
        </div>
      </div>

      {/* 4. Montant exact unique + copie (action PRIMAIRE mobile) */}
      <div className="mt-6 rounded-lg bg-card p-4 ring-1 ring-foreground/10">
        <p className="text-sm text-muted-foreground">{t('amountLabel')}</p>
        <p className="mt-1 text-4xl font-semibold leading-tight text-primary">
          <bdi dir="ltr">
            {amountDisplay} {t('amountUnit')}
          </bdi>
        </p>
        <p className="mt-2 text-sm text-muted-foreground">{t('amountInstruction')}</p>
        <div className="mt-3">
          <CopyButton
            value={amountRaw}
            label={t('copyAmount')}
            successToast={t('copyAmountToast')}
            failToast={t('copyFailed')}
            primary
          />
        </div>
        {/* 5. Compte à rebours de réservation (D-05) */}
        <p className="mt-3 text-xs text-muted-foreground">
          {t('reservation.countdown', { minutes: reservationMinutes })}
        </p>
      </div>

      {/* 6. Soumission du hash */}
      <div className="mt-8">
        <HashForm paymentId={paymentId} onSubmitted={setSubmittedHash} />
      </div>
    </section>
  )
}
