/**
 * course-model.test.ts — dérivation cours/leçons sans DB (CMS-02, D-04/D-07).
 *
 * Behavior testé :
 *  - deriveCourse : filtre type==='lecon' && course===courseSlug, tri par `order` croissant,
 *    total exact ;
 *  - tie-break déterministe par slug quand `order` est dupliqué ;
 *  - lessonNavigation : prev/next voisins dans la liste triée, undefined aux bornes,
 *    current/total cohérents (progression).
 *
 * Fonctions PURES : reçoivent le catalogue, ne lisent pas le disque.
 */
import { describe, it, expect } from 'vitest'
import { deriveCourse, lessonNavigation } from './course-model'
import type { CatalogEntry } from './content'

function lecon(slug: string, order: number, course = 'mt5'): CatalogEntry {
  return {
    slug,
    type: 'lecon',
    theme: 'usage-plateforme',
    niveau: 'debutant',
    plateforme: 'mt5',
    titre: `Leçon ${order}`,
    resume: 'résumé',
    cover: '/c.png',
    date: '2026-06-14T00:00:00.000Z',
    readingMinutes: 2,
    course,
    order,
  }
}

const article: CatalogEntry = {
  slug: 'un-article',
  type: 'article',
  theme: 'gestion-risque',
  niveau: 'debutant',
  titre: 'Article',
  resume: 'r',
  cover: '/a.png',
  date: '2026-06-10T00:00:00.000Z',
  readingMinutes: 3,
}

describe('deriveCourse: regroupement + tri', () => {
  it('ordonne les leçons par order croissant et exclut articles + autres cours', () => {
    const catalog: CatalogEntry[] = [
      lecon('c', 3),
      article,
      lecon('a', 1),
      lecon('autre', 1, 'mt4'),
      lecon('b', 2),
    ]
    const course = deriveCourse('mt5', catalog)
    expect(course.lessons.map((l) => l.order)).toEqual([1, 2, 3])
    expect(course.lessons.map((l) => l.slug)).toEqual(['a', 'b', 'c'])
    expect(course.total).toBe(3)
    expect(course.courseSlug).toBe('mt5')
  })

  it('tie-break déterministe par slug quand order dupliqué', () => {
    const catalog = [lecon('zebra', 1), lecon('alpha', 1), lecon('mid', 2)]
    const course = deriveCourse('mt5', catalog)
    expect(course.lessons.map((l) => l.slug)).toEqual(['alpha', 'zebra', 'mid'])
  })

  it('cours inexistant → liste vide, total 0', () => {
    const course = deriveCourse('absent', [article])
    expect(course.lessons).toEqual([])
    expect(course.total).toBe(0)
  })
})

describe('lessonNavigation: prev/next + progression', () => {
  const catalog = [lecon('a', 1), lecon('b', 2), lecon('c', 3)]

  it('1ère leçon : prev undefined, next = leçon 2', () => {
    const nav = lessonNavigation('mt5', 1, catalog)
    expect(nav.prev).toBeUndefined()
    expect(nav.next?.slug).toBe('b')
    expect(nav.current).toBe(1)
    expect(nav.total).toBe(3)
  })

  it('leçon du milieu : prev et next définis', () => {
    const nav = lessonNavigation('mt5', 2, catalog)
    expect(nav.prev?.slug).toBe('a')
    expect(nav.next?.slug).toBe('c')
    expect(nav.current).toBe(2)
  })

  it('dernière leçon : next undefined, prev = leçon 2', () => {
    const nav = lessonNavigation('mt5', 3, catalog)
    expect(nav.prev?.slug).toBe('b')
    expect(nav.next).toBeUndefined()
    expect(nav.current).toBe(3)
    expect(nav.total).toBe(3)
  })

  it('order inexistant dans le cours → current 0, prev/next undefined', () => {
    const nav = lessonNavigation('mt5', 99, catalog)
    expect(nav.current).toBe(0)
    expect(nav.prev).toBeUndefined()
    expect(nav.next).toBeUndefined()
    expect(nav.total).toBe(3)
  })
})
