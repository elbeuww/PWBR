/**
 * /[locale]/affiliation — page de candidature affilié (AFF-01, surface 1, D-08).
 *
 * RSC trilingue (FR/EN/AR + RTL via utilities logiques). Point d'entrée du programme :
 * un visiteur/membre soumet sa candidature (réseaux sociaux, Telegram, Facebook,
 * nb abonnés, interactions) → file de revue superadmin (status='pending'). L'insert
 * passe par la server action service_role (ApplicationForm + actions.ts).
 *
 * Disclaimer P2 réutilisé (LEGAL-01) : contenu éducatif, AUCUNE promesse de revenu
 * d'affiliation. Aucune classe vert/rouge (D-04). Conteneur miroir des pages auth.
 */
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { Disclaimer } from '@/components/Disclaimer'
import { createClient } from '../../../lib/supabase/server'
import { ApplicationForm } from './ApplicationForm'

export default async function AffiliationPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('affiliate')

  // Email de session si connecté (sinon le formulaire affiche un champ email).
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const sessionEmail = user?.email ?? null

  return (
    <main className="mx-auto max-w-xl px-4 py-12 text-start">
      <h1 className="text-2xl font-semibold">{t('application.title')}</h1>
      <p className="mt-2 text-muted-foreground">{t('application.intro')}</p>

      <div className="mt-8">
        <ApplicationForm sessionEmail={sessionEmail} />
      </div>

      <div className="mt-8 border-t pt-6">
        <Disclaimer />
      </div>
    </main>
  )
}
