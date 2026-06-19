/**
 * ContentCard — carte article ou cours sur l'index (UI-SPEC §Layout 1).
 *
 * RSC. Compose `Card` + `Badge`. Cover `next/image` 16:9, titre `text-xl font-semibold`,
 * résumé 2 lignes atténué, rangée de badges thème/niveau/plateforme et méta temps de
 * lecture `academy.readingTime` (ICU {minutes}).
 *
 * Badges au repos = `variant="outline"` UNIQUEMENT (jamais `default`/bg-primary, réservé
 * au filtre actif — UI-SPEC §Color). Variante cours : badge `outline` « Cours »
 * (`academy.courseBadge`) + nombre de leçons + CTA `academy.startCourse` ; article :
 * CTA `academy.readArticle`. Lien interne via `@/i18n/navigation` Link (préserve la locale).
 *
 * Libellés thème/niveau/plateforme via `academy.theme.*`/`niveau.*`/`plateforme.*`
 * (clés posées au Plan 04) — aucune valeur d'enum affichée brute.
 */
import { getTranslations } from 'next-intl/server'
import Image from 'next/image'
import { Link } from '../../i18n/navigation'
import { Card } from '../ui/card'
import { Badge } from '../ui/badge'

interface ContentCardProps {
  href: string
  type: 'article' | 'cours'
  titre: string
  resume: string
  cover: string
  theme: string
  niveau: string
  plateforme?: string | undefined
  readingMinutes: number
  /** Nombre de leçons (variante cours uniquement). */
  lessonCount?: number
}

export async function ContentCard({
  href,
  type,
  titre,
  resume,
  cover,
  theme,
  niveau,
  plateforme,
  readingMinutes,
  lessonCount,
}: ContentCardProps) {
  const t = await getTranslations('academy')
  const isCourse = type === 'cours'

  return (
    <Link
      href={href}
      className="group block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Card className="h-full transition-shadow group-hover:ring-foreground/20 group-focus-visible:ring-foreground/20">
        <div className="relative aspect-video w-full overflow-hidden">
          <Image
            src={cover}
            alt={titre}
            fill
            className="object-cover"
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          />
        </div>

        <div className="flex flex-col gap-3 px-4 pb-4">
          {isCourse ? (
            <div className="flex items-center gap-2">
              <Badge variant="outline">{t('courseBadge')}</Badge>
              {typeof lessonCount === 'number' ? (
                <span className="text-sm text-muted-foreground">
                  {t('lessonCount', { count: lessonCount })}
                </span>
              ) : null}
            </div>
          ) : null}

          <h3 className="text-xl font-semibold text-foreground">{titre}</h3>
          <p className="line-clamp-2 text-sm text-muted-foreground">{resume}</p>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{t(`theme.${theme}`)}</Badge>
            <Badge variant="outline">{t(`niveau.${niveau}`)}</Badge>
            {plateforme ? <Badge variant="outline">{t(`plateforme.${plateforme}`)}</Badge> : null}
          </div>

          <p className="text-sm text-muted-foreground">
            {t('readingTime', { minutes: readingMinutes })}
          </p>

          <span className="text-sm font-semibold text-primary">
            {isCourse ? t('startCourse') : t('readArticle')}
          </span>
        </div>
      </Card>
    </Link>
  )
}
