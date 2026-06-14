import { defineRouting } from 'next-intl/routing'

/**
 * Routing i18n verrouillé (décisions D-01/02/03) :
 * - locales : fr, en, ar
 * - defaultLocale : fr (racine → /fr)
 * - localePrefix : 'always' (toutes les URLs préfixées /fr /en /ar)
 *
 * Pas de détection Accept-Language au MVP : la locale vient de l'URL ou du
 * cookie NEXT_LOCALE (changé via le sélecteur de langue).
 */
export const routing = defineRouting({
  locales: ['fr', 'en', 'ar'],
  defaultLocale: 'fr',
  localePrefix: 'always',
})

export type Locale = (typeof routing.locales)[number]
