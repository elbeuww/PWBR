/**
 * Golden tests — buildTechnicalSnapshot (forme §3 + hash déterministe + gap EMA200).
 *
 * Tests purs, hors-ligne, déterministes (aucun réseau, aucune écriture DB).
 *  1. forme §3 : le snapshot assemblé passe TechnicalSnapshotSchema.parse.
 *  2. hash : deux appels sur la MÊME fixture → snapshotContentHash identique (D-41).
 *  3. gap EMA200 : fixture < 200 bougies → partial:true + missing inclut 'ema200'
 *     (RESEARCH Pitfall 2 — jamais de zéro silencieux).
 *  4. volume_source : crypto (volume réel) → 'real' ; FX (volume null) → 'proxy' (D-35).
 *
 * Fixture : packages/indicators/src/__fixtures__/btcusdt-h4.json (220 bougies H4 réelles).
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { TechnicalSnapshotSchema, snapshotContentHash } from '@app/indicators'
import type { CandleRow } from '@app/supabase'
import { buildTechnicalSnapshot } from '../src/jobs/technical-engine'

const require = createRequire(import.meta.url)
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const fullFixture = require('../../../packages/indicators/src/__fixtures__/btcusdt-h4.json') as CandleRow[]

// Style 'day' : HTF=H4, LTF=H1. On réutilise la fixture H4 pour les deux TF
// (test pur d'assemblage — le mapping TF→DB est testé en intégration Task 2).
const candlesByTf = { htf: fullFixture, ltf: fullFixture }

// Fixture courte (< 200) pour le gap EMA200.
const shortFixture = fullFixture.slice(0, 60)
const shortByTf = { htf: shortFixture, ltf: shortFixture }

// Fixture FX : volume null → POC en 'proxy'.
const fxFixture: CandleRow[] = fullFixture.map((c) => ({ ...c, volume: null }))
const fxByTf = { htf: fxFixture, ltf: fxFixture }

describe('buildTechnicalSnapshot — forme §3 LOCKED', () => {
  it('produit un snapshot qui passe TechnicalSnapshotSchema.parse', () => {
    const { snapshot } = buildTechnicalSnapshot(candlesByTf, 'day', 'real')
    expect(() => TechnicalSnapshotSchema.parse(snapshot)).not.toThrow()
  })

  it('remplit trend_htf / trend_ltf / momentum / volatility / key_levels / structure / volume_state', () => {
    const { snapshot } = buildTechnicalSnapshot(candlesByTf, 'day', 'real')
    expect(['bullish', 'bearish', 'range']).toContain(snapshot.trend_htf)
    expect(['bullish', 'bearish', 'range']).toContain(snapshot.trend_ltf)
    expect(typeof snapshot.momentum.rsi).toBe('number')
    expect(typeof snapshot.momentum.macd_hist).toBe('number')
    expect(typeof snapshot.momentum.slope).toBe('number')
    expect(typeof snapshot.volatility.atr).toBe('number')
    expect(typeof snapshot.volatility.atr_percentile).toBe('number')
    expect(snapshot.key_levels.length).toBeGreaterThan(0)
    expect(typeof snapshot.structure.last_swing_high).toBe('number')
    expect(typeof snapshot.structure.last_swing_low).toBe('number')
    expect(['expanding', 'contracting']).toContain(snapshot.volume_state)
  })
})

describe('buildTechnicalSnapshot — hash déterministe (D-41)', () => {
  it('deux appels sur la même fixture → snapshotContentHash identique', () => {
    const a = buildTechnicalSnapshot(candlesByTf, 'day', 'real')
    const b = buildTechnicalSnapshot(candlesByTf, 'day', 'real')
    expect(snapshotContentHash(a.snapshot)).toBe(snapshotContentHash(b.snapshot))
  })
})

describe('buildTechnicalSnapshot — gap EMA200 (Pitfall 2)', () => {
  it('fixture < 200 bougies → partial:true et missing inclut ema200', () => {
    const { partial, missing } = buildTechnicalSnapshot(shortByTf, 'day', 'real')
    expect(partial).toBe(true)
    expect(missing).toContain('ema200')
  })

  it('fixture >= 200 bougies → partial:false', () => {
    const { partial } = buildTechnicalSnapshot(candlesByTf, 'day', 'real')
    expect(partial).toBe(false)
  })
})

describe('buildTechnicalSnapshot — volume_source (D-35)', () => {
  it('crypto (volume réel) → poc volume_source = real', () => {
    const { snapshot } = buildTechnicalSnapshot(candlesByTf, 'day', 'real')
    const poc = snapshot.key_levels.find((l) => l.type === 'poc')
    expect(poc?.volume_source).toBe('real')
  })

  it('FX (volume null) → poc volume_source = proxy', () => {
    const { snapshot } = buildTechnicalSnapshot(fxByTf, 'day', 'proxy')
    const poc = snapshot.key_levels.find((l) => l.type === 'poc')
    expect(poc?.volume_source).toBe('proxy')
  })
})
