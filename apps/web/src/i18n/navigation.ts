import { createNavigation } from 'next-intl/navigation'
import { routing } from './routing'

/**
 * Wrappers de navigation localisés (D-10).
 * Link/redirect/usePathname/useRouter/getPathname préfixent automatiquement la
 * locale active — à utiliser PARTOUT à la place des primitives next/navigation
 * (consommés par le shell [locale], le sélecteur de langue et le gate au Plan 03).
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing)
