/**
 * /[locale]/paiement-bientot — écran de fin de funnel honnête (D-09).
 *
 * Affiché après la création de compte (redirection succès du signup, D-09).
 * Page purement informative : « Paiement disponible très bientôt ».
 * ⛔ Zéro destinataire de fonds, zéro code visuel de réception, zéro identifiant de
 * transaction, zéro flux : le paiement réel (USDT TRC-20 + vérification on-chain)
 * arrive en Phase 4.
 *
 * Invariants : setRequestLocale (SSG) ; getTranslations('paiement') ;
 * conteneur prose ; classes logiques uniquement ; aucun vert/rouge.
 */
import { setRequestLocale, getTranslations } from 'next-intl/server'

export default async function PaiementBientotPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('paiement')

  return (
    <main className="mx-auto max-w-prose px-4 py-20 text-start">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      {/* Accent Tier 2 discret (filet token --primary) sur surface funnel calme. */}
      <div className="mt-3 h-px w-16 bg-primary/60" aria-hidden="true" />
      <p className="mt-4 text-muted-foreground">{t('body')}</p>
    </main>
  )
}
