/**
 * /[locale]/dashboard/abonnement — gestion d'abonnement RÉHÉBERGÉE dans le shell (dash)
 * (UDASH-01, D-11). Réhébergement, PAS un clone : on MONTE le composant existant
 * `PlanCard` et l'action serveur `getDiscoveryAvailability` de `(account)/abonnement`
 * (parcours de paiement USDT, PAY-01/06) pour rester dans le chrome du dashboard.
 *
 * Gate : assuré par `(dash)/layout.tsx` (requireUser) — atteignable par un membre
 * non-abonné venu payer ET par un abonné venu renouveler (D-11). ExpiryBanner est déjà
 * rendu EN TÊTE du shell → non répété ici (anti-doublon vs (account)/abonnement).
 * AUCUN client service_role (frontière producteur-unique).
 */
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { OFFSET_RESERVATION_MINUTES } from '@app/supabase'
import { QueryProvider } from '@/components/providers/QueryProvider'
import { PlanCard } from '../../../(account)/abonnement/PlanCard'
import { getDiscoveryAvailability } from '../../../(account)/abonnement/actions'

interface AbonnementPageProps {
  params: Promise<{ locale: string }>
}

export default async function DashAbonnementPage({ params }: AbonnementPageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('payment')

  // Adresse PUBLIQUE de réception — env serveur, jamais une saisie utilisateur.
  const receiveAddress = process.env['USDT_RECEIVE_ADDRESS'] ?? ''
  const discoveryAvailable = await getDiscoveryAvailability()

  return (
    <main className="mx-auto max-w-screen-md px-4 py-8 text-start md:px-6">
      <header className="mb-8">
        <h1 className="font-heading text-2xl font-semibold">{t('planTitle')}</h1>
        <div className="mt-2 h-px w-16 bg-primary/60" aria-hidden="true" />
        <p className="mt-3 text-muted-foreground">{t('usdtNote')}</p>
      </header>

      <QueryProvider>
        <PlanCard
          receiveAddress={receiveAddress}
          reservationMinutes={OFFSET_RESERVATION_MINUTES}
          discoveryAvailable={discoveryAvailable}
        />
      </QueryProvider>
    </main>
  )
}
