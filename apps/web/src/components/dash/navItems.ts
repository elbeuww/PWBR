/**
 * navItems — modèle de navigation partagé du dashboard (source unique).
 *
 * Réutilisé par la sidebar desktop (DashShell), la bottom-bar mobile et le drawer
 * (MobileNav) → une seule définition, pas de triple source de vérité.
 *
 * `key` = clé de label sous le namespace i18n `dash.nav.*`. `href` = chemin localisé
 * (sans préfixe de locale, géré par Link de @/i18n/navigation). `Icon` = lucide-react.
 *
 * `PRIMARY_KEYS` = onglets exposés directement dans la bottom-bar mobile (≤4) ; le
 * reste vit dans le drawer « Menu ».
 */
import type { ComponentType } from 'react'
import {
  LayoutDashboard,
  LineChart,
  Activity,
  Star,
  CreditCard,
  Share2,
  Settings,
} from 'lucide-react'

export interface NavItem {
  /** Clé de label sous `dash.nav.*`. */
  key: string
  /** Chemin localisé (sans préfixe de locale — géré par Link). */
  href: string
  Icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
}

// 7 onglets (UI-SPEC Surfaces & Interaction Contracts). « signaux » = liste complète
// des signaux actifs ; « suivis » = sous-ensemble bookmarké (Historique = sous-vue interne).
export const NAV_ITEMS: readonly NavItem[] = [
  { key: 'overview', href: '/dashboard', Icon: LayoutDashboard },
  { key: 'signaux', href: '/dashboard/signaux', Icon: LineChart },
  { key: 'suivis', href: '/dashboard/suivis', Icon: Activity },
  { key: 'watchlist', href: '/dashboard/watchlist', Icon: Star },
  { key: 'abonnement', href: '/dashboard/abonnement', Icon: CreditCard },
  { key: 'affiliation', href: '/dashboard/affiliation', Icon: Share2 },
  { key: 'parametres', href: '/dashboard/parametres', Icon: Settings },
]

// Onglets prioritaires en accès direct dans la bottom-bar mobile (le reste → drawer).
export const PRIMARY_KEYS: readonly string[] = ['overview', 'signaux', 'suivis', 'watchlist']

export const PRIMARY_ITEMS: readonly NavItem[] = NAV_ITEMS.filter((item) =>
  PRIMARY_KEYS.includes(item.key),
)

/**
 * Actif si la route courante correspond à l'onglet. La vue d'ensemble (`/dashboard`)
 * exige une correspondance EXACTE (sinon elle resterait active sur toutes les
 * sous-routes) ; les autres acceptent leurs sous-chemins. Historique = sous-vue de Suivis.
 */
export function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === href
  if (href === '/dashboard/suivis') {
    return (
      pathname === href ||
      pathname.startsWith(`${href}/`) ||
      pathname === '/dashboard/historique'
    )
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}
