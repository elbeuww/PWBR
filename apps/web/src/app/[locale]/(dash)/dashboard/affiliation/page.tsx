/**
 * /[locale]/dashboard/affiliation — alias vers le dashboard affilié dédié (D-10).
 *
 * Redirige vers `/affiliation/dashboard` (groupe séparé, gate requireRole('affiliate')).
 * La carte résumé affilié (AffiliateSummaryCard) est dans l'overview du (dash) ; ce
 * lien de nav permet d'atterrir sur la vue détaillée sans casser la navigation du shell.
 *
 * `redirect` localisé (i18n/navigation) → conserve le préfixe de locale courant.
 */
import { getLocale } from 'next-intl/server'
import { redirect } from '@/i18n/navigation'

export default async function DashAffiliationPage() {
  const locale = await getLocale()
  redirect({ href: '/affiliation/dashboard', locale })
}
