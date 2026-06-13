/**
 * Golden values — parseBinanceKlines
 *
 * Test hors-ligne : charge la fixture JSON et vérifie la normalisation UTC.
 * Aucun appel réseau. Déterministe.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { parseBinanceKlines } from './schema.js'

const require = createRequire(import.meta.url)
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const rawFixture = require('../__fixtures__/binance-klines.json') as unknown[][]

const INSTRUMENT_ID = 'test-btcusdt-id'
const TIMEFRAME = 'H1'

describe('parseBinanceKlines — golden values', () => {
  it('retourne 3 CandleInsert depuis la fixture', () => {
    const result = parseBinanceKlines(rawFixture, INSTRUMENT_ID, TIMEFRAME)
    expect(result).toHaveLength(3)
  })

  it('bougie 0 : ts ISO UTC correct (openTime 1749463200000 = 2026-06-09T09:00:00.000Z)', () => {
    const result = parseBinanceKlines(rawFixture, INSTRUMENT_ID, TIMEFRAME)
    expect(result[0]?.ts).toBe('2026-06-09T09:00:00.000Z')
  })

  it('bougie 0 : open/high/low/close numériques corrects', () => {
    const result = parseBinanceKlines(rawFixture, INSTRUMENT_ID, TIMEFRAME)
    expect(result[0]?.open).toBe(68250.5)
    expect(result[0]?.high).toBe(68410.0)
    expect(result[0]?.low).toBe(68180.25)
    expect(result[0]?.close).toBe(68345.75)
  })

  it('bougie 0 : volume numérique correct', () => {
    const result = parseBinanceKlines(rawFixture, INSTRUMENT_ID, TIMEFRAME)
    expect(result[0]?.volume).toBeCloseTo(123.456, 3)
  })

  it('bougie 0 : instrument_id et timeframe injectés', () => {
    const result = parseBinanceKlines(rawFixture, INSTRUMENT_ID, TIMEFRAME)
    expect(result[0]?.instrument_id).toBe(INSTRUMENT_ID)
    expect(result[0]?.timeframe).toBe(TIMEFRAME)
  })

  it('bougie 1 : ts ISO UTC correct (openTime 1749466800000 = 2026-06-09T10:00:00.000Z)', () => {
    const result = parseBinanceKlines(rawFixture, INSTRUMENT_ID, TIMEFRAME)
    expect(result[1]?.ts).toBe('2026-06-09T10:00:00.000Z')
  })

  it('bougie 2 : ts ISO UTC correct (openTime 1749470400000 = 2026-06-09T11:00:00.000Z)', () => {
    const result = parseBinanceKlines(rawFixture, INSTRUMENT_ID, TIMEFRAME)
    expect(result[2]?.ts).toBe('2026-06-09T11:00:00.000Z')
  })

  it('retourne un tableau vide si fixtures vide', () => {
    const result = parseBinanceKlines([], INSTRUMENT_ID, TIMEFRAME)
    expect(result).toHaveLength(0)
  })
})
