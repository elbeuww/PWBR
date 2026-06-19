/**
 * /[locale]/academie/[slug] — détail RSC : ARTICLE ou page-COURS (CMS-01, D-04/D-07).
 *
 * Résolution (slug, locale) déléguée à `resolveContent` (Plan 02) qui valide slug/locale
 * et confine le chemin sous content/academie/ AVANT tout fs (threat T-09-PATH). La route
 * ne concatène jamais de chemin brut.
 *
 * Rendu MDX EXCLUSIVEMENT via `renderMdxFile` → `compileMDX(fs.readFile)` (Pitfall 1, le
 * `!` du chemin). Frontmatter invalide → état d'erreur, jamais 500 (T-09-02).
 *
 * `<Disclaimer />` injecté par la PAGE après `{content}` sur 100% des articles/leçons
 * (LEGAL-01, non-contournable — RESEARCH Pattern 2 ; jamais dans le MDX).
 *
 * Un cours n'a pas forcément de fichier propre : si `resolveContent` échoue, on tente de
 * dériver un cours du catalogue (`deriveCourse`) — page-parcours = liste ordonnée des
 * leçons + `Progress`. Un slug inexistant partout → `notFound()`.
 */
import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import Image from 'next/image'
import { Link } from '../../../../../i18n/navigation'
import { resolveContent, listContent } from '../../../../../lib/academie/content'
import { renderMdxFile } from '../../../../../lib/academie/render-mdx'
import { deriveCourse } from '../../../../../lib/academie/course-model'
import { extractToc } from '../../../../../lib/academie/toc'
import { Toc } from '../../../../../components/academie/Toc'
import { FallbackBanner } from '../../../../../components/academie/FallbackBanner'
import { Disclaimer } from '@/components/Disclaimer'
import { Progress } from '../../../../../components/ui/progress'
import { Badge } from '../../../../../components/ui/badge'

interface DetailProps {
  params: Promise<{ locale: string; slug: string }>
}

/** Pied disclaimer commun (LEGAL-01) — injecté par la page, jamais par le MDX. */
function DisclaimerFooter() {
  return (
    <div className="mt-12 border-t border-border pt-6">
      <Disclaimer />
    </div>
  )
}

export default async function AcademyDetailPage({ params }: DetailProps) {
  const { locale, slug } = await params
  setRequestLocale(locale)
  const t = await getTranslations('academy')

  const resolved = await resolveContent(slug, locale)

  // Cas A : un fichier réel résout (article, leçon servie en direct, ou cours explicite).
  if (resolved) {
    const rendered = await renderMdxFile(resolved.absPath)
    if (!rendered) {
      return (
        <main className="mx-auto max-w-prose px-4 py-16 text-start md:px-6">
          <h1 className="text-2xl font-semibold text-foreground">{t('emptyHeading')}</h1>
          <p className="mt-4 text-base text-muted-foreground">{t('errorBody')}</p>
          <Link href="/academie" className="mt-6 inline-flex text-sm font-semibold text-primary">
            {t('errorBackLink')}
          </Link>
          <DisclaimerFooter />
        </main>
      )
    }

    const { content, meta, body } = rendered

    // Page-cours explicite (fichier `type:'cours'`).
    if (meta.type === 'cours') {
      const catalog = await listContent(locale)
      const course = deriveCourse(slug, catalog)
      return (
        <CourseLanding
          title={meta.titre}
          resume={meta.resume}
          cover={meta.cover}
          locale={locale}
          courseSlug={slug}
          lessons={course.lessons}
          total={course.total}
          fallback={resolved.fallback}
        />
      )
    }

    // Article (ou leçon ouverte par son slug) : shell prose + TOC + Disclaimer.
    const toc = extractToc(body)
    return (
      <main className="mx-auto max-w-prose px-4 py-16 text-start md:px-6">
        {resolved.fallback ? <FallbackBanner /> : null}

        <header>
          <div className="relative aspect-video w-full overflow-hidden rounded-xl">
            <Image
              src={meta.cover}
              alt={meta.titre}
              fill
              className="object-cover"
              sizes="(min-width: 768px) 65ch, 100vw"
              priority
            />
          </div>
          <h1 className="mt-6 text-2xl font-semibold text-foreground">{meta.titre}</h1>
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

        <DisclaimerFooter />
      </main>
    )
  }

  // Cas B : aucun fichier — le slug est peut-être un cours implicite (dérivé des leçons).
  const catalog = await listContent(locale)
  const course = deriveCourse(slug, catalog)
  if (course.total > 0) {
    const head = course.lessons[0]
    // Méta dérivée de la 1ʳᵉ leçon (aucun fichier cours dédié — cours implicite).
    const headEntry = catalog.find((e) => e.type === 'lecon' && e.course === slug && e.order === head?.order)
    return (
      <CourseLanding
        title={head?.titre ?? slug}
        resume={head?.resume ?? ''}
        cover={headEntry?.cover ?? ''}
        locale={locale}
        courseSlug={slug}
        lessons={course.lessons}
        total={course.total}
        fallback={false}
      />
    )
  }

  notFound()
}

interface CourseLandingProps {
  title: string
  resume: string
  cover: string
  locale: string
  courseSlug: string
  lessons: { slug: string; order: number; titre: string; resume: string }[]
  total: number
  fallback: boolean
}

/** Page-parcours : en-tête cours + liste ordonnée des leçons + Progress + Disclaimer. */
async function CourseLanding({
  title,
  resume,
  cover,
  courseSlug,
  lessons,
  total,
  fallback,
}: CourseLandingProps) {
  const t = await getTranslations('academy')

  return (
    <main className="mx-auto max-w-prose px-4 py-16 text-start md:px-6">
      {fallback ? <FallbackBanner /> : null}

      <header>
        {cover ? (
          <div className="relative aspect-video w-full overflow-hidden rounded-xl">
            <Image
              src={cover}
              alt={title}
              fill
              className="object-cover"
              sizes="(min-width: 768px) 65ch, 100vw"
              priority
            />
          </div>
        ) : null}
        <div className="mt-6 flex items-center gap-2">
          <Badge variant="outline">{t('courseBadge')}</Badge>
          <span className="text-sm text-muted-foreground">{t('lessonsCount', { count: total })}</span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">{title}</h1>
        {resume ? <p className="mt-4 text-base text-muted-foreground">{resume}</p> : null}
      </header>

      <Progress value={0} className="mt-8" aria-label={t('courseProgress', { current: 0, total })} />

      <ol className="mt-8 flex flex-col gap-3">
        {lessons.map((lesson, idx) => (
          <li key={lesson.slug}>
            <Link
              href={`/academie/${courseSlug}/${lesson.slug}`}
              className="flex items-baseline gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:ring-1 hover:ring-foreground/20"
            >
              <span className="text-sm font-semibold tabular-nums text-primary">
                <bdi>{idx + 1}</bdi>
              </span>
              <span className="flex-1">
                <span className="block text-base font-semibold text-foreground">{lesson.titre}</span>
                <span className="mt-1 block text-sm text-muted-foreground">{lesson.resume}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>

      <div className="mt-12 border-t border-border pt-6">
        <Disclaimer />
      </div>
    </main>
  )
}
