import { hasLocale } from 'next-intl'
import { getRequestConfig } from 'next-intl/server'
import { routing } from './routing'

/**
 * Config de requête next-intl : résout la locale depuis l'URL et charge les
 * messages correspondants. La locale issue de l'URL est validée par hasLocale
 * (frontière d'entrée — T-01-05) ; toute valeur non supportée retombe sur
 * defaultLocale plutôt que de casser le rendu.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
