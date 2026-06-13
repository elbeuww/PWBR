/**
 * Golden values — schéma §3 LOCKED + hash de contenu déterministe.
 *
 * - Zod : un payload conforme §3 passe ; un enum hors §3 est rejeté.
 * - Hash : même payload → même hash sur deux appels ; clés réordonnées →
 *   même hash (canonicalisation) ; précision décimale fixe (anti float noise).
 * Déterministe, offline (D-41, RESEARCH Pitfall 3).
 */
import { describe, it, expect } from 'vitest'
import {
  TechnicalSnapshotSchema,
  FundamentalContextSchema,
  NewsContextSchema,
} from './schema.js'
import { snapshotContentHash } from './hash.js'

const validTechnical = {
  trend_htf: 'bullish',
  trend_ltf: 'range',
  momentum: { rsi: 54.71, macd_hist: 42.29, slope: 0.12 },
  volatility: { atr: 428.36, atr_percentile: 0.6 },
  key_levels: [
    { price: 47000, type: 'resistance', strength: 0.8 },
    { price: 45000, type: 'poc', strength: 0.5, volume_source: 'real' },
  ],
  structure: { last_swing_high: 47500, last_swing_low: 44000, bos_choch: 'bos' },
  volume_state: 'expanding',
}

describe('TechnicalSnapshotSchema — §3 LOCKED', () => {
  it('parse un payload conforme', () => {
    expect(() => TechnicalSnapshotSchema.parse(validTechnical)).not.toThrow()
  })
  it('rejette un enum trend hors §3', () => {
    const bad = { ...validTechnical, trend_htf: 'sideways' }
    expect(() => TechnicalSnapshotSchema.parse(bad)).toThrow()
  })
  it('rejette un volume_source hors {real,proxy}', () => {
    const bad = {
      ...validTechnical,
      key_levels: [{ price: 1, type: 'poc', strength: 0.5, volume_source: 'fake' }],
    }
    expect(() => TechnicalSnapshotSchema.parse(bad)).toThrow()
  })
  it('bos_choch peut être null', () => {
    const ok = { ...validTechnical, structure: { ...validTechnical.structure, bos_choch: null } }
    expect(() => TechnicalSnapshotSchema.parse(ok)).not.toThrow()
  })
})

describe('FundamentalContextSchema — §3 LOCKED', () => {
  it('parse un contexte fondamental conforme', () => {
    const fund = {
      macro_bias: 'risk_on',
      rate_environment: 'hawkish',
      dxy_trend: 'bullish',
      real_yields: 'rising',
      asset_specific_drivers: ['DXY', 'REAL_YIELDS'],
    }
    expect(() => FundamentalContextSchema.parse(fund)).not.toThrow()
  })
  it('rejette un macro_bias hors §3', () => {
    expect(() =>
      FundamentalContextSchema.parse({
        macro_bias: 'bullish',
        rate_environment: 'neutral',
        dxy_trend: 'flat',
        real_yields: 'flat',
        asset_specific_drivers: [],
      }),
    ).toThrow()
  })
})

describe('NewsContextSchema — §3 LOCKED', () => {
  it('parse un contexte news conforme (sentiment -1..+1, news_risk)', () => {
    const news = {
      net_sentiment: 0.3,
      recent_catalysts: ['FOMC'],
      upcoming_events: ['CPI'],
      news_risk: true,
    }
    expect(() => NewsContextSchema.parse(news)).not.toThrow()
  })
  it('rejette un net_sentiment hors [-1,+1]', () => {
    expect(() =>
      NewsContextSchema.parse({
        net_sentiment: 2,
        recent_catalysts: [],
        upcoming_events: [],
        news_risk: false,
      }),
    ).toThrow()
  })
})

describe('snapshotContentHash — déterministe (D-41)', () => {
  it('même payload → même hash sur deux appels', () => {
    expect(snapshotContentHash(validTechnical)).toBe(snapshotContentHash(validTechnical))
  })
  it('hash insensible à l’ordre des clés (canonicalisation)', () => {
    const reordered = {
      volume_state: 'expanding',
      structure: { bos_choch: 'bos', last_swing_low: 44000, last_swing_high: 47500 },
      key_levels: validTechnical.key_levels,
      volatility: { atr_percentile: 0.6, atr: 428.36 },
      momentum: { slope: 0.12, macd_hist: 42.29, rsi: 54.71 },
      trend_ltf: 'range',
      trend_htf: 'bullish',
    }
    expect(snapshotContentHash(reordered)).toBe(snapshotContentHash(validTechnical))
  })
  it('renvoie un sha256 hex (64 caractères)', () => {
    expect(snapshotContentHash(validTechnical)).toMatch(/^[0-9a-f]{64}$/)
  })
  it('précision décimale fixe : bruit float sous le seuil → même hash', () => {
    const noisy = {
      ...validTechnical,
      momentum: { ...validTechnical.momentum, rsi: 54.71 + 1e-9 },
    }
    expect(snapshotContentHash(noisy)).toBe(snapshotContentHash(validTechnical))
  })
  it('un changement réel de valeur → hash différent', () => {
    const changed = { ...validTechnical, volume_state: 'contracting' }
    expect(snapshotContentHash(changed)).not.toBe(snapshotContentHash(validTechnical))
  })
})
