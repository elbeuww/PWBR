/**
 * Golden values — scoreSetup (D-42, SCORE-02/03).
 *
 * Couvre : barème §3 décomposable (breakdown somme au score), CAP 45 condition
 * EXACTE (catalyseur fort lève le cap), pénalité news -15, bornes inputs (clamp
 * RSI / throw invalid_atr, concern #4), ordre figé score→confidence→risk,
 * reproductibilité. Patron golden snapshots.test.ts.
 */
import { describe, it, expect } from 'vitest'
import { scoreSetup } from '../../src/scoring/score.js'
import {
  bullishSnapshot,
  htfContradictsSnapshot,
  longOutput,
  type CombinedSnapshot,
} from './__fixtures__/setups.js'
import type { Output } from '../../src/schemas/output.js'

// Output sans catalyseur fort (news_catalysts vide) — pour tester le cap.
const noCatalystOutput: Output = { ...longOutput, news_catalysts: [] }

describe('scoreSetup — barème §3 décomposable (SCORE-02)', () => {
  it('confluence forte day → score figé (98) + breakdown sommant au score', () => {
    const res = scoreSetup(bullishSnapshot, longOutput, 'day')
    expect(res.opportunity_score).toBe(98)
    const b = res.breakdown
    const sum =
      b.trendAlign + b.keyLevel + b.momentum + b.fundamental + b.news + b.rr + b.penalties
    expect(Math.round(Math.min(100, Math.max(0, sum)))).toBe(res.opportunity_score)
    expect(b.capApplied).toBe(false)
  })

  it('breakdown décompose chaque bloc §3 (valeurs figées)', () => {
    const b = scoreSetup(bullishSnapshot, longOutput, 'day').breakdown
    expect(b).toMatchObject({
      trendAlign: 25,
      keyLevel: 18,
      momentum: 15,
      fundamental: 15,
      news: 10,
      rr: 15,
      penalties: 0,
    })
  })
})

describe('scoreSetup — CAP 45 condition exacte (D-42, §3 règle dure)', () => {
  it('HTF contredit + AUCUN catalyseur fort → score plafonné à 45', () => {
    const res = scoreSetup(htfContradictsSnapshot, noCatalystOutput, 'day')
    expect(res.opportunity_score).toBe(45)
    expect(res.breakdown.capApplied).toBe(true)
  })

  it('HTF contredit MAIS catalyseur fort (high + même direction) présent → PAS de cap', () => {
    // longOutput contient news_catalysts impact=high direction=bullish == long.
    const res = scoreSetup(htfContradictsSnapshot, longOutput, 'day')
    expect(res.opportunity_score).toBeGreaterThan(45)
    expect(res.breakdown.capApplied).toBe(false)
  })
})

describe('scoreSetup — pénalités §3', () => {
  it('news high-impact imminente (news_risk) → -15 appliqué (breakdown.penalties)', () => {
    const snap: CombinedSnapshot = {
      ...bullishSnapshot,
      news: { ...bullishSnapshot.news, news_risk: true },
    }
    const res = scoreSetup(snap, longOutput, 'day')
    expect(res.breakdown.penalties).toBe(-15)
    const baseline = scoreSetup(bullishSnapshot, longOutput, 'day').opportunity_score
    expect(res.opportunity_score).toBe(baseline - 15)
  })
})

describe('scoreSetup — bornes inputs (concern #4, T-04-14)', () => {
  it('RSI=150 (hors borne) → clampé, score reste dans [0,100]', () => {
    const snap: CombinedSnapshot = {
      ...bullishSnapshot,
      technical: {
        ...bullishSnapshot.technical,
        momentum: { ...bullishSnapshot.technical.momentum, rsi: 150 },
      },
    }
    const res = scoreSetup(snap, longOutput, 'day')
    expect(res.opportunity_score).toBeGreaterThanOrEqual(0)
    expect(res.opportunity_score).toBeLessThanOrEqual(100)
  })

  it('RSI=-10 (hors borne) → clampé (momentum long ne crédite plus rsi)', () => {
    const snap: CombinedSnapshot = {
      ...bullishSnapshot,
      technical: {
        ...bullishSnapshot.technical,
        momentum: { rsi: -10, macd_hist: -1, slope: -1 },
      },
    }
    const res = scoreSetup(snap, longOutput, 'day')
    // rsi clampé à 0 (<50), macd/slope négatifs → momentum 0 pour un long
    expect(res.breakdown.momentum).toBe(0)
    expect(res.opportunity_score).toBeLessThanOrEqual(100)
  })

  it('ATR<0 → throw invalid_atr', () => {
    const snap: CombinedSnapshot = {
      ...bullishSnapshot,
      technical: {
        ...bullishSnapshot.technical,
        volatility: { atr: -5, atr_percentile: 40 },
      },
    }
    expect(() => scoreSetup(snap, longOutput, 'day')).toThrow('invalid_atr')
  })
})

describe('scoreSetup — invariants', () => {
  it('score entier borné [0,100] et reproductible (2 appels identiques)', () => {
    const a = scoreSetup(bullishSnapshot, longOutput, 'day')
    const b = scoreSetup(bullishSnapshot, longOutput, 'day')
    expect(a).toEqual(b)
    expect(Number.isInteger(a.opportunity_score)).toBe(true)
    expect(a.opportunity_score).toBeGreaterThanOrEqual(0)
    expect(a.opportunity_score).toBeLessThanOrEqual(100)
  })

  it('ordre figé : confidence dérive du score déjà calculé (cap → confidence basse)', () => {
    // Quand le cap rabaisse le score à 45, la confidence DOIT refléter ce score
    // bas (≤ moderate), pas le raw pré-cap. Preuve de l'ordre score→confidence.
    const capped = scoreSetup(htfContradictsSnapshot, noCatalystOutput, 'day')
    expect(capped.opportunity_score).toBe(45)
    expect(['low', 'moderate']).toContain(capped.confidence)
  })

  it('style swing applique le barème swing (poids différents)', () => {
    const res = scoreSetup(bullishSnapshot, longOutput, 'swing')
    // swing rr cible = 2.0 ; rr.global longOutput = 1.566 < 2.0 mais ≥1.2 → moitié (5)
    expect(res.breakdown.rr).toBe(5)
    expect(res.breakdown.trendAlign).toBe(30)
  })
})
