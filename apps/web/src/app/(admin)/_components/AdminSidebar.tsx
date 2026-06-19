'use client'

/**
 * AdminSidebar — navigation persistante du back-office superadmin (D-01).
 *
 * Îlot client : détecte la route active via usePathname() (prefix-match), monté SOUS
 * le gate requireRole('superadmin') du layout (jamais de garde ici).
 *
 * ⚠️ Le groupe (admin) est HORS [locale] (mono-FR) → on utilise le Link standard de
 * next/link avec des hrefs littéraux /admin/…, JAMAIS le Link i18n de next-intl
 * (qui localiserait les URLs). L'accent --primary est réservé à l'item actif.
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  Activity,
  Inbox,
  LayoutDashboard,
  Radio,
  Share2,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

interface NavItem {
  href: string
  labelKey: string
  Icon: LucideIcon
  /** Actif uniquement sur correspondance exacte (évite que /admin soit toujours actif). */
  exact?: boolean
}

// Ordre D-01 : Tableau de bord · Membres · File · Affiliation · Payouts · Signaux · Santé.
const NAV_ITEMS: readonly NavItem[] = [
  { href: '/admin', labelKey: 'nav.dashboard', Icon: LayoutDashboard, exact: true },
  { href: '/admin/membres', labelKey: 'nav.members', Icon: Users },
  { href: '/admin/file', labelKey: 'nav.queue', Icon: Inbox },
  { href: '/admin/affiliation/affilies', labelKey: 'nav.affiliates', Icon: Share2 },
  { href: '/admin/affiliation/payouts', labelKey: 'nav.payouts', Icon: Wallet },
  { href: '/admin/signaux', labelKey: 'nav.signals', Icon: Radio },
  { href: '/admin/sante', labelKey: 'nav.health', Icon: Activity },
]

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

export function AdminSidebar() {
  const t = useTranslations('admin')
  const pathname = usePathname()

  return (
    <aside className="w-60 shrink-0 border-e border-border bg-card text-card-foreground">
      <nav className="flex flex-col gap-1 p-3">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item)
          const { Icon } = item
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={
                active
                  ? 'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium bg-primary/10 text-primary'
                  : 'flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              }
            >
              <Icon size={16} aria-hidden="true" />
              {t(item.labelKey)}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
