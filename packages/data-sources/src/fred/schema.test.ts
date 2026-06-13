/**
 * Golden values — parseFredObservations
 *
 * Test hors-ligne : charge la fixture JSON et vérifie la normalisation.
 * Point clé : prouver l'exclusion des observations FRED manquantes (value === '.').
 * Aucun appel réseau. Déterministe.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { parseFredObservations } from './client.js'

const require = createRequire(import.meta.url)
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const rawFixture = require('../__fixtures__/fred-observations.json') as unknown

const SERIES_CODE = 'DFF'

describe('parseFredObservations — golden values', () => {
  it('retourne 5 MacroSeriesInsert (6 obs fixture dont 1 valeur "." exclue)', () => {
    const result = parseFredObservations(rawFixture, SERIES_CODE)
    // La fixture a 6 observations dont 1 avec value === '.' (2024-08-01) => exclusion
    expect(result).toHaveLength(5)
  })

  it('exclut les observations value === "." (FRED manquant)', () => {
    const result = parseFredObservations(rawFixture, SERIES_CODE)
    // Aucun résultat ne doit avoir value NaN ou la date 2024-08-01
    for (const item of result) {
      expect(isNaN(item.value)).toBe(false)
    }
    const aug = result.find((r) => r.ts.startsWith('2024-08-01'))
    expect(aug).toBeUndefined()
  })

  it('series_code injecté correctement', () => {
    const result = parseFredObservations(rawFixture, SERIES_CODE)
    for (const item of result) {
      expect(item.series_code).toBe(SERIES_CODE)
    }
  })

  it('ts est ISO UTC (date FRED en heure UTC minuit)', () => {
    const result = parseFredObservations(rawFixture, SERIES_CODE)
    expect(result[0]?.ts).toBe('2024-06-01T00:00:00.000Z')
  })

  it('value est numérique correct (5.33 pour 2024-06-01)', () => {
    const result = parseFredObservations(rawFixture, SERIES_CODE)
    expect(result[0]?.value).toBeCloseTo(5.33, 2)
  })

  it('valeurs dans l\'ordre chronologique croissant', () => {
    const result = parseFredObservations(rawFixture, SERIES_CODE)
    for (let i = 1; i < result.length; i++) {
      expect(result[i]!.ts >= result[i - 1]!.ts).toBe(true)
    }
  })

  it('retourne un tableau vide si observations vides', () => {
    const empty = { ...rawFixture, observations: [] } as unknown
    const result = parseFredObservations(empty, SERIES_CODE)
    expect(result).toHaveLength(0)
  })
})
