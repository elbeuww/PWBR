/**
 * searchParams.test.ts — garde-fou du parsing/sérialisation des filtres Académie
 * (D-05, threat T-09-01). Calque sur signals/searchParams.test.ts.
 *
 * Behavior testé :
 *  - défaut : parseAcademyParams({}) → aucun filtre (tableaux vides) ;
 *  - rejet hors-enum : une valeur hors whitelist Zod est ignorée, jamais propagée ;
 *  - multi-select par axe : theme=a&theme=b → string[] filtré sur l'enum, les
 *    membres invalides du tableau sont retirés ;
 *  - round-trip serialize∘parse stable.
 */
import { describe, it, expect } from 'vitest'
import {
  AcademyParamsSchema,
  parseAcademyParams,
  serializeAcademyParams,
} from './searchParams'

describe('searchParams Académie: défaut', () => {
  it('parseAcademyParams({}) → aucun filtre', () => {
    const p = parseAcademyParams({})
    expect(p.theme).toEqual([])
    expect(p.niveau).toEqual([])
    expect(p.plateforme).toEqual([])
  })
})

describe('searchParams Académie: rejet hors-enum (T-09-01)', () => {
  it('theme hors enum → absent du résultat (jamais propagé)', () => {
    expect(parseAcademyParams({ theme: '__invalid__' }).theme).toEqual([])
  })

  it('niveau = injection → ignoré, ne throw pas', () => {
    expect(() => parseAcademyParams({ niveau: 'DROP TABLE' })).not.toThrow()
    expect(parseAcademyParams({ niveau: 'DROP TABLE' }).niveau).toEqual([])
  })

  it('plateforme hors enum → ignoré', () => {
    expect(parseAcademyParams({ plateforme: 'ctrader' }).plateforme).toEqual([])
  })
})

describe('searchParams Académie: multi-select par axe (D-05)', () => {
  it('theme=a&theme=b collecté en string[] filtré sur enum', () => {
    const p = parseAcademyParams({ theme: ['gestion-risque', 'bases-trading'] })
    expect(p.theme).toEqual(['gestion-risque', 'bases-trading'])
  })

  it('tableau mêlant valides + invalide : retire l’invalide', () => {
    const p = parseAcademyParams({ theme: ['gestion-risque', '__nope__', 'analyse-technique'] })
    expect(p.theme).toEqual(['gestion-risque', 'analyse-technique'])
  })

  it('niveau multi-valeur', () => {
    expect(parseAcademyParams({ niveau: ['debutant', 'intermediaire'] }).niveau).toEqual([
      'debutant',
      'intermediaire',
    ])
  })
})

describe('searchParams Académie: round-trip', () => {
  it('serialize∘parse stable', () => {
    const source = parseAcademyParams({
      theme: ['gestion-risque', 'analyse-technique'],
      niveau: ['debutant'],
      plateforme: ['mt5'],
    })
    const qs = serializeAcademyParams(source)
    const back = parseAcademyParams(parseQueryToRaw(qs))
    expect(back.theme).toEqual(['gestion-risque', 'analyse-technique'])
    expect(back.niveau).toEqual(['debutant'])
    expect(back.plateforme).toEqual(['mt5'])
  })

  it('serialize d’un état vide → chaîne vide', () => {
    expect(serializeAcademyParams(parseAcademyParams({})).toString()).toBe('')
  })
})

describe('AcademyParamsSchema exposé', () => {
  it('parse un objet valide', () => {
    const r = AcademyParamsSchema.safeParse({
      theme: ['gestion-risque'],
      niveau: ['debutant'],
      plateforme: ['mt5'],
    })
    expect(r.success).toBe(true)
  })
})

/** Reconstruit un RawParams (multi-valeur en string[]) depuis URLSearchParams. */
function parseQueryToRaw(qs: URLSearchParams): Record<string, string | string[] | undefined> {
  const raw: Record<string, string | string[] | undefined> = {}
  for (const key of new Set(qs.keys())) {
    const all = qs.getAll(key)
    raw[key] = all.length > 1 ? all : all[0]
  }
  return raw
}
