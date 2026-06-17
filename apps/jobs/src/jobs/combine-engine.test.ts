/**
 * Tests golden — combine-engine logique PURE (TROU #2).
 *
 * Couvre :
 *  1. buildCombinedPayload renvoie EXACTEMENT les 3 clés {technical, fundamental, news}
 *     (forme CombinedSnapshot §3, sous-objets accessibles).
 *  2. snapshotContentHash(combined) est INVARIANT à l'ordre d'insertion des kinds
 *     (preuve de la canonicalisation par clés triées, D-44).
 *  3. pickTriplet skippe un triplet incomplet (kind null → {ok:false, missing}),
 *     complet → {ok:true}. Décision de cohérence temporelle séparée de l'IO (D-23).
 */
import { describe, it, expect } from 'vitest'
import { snapshotContentHash } from '@app/indicators'
import { buildCombinedPayload, pickTriplet } from './combine-engine'
import type { CombinedSnapshot } from '@app/core'

// ─── Fixtures minimales conformes aux interfaces §3 (snapshot-input.ts) ─────────

const technical: CombinedSnapshot['technical'] = {
  trend_htf: 'bullish',
  trend_ltf: 'range',
  momentum: { rsi: 55.5, macd_hist: 0.001234, slope: -0.0005 },
  volatility: { atr: 1.23, atr_percentile: 0.42 },
  key_levels: [{ price: 100.5, type: 'support', strength: 2 }],
  structure: { last_swing_high: 110.25, last_swing_low: 95.5, bos_choch: 'bos' },
  volume_state: 'expanding',
}

const fundamental: CombinedSnapshot['fundamental'] = {
  macro_bias: 'risk_on',
  rate_environment: 'hawkish',
  dxy_trend: 'down',
  real_yields: 'rising',
  asset_specific_drivers: ['oil_supply'],
}

const news: CombinedSnapshot['news'] = {
  net_sentiment: 0.3,
  recent_catalysts: ['cpi_release'],
  upcoming_events: ['fomc'],
  news_risk: true,
}

describe('buildCombinedPayload', () => {
  it('assemble exactement les 3 clés CombinedSnapshot avec sous-objets accessibles', () => {
    const combined = buildCombinedPayload(technical, fundamental, news)

    expect(Object.keys(combined).sort()).toEqual(['fundamental', 'news', 'technical'])
    expect(combined.technical.structure.bos_choch).toBe('bos')
    expect(combined.fundamental.macro_bias).toBe('risk_on')
    expect(combined.news.net_sentiment).toBe(0.3)
  })

  it('produit un hash DÉTERMINISTE invariant à l ordre d insertion des kinds', () => {
    const hashTfn = snapshotContentHash(buildCombinedPayload(technical, fundamental, news))

    // Même 3 payloads, ordre top-level inversé → la canonicalisation trie les clés.
    const reordered = { news, fundamental, technical } as CombinedSnapshot
    const hashNft = snapshotContentHash(reordered)

    expect(hashTfn).toBe(hashNft)
    expect(hashTfn).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('pickTriplet', () => {
  it('triplet complet → {ok:true}', () => {
    const res = pickTriplet({ technical: 'T', fundamental: 'F', news: 'N' })
    expect(res.ok).toBe(true)
  })

  it('un kind null → {ok:false, missing:[kind]}', () => {
    const res = pickTriplet({ technical: 'T', fundamental: null, news: 'N' })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.missing).toEqual(['fundamental'])
  })

  it('plusieurs kinds null → missing liste tous les absents dans l ordre', () => {
    const res = pickTriplet({ technical: null, fundamental: null, news: 'N' })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.missing).toEqual(['technical', 'fundamental'])
  })
})
