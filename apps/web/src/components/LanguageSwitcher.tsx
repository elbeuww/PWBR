'use client'

/**
 * LanguageSwitcher — dropdown accessible de bascule de langue (D-10).
 *
 * - Reste sur la MÊME page : usePathname() + useRouter().replace(pathname, { locale })
 *   de i18n/navigation (la persistance cookie NEXT_LOCALE est gérée par next-intl).
 * - Autonymes (Français / English / العربية) jamais traduits — via messages `language`.
 * - a11y : aria-haspopup=listbox, aria-expanded, navigation flèches, Enter/Espace
 *   sélectionne, Échap ferme + refocus, aria-selected sur l'item actif, focus-visible.
 * - RTL : menu ancré à l'`end` logique, items alignés text-start. Aucune classe
 *   physique (ml/mr/pl/pr/left/right/text-left).
 * - lucide-react absent du package.json (threat T-01-SC : pas de nouvel install) →
 *   icônes globe/chevron en SVG inline.
 *
 * Source : 01-RESEARCH.md §Pattern 1 ; UI-SPEC §Sélecteur de langue
 */
import { useEffect, useId, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { usePathname, useRouter } from '../i18n/navigation'
import { routing, type Locale } from '../i18n/routing'

const LOCALES = routing.locales

function GlobeIcon() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={open ? 'rotate-180 transition-transform' : 'transition-transform'}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

export function LanguageSwitcher() {
  const t = useTranslations('language')
  const activeLocale = useLocale() as Locale
  const pathname = usePathname()
  const router = useRouter()

  const [open, setOpen] = useState(false)
  const [focusIndex, setFocusIndex] = useState(0)

  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<Array<HTMLLIElement | null>>([])
  const listboxId = useId()

  // Ferme au clic extérieur.
  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  // Focus l'item actif/ciblé à l'ouverture.
  useEffect(() => {
    if (open) {
      itemRefs.current[focusIndex]?.focus()
    }
  }, [open, focusIndex])

  function openMenu() {
    const current = LOCALES.indexOf(activeLocale)
    setFocusIndex(current >= 0 ? current : 0)
    setOpen(true)
  }

  function closeMenu(refocus = true) {
    setOpen(false)
    if (refocus) triggerRef.current?.focus()
  }

  function select(locale: Locale) {
    setOpen(false)
    if (locale !== activeLocale) {
      // Reste sur la même page, change la locale (D-10).
      router.replace(pathname, { locale })
    } else {
      triggerRef.current?.focus()
    }
  }

  function onTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openMenu()
    }
  }

  function onListKeyDown(event: React.KeyboardEvent<HTMLUListElement>) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setFocusIndex((i) => (i + 1) % LOCALES.length)
        break
      case 'ArrowUp':
        event.preventDefault()
        setFocusIndex((i) => (i - 1 + LOCALES.length) % LOCALES.length)
        break
      case 'Home':
        event.preventDefault()
        setFocusIndex(0)
        break
      case 'End':
        event.preventDefault()
        setFocusIndex(LOCALES.length - 1)
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        select(LOCALES[focusIndex]!)
        break
      case 'Escape':
        event.preventDefault()
        closeMenu()
        break
      case 'Tab':
        closeMenu(false)
        break
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('label')}
        onClick={() => (open ? closeMenu(false) : openMenu())}
        onKeyDown={onTriggerKeyDown}
        className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <GlobeIcon />
        <span>{t(activeLocale)}</span>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={t('label')}
          aria-activedescendant={`${listboxId}-${LOCALES[focusIndex]}`}
          tabIndex={-1}
          onKeyDown={onListKeyDown}
          className="absolute end-0 z-10 mt-1 min-w-40 rounded-md border border-border bg-popover py-1 shadow-md"
        >
          {LOCALES.map((locale, index) => {
            const isActive = locale === activeLocale
            return (
              <li
                key={locale}
                id={`${listboxId}-${locale}`}
                ref={(el) => {
                  itemRefs.current[index] = el
                }}
                role="option"
                aria-selected={isActive}
                aria-current={isActive ? 'true' : undefined}
                tabIndex={-1}
                onClick={() => select(locale)}
                onFocus={() => setFocusIndex(index)}
                className="flex cursor-pointer items-center gap-2 px-3 py-2 text-start text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring data-[active=true]:font-semibold"
                data-active={isActive}
              >
                {t(locale)}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
