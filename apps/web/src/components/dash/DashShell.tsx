'use client'

/**
 * DashShell — chrome de navigation du groupe (dash) (UDASH-04, D-01/D-02).
 *
 * Sidebar latérale persistante en desktop (md:+) + bottom-nav fixe en mobile, 6
 * onglets (vue d'ensemble · signaux suivis · watchlist · abonnement · affiliation ·
 * paramètres) via le namespace i18n `dash.nav.*`. Liens localisés (`Link` de
 * @/i18n/navigation) ; item actif détecté par `usePathname()` (segment-aware).
 *
 * D-01 (P16) : AUCUN halo lumineux (néon) sur le chrome de navigation — l'item actif
 * = accent `--primary` en fill/underline SUBTIL (lisibilité d'abord, Tier App).
 * L'accent lumineux reste réservé aux surfaces de valeur (SignalCard). Focus = `--ring`.
 *
 * RTL : propriétés logiques uniquement (ps/pe/ms/me/start/end/inset-inline, border-s/e) ;
 * `dir` hérité de <html>. Aucune classe physique left/right. Tokens Tailwind v4
 * toujours via la forme longue `bg-[var(--token)]` (CR-01 P16). Hit-area ≥44px par item.
 *
 * lucide-react est résolu dans apps/web (UI-SPEC iconLibrary lucide) → icônes lucide.
 */
import type { ComponentType } from 'react'
import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/navigation'
import {
  LayoutDashboard,
  Activity,
  Star,
  CreditCard,
  Share2,
  Settings,
} from 'lucide-react'

interface NavItem {
  /** Clé de label sous `dash.nav.*`. */
  key: string
  /** Chemin localisé (sans préfixe de locale — géré par Link). */
  href: string
  Icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
}

// 6 onglets (UI-SPEC Surfaces & Interaction Contracts). L'onglet « signaux » pointe
// sur la vue Suivis ; Historique est une sous-vue interne (plan aval).
const NAV_ITEMS: readonly NavItem[] = [
  { key: 'overview', href: '/dashboard', Icon: LayoutDashboard },
  { key: 'suivis', href: '/dashboard/suivis', Icon: Activity },
  { key: 'watchlist', href: '/dashboard/watchlist', Icon: Star },
  { key: 'abonnement', href: '/dashboard/abonnement', Icon: CreditCard },
  { key: 'affiliation', href: '/dashboard/affiliation', Icon: Share2 },
  { key: 'parametres', href: '/dashboard/parametres', Icon: Settings },
]

/**
 * Actif si la route courante correspond à l'onglet. La vue d'ensemble (`/dashboard`)
 * exige une correspondance EXACTE (sinon elle resterait active sur toutes les
 * sous-routes) ; les autres acceptent leurs sous-chemins.
 */
function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function DashShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations('dash.nav')
  const pathname = usePathname()

  return (
    <div className="flex min-h-screen bg-[var(--background)]">
      {/* Sidebar persistante (desktop). */}
      <aside className="hidden w-60 shrink-0 border-e border-[var(--border)] bg-[var(--card)] md:flex md:flex-col">
        <nav aria-label={t('overview')} className="flex flex-col gap-1 p-4">
          {NAV_ITEMS.map(({ key, href, Icon }) => {
            const active = isActive(pathname, href)
            return (
              <Link
                key={key}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={[
                  'flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm text-start',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
                  active
                    ? 'bg-[var(--primary)]/10 font-medium text-[var(--primary)]'
                    : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]',
                ].join(' ')}
              >
                <Icon className="size-5 shrink-0" aria-hidden={true} />
                <span>{t(key)}</span>
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Zone de contenu. pb pour ne pas masquer le contenu sous la bottom-nav mobile. */}
      <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
        <main className="flex-1">{children}</main>
      </div>

      {/* Bottom-nav fixe (mobile). */}
      <nav
        aria-label={t('overview')}
        className="fixed inset-inline-0 bottom-0 z-20 flex items-stretch border-t border-[var(--border)] bg-[var(--card)] md:hidden"
      >
        {NAV_ITEMS.map(({ key, href, Icon }) => {
          const active = isActive(pathname, href)
          return (
            <Link
              key={key}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={[
                'flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-xs',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]',
                active
                  ? 'font-medium text-[var(--primary)]'
                  : 'text-[var(--muted-foreground)]',
              ].join(' ')}
            >
              <Icon className="size-5 shrink-0" aria-hidden={true} />
              <span className="truncate">{t(key)}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
