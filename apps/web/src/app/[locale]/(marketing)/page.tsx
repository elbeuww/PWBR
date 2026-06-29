/**
 * /[locale] — page d'accueil de la vitrine NEXA (VITR-01).
 *
 * Port fidèle de la maquette dark/néon du fondateur : la vitrine `.nxl` prend tout
 * l'écran (sa propre nav + footer remplacent le shell NEXA, masqué côté layout sur la
 * home). Marque NEXA, aucune promesse de gain (VITR-03), % toujours mesuré jamais
 * inventé, copy i18n fr/en/ar + RTL via propriétés logiques.
 */
import { setRequestLocale } from 'next-intl/server'

import { NexaLanding } from '@/components/landing/NexaLanding'
import '@/components/landing/nexa-landing.css'

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  return <NexaLanding />
}
