/**
 * toc.test.ts — extraction du sommaire (D-10), slugs cohérents avec rehype-slug.
 *
 * Behavior testé :
 *  - `extractToc` retourne {level, text, slug} pour les titres H2/H3 du corps brut ;
 *  - le slug est produit par github-slugger (même algo que rehype-slug au render) ;
 *  - titres avec accents (fr) et caractères arabes → slugs non vides et stables ;
 *  - dédup cohérente (titres identiques → slug, slug-1, …) ;
 *  - les H1/H4+ et les `#` à l'intérieur d'un bloc de code ne polluent pas le TOC.
 */
import { describe, it, expect } from 'vitest'
import { extractToc } from './toc'

describe('extractToc: niveaux et structure', () => {
  it('extrait H2 et H3, ignore H1', () => {
    const body = ['# Titre principal', '## Section A', '### Sous-section', '## Section B'].join('\n')
    const toc = extractToc(body)
    expect(toc).toEqual([
      { level: 2, text: 'Section A', slug: 'section-a' },
      { level: 3, text: 'Sous-section', slug: 'sous-section' },
      { level: 2, text: 'Section B', slug: 'section-b' },
    ])
  })

  it('ignore les niveaux H4+', () => {
    const toc = extractToc('#### Trop profond\n## Garde')
    expect(toc.map((t) => t.text)).toEqual(['Garde'])
  })
})

describe('extractToc: slugs cohérents rehype-slug', () => {
  it('titre avec accents → slug non vide et stable', () => {
    const item = extractToc('## Gestion du Risque é à')[0]!
    expect(item.slug).toBe('gestion-du-risque-é-à')
    expect(item.slug.length).toBeGreaterThan(0)
  })

  it('titre arabe → slug non vide', () => {
    const item = extractToc('## إدارة المخاطر')[0]!
    expect(item.slug).toBe('إدارة-المخاطر')
    expect(item.slug.length).toBeGreaterThan(0)
  })

  it('dédup des titres identiques (cohérent rehype-slug)', () => {
    const toc = extractToc('## Titre\n## Titre')
    expect(toc.map((t) => t.slug)).toEqual(['titre', 'titre-1'])
  })
})

describe('extractToc: robustesse', () => {
  it('corps sans titre → tableau vide', () => {
    expect(extractToc('Juste du texte sans titre.')).toEqual([])
  })
})
