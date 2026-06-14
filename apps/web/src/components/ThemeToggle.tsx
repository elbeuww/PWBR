'use client'

/**
 * ThemeToggle — bouton de bascule dark/light (D-02).
 *
 * - useTheme() de next-themes : bascule + persistance + sync (class strategy).
 * - a11y/touch : min-h-11 min-w-11 (cible ≥44px), aria-label traduit (namespace
 *   `theme`), focus-visible:ring-2 (analog LanguageSwitcher).
 * - RTL-safe : AUCUNE classe physique (ml/mr/pl/pr/left/right/text-*) — uniquement
 *   propriétés logiques / utilitaires neutres (Pitfall B / AP4).
 * - No-flash : rendu différé après montage (resolvedTheme indéfini côté serveur)
 *   pour éviter un mismatch d'hydratation sur l'icône ; <html> porte
 *   suppressHydrationWarning ([locale]/layout).
 *
 * Source : 02-PATTERNS.md §ThemeToggle ; 02-UI-SPEC.md §Interaction & States.
 */
import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { useTranslations } from 'next-intl'
import { Moon, Sun } from 'lucide-react'

export function ThemeToggle() {
  const t = useTranslations('theme')
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = resolvedTheme === 'dark'

  function toggle() {
    setTheme(isDark ? 'light' : 'dark')
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t('toggleLabel')}
      title={mounted ? (isDark ? t('light') : t('dark')) : t('toggleLabel')}
      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
    >
      {/* Avant montage : icône neutre (évite le mismatch d'hydratation). */}
      {mounted && isDark ? (
        <Sun aria-hidden="true" width={18} height={18} />
      ) : (
        <Moon aria-hidden="true" width={18} height={18} />
      )}
    </button>
  )
}
