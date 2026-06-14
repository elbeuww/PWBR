/**
 * /[locale]/(member)/signaux — surface membre gated par abonnement actif.
 *
 * Minimal en P1 : c'est la première surface réelle sous (member) dont le seul
 * rôle est d'activer le gate `requireActiveSub` du layout parent (D-07). En P1
 * AUCUN user n'a d'abonnement actif → tout visiteur authentifié est redirigé
 * vers /tarifs (funnel), tout visiteur non authentifié vers /login+returnTo.
 * Le contenu réel des signaux (trade_setups/analyses lus via RLS ACCESS-02)
 * arrive en Phase 3. Chaînes externalisées (namespace `signals`, I18N-03).
 */
import { setRequestLocale, getTranslations } from 'next-intl/server'

export default async function SignalsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('signals')

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-start">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <p className="mt-4 text-muted-foreground">{t('body')}</p>
    </main>
  )
}
