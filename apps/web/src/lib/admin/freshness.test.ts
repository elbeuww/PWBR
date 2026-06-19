/**
 * Tests des feux de fraîcheur (ADMIN-04, D-06).
 *
 * Seuils approuvés par le fondateur (RESEARCH Q1) :
 *   candles : rouge SSI is_stale ; ambre SSI !is_stale && age > 1.5× seuil ; vert sinon.
 *   news    : ambre > 6h / rouge > 24h.
 *   macro   : ambre > 36h / rouge > 72h.
 * Couverture des bornes exactes et juste-au-dessus.
 */
import { describe, expect, it } from 'vitest'
import {
  ageColor,
  candleColor,
  MACRO_THRESHOLDS,
  NEWS_THRESHOLDS,
} from './freshness.js'

describe('candleColor — feu candles (is_stale + bande ambre 1.5×)', () => {
  const threshold = 4 // 4h (ex. H4)

  it('rouge SSI is_stale (peu importe age)', () => {
    expect(candleColor(true, 0, threshold)).toBe('red')
    expect(candleColor(true, 100, threshold)).toBe('red')
  })

  it('vert si frais et sous la bande ambre', () => {
    expect(candleColor(false, 3, threshold)).toBe('green')
  })

  it('borne exacte 1.5× seuil → vert (strictement >)', () => {
    expect(candleColor(false, 6, threshold)).toBe('green') // 1.5 * 4 = 6
  })

  it('juste au-dessus de 1.5× seuil → ambre', () => {
    expect(candleColor(false, 6.01, threshold)).toBe('amber')
  })
})

describe('ageColor — feu age générique news/macro', () => {
  it('rouge si age > redHours', () => {
    expect(ageColor(25, 6, 24)).toBe('red')
  })

  it('ambre si amberHours < age <= redHours', () => {
    expect(ageColor(10, 6, 24)).toBe('amber')
  })

  it('vert si age <= amberHours', () => {
    expect(ageColor(3, 6, 24)).toBe('green')
  })

  it('borne exacte amber (age == amberHours) → vert (strictement >)', () => {
    expect(ageColor(6, 6, 24)).toBe('green')
  })

  it('juste au-dessus amber → ambre', () => {
    expect(ageColor(6.01, 6, 24)).toBe('amber')
  })

  it('borne exacte red (age == redHours) → ambre (strictement >)', () => {
    expect(ageColor(24, 6, 24)).toBe('amber')
  })

  it('juste au-dessus red → rouge', () => {
    expect(ageColor(24.01, 6, 24)).toBe('red')
  })
})

describe('seuils approuvés (RESEARCH Q1)', () => {
  it('NEWS_THRESHOLDS = ambre 6h / rouge 24h', () => {
    expect(NEWS_THRESHOLDS).toEqual({ amberHours: 6, redHours: 24 })
  })

  it('MACRO_THRESHOLDS = ambre 36h / rouge 72h', () => {
    expect(MACRO_THRESHOLDS).toEqual({ amberHours: 36, redHours: 72 })
  })

  it('news avec seuils réels : 5h vert, 7h ambre, 25h rouge', () => {
    expect(ageColor(5, NEWS_THRESHOLDS.amberHours, NEWS_THRESHOLDS.redHours)).toBe('green')
    expect(ageColor(7, NEWS_THRESHOLDS.amberHours, NEWS_THRESHOLDS.redHours)).toBe('amber')
    expect(ageColor(25, NEWS_THRESHOLDS.amberHours, NEWS_THRESHOLDS.redHours)).toBe('red')
  })

  it('macro avec seuils réels : 30h vert, 40h ambre, 80h rouge', () => {
    expect(ageColor(30, MACRO_THRESHOLDS.amberHours, MACRO_THRESHOLDS.redHours)).toBe('green')
    expect(ageColor(40, MACRO_THRESHOLDS.amberHours, MACRO_THRESHOLDS.redHours)).toBe('amber')
    expect(ageColor(80, MACRO_THRESHOLDS.amberHours, MACRO_THRESHOLDS.redHours)).toBe('red')
  })
})
