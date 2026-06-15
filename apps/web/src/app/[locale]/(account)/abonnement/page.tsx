/**
 * /[locale]/abonnement — parcours de paiement USDT (PAY-01/06, RSC).
 *
 * Remplace l'écran honnête « paiement bientôt » (P2) : c'est l'entrée réelle de
 * l'argent. Gate d'accès posé par (account)/layout.tsx (requireUser SEUL, pas
 * requireActiveSub) → atteignable par un membre authentifié NON-abonné venu payer
 * (et par un abonné pour renouveler, D-11).
 *
 * Le serveur fournit : l'adresse PUBLIQUE de réception (USDT_RECEIVE_ADDRESS, env,
 * jamais saisie user) + la disponibilité de la découverte (getDiscoveryAvailability,
 * D-12) + la durée de réservation (OFFSET_RESERVATION_MINUTES). Le reste (sélection,
 * réservation du montant unique, soumission, polling) vit dans l'arbre client sous
 * QueryProvider. AUCUN import service-client ici (frontière producteur-unique).
 *
 * i18n : namespaces `payment` + `pricing`. Classes logiques (text-start). Mobile-first.
 */
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { OFFSET_RESERVATION_MINUTES } from '@app/supabase'
import { QueryProvider } from '../../../../components/providers/QueryProvider'
import { PlanCard } from './PlanCard'
import { getDiscoveryAvailability } from './actions'

interface AbonnementPageProps {
  params: Promise<{ locale: string }>
}

export default async function AbonnementPage({ params }: AbonnementPageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('payment')

  // Adresse PUBLIQUE de réception — env serveur, jamais une saisie utilisateur.
  const receiveAddress = process.env['USDT_RECEIVE_ADDRESS'] ?? ''
  const discoveryAvailable = await getDiscoveryAvailability()

  return (
    <main className="mx-auto max-w-screen-md px-4 py-10 text-start md:px-6">
      <header className="mb-8">
        <h1 className="font-heading text-2xl font-semibold">{t('planTitle')}</h1>
        <p className="mt-1 text-muted-foreground">{t('usdtNote')}</p>
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
