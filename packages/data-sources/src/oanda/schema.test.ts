/**
 * Golden values — parseOandaCandles
 *
 * Test hors-ligne : charge la fixture JSON et vérifie la normalisation UTC
 * et le filtrage des bougies incomplete.
 * Aucun appel réseau. Déterministe.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { parseOandaCandles } from './schema.js'

const require = createRequire(import.meta.url)
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const rawFixture = require('../__fixtures__/oanda-candles.json') as unknown

const INSTRUMENT_ID = 'test-eurusd-id'
const TIMEFRAME = 'H1'

describe('parseOandaCandles — golden values', () => {
  it('retourne 2 CandleInsert (exclut la bougie complete:false)', () => {
    const result = parseOandaCandles(rawFixture, INSTRUMENT_ID, TIMEFRAME)
    expect(result).toHaveLength(2)
  })

  it('bougie 0 : ts ISO UTC correct (2026-06-09T09:00:00.000Z)', () => {
    const result = parseOandaCandles(rawFixture, INSTRUMENT_ID, TIMEFRAME)
    expect(result[0]?.ts).toBe('2026-06-09T09:00:00.000Z')
  })

  it('bougie 0 : open/high/low/close numériques corrects', () => {
    const result = parseOandaCandles(rawFixture, INSTRUMENT_ID, TIMEFRAME)
    expect(result[0]?.open).toBeCloseTo(1.0821, 4)
    expect(result[0]?.high).toBeCloseTo(1.08345, 5)
    expect(result[0]?.low).toBeCloseTo(1.0818, 4)
    expect(result[0]?.close).toBeCloseTo(1.08295, 5)
  })

  it('bougie 0 : instrument_id et timeframe injectés', () => {
    const result = parseOandaCandles(rawFixture, INSTRUMENT_ID, TIMEFRAME)
    expect(result[0]?.instrument_id).toBe(INSTRUMENT_ID)
    expect(result[0]?.timeframe).toBe(TIMEFRAME)
  })

  it('bougie 1 : ts ISO UTC correct (2026-06-09T10:00:00.000Z)', () => {
    const result = parseOandaCandles(rawFixture, INSTRUMENT_ID, TIMEFRAME)
    expect(result[1]?.ts).toBe('2026-06-09T10:00:00.000Z')
  })

  it('exclut strictement la bougie complete:false (anti look-ahead T-02-07)', () => {
    const result = parseOandaCandles(rawFixture, INSTRUMENT_ID, TIMEFRAME)
    // La 3ème bougie (time=11:00) est complete:false — elle ne doit PAS apparaître
    const timestamps = result.map((c) => c.ts)
    expect(timestamps).not.toContain('2026-06-09T11:00:00.000Z')
  })

  it('retourne un tableau vide si pas de bougies complètes', () => {
    const onlyIncomplete = {
      instrument: 'EUR_USD',
      granularity: 'H1',
      candles: [
        {
          complete: false,
          volume: 100,
          time: '2026-06-09T12:00:00.000000000Z',
          mid: { o: '1.08', h: '1.09', l: '1.07', c: '1.085' },
        },
      ],
    }
    const result = parseOandaCandles(onlyIncomplete, INSTRUMENT_ID, TIMEFRAME)
    expect(result).toHaveLength(0)
  })
})
