/**
 * Golden tests — deriveFundamentalContext (règles FRED déterministes + drivers table).
 *
 * Tests purs, hors-ligne, déterministes (aucun réseau, aucune écriture DB).
 *  1. forme §3 : le contexte assemblé passe FundamentalContextSchema.parse.
 *  2. règles macro_bias : DXY↗ + real_yields↗ → risk_off ; ↘ + ↘ → risk_on (D-38).
 *  3. règles rate_environment : DFF en hausse récente → hawkish ; en baisse → dovish.
 *  4. drivers data-not-code : asset_specific_drivers dérivés de getAssetDrivers (jamais codés).
 *  5. hash : deux appels sur les mêmes entrées → snapshotContentHash identique (D-41).
 *  6. robustesse : instrument sans drivers → contexte macro global, pas de crash.
 *
 * Fixtures inline (séries macro minimales), pas de réseau.
 */
import { describe, it, expect } from 'vitest'
import { FundamentalContextSchema, snapshotContentHash } from '@app/indicators'
import type { MacroSeriesRow, AssetDriverRow } from '@app/supabase'
import { deriveFundamentalContext } from '../src/jobs/fundamental-engine'

// ─── Helpers fixtures ─────────────────────────────────────────────────────────

let seq = 0
function obs(series_code: string, ts: string, value: number): MacroSeriesRow {
  return { id: `m-${seq++}`, series_code, ts, value }
}

function driver(driver_code: string, direction: number, weight = 1): AssetDriverRow {
  return { id: `d-${seq++}`, instrument_id: 'xau', driver_code, direction, weight }
}

/** Série montante : valeurs croissantes sur 3 observations. */
function rising(code: string): MacroSeriesRow[] {
  return [
    obs(code, '2026-06-01T00:00:00.000Z', 100),
    obs(code, '2026-06-02T00:00:00.000Z', 102),
    obs(code, '2026-06-03T00:00:00.000Z', 105),
  ]
}

/** Série descendante : valeurs décroissantes sur 3 observations. */
function falling(code: string): MacroSeriesRow[] {
  return [
    obs(code, '2026-06-01T00:00:00.000Z', 105),
    obs(code, '2026-06-02T00:00:00.000Z', 102),
    obs(code, '2026-06-03T00:00:00.000Z', 100),
  ]
}

/** Série plate : valeurs identiques. */
function flat(code: string): MacroSeriesRow[] {
  return [
    obs(code, '2026-06-01T00:00:00.000Z', 100),
    obs(code, '2026-06-02T00:00:00.000Z', 100),
    obs(code, '2026-06-03T00:00:00.000Z', 100),
  ]
}

describe('deriveFundamentalContext — forme §3 LOCKED', () => {
  it('produit un contexte qui passe FundamentalContextSchema.parse', () => {
    const macro = [...rising('DTWEXBGS'), ...rising('DFII10'), ...rising('DFF')]
    const ctx = deriveFundamentalContext(macro, [])
    expect(() => FundamentalContextSchema.parse(ctx)).not.toThrow()
  })
})

describe('deriveFundamentalContext — macro_bias (D-38)', () => {
  it('DXY↗ + real_yields↗ → risk_off', () => {
    const macro = [...rising('DTWEXBGS'), ...rising('DFII10'), ...flat('DFF')]
    const ctx = deriveFundamentalContext(macro, [])
    expect(ctx.macro_bias).toBe('risk_off')
  })

  it('DXY↘ + real_yields↘ → risk_on', () => {
    const macro = [...falling('DTWEXBGS'), ...falling('DFII10'), ...flat('DFF')]
    const ctx = deriveFundamentalContext(macro, [])
    expect(ctx.macro_bias).toBe('risk_on')
  })

  it('signaux mixtes → neutral', () => {
    const macro = [...rising('DTWEXBGS'), ...falling('DFII10'), ...flat('DFF')]
    const ctx = deriveFundamentalContext(macro, [])
    expect(ctx.macro_bias).toBe('neutral')
  })
})

describe('deriveFundamentalContext — rate_environment (D-38)', () => {
  it('DFF en hausse récente → hawkish', () => {
    const macro = [...flat('DTWEXBGS'), ...flat('DFII10'), ...rising('DFF')]
    const ctx = deriveFundamentalContext(macro, [])
    expect(ctx.rate_environment).toBe('hawkish')
  })

  it('DFF en baisse récente → dovish', () => {
    const macro = [...flat('DTWEXBGS'), ...flat('DFII10'), ...falling('DFF')]
    const ctx = deriveFundamentalContext(macro, [])
    expect(ctx.rate_environment).toBe('dovish')
  })

  it('DFF plat → neutral', () => {
    const macro = [...flat('DTWEXBGS'), ...flat('DFII10'), ...flat('DFF')]
    const ctx = deriveFundamentalContext(macro, [])
    expect(ctx.rate_environment).toBe('neutral')
  })
})

describe('deriveFundamentalContext — drivers data-not-code (D-38)', () => {
  it('asset_specific_drivers dérivés des drivers passés (or : DXY-1, REAL_YIELDS-1)', () => {
    const macro = [...rising('DTWEXBGS'), ...rising('DFII10'), ...flat('DFF')]
    const drivers = [driver('DXY', -1), driver('REAL_YIELDS', -1)]
    const ctx = deriveFundamentalContext(macro, drivers)
    expect(ctx.asset_specific_drivers.some((d) => d.includes('DXY'))).toBe(true)
    expect(ctx.asset_specific_drivers.some((d) => d.includes('REAL_YIELDS'))).toBe(true)
    expect(ctx.asset_specific_drivers).toHaveLength(2)
  })

  it('instrument sans drivers → contexte macro global, asset_specific_drivers vide, pas de crash', () => {
    const macro = [...rising('DTWEXBGS'), ...rising('DFII10'), ...flat('DFF')]
    const ctx = deriveFundamentalContext(macro, [])
    expect(ctx.asset_specific_drivers).toEqual([])
    expect(ctx.macro_bias).toBe('risk_off')
  })
})

describe('deriveFundamentalContext — hash déterministe (D-41)', () => {
  it('deux appels sur les mêmes entrées → snapshotContentHash identique', () => {
    const macro = [...rising('DTWEXBGS'), ...rising('DFII10'), ...rising('DFF')]
    const drivers = [driver('DXY', -1)]
    const a = deriveFundamentalContext(macro, drivers)
    const b = deriveFundamentalContext(macro, drivers)
    expect(snapshotContentHash(a)).toBe(snapshotContentHash(b))
  })
})
