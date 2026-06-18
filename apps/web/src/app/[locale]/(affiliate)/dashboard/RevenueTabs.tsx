'use client'

/**
 * RevenueTabs (AFF-02, D-14) — tuile « Revenus générés » avec onglets cumul / mois.
 *
 * Composant client minimal pour l'interaction `tabs` (le reste du dashboard est RSC).
 * Reçoit les montants DÉJÀ formatés côté serveur (string), jamais les atomic bruts :
 * le formatage atomic→affichage (BigInt) reste serveur, ici on ne fait qu'afficher.
 * Montants en `<bdi>` (anti-inversion RTL). Aucune classe vert/rouge (D-04).
 */
import { useTranslations } from 'next-intl'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

interface RevenueTabsProps {
  /** Revenu cumulé déjà formaté (ex. « 1 234.56 USDT »). */
  totalFormatted: string
  /** Revenu du mois courant déjà formaté. */
  currentMonthFormatted: string
}

export function RevenueTabs({ totalFormatted, currentMonthFormatted }: RevenueTabsProps) {
  const t = useTranslations('affiliate')

  return (
    <Tabs defaultValue="total" className="w-full">
      <TabsList>
        <TabsTrigger value="total">{t('dashboard.revenueTotal')}</TabsTrigger>
        <TabsTrigger value="month">{t('dashboard.revenueCurrentMonth')}</TabsTrigger>
      </TabsList>
      <TabsContent value="total">
        <p className="text-2xl font-semibold">
          <bdi>{totalFormatted}</bdi>
        </p>
      </TabsContent>
      <TabsContent value="month">
        <p className="text-2xl font-semibold">
          <bdi>{currentMonthFormatted}</bdi>
        </p>
      </TabsContent>
    </Tabs>
  )
}
