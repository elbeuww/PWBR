'use client'

/**
 * FilterBar — filtres multi-axes de l'Académie synchronisés dans l'URL (D-05).
 *
 * Calque sur `signals/FilterBar.tsx`. Source de vérité = URL query params (RSC-readable).
 * Navigation localisée via useRouter/usePathname de `../../i18n/navigation` (préserve la
 * locale, localePrefix always) — JAMAIS next/navigation (perdrait la locale). Lecture des
 * params via useSearchParams (next/navigation, lecture seule OK).
 *
 * Axes (D-05) : thème / niveau / plateforme, MULTI-SELECT par axe — le toggle ajoute ou
 * retire la valeur du paramètre tableau (`theme=a&theme=b`), il n'écrase pas l'axe. Chip
 * actif = `Badge variant="default"` (bg-primary, réservé filtre actif) ; repos =
 * `variant="outline"`. Cible tactile `min-h-11`, propriétés logiques (gap/ms/me) RTL-safe.
 *
 * La frontière de confiance reste la lecture RSC `parseAcademyParams` (Plan 01, hors-enum
 * ignoré) : la FilterBar n'écrit que des valeurs d'enum internes connues (threat T-09-01).
 *
 * Tous les libellés via next-intl (namespace `academy`).
 */
import { useTranslations } from 'next-intl'
import { useRouter, usePathname } from '../../i18n/navigation'
import { useSearchParams } from 'next/navigation'
import { Badge } from '../ui/badge'

const THEME_OPTIONS = [
  'usage-plateforme',
  'bases-trading',
  'gestion-risque',
  'analyse-technique',
  'comprendre-signaux',
] as const
const NIVEAU_OPTIONS = ['debutant', 'intermediaire'] as const
const PLATEFORME_OPTIONS = ['mt4', 'mt5', 'autre'] as const

const AXES = ['theme', 'niveau', 'plateforme'] as const
type Axis = (typeof AXES)[number]

export function FilterBar() {
  const t = useTranslations('academy')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const selected = (axis: Axis): string[] => searchParams.getAll(axis)
  const isActive = (axis: Axis, value: string): boolean => selected(axis).includes(value)
  const hasAnyFilter = AXES.some((axis) => selected(axis).length > 0)

  /** Toggle multi-select : retire la valeur si présente, l'ajoute sinon (logique tableau). */
  function toggleValue(axis: Axis, value: string) {
    const next = new URLSearchParams(searchParams.toString())
    const current = next.getAll(axis)
    next.delete(axis)
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value]
    for (const v of updated) next.append(axis, v)
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  function resetAll() {
    router.replace(pathname, { scroll: false })
  }

  const groups: Array<{ axis: Axis; label: string; options: readonly string[]; prefix: string }> = [
    { axis: 'theme', label: t('filterTheme'), options: THEME_OPTIONS, prefix: 'theme' },
    { axis: 'niveau', label: t('filterNiveau'), options: NIVEAU_OPTIONS, prefix: 'niveau' },
    { axis: 'plateforme', label: t('filterPlateforme'), options: PLATEFORME_OPTIONS, prefix: 'plateforme' },
  ]

  return (
    <section className="mt-6 flex flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      {groups.map((group) => (
        <div key={group.axis} className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">{group.label}</span>
          {group.options.map((opt) => {
            const active = isActive(group.axis, opt)
            return (
              <button
                key={opt}
                type="button"
                aria-pressed={active}
                onClick={() => toggleValue(group.axis, opt)}
                className="inline-flex min-h-11 items-center"
              >
                <Badge variant={active ? 'default' : 'outline'}>
                  {t(`${group.prefix}.${opt}`)}
                </Badge>
              </button>
            )
          })}
        </div>
      ))}

      {hasAnyFilter ? (
        <div className="flex">
          <button
            type="button"
            onClick={resetAll}
            className="inline-flex min-h-11 items-center rounded-lg px-4 py-2 text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            {t('resetFilters')}
          </button>
        </div>
      ) : null}
    </section>
  )
}
