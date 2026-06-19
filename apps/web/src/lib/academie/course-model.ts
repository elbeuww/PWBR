/**
 * course-model.ts — dérivation cours/leçons SANS base de données (D-04, D-07).
 *
 * Un cours est un regroupement implicite : toutes les entrées `type==='lecon'` partageant
 * le même `course`, triées par `order` croissant. Aucune I/O : ces fonctions sont PURES,
 * elles reçoivent le catalogue (produit par `content.ts:listContent`) en argument.
 *
 * Tri déterministe : `order` croissant, tie-break par `slug` (ordre lexicographique) pour
 * un résultat stable même si deux leçons partagent le même `order`.
 */
import type { CatalogEntry } from './content'

export interface CourseLesson {
  slug: string
  order: number
  titre: string
  resume: string
}

export interface CourseModel {
  courseSlug: string
  lessons: CourseLesson[]
  total: number
}

export interface LessonNav {
  /** Leçon précédente dans l'ordre du cours, undefined à la 1ʳᵉ. */
  prev?: CourseLesson | undefined
  /** Leçon suivante dans l'ordre du cours, undefined à la dernière. */
  next?: CourseLesson | undefined
  /** Index 1-based de la leçon courante (0 si l'order demandé est absent). */
  current: number
  /** Nombre total de leçons du cours. */
  total: number
}

/** Trie les leçons par `order` croissant puis `slug` (tie-break déterministe). */
function sortLessons(lessons: CourseLesson[]): CourseLesson[] {
  return [...lessons].sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order
    return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0
  })
}

/** Dérive le cours `courseSlug` depuis le catalogue : leçons triées + total. */
export function deriveCourse(courseSlug: string, catalog: readonly CatalogEntry[]): CourseModel {
  const lessons = catalog
    .filter(
      (e): e is CatalogEntry & { order: number } =>
        e.type === 'lecon' && e.course === courseSlug && typeof e.order === 'number',
    )
    .map<CourseLesson>((e) => ({
      slug: e.slug,
      order: e.order,
      titre: e.titre,
      resume: e.resume,
    }))

  const sorted = sortLessons(lessons)
  return { courseSlug, lessons: sorted, total: sorted.length }
}

/**
 * Navigation d'une leçon dans son cours : voisins prev/next dans la liste triée,
 * undefined aux bornes ; `current` est l'index 1-based (0 si l'order est introuvable).
 */
export function lessonNavigation(
  courseSlug: string,
  lessonOrder: number,
  catalog: readonly CatalogEntry[],
): LessonNav {
  const { lessons, total } = deriveCourse(courseSlug, catalog)
  const idx = lessons.findIndex((l) => l.order === lessonOrder)

  if (idx === -1) {
    return { prev: undefined, next: undefined, current: 0, total }
  }

  return {
    prev: idx > 0 ? lessons[idx - 1] : undefined,
    next: idx < lessons.length - 1 ? lessons[idx + 1] : undefined,
    current: idx + 1,
    total,
  }
}
