/**
 * Tests du seuil d'affichage track record en @app/core (TRACK-03, D-09/D-12).
 *
 * Source unique partagée vitrine P5 ↔ Telegram P6 (D-11). Cas golden IDENTIQUES
 * à ceux de la vitrine (apps/web) : N≥30 → % affichable ; N<30 → insuffisant
 * (aucun %) ; N=0 → état honnête sans erreur ; N TOUJOURS présent ; pas de NaN.
 */
import { describe, expect, it } from 'vitest'
import { applyThreshold, MIN_SAMPLE } from './threshold.js'

describe('applyThreshold — seuil N≥30 (D-09/D-12)', () => {
  it('N=30 (seuil exact) → sufficient avec winRatePct entier', () => {
    const result = applyThreshold({ n: 30, win_rate: 0.64, expectancy: 0.42, avg_r: 1.8 })
    expect(result.sufficient).toBe(true)
    if (result.sufficient) {
      expect(result.n).toBe(30)
      expect(result.winRatePct).toBe(64)
      expect(Number.isInteger(result.winRatePct)).toBe(true)
    }
  })

  it('N=58 → winRatePct 58 (cas plan)', () => {
    const result = applyThreshold({ n: 30, win_rate: 0.58, expectancy: 0.3, avg_r: 1.5 })
    expect(result.sufficient).toBe(true)
    if (result.sufficient) {
      expect(result.winRatePct).toBe(58)
      expect(result.n).toBe(30)
    }
  })

  it('N=29 (sous le seuil) → insufficient, AUCUN %, N=29 présent', () => {
    const result = applyThreshold({ n: 29, win_rate: 0.7, expectancy: 0.5 })
    expect(result.sufficient).toBe(false)
    expect(result.n).toBe(29)
    expect('winRatePct' in result).toBe(false)
  })

  it('N=12 → insufficient, N=12 (cas plan)', () => {
    const result = applyThreshold({ n: 12, win_rate: null, expectancy: null })
    expect(result.sufficient).toBe(false)
    expect(result.n).toBe(12)
  })

  it('N=0 → insufficient, pas d’erreur, N=0 (jamais NaN)', () => {
    const result = applyThreshold({ n: 0, win_rate: null, expectancy: null })
    expect(result.sufficient).toBe(false)
    expect(result.n).toBe(0)
  })

  it('N est TOUJOURS présent, suffisant ou non (D-12)', () => {
    const high = applyThreshold({ n: 100, win_rate: 0.55, expectancy: 0.3 })
    const low = applyThreshold({ n: 5, win_rate: 0.9, expectancy: 1 })
    expect(high.n).toBe(100)
    expect(low.n).toBe(5)
  })

  it('win_rate null avec N suffisant → winRatePct 0 (pas de NaN)', () => {
    const result = applyThreshold({ n: 50, win_rate: null, expectancy: 0 })
    expect(result.sufficient).toBe(true)
    if (result.sufficient) {
      expect(result.winRatePct).toBe(0)
    }
  })

  it('MIN_SAMPLE est exactement 30', () => {
    expect(MIN_SAMPLE).toBe(30)
  })
})
