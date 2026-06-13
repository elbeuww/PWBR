/**
 * Golden values — wrappers d'indicateurs classiques (TECH-01).
 *
 * Test hors-ligne, déterministe : charge la fixture OHLCV fixe et épingle
 * pour CHAQUE indicateur la VALEUR (toBeCloseTo) ET la LONGUEUR de sortie
 * (toHaveLength). Le pin de longueur attrape le piège warmup-offset de
 * technicalindicators (sortie PLUS COURTE que l'entrée) — RESEARCH Pitfall 1.
 * Aucun appel réseau.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import type { CandleRow } from '@app/supabase'
import { toOhlcv } from './../ohlcv.js'
import { rsi, rsiSeries } from './rsi.js'
import { macd, macdSeries } from './macd.js'
import { ema, emaSeries } from './ema.js'
import { atr, atrSeries } from './atr.js'
import { bollinger, bollingerSeries } from './bollinger.js'

const require = createRequire(import.meta.url)
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const rows = require('../__fixtures__/btcusdt-h4.json') as CandleRow[]
const N = rows.length // 220

describe('toOhlcv — mapping CandleRow[] → arrays', () => {
  it('mappe closes/highs/lows/vols dans l’ordre ts ascendant', () => {
    const o = toOhlcv(rows)
    expect(o.closes).toHaveLength(N)
    expect(o.highs).toHaveLength(N)
    expect(o.lows).toHaveLength(N)
    expect(o.vols).toHaveLength(N)
    expect(o.closes[0]).toBeCloseTo(rows[0]!.close, 2)
    expect(o.closes.at(-1)).toBeCloseTo(rows.at(-1)!.close, 2)
  })

  it('volume null → 0 (FX tick-volume non confirmé)', () => {
    const withNull = [{ ...rows[0]!, volume: null }]
    expect(toOhlcv(withNull).vols[0]).toBe(0)
  })
})

describe('rsi (RSI 14) — golden value + longueur', () => {
  it('valeur dernière bougie clôturée == 54.71 ± 0.01', () => {
    expect(rsi(rows)).toBeCloseTo(54.71, 2)
  })
  it('longueur de série == N - 14 (warmup-offset)', () => {
    expect(rsiSeries(rows)).toHaveLength(N - 14)
  })
})

describe('macd (12/26/9) — golden value + longueur', () => {
  it('histogramme dernière bougie == 42.2935 ± 0.001', () => {
    expect(macd(rows).histogram).toBeCloseTo(42.2935, 3)
  })
  it('MACD line dernière bougie == -87.6819 ± 0.001', () => {
    expect(macd(rows).macd).toBeCloseTo(-87.6819, 3)
  })
  it('longueur de série == 195 (warmup MACD)', () => {
    expect(macdSeries(rows)).toHaveLength(195)
  })
})

describe('ema (20/50/200) — golden values + longueurs', () => {
  it('EMA20 dernière == 47454.31 ± 0.01, longueur N - 20 + 1', () => {
    expect(ema(rows, 20)).toBeCloseTo(47454.31, 1)
    expect(emaSeries(rows, 20)).toHaveLength(N - 20 + 1)
  })
  it('EMA50 dernière == 47313.04 ± 0.01, longueur N - 50 + 1', () => {
    expect(ema(rows, 50)).toBeCloseTo(47313.04, 1)
    expect(emaSeries(rows, 50)).toHaveLength(N - 50 + 1)
  })
  it('EMA200 dernière == 44462.57 ± 0.01, longueur N - 200 + 1', () => {
    expect(ema(rows, 200)).toBeCloseTo(44462.57, 1)
    expect(emaSeries(rows, 200)).toHaveLength(N - 200 + 1)
  })
})

describe('atr (ATR 14) — golden value + longueur', () => {
  it('valeur dernière == 428.36 ± 0.01', () => {
    expect(atr(rows)).toBeCloseTo(428.36, 1)
  })
  it('longueur de série == N - 14', () => {
    expect(atrSeries(rows)).toHaveLength(N - 14)
  })
})

describe('bollinger (20/2) — golden values + longueur', () => {
  it('middle == 47342.84 ± 0.01, upper == 47691.20 ± 0.01', () => {
    const b = bollinger(rows)
    expect(b.middle).toBeCloseTo(47342.84, 1)
    expect(b.upper).toBeCloseTo(47691.20, 1)
    expect(b.lower).toBeCloseTo(46994.47, 1)
  })
  it('longueur de série == N - 20 + 1', () => {
    expect(bollingerSeries(rows)).toHaveLength(N - 20 + 1)
  })
})
