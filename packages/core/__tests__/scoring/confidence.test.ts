/**
 * Golden values — deriveConfidence (D-48).
 *
 * Mapping reproductible : opportunity_score (déjà calculé) + nombre de
 * confluences alignées + flag news_risk (dégrade d'un cran). Sortie enum stable
 * low | moderate | high. Fonction pure.
 */
import { describe, it, expect } from 'vitest'
import { deriveConfidence } from '../../src/scoring/confidence.js'

describe('deriveConfidence — 3 enums golden (D-48)', () => {
  it('HIGH : score haut + confluences alignées + pas de news_risk', () => {
    expect(
      deriveConfidence({ opportunity_score: 80, alignedConfluences: 5, news_risk: false }),
    ).toBe('high')
  })

  it('MODERATE : score moyen, confluences partielles, pas de news_risk', () => {
    expect(
      deriveConfidence({ opportunity_score: 55, alignedConfluences: 3, news_risk: false }),
    ).toBe('moderate')
  })

  it('LOW : score bas', () => {
    expect(
      deriveConfidence({ opportunity_score: 30, alignedConfluences: 2, news_risk: false }),
    ).toBe('low')
  })

  it('news_risk dégrade d’un cran : high → moderate', () => {
    const without = deriveConfidence({
      opportunity_score: 80,
      alignedConfluences: 5,
      news_risk: false,
    })
    const withNews = deriveConfidence({
      opportunity_score: 80,
      alignedConfluences: 5,
      news_risk: true,
    })
    expect(without).toBe('high')
    expect(withNews).toBe('moderate')
  })

  it('news_risk dégrade : moderate → low', () => {
    expect(
      deriveConfidence({ opportunity_score: 55, alignedConfluences: 3, news_risk: true }),
    ).toBe('low')
  })

  it('low ne descend pas plus bas avec news_risk', () => {
    expect(
      deriveConfidence({ opportunity_score: 20, alignedConfluences: 0, news_risk: true }),
    ).toBe('low')
  })

  it('score haut MAIS peu de confluences alignées → pas high (moderate)', () => {
    expect(
      deriveConfidence({ opportunity_score: 78, alignedConfluences: 2, news_risk: false }),
    ).toBe('moderate')
  })

  it('pur : deux appels identiques', () => {
    const args = { opportunity_score: 70, alignedConfluences: 4, news_risk: false }
    expect(deriveConfidence(args)).toBe(deriveConfidence(args))
  })
})
