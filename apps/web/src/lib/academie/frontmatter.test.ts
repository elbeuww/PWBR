/**
 * frontmatter.test.ts — garde-fou de la frontière de données D-11 (threat T-09-02).
 *
 * Behavior testé :
 *  - un frontmatter valide (article/cours/leçon) parse ;
 *  - `type` hors {article,cours,lecon} → erreur Zod ;
 *  - `theme`/`niveau` hors enum → erreur ;
 *  - `titre`/`resume`/`cover` vides → erreur (.min(1)) ;
 *  - `plateforme`/`course`/`order` absents → OK (optionnels).
 * Un frontmatter invalide est rejeté à la frontière, jamais rendu silencieusement.
 */
import { describe, it, expect } from 'vitest'
import { FrontmatterSchema, ThemeEnum, NiveauEnum, PlateformeEnum } from './frontmatter'

const valid = {
  type: 'article',
  titre: 'Comprendre le risque',
  resume: 'Un résumé court.',
  theme: 'gestion-risque',
  niveau: 'debutant',
  date: '2026-06-19T00:00:00.000Z',
  cover: '/images/cover.png',
}

describe('FrontmatterSchema: cas valides (D-11)', () => {
  it('parse un article minimal valide (optionnels absents)', () => {
    const r = FrontmatterSchema.safeParse(valid)
    expect(r.success).toBe(true)
  })

  it('parse une leçon avec course + order', () => {
    const r = FrontmatterSchema.safeParse({
      ...valid,
      type: 'lecon',
      plateforme: 'mt5',
      course: 'mt5-prise-en-main',
      order: 2,
    })
    expect(r.success).toBe(true)
  })

  it('accepte une date string non-ISO (z.string fallback)', () => {
    expect(FrontmatterSchema.safeParse({ ...valid, date: '2026-06-19' }).success).toBe(true)
  })
})

describe('FrontmatterSchema: rejet à la frontière (T-09-02)', () => {
  it('type hors enum → erreur', () => {
    expect(FrontmatterSchema.safeParse({ ...valid, type: 'video' }).success).toBe(false)
  })

  it('theme hors enum → erreur', () => {
    expect(FrontmatterSchema.safeParse({ ...valid, theme: 'hacking' }).success).toBe(false)
  })

  it('niveau hors enum → erreur', () => {
    expect(FrontmatterSchema.safeParse({ ...valid, niveau: 'expert' }).success).toBe(false)
  })

  it('titre vide → erreur (.min(1))', () => {
    expect(FrontmatterSchema.safeParse({ ...valid, titre: '' }).success).toBe(false)
  })

  it('resume vide → erreur (.min(1))', () => {
    expect(FrontmatterSchema.safeParse({ ...valid, resume: '' }).success).toBe(false)
  })

  it('cover vide → erreur (.min(1))', () => {
    expect(FrontmatterSchema.safeParse({ ...valid, cover: '' }).success).toBe(false)
  })

  it('order négatif → erreur (positive int)', () => {
    expect(FrontmatterSchema.safeParse({ ...valid, order: -1 }).success).toBe(false)
  })
})

describe('Enums exposés (source unique des axes)', () => {
  it('ThemeEnum couvre les 5 thèmes D-11', () => {
    expect(ThemeEnum.options).toEqual([
      'usage-plateforme',
      'bases-trading',
      'gestion-risque',
      'analyse-technique',
      'comprendre-signaux',
    ])
  })

  it('NiveauEnum = debutant/intermediaire', () => {
    expect(NiveauEnum.options).toEqual(['debutant', 'intermediaire'])
  })

  it('PlateformeEnum = mt4/mt5/autre', () => {
    expect(PlateformeEnum.options).toEqual(['mt4', 'mt5', 'autre'])
  })
})
