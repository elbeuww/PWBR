/**
 * Toc — sommaire d'un contenu long (UI-SPEC §Layout 2).
 *
 * RSC. Reçoit `items: TocItem[]` (produits par lib/academie/toc.ts, slugs cohérents
 * rehype-slug). Liste de liens d'ancrage `text-sm` ; l'item courant (`currentSlug`)
 * passe en `text-primary` (accent réservé aux liens contextuels actifs, UI-SPEC §Color).
 *
 * Sticky desktop (`lg:sticky`) côté `end` logique, en flux mobile. Navigation par
 * ancres `#slug` (mêmes slugs que les `id` rendus par rehype-slug). Titre « Sommaire »
 * via `academy.tocTitle`. Propriétés logiques uniquement (ps/pe, ms/me) — RTL-safe.
 */
import { getTranslations } from 'next-intl/server'
import type { TocItem } from '../../lib/academie/toc'

interface TocProps {
  items: TocItem[]
  /** Slug de l'item courant (mis en accent). Optionnel. */
  currentSlug?: string
}

export async function Toc({ items, currentSlug }: TocProps) {
  if (items.length === 0) return null
  const t = await getTranslations('academy')

  return (
    <nav aria-label={t('tocTitle')} className="lg:sticky lg:top-24">
      <h2 className="text-sm font-semibold text-foreground">{t('tocTitle')}</h2>
      <ul className="mt-3 flex flex-col gap-2 border-s border-border ps-4">
        {items.map((item) => {
          const active = item.slug === currentSlug
          return (
            <li key={item.slug} className={item.level === 3 ? 'ms-3' : undefined}>
              <a
                href={`#${item.slug}`}
                aria-current={active ? 'location' : undefined}
                className={`text-sm transition-colors hover:text-foreground ${
                  active ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                {item.text}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
