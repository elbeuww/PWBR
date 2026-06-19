/**
 * /[locale]/academie/[course]/[lesson] — leçon RSC (CMS-01, D-07).
 *
 * Même gabarit que l'article : `resolveContent(lessonSlug, locale)` (garde T-09-PATH,
 * confine sous content/academie/ AVANT fs), rendu via `renderMdxFile` → `compileMDX`
 * sur `fs.readFile` (Pitfall 1, le `!`). Frontmatter invalide → état d'erreur, jamais 500.
 *
 * Ajoute la navigation préc./suiv. dérivée du modèle cours (`lessonNavigation`, Plan 02 :
 * voisins dans la liste triée par `order`, masqués aux bornes) + l'indicateur
 * `academy.courseProgress`. Liens via `@/i18n/navigation` (préserve la locale).
 *
 * `<Disclaimer />` injecté par la PAGE après `{content}` (LEGAL-01, non-contournable).
 */
import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { Link } from '../../../../../../i18n/navigation'
import { resolveContent, listContent } from '../../../../../../lib/academie/content'
import { renderMdxFile } from '../../../../../../lib/academie/render-mdx'
import { lessonNavigation } from '../../../../../../lib/academie/course-model'
import { extractToc } from '../../../../../../lib/academie/toc'
import { Toc } from '../../../../../../components/academie/Toc'
import { FallbackBanner } from '../../../../../../components/academie/FallbackBanner'
import { Disclaimer } from '@/components/Disclaimer'
import { Badge } from '../../../../../../components/ui/badge'

interface LessonProps {
  params: Promise<{ locale: string; course: string; lesson: string }>
}

export default async function AcademyLessonPage({ params }: LessonProps) {
  const { locale, course, lesson } = await params
  setRequestLocale(locale)
  const t = await getTranslations('academy')

  const resolved = await resolveContent(lesson, locale)
  if (!resolved) notFound()

  const rendered = await renderMdxFile(resolved.absPath)
  if (!rendered) {
    return (
      <main className="mx-auto max-w-prose px-4 py-16 text-start md:px-6">
        <h1 className="text-2xl font-semibold text-foreground">{t('emptyHeading')}</h1>
        <p className="mt-4 text-base text-muted-foreground">{t('errorBody')}</p>
        <Link href="/academie" className="mt-6 inline-flex text-sm font-semibold text-primary">
          {t('errorBackLink')}
        </Link>
        <div className="mt-12 border-t border-border pt-6">
          <Disclaimer />
        </div>
      </main>
    )
  }

  const { content, meta, body } = rendered
  const toc = extractToc(body)

  // Navigation cours : ordre depuis le frontmatter, voisins dérivés du catalogue.
  const catalog = await listContent(locale)
  const order = meta.order ?? 0
  const nav = lessonNavigation(course, order, catalog)

  return (
    <main className="mx-auto max-w-prose px-4 py-16 text-start md:px-6">
      {resolved.fallback ? <FallbackBanner /> : null}

      <header>
        {nav.total > 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('courseProgress', { current: nav.current, total: nav.total })}
          </p>
        ) : null}
        <h1 className="mt-2 text-2xl font-semibold text-foreground">{meta.titre}</h1>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge variant="outline">{t(`theme.${meta.theme}`)}</Badge>
          <Badge variant="outline">{t(`niveau.${meta.niveau}`)}</Badge>
          {meta.plateforme ? (
            <Badge variant="outline">{t(`plateforme.${meta.plateforme}`)}</Badge>
          ) : null}
        </div>
      </header>

      {toc.length > 0 ? (
        <div className="mt-8">
          <Toc items={toc} />
        </div>
      ) : null}

      <div className="prose prose-neutral mt-8 max-w-none dark:prose-invert">{content}</div>

      <nav
        aria-label={t('courseProgress', { current: nav.current, total: nav.total })}
        className="mt-12 flex items-center justify-between gap-4 border-t border-border pt-6"
      >
        {nav.prev ? (
          <Link
            href={`/academie/${course}/${nav.prev.slug}`}
            className="inline-flex h-11 items-center rounded-lg border border-border px-4 text-sm font-semibold text-foreground hover:bg-muted me-auto"
          >
            {t('lessonPrev')}
          </Link>
        ) : (
          <span className="me-auto" />
        )}
        {nav.next ? (
          <Link
            href={`/academie/${course}/${nav.next.slug}`}
            className="inline-flex h-11 items-center rounded-lg border border-border px-4 text-sm font-semibold text-foreground hover:bg-muted ms-auto"
          >
            {t('lessonNext')}
          </Link>
        ) : (
          <span className="ms-auto" />
        )}
      </nav>

      <div className="mt-12 border-t border-border pt-6">
        <Disclaimer />
      </div>
    </main>
  )
}
