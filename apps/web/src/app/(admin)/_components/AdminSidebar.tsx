'use client'

/**
 * AdminSidebar — navigation persistante du back-office superadmin (D-01/D-06).
 *
 * Îlot client : détecte la route active via usePathname() (prefix-match), monté SOUS
 * le gate requireRole('superadmin') du layout (jamais de garde ici).
 *
 * Phase 20 (D-06) : les liens existants sont REGROUPÉS sous 4 en-têtes d'axe
 * (Acquisition / Revenus / Ops / Conformité). Les URLs détail restent INCHANGÉES
 * (A5 — aucune redirection) : /admin/membres, /admin/file, /admin/sante,
 * /admin/signaux, /admin/affiliation/*. La synthèse Conformité vit sur le tableau de
 * bord (panneau D-18), il n'existe pas de page détail dédiée → en-tête + renvoi.
 *
 * ⚠️ Le groupe (admin) est HORS [locale] (mono-FR) → Link standard de next/link avec
 * hrefs littéraux /admin/…, JAMAIS le Link i18n de next-intl. L'accent --primary est
 * réservé à l'item actif.
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

interface AxisGroup {
  title: string
  items: readonly NavItem[]
}

// Tableau de bord (cockpit) : entrée racine, hors groupe d'axe.
const DASHBOARD: NavItem = {
  href: '/admin',
  labelKey: 'nav.dashboard',
  Icon: LayoutDashboard,
  exact: true,
}

// 4 axes D-06 — URLs détail INCHANGÉES (A5, aucune redirection).
const AXES: readonly AxisGroup[] = [
  {
    title: 'Acquisition',
    items: [
      { href: '/admin/affiliation/affilies', labelKey: 'nav.affiliates', Icon: Share2 },
      { href: '/admin/affiliation/payouts', labelKey: 'nav.payouts', Icon: Wallet },
    ],
  },
  {
    title: 'Revenus',
    items: [
      { href: '/admin/membres', labelKey: 'nav.members', Icon: Users },
      { href: '/admin/file', labelKey: 'nav.queue', Icon: Inbox },
    ],
  },
  {
    title: 'Ops',
    items: [
      { href: '/admin/sante', labelKey: 'nav.health', Icon: Activity },
      { href: '/admin/signaux', labelKey: 'nav.signals', Icon: Radio },
    ],
  },
]

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

export function AdminSidebar() {
  const t = useTranslations('admin')
  const pathname = usePathname()

  const renderItem = (item: NavItem) => {
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
  }

  return (
    <aside className="w-60 shrink-0 border-e border-border bg-card text-card-foreground">
      <nav className="flex flex-col gap-4 p-3">
        {renderItem(DASHBOARD)}

        {AXES.map((axis) => (
          <div key={axis.title} className="flex flex-col gap-1">
            <p className="px-3 pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {axis.title}
            </p>
            {axis.items.map(renderItem)}
          </div>
        ))}

        {/* Conformité : pas de page détail, synthèse sur le tableau de bord (D-18). */}
        <div className="flex flex-col gap-1">
          <p className="px-3 pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Conformité
          </p>
          <p className="px-3 text-xs text-muted-foreground">Synthèse sur le tableau de bord.</p>
        </div>
      </nav>
    </aside>
  )
}
