'use client'

/**
 * FilterBar — filtres + tri synchronisés dans l'URL (Plan 03-02 Task 2 ;
 * MEMB-02, D-05/06/07/08).
 *
 * Source de vérité = URL query params (RSC-readable). Navigation localisée via
 * useRouter/usePathname de @/i18n/navigation (préserve la locale, localePrefix
 * always) — JAMAIS next/navigation (perdrait la locale). Lecture des params via
 * useSearchParams (next/navigation, lecture seule OK).
 *
 * Chips toggle : style (day/swing) + risque (low/medium/high/extreme). Select :
 * classe d'actif + tri. router.replace(..., { scroll: false }) → re-render RSC
 * sans saut de scroll. Bouton Réinitialiser quand un filtre est actif.
 *
 * Tap targets ≥44px ; propriétés logiques (ms/me/gap), RTL-friendly. Labels via
 * next-intl (namespace `signals`).
 */
import { useTranslations } from 'next-intl'
import { useRouter, usePathname } from '../../i18n/navigation'
import { useSearchParams } from 'next/navigation'

const STYLE_OPTIONS = ['day', 'swing'] as const
const RISK_OPTIONS = ['low', 'medium', 'high', 'extreme'] as const
const CLASS_OPTIONS = ['crypto', 'forex', 'metal', 'energy'] as const
const SORT_OPTIONS = ['score', 'recent', 'rr'] as const

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function FilterBar() {
  const t = useTranslations('signals')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const current = (key: string) => searchParams.get(key) ?? undefined
  const hasAnyFilter =
    !!current('style') || !!current('risk') || !!current('class') || !!current('asset') || !!current('sort')

  function setParam(key: string, value: string | undefined) {
    const next = new URLSearchParams(searchParams.toString())
    if (value === undefined || value === '') {
      next.delete(key)
    } else {
      next.set(key, value)
    }
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  function toggleParam(key: string, value: string) {
    setParam(key, current(key) === value ? undefined : value)
  }

  function resetAll() {
    router.replace(pathname, { scroll: false })
  }

  return (
    <section className="mt-6 flex flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      {/* Style (D-05) */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">{t('filters.style')}</span>
        {STYLE_OPTIONS.map((opt) => {
          const active = current('style') === opt
          return (
            <button
              key={opt}
              type="button"
              aria-pressed={active}
              onClick={() => toggleParam('style', opt)}
              className={`inline-flex min-h-11 items-center rounded-4xl px-4 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70'
              }`}
            >
              {t(`filters.style${capitalize(opt)}`)}
            </button>
          )
        })}
      </div>

      {/* Risque (D-05) */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">{t('filters.risk')}</span>
        {RISK_OPTIONS.map((opt) => {
          const active = current('risk') === opt
          return (
            <button
              key={opt}
              type="button"
              aria-pressed={active}
              onClick={() => toggleParam('risk', opt)}
              className={`inline-flex min-h-11 items-center rounded-4xl px-4 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70'
              }`}
            >
              {t(`filters.risk${capitalize(opt)}`)}
            </button>
          )
        })}
      </div>

      {/* Classe d'actif + tri (selects natifs, RTL via text-start) */}
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          {t('filters.class')}
          <select
            value={current('class') ?? ''}
            onChange={(e) => setParam('class', e.target.value || undefined)}
            className="min-h-11 rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground"
          >
            <option value="">—</option>
            {CLASS_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          {t('sortLabel')}
          <select
            value={current('sort') ?? 'score'}
            onChange={(e) => setParam('sort', e.target.value === 'score' ? undefined : e.target.value)}
            className="min-h-11 rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt === 'score' ? t('sort.scoreDesc') : opt === 'recent' ? t('sort.recent') : t('sort.rr')}
              </option>
            ))}
          </select>
        </label>

        {hasAnyFilter ? (
          <button
            type="button"
            onClick={resetAll}
            className="inline-flex min-h-11 items-center rounded-lg px-4 py-2 text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            {t('filters.reset')}
          </button>
        ) : null}
      </div>
    </section>
  )
}
