/**
 * Golden values — computeRiskReward (D-50, bord conservateur).
 *
 * Pitfall 1 (04-RESEARCH) : le R:R doit être recalculé sur le PIRE prix d'entrée
 * de la zone (long → zone.max, short → zone.min), jamais sur entry.price ni le
 * bord favorable. Sinon le R:R est surestimé (T-04-05). Valeurs figées (golden),
 * arrondi 6 décimales (patron hash.ts HASH_DECIMALS).
 */
import { describe, it, expect } from 'vitest'
import { computeRiskReward } from '../../src/scoring/rr.js'
import { longOutput, shortOutput } from './__fixtures__/setups.js'

describe('computeRiskReward — bord conservateur (D-50)', () => {
  it('LONG : entrée conservatrice = zone.max (2320), valeurs figées', () => {
    const res = computeRiskReward(longOutput)
    // risk = 2320 - 2305 = 15 ; TP1 (2335) → 1.0 ; TP2 (2352) → 32/15
    expect(res.perTp.map((t) => t.rr)).toEqual([1.0, 2.133333])
    expect(res.global).toBe(1.566667)
  })

  it('SHORT : entrée conservatrice = zone.min (2316), valeurs figées', () => {
    const res = computeRiskReward(shortOutput)
    // risk = |2316 - 2335| = 19 ; TP1 (2301) → 15/19 ; TP2 (2284) → 32/19
    expect(res.perTp.map((t) => t.rr)).toEqual([0.789474, 1.684211])
    expect(res.global).toBe(1.236842)
  })

  it('LONG : le bord conservateur (zone.max) donne un R:R ≤ celui du bord favorable (zone.min)', () => {
    // Preuve anti-surestimation (Pitfall 1) : si on utilisait zone.min (2316),
    // le risk serait 11 → rr TP1 = 19/11 ≈ 1.727 > 1.0. Le code DOIT prendre le pire.
    const res = computeRiskReward(longOutput)
    const favorableRisk = Math.abs(2316 - 2305) // bord favorable
    const favorableRrTp1 = (2335 - 2316) / favorableRisk
    expect(res.perTp[0]!.rr).toBeLessThan(favorableRrTp1)
  })

  it('global = somme pondérée par alloc_pct des rr par TP', () => {
    const res = computeRiskReward(longOutput)
    const manual =
      res.perTp.reduce((s, t) => s + t.rr * (t.alloc_pct / 100), 0)
    expect(res.global).toBe(Math.round(manual * 1e6) / 1e6)
  })

  it('distance SL nulle (entrée conservatrice == stop_loss) → throw zero_sl_distance', () => {
    const degenerate = { ...longOutput, stop_loss: 2320.0 } // == zone.max
    expect(() => computeRiskReward(degenerate)).toThrow('zero_sl_distance')
  })

  it('pur : deux appels donnent un résultat identique', () => {
    expect(computeRiskReward(longOutput)).toEqual(computeRiskReward(longOutput))
  })
})
