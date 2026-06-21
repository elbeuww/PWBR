/**
 * /[locale]/academie — index RSC public de l'Académie (CMS-01, D-06).
 *
 * Surface PUBLIQUE (groupe marketing) : AUCUNE gate Supabase/RLS/abonnement. Le
 * catalogue vient de `content.ts:listContent(locale)` (scan fs + gray-matter,
 * frontmatter-seul), filtré en mémoire par `parseAcademyParams` (whitelist Zod,
 * hors-enum ignoré, threat T-09-01). Multi-axes (D-05) : thème / niveau / plateforme.
 *
 * Deux types (D-04) : articles = cartes simples ; cours = cartes-parcours dérivées du
 * catalogue (regroupement des `type:'lecon'` par `course`, une carte par cours). Le
 * titre/cover d'un cours est dérivé de sa 1ʳᵉ leçon (aucun fichier `type:'cours'` —
 * les cours sont implicites, course-model.ts).
 *
 * Chaînes via next-intl (namespace `academy`, I18N-03). Classes logiques (text-start),
 * RTL-safe. `params`/`searchParams` `await`és (Next 15). Le rendu réel est validé en
 * Vercel preview (Plan 05), pas en build local (Pitfall 2 du `!`).
 */
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { listContent, type CatalogEntry } from '../../../../lib/academie/content'
import { parseAcademyParams, type AcademyParams } from '../../../../lib/academie/searchParams'
import { FilterBar } from '../../../../components/academie/FilterBar'
import { ContentCard } from '../../../../components/academie/ContentCard'
import { Eyebrow } from '@/components/nexa/Eyebrow'

interface AcademyIndexProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/** Entrée d'affichage normalisée pour l'index (article OU carte-parcours cours). */
interface DisplayCard {
  key: string
  href: string
  type: 'article' | 'cours'
  titre: string
  resume: string
  cover: string
  theme: string
  niveau: string
  plateforme?: string | undefined
  readingMinutes: number
  lessonCount?: number
}

/** Un filtre actif sur un axe matche si l'entrée porte une des valeurs sélectionnées. */
function matchesFilters(entry: CatalogEntry, filters: AcademyParams): boolean {
  if (filters.theme.length > 0 && !filters.theme.includes(entry.theme)) return false
  if (filters.niveau.length > 0 && !filters.niveau.includes(entry.niveau)) return false
  if (filters.plateforme.length > 0) {
    if (!entry.plateforme || !filters.plateforme.includes(entry.plateforme)) return false
  }
  return true
}

/**
 * Construit les cartes d'affichage : articles tels quels + une carte-parcours par
 * `course` (dérivée de la leçon d'ordre le plus bas pour le cover/thème/méta).
 */
function buildDisplayCards(catalog: CatalogEntry[], filters: AcademyParams): DisplayCard[] {
  const cards: DisplayCard[] = []
  const courseBuckets = new Map<string, CatalogEntry[]>()

  for (const entry of catalog) {
    if (!matchesFilters(entry, filters)) continue

    if (entry.type === 'lecon' && entry.course) {
      const bucket = courseBuckets.get(entry.course) ?? []
      bucket.push(entry)
      courseBuckets.set(entry.course, bucket)
      continue
    }
    if (entry.type === 'article') {
      cards.push({
        key: `article:${entry.slug}`,
        href: `/academie/${entry.slug}`,
        type: 'article',
        titre: entry.titre,
        resume: entry.resume,
        cover: entry.cover,
        theme: entry.theme,
        niveau: entry.niveau,
        plateforme: entry.plateforme,
        readingMinutes: entry.readingMinutes,
      })
    }
    // entry.type === 'cours' (fichier de cours explicite, optionnel) : traité comme carte cours.
    if (entry.type === 'cours') {
      cards.push({
        key: `cours:${entry.slug}`,
        href: `/academie/${entry.slug}`,
        type: 'cours',
        titre: entry.titre,
        resume: entry.resume,
        cover: entry.cover,
        theme: entry.theme,
        niveau: entry.niveau,
        plateforme: entry.plateforme,
        readingMinutes: entry.readingMinutes,
      })
    }
  }

  for (const [courseSlug, lessons] of courseBuckets) {
    const sorted = [...lessons].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    const head = sorted[0]
    if (!head) continue
    cards.push({
      key: `cours:${courseSlug}`,
      href: `/academie/${courseSlug}`,
      type: 'cours',
      titre: head.titre,
      resume: head.resume,
      cover: head.cover,
      theme: head.theme,
      niveau: head.niveau,
      plateforme: head.plateforme,
      readingMinutes: sorted.reduce((sum, l) => sum + l.readingMinutes, 0),
      lessonCount: sorted.length,
    })
  }

  return cards
}

export default async function AcademyIndexPage({ params, searchParams }: AcademyIndexProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('academy')

  const sp = await searchParams
  const filters = parseAcademyParams(sp)
  const catalog = await listContent(locale)
  const cards = buildDisplayCards(catalog, filters)

  return (
    <main className="mx-auto max-w-6xl px-4 py-16 text-start md:px-6">
      <header className="mb-2">
        <Eyebrow>{t('eyebrow')}</Eyebrow>
        <h1 className="mt-2 font-display text-2xl font-semibold text-foreground">{t('title')}</h1>
        <p className="mt-4 max-w-prose text-base text-muted-foreground">{t('subtitle')}</p>
      </header>

      <FilterBar />

      {cards.length === 0 ? (
        <section className="mt-12 rounded-xl bg-card p-8 text-center ring-1 ring-foreground/10">
          <h2 className="text-lg font-semibold text-foreground">{t('emptyHeading')}</h2>
          <p className="mx-auto mt-2 max-w-prose text-muted-foreground">{t('emptyBody')}</p>
        </section>
      ) : (
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <ContentCard
              key={card.key}
              href={card.href}
              type={card.type}
              titre={card.titre}
              resume={card.resume}
              cover={card.cover}
              theme={card.theme}
              niveau={card.niveau}
              plateforme={card.plateforme}
              readingMinutes={card.readingMinutes}
              {...(card.lessonCount !== undefined ? { lessonCount: card.lessonCount } : {})}
            />
          ))}
        </div>
      )}
    </main>
  )
}
