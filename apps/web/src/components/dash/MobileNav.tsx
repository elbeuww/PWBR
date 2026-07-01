'use client'

/**
 * MobileNav — navigation mobile pour TOUTES les surfaces connectées (dash + member +
 * account). Corrige le trou : hors du groupe (dash), l'utilisateur mobile n'avait
 * aucune nav (tapait le logo → retour vitrine).
 *
 * Deux couches :
 *  1. Bottom-bar fixe (`md:hidden`) : 4 onglets prioritaires (PRIMARY_ITEMS) + un 5e
 *     bouton « Menu » qui ouvre le drawer.
 *  2. Drawer latéral (Radix Dialog) ancré au côté logique `start` (gauche en LTR /
 *     droite en RTL) : les 7 NAV_ITEMS + langue + déconnexion. Focus-trap & Esc gérés
 *     par Radix. Ferme au changement de route et au clic sur un item.
 *
 * D-01 (P16) : pas de néon sur le chrome ; item actif = accent `--primary` subtil.
 * RTL : propriétés logiques uniquement (inset-inline, start/end, ps/pe) ; `dir` hérité
 * de <html>. Tokens Tailwind v4 en forme longue `bg-[var(--token)]` (CR-01). Hit-area ≥44px.
 * PAS de alert()/confirm() (piège dialog). Déconnexion = server action existante.
 */
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { Menu, LogOut } from 'lucide-react'
import { Link, usePathname } from '@/i18n/navigation'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { NAV_ITEMS, PRIMARY_ITEMS, isActive } from './navItems'
import { signOut } from '../../app/[locale]/(auth)/actions'

export function MobileNav() {
  const t = useTranslations('dash.nav')
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // Ferme le drawer à chaque changement de route (navigation via un item ou ailleurs).
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  return (
    <>
      {/* Bottom-bar fixe (mobile uniquement). */}
      <nav
        aria-label={t('bottomLabel')}
        className="fixed inset-inline-0 bottom-0 z-30 flex items-stretch border-t border-[var(--border)] bg-[var(--card)] md:hidden"
      >
        {PRIMARY_ITEMS.map(({ key, href, Icon }) => {
          const active = isActive(pathname, href)
          return (
            <Link
              key={key}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={[
                'flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-xs',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]',
                active ? 'font-medium text-[var(--primary)]' : 'text-[var(--muted-foreground)]',
              ].join(' ')}
            >
              <Icon className="size-5 shrink-0" aria-hidden={true} />
              <span className="truncate">{t(key)}</span>
            </Link>
          )
        })}

        {/* 5e item : bouton « Menu » ouvrant le drawer avec la nav complète. */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-xs text-[var(--muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]"
        >
          <Menu className="size-5 shrink-0" aria-hidden={true} />
          <span className="truncate">{t('menu')}</span>
        </button>
      </nav>

      {/* Drawer latéral (côté logique start). */}
      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/40 duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 md:hidden" />
          <DialogPrimitive.Content
            aria-label={t('sidebarLabel')}
            className="fixed inset-block-0 start-0 z-50 flex h-full w-72 max-w-[85%] flex-col border-e border-[var(--border)] bg-[var(--card)] p-4 shadow-lg duration-150 outline-none data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 md:hidden"
          >
            <DialogPrimitive.Title className="px-3 pb-2 font-heading text-sm font-semibold text-[var(--muted-foreground)]">
              {t('sidebarLabel')}
            </DialogPrimitive.Title>

            <nav aria-label={t('sidebarLabel')} className="flex flex-1 flex-col gap-1 overflow-y-auto">
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

            {/* Pied : langue + déconnexion (action réversible, server action existante). */}
            <div className="mt-2 flex flex-col gap-2 border-t border-[var(--border)] pt-3">
              <LanguageSwitcher />
              <form action={signOut}>
                <button
                  type="submit"
                  className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-start text-[var(--destructive)] hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                >
                  <LogOut className="size-5 shrink-0" aria-hidden={true} />
                  <span>{t('logout')}</span>
                </button>
              </form>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  )
}
