'use client'

/**
 * PlanCard (PAY-06, D-12) — choix d'offre + déclenchement de la réservation.
 *
 * 2 offres : standard (9$/mois) + découverte (3$/7j, une seule fois). La carte
 * découverte est masquée/désactivée si déjà consommée (discoveryAvailable, calculé
 * serveur via canConsumeDiscovery). En période découverte active, propose « passer
 * au standard » (D-12, upgrade anticipé sans remboursement).
 *
 * CÂBLAGE CLÉ : la sélection appelle la server action reservePayment(plan) ; la
 * valeur retournée { payment_id, expected_amount_atomic } est propagée à
 * PaymentPanel, qui affiche le montant UNIQUE réservé serveur. Le client n'invente
 * JAMAIS le montant.
 */
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { reservePayment, type Plan, type PaymentErrorCode } from './actions'
import { PaymentPanel } from './PaymentPanel'

interface PlanCardProps {
  receiveAddress: string
  reservationMinutes: number
  /** Calculé serveur (canConsumeDiscovery) : la découverte est-elle encore proposable ? */
  discoveryAvailable: boolean
}

interface Reserved {
  paymentId: string
  expectedAmountAtomic: string
}

export function PlanCard({ receiveAddress, reservationMinutes, discoveryAvailable }: PlanCardProps) {
  const t = useTranslations('payment')
  const tp = useTranslations('pricing')
  const [reserved, setReserved] = useState<Reserved | null>(null)
  const [pendingPlan, setPendingPlan] = useState<Plan | null>(null)

  async function choose(plan: Plan) {
    setPendingPlan(plan)
    const result = await reservePayment(plan)
    setPendingPlan(null)
    if (!result.ok) {
      toast.error(t(`errors.${result.code}` as `errors.${PaymentErrorCode}`))
      return
    }
    setReserved({
      paymentId: result.payment_id,
      expectedAmountAtomic: result.expected_amount_atomic,
    })
  }

  if (reserved) {
    return (
      <PaymentPanel
        paymentId={reserved.paymentId}
        expectedAmountAtomic={reserved.expectedAmountAtomic}
        receiveAddress={receiveAddress}
        reservationMinutes={reservationMinutes}
      />
    )
  }

  return (
    <section className="text-start" aria-labelledby="plan-heading">
      <h2 id="plan-heading" className="text-xl font-semibold">
        {t('planTitle')}
      </h2>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {/* Offre Standard — 9$/mois (D-11) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{tp('plan1Title')}</CardTitle>
            <CardDescription>{tp('plan1Usdt')}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold text-primary">
              <bdi dir="ltr">{tp('plan1Price')}</bdi>
            </p>
          </CardContent>
          <CardFooter>
            <Button
              type="button"
              className="min-h-11 w-full"
              disabled={pendingPlan !== null}
              onClick={() => choose('standard')}
            >
              {pendingPlan === 'standard' ? t('submitting') : tp('cta')}
            </Button>
          </CardFooter>
        </Card>

        {/* Offre Découverte — 3$/7j, one-shot (D-12). Masquée si consommée. */}
        {discoveryAvailable && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">{tp('plan2Title')}</CardTitle>
                <Badge>{tp('plan2Badge')}</Badge>
              </div>
              <CardDescription>{tp('plan2Usdt')}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-semibold text-primary">
                <bdi dir="ltr">{tp('plan2Price')}</bdi>
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{tp('plan2Note')}</p>
            </CardContent>
            <CardFooter>
              <Button
                type="button"
                className="min-h-11 w-full"
                disabled={pendingPlan !== null}
                onClick={() => choose('discovery')}
              >
                {pendingPlan === 'discovery' ? t('submitting') : tp('cta')}
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>

      {!discoveryAvailable && (
        <p className="mt-4 text-sm text-muted-foreground">{tp('discoveryConsumed')}</p>
      )}
    </section>
  )
}
