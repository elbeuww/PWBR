/**
 * content.ts — couche fichiers de l'Académie (D-01/D-02 : MDX versionnés, pas de DB).
 *
 * Sécurité (threat T-09-PATH, plus haute sévérité du domaine) :
 *  - `slug` doit matcher `^[a-z0-9-]+$` ET `locale` ∈ routing.locales AVANT tout accès
 *    disque. Le chemin est construit par `path.join` puis confiné par `path.resolve` +
 *    assertion `startsWith(CONTENT_ROOT)`. JAMAIS de concaténation du slug brut.
 *
 * Index (Pattern 3) : `fs.readdir` + `gray-matter` (frontmatter SEUL, aucun compile MDX).
 * Le frontmatter scanné est validé par `FrontmatterSchema` (frontière D-11, threat T-09-02).
 * Le temps de lecture est dérivé du corps brut via `computeReadingTime`.
 *
 * Fallback (Pattern 4, D-14) : (slug, locale) absent mais (slug, 'fr') présent → on sert
 * la version FR avec `fallback:true`. Jamais `null` si le FR existe (aucun 404 silencieux).
 *
 * Note CJS (Pitfall 3) : `import matter from 'gray-matter'` (default import, jamais require).
 */
import matter from 'gray-matter'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { routing } from '../../i18n/routing'
import { FrontmatterSchema, type Frontmatter } from './frontmatter'
import { computeReadingTime } from './reading-time'

/**
 * Racine du contenu, résolue relativement à CE module (apps/web/src/lib/academie),
 * indépendante du cwd : robuste pour Vitest (root workspace) ET le build Vercel.
 * apps/web/src/lib/academie → ../../../content/academie = apps/web/content/academie.
 */
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url))
export const CONTENT_ROOT = path.resolve(MODULE_DIR, '../../../content/academie')

const ARTICLES_DIR = path.join(CONTENT_ROOT, 'articles')
const COURS_DIR = path.join(CONTENT_ROOT, 'cours')

const SLUG_RE = /^[a-z0-9-]+$/

type Locale = (typeof routing.locales)[number]

export interface ResolvedContent {
  /** Chemin absolu confiné sous CONTENT_ROOT. */
  absPath: string
  /** Locale effectivement servie (peut différer de la demande si fallback). */
  locale: Locale
  /** true si la locale demandée était absente et qu'on a servi le FR (D-14). */
  fallback: boolean
}

export interface CatalogEntry {
  slug: string
  type: Frontmatter['type']
  theme: Frontmatter['theme']
  niveau: Frontmatter['niveau']
  plateforme?: Frontmatter['plateforme']
  titre: string
  resume: string
  cover: string
  date: string
  readingMinutes: number
  course?: string
  order?: number
}

export interface ContentLocales {
  slug: string
  locales: Locale[]
}

/** Garde path-traversal : valide slug/locale et renvoie le chemin confiné, sinon null. */
function safeFilePath(slug: string, locale: string): string | null {
  if (!SLUG_RE.test(slug)) return null
  if (!(routing.locales as readonly string[]).includes(locale)) return null

  // Un slug de leçon (cours) vit sous cours/{course}/{slug}.{locale}.mdx ; un article
  // sous articles/{slug}.{locale}.mdx. On ne connaît pas le dossier ici → on confine
  // simplement le nom de fichier et on laisse les helpers chercher dans les deux racines.
  const fileName = `${slug}.${locale}.mdx`

  // Confinement : le fichier doit rester sous CONTENT_ROOT.
  const candidate = path.resolve(CONTENT_ROOT, fileName)
  if (!candidate.startsWith(CONTENT_ROOT + path.sep)) return null

  return fileName
}

async function fileExists(absPath: string): Promise<boolean> {
  try {
    await fs.access(absPath)
    return true
  } catch {
    return false
  }
}

/** Cherche le chemin absolu d'un (slug, locale) dans articles/ puis dans cours/. */
async function findAbsPath(fileName: string): Promise<string | null> {
  const inArticles = path.join(ARTICLES_DIR, fileName)
  if (await fileExists(inArticles)) return inArticles

  // Leçons : cours/{course}/{fileName}. On scanne les dossiers de cours.
  let courseDirs: string[]
  try {
    const entries = await fs.readdir(COURS_DIR, { withFileTypes: true })
    courseDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name)
  } catch {
    courseDirs = []
  }
  for (const dir of courseDirs) {
    const candidate = path.join(COURS_DIR, dir, fileName)
    if (await fileExists(candidate)) return candidate
  }
  return null
}

/**
 * Résout (slug, locale) → fichier réel avec fallback FR (D-14).
 * Garde path-traversal appliquée AVANT tout accès disque (threat T-09-PATH).
 */
export async function resolveContent(
  slug: string,
  locale: string,
): Promise<ResolvedContent | null> {
  const fileName = safeFilePath(slug, locale)
  if (fileName === null) return null

  const direct = await findAbsPath(fileName)
  if (direct) return { absPath: direct, locale: locale as Locale, fallback: false }

  // Fallback D-14 : si la locale n'est pas 'fr', tenter le FR.
  if (locale !== 'fr') {
    const frFileName = safeFilePath(slug, 'fr')
    if (frFileName) {
      const frPath = await findAbsPath(frFileName)
      if (frPath) return { absPath: frPath, locale: 'fr', fallback: true }
    }
  }
  return null
}

/** Extrait le slug d'un nom de fichier `{slug}.{locale}.mdx`. */
function parseFileName(fileName: string): { slug: string; locale: string } | null {
  const m = fileName.match(/^([a-z0-9-]+)\.([a-z]{2})\.mdx$/)
  if (!m) return null
  return { slug: m[1], locale: m[2] }
}

/** Énumère tous les fichiers MDX (articles + leçons) avec leur chemin absolu. */
async function listAllFiles(): Promise<Array<{ fileName: string; absPath: string }>> {
  const out: Array<{ fileName: string; absPath: string }> = []

  try {
    const articleFiles = await fs.readdir(ARTICLES_DIR)
    for (const f of articleFiles) {
      if (f.endsWith('.mdx')) out.push({ fileName: f, absPath: path.join(ARTICLES_DIR, f) })
    }
  } catch {
    /* dossier absent → catalogue articles vide */
  }

  try {
    const courseDirs = await fs.readdir(COURS_DIR, { withFileTypes: true })
    for (const d of courseDirs) {
      if (!d.isDirectory()) continue
      const lessonDir = path.join(COURS_DIR, d.name)
      const lessonFiles = await fs.readdir(lessonDir)
      for (const f of lessonFiles) {
        if (f.endsWith('.mdx')) out.push({ fileName: f, absPath: path.join(lessonDir, f) })
      }
    }
  } catch {
    /* dossier absent → catalogue leçons vide */
  }

  return out
}

/**
 * Catalogue d'une locale (Pattern 3) : scan + gray-matter frontmatter-seul, validé par
 * FrontmatterSchema (T-09-02), readingMinutes sur le corps brut. Applique le fallback FR
 * D-14 par slug (un slug sans la locale demandée mais présent en FR apparaît via le FR).
 */
export async function listContent(locale: string): Promise<CatalogEntry[]> {
  if (!(routing.locales as readonly string[]).includes(locale)) return []

  const files = await listAllFiles()

  // Regrouper par slug → {locale: absPath}
  const bySlug = new Map<string, Map<string, string>>()
  for (const { fileName, absPath } of files) {
    const parsed = parseFileName(fileName)
    if (!parsed) continue
    if (!bySlug.has(parsed.slug)) bySlug.set(parsed.slug, new Map())
    bySlug.get(parsed.slug)!.set(parsed.locale, absPath)
  }

  const catalog: CatalogEntry[] = []
  for (const [slug, localeMap] of bySlug) {
    // Résolution locale demandée puis fallback FR (D-14).
    const absPath = localeMap.get(locale) ?? localeMap.get('fr')
    if (!absPath) continue

    const raw = await fs.readFile(absPath, 'utf8')
    const { data, content } = matter(raw)
    const fm = FrontmatterSchema.parse(data) // frontière D-11 (throw si invalide)

    catalog.push({
      slug,
      type: fm.type,
      theme: fm.theme,
      niveau: fm.niveau,
      plateforme: fm.plateforme,
      titre: fm.titre,
      resume: fm.resume,
      cover: fm.cover,
      date: fm.date,
      readingMinutes: computeReadingTime(content),
      course: fm.course,
      order: fm.order,
    })
  }

  return catalog
}

/**
 * Énumère chaque slug avec la liste des locales RÉELLEMENT présentes (pour le sitemap,
 * Plan 04). N'inclut PAS les fallbacks — uniquement les fichiers existants.
 */
export async function listAllContent(): Promise<ContentLocales[]> {
  const files = await listAllFiles()
  const bySlug = new Map<string, Set<Locale>>()

  for (const { fileName } of files) {
    const parsed = parseFileName(fileName)
    if (!parsed) continue
    if (!(routing.locales as readonly string[]).includes(parsed.locale)) continue
    if (!bySlug.has(parsed.slug)) bySlug.set(parsed.slug, new Set())
    bySlug.get(parsed.slug)!.add(parsed.locale as Locale)
  }

  return Array.from(bySlug.entries()).map(([slug, locales]) => ({
    slug,
    locales: Array.from(locales),
  }))
}
