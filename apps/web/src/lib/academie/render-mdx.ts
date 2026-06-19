/**
 * render-mdx.ts — compilation MDX d'un fichier résolu, EXCLUSIVEMENT via
 * `compileMDX` sur un `fs.readFile` (RESEARCH Pattern 1, Pitfall 1).
 *
 * Le `!` du chemin projet casse tout passage par la résolution de modules webpack
 * (séparateur de loaders). `compileMDX` reçoit une STRING lue par `fs`, jamais un
 * `import './x.mdx'` — il contourne entièrement le piège. NE JAMAIS importer un .mdx,
 * NE JAMAIS enregistrer un loader webpack `.mdx`, NE JAMAIS utiliser `@next/mdx`.
 *
 * Frontière de données (threat T-09-02) : le frontmatter compilé est re-validé par
 * `FrontmatterSchema`. Un frontmatter invalide → `safeParse` échoue → l'appelant rend
 * un état d'erreur / `notFound()`, JAMAIS un 500 (posture signaux/[id]).
 */
import { compileMDX } from 'next-mdx-remote/rsc'
import remarkGfm from 'remark-gfm'
import rehypeSlug from 'rehype-slug'
import { promises as fs } from 'node:fs'
import type { ReactElement } from 'react'
import { MDX_COMPONENTS } from '../../components/academie/mdx-components'
import { FrontmatterSchema, type Frontmatter } from './frontmatter'

export interface RenderedMdx {
  content: ReactElement
  meta: Frontmatter
  /** Corps MDX brut (sans frontmatter) — pour l'extraction du TOC. */
  body: string
}

/**
 * Lit le fichier (fs, jamais import), compile le MDX en RSC avec l'allowlist fixe
 * `MDX_COMPONENTS` (threat T-09-XSS), et valide le frontmatter. Retourne `null` si le
 * frontmatter est invalide (l'appelant décide : notFound / état d'erreur, jamais 500).
 */
export async function renderMdxFile(absPath: string): Promise<RenderedMdx | null> {
  const file = await fs.readFile(absPath, 'utf8') // fs, JAMAIS import — contourne le `!`

  const { content, frontmatter } = await compileMDX<Record<string, unknown>>({
    source: file,
    components: MDX_COMPONENTS,
    options: {
      parseFrontmatter: true,
      mdxOptions: { remarkPlugins: [remarkGfm], rehypePlugins: [rehypeSlug] },
    },
  })

  const parsed = FrontmatterSchema.safeParse(frontmatter)
  if (!parsed.success) return null

  // Corps brut sans frontmatter (pour le TOC) : retire le bloc `--- ... ---` de tête.
  const body = file.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')

  return { content, meta: parsed.data, body }
}
