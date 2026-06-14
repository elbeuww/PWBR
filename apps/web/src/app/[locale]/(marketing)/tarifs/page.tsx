/**
 * /[locale]/tarifs — page placeholder (cible de redirection D-07).
 *
 * Contenu réel des offres en Phase 2/4. Toutes les chaînes via messages `pricing`
 * (I18N-03). setRequestLocale présent pour garder le rendu statique (Pitfall 3).
 */
import { setRequestLocale, getTranslations } from 'next-intl/server'

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('pricing')

  return (
    <main className="mx-auto max-w-2xl px-4 py-16 text-start md:px-6">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <p className="mt-4 text-muted-foreground">{t('body')}</p>
    </main>
  )
}
