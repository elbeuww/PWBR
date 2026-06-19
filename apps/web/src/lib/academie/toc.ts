/**
 * toc.ts — extraction du sommaire (TOC) d'un corps MDX brut (D-10).
 *
 * Les slugs sont produits par `github-slugger` (Pitfall 5 : même algorithme que
 * `rehype-slug` appliqué au render), donc les ancres du TOC correspondent exactement
 * aux `id` émis sur les titres rendus — accents (fr) et caractères arabes inclus.
 *
 * Une instance fraîche de GithubSlugger par appel garantit une dédup déterministe
 * (titres identiques → `slug`, `slug-1`, …) cohérente avec le rendu d'une page.
 * On ne capte que H2/H3 ; les `#` à l'intérieur des blocs de code fencés sont ignorés.
 */
import GithubSlugger from 'github-slugger'

export type TocItem = { level: 2 | 3; text: string; slug: string }

const HEADING_RE = /^(#{2,3})\s+(.+?)\s*#*\s*$/
const FENCE_RE = /^(```|~~~)/

/** Extrait les titres H2/H3 du corps brut en items {level, text, slug}. */
export function extractToc(body: string): TocItem[] {
  const slugger = new GithubSlugger()
  const items: TocItem[] = []
  let inFence = false

  for (const line of body.split('\n')) {
    if (FENCE_RE.test(line.trim())) {
      inFence = !inFence
      continue
    }
    if (inFence) continue

    const match = HEADING_RE.exec(line)
    if (!match) continue

    const level = match[1]!.length as 2 | 3
    const text = match[2]!.trim()
    items.push({ level, text, slug: slugger.slug(text) })
  }

  return items
}
