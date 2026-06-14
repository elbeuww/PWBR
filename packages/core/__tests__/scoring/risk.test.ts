/**
 * Golden values — deriveRiskLevel (D-46, facteurs §3 lignes 120-121).
 *
 * Facteurs : distance SL en ATR (trop serrée = risqué), atr_percentile élevé
 * (vol extrême), news_risk, contre-tendance HTF. Règles nommées (data-not-magic).
 * 4 fixtures figées → low / medium / high / extreme. Fonction pure.
 */
import { describe, it, expect } from 'vitest'
import { deriveRiskLevel } from '../../src/scoring/risk.js'
import { bullishSnapshot, longOutput, type CombinedSnapshot } from './__fixtures__/setups.js'

// Base bullish/long ; on dérive chaque niveau en modulant les facteurs.

describe('deriveRiskLevel — 4 enums golden (D-46)', () => {
  it('LOW : SL large (≥2 ATR), vol modérée, pas de news, HTF aligné', () => {
    // entryCons long = 2320, SL 2305 → dist 15 ; atr 12 → 1.25 ATR (un peu serré)
    // on élargit SL pour un cas franchement LOW : dist 30 → 2.5 ATR
    const snap: CombinedSnapshot = {
      ...bullishSnapshot,
      technical: { ...bullishSnapshot.technical, volatility: { atr: 12, atr_percentile: 30 } },
    }
    const out = { ...longOutput, stop_loss: 2290.0 } // dist = 2320-2290 = 30 → 2.5 ATR
    expect(deriveRiskLevel({ snapshot: snap, output: out, rr: 1.6 })).toBe('low')
  })

  it('MEDIUM : SL un peu serré (1-1.5 ATR), reste aligné, pas de news', () => {
    const snap: CombinedSnapshot = {
      ...bullishSnapshot,
      technical: { ...bullishSnapshot.technical, volatility: { atr: 12, atr_percentile: 30 } },
    }
    const out = { ...longOutput, stop_loss: 2305.0 } // dist 15 → 1.25 ATR
    expect(deriveRiskLevel({ snapshot: snap, output: out, rr: 1.6 })).toBe('medium')
  })

  it('HIGH : SL très serré (<1 ATR) + vol élevée', () => {
    const snap: CombinedSnapshot = {
      ...bullishSnapshot,
      technical: { ...bullishSnapshot.technical, volatility: { atr: 12, atr_percentile: 85 } },
    }
    const out = { ...longOutput, stop_loss: 2312.0 } // dist 8 → 0.66 ATR (serré)
    expect(deriveRiskLevel({ snapshot: snap, output: out, rr: 1.4 })).toBe('high')
  })

  it('EXTREME : SL serré + vol extrême + news_risk + contre-HTF', () => {
    const snap: CombinedSnapshot = {
      ...bullishSnapshot,
      technical: {
        ...bullishSnapshot.technical,
        trend_htf: 'bearish', // contredit le long
        volatility: { atr: 12, atr_percentile: 90 },
      },
      news: { ...bullishSnapshot.news, news_risk: true },
    }
    const out = { ...longOutput, stop_loss: 2314.0 } // dist 6 → 0.5 ATR
    expect(deriveRiskLevel({ snapshot: snap, output: out, rr: 1.3 })).toBe('extreme')
  })

  it('SL distance < seuil ATR → au moins high', () => {
    const snap: CombinedSnapshot = {
      ...bullishSnapshot,
      technical: { ...bullishSnapshot.technical, volatility: { atr: 12, atr_percentile: 50 } },
    }
    const out = { ...longOutput, stop_loss: 2313.0 } // dist 7 → 0.58 ATR
    const level = deriveRiskLevel({ snapshot: snap, output: out, rr: 1.5 })
    expect(['high', 'extreme']).toContain(level)
  })

  it('news_risk relève le risque (medium → high toutes choses égales)', () => {
    const base: CombinedSnapshot = {
      ...bullishSnapshot,
      technical: { ...bullishSnapshot.technical, volatility: { atr: 12, atr_percentile: 30 } },
    }
    const out = { ...longOutput, stop_loss: 2305.0 } // medium
    const without = deriveRiskLevel({ snapshot: base, output: out, rr: 1.6 })
    const withNews = deriveRiskLevel({
      snapshot: { ...base, news: { ...base.news, news_risk: true } },
      output: out,
      rr: 1.6,
    })
    const order = ['low', 'medium', 'high', 'extreme']
    expect(order.indexOf(withNews)).toBeGreaterThan(order.indexOf(without))
  })

  it('pur : deux appels identiques', () => {
    const a = deriveRiskLevel({ snapshot: bullishSnapshot, output: longOutput, rr: 1.5 })
    const b = deriveRiskLevel({ snapshot: bullishSnapshot, output: longOutput, rr: 1.5 })
    expect(a).toBe(b)
  })
})
