/**
 * Golden values — parseTwelveDataTimeSeries + mapping instruments Twelve Data.
 *
 * Test hors-ligne : charge la fixture JSON (values récent→ancien) et vérifie la
 * normalisation UTC, le ré-ordonnancement ascendant, le volume, et le throw sur
 * body status=error. Aucun appel réseau. Déterministe.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { parseTwelveDataTimeSeries } from './schema.js'
import { toTwelveDataSymbol, toTwelveDataInterval } from './instruments.js'

const require = createRequire(import.meta.url)
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const rawFixture = require('../__fixtures__/twelvedata-timeseries.json') as unknown

const INSTRUMENT_ID = 'test-eurusd-id'
const TIMEFRAME = 'H1'

describe('parseTwelveDataTimeSeries — golden values', () => {
  it('retourne 3 CandleInsert', () => {
    const result = parseTwelveDataTimeSeries(rawFixture, INSTRUMENT_ID, TIMEFRAME)
    expect(result).toHaveLength(3)
  })

  it('réordonne ASCENDANT (ts croissants) — TD renvoie récent→ancien', () => {
    const result = parseTwelveDataTimeSeries(rawFixture, INSTRUMENT_ID, TIMEFRAME)
    expect(result[0]?.ts).toBe('2026-07-01T10:00:00.000Z')
    expect(result[1]?.ts).toBe('2026-07-01T11:00:00.000Z')
    expect(result[2]?.ts).toBe('2026-07-01T12:00:00.000Z')
  })

  it('normalise datetime intraday "yyyy-MM-dd HH:mm:ss" → ISO UTC', () => {
    const result = parseTwelveDataTimeSeries(rawFixture, INSTRUMENT_ID, TIMEFRAME)
    expect(result[0]?.ts).toBe('2026-07-01T10:00:00.000Z')
  })

  it('normalise datetime date-seule "yyyy-MM-dd" → minuit UTC', () => {
    const daily = {
      status: 'ok',
      values: [
        {
          datetime: '2026-07-01',
          open: '1.08',
          high: '1.09',
          low: '1.07',
          close: '1.085',
          volume: '0',
        },
      ],
    }
    const result = parseTwelveDataTimeSeries(daily, INSTRUMENT_ID, 'D')
    expect(result[0]?.ts).toBe('2026-07-01T00:00:00.000Z')
  })

  it('bougie ascendante 0 : open/high/low/close numériques corrects', () => {
    const result = parseTwelveDataTimeSeries(rawFixture, INSTRUMENT_ID, TIMEFRAME)
    expect(result[0]?.open).toBeCloseTo(1.081, 4)
    expect(result[0]?.high).toBeCloseTo(1.0825, 5)
    expect(result[0]?.low).toBeCloseTo(1.0805, 5)
    expect(result[0]?.close).toBeCloseTo(1.082, 4)
  })

  it('instrument_id + timeframe injectés', () => {
    const result = parseTwelveDataTimeSeries(rawFixture, INSTRUMENT_ID, TIMEFRAME)
    expect(result[0]?.instrument_id).toBe(INSTRUMENT_ID)
    expect(result[0]?.timeframe).toBe(TIMEFRAME)
  })

  it('volume absent → 0 (number)', () => {
    const noVol = {
      status: 'ok',
      values: [
        {
          datetime: '2026-07-01 10:00:00',
          open: '1.08',
          high: '1.09',
          low: '1.07',
          close: '1.085',
        },
      ],
    }
    const result = parseTwelveDataTimeSeries(noVol, INSTRUMENT_ID, TIMEFRAME)
    expect(result[0]?.volume).toBe(0)
  })

  it('volume "0" (string) → 0 (number)', () => {
    const result = parseTwelveDataTimeSeries(rawFixture, INSTRUMENT_ID, TIMEFRAME)
    expect(result[0]?.volume).toBe(0)
    expect(typeof result[0]?.volume).toBe('number')
  })

  it('body status=error (code 404) → throw contenant code + message', () => {
    const errBody = {
      status: 'error',
      code: 404,
      message: 'symbol not available on your plan',
    }
    expect(() => parseTwelveDataTimeSeries(errBody, INSTRUMENT_ID, TIMEFRAME)).toThrow(/404/)
    expect(() => parseTwelveDataTimeSeries(errBody, INSTRUMENT_ID, TIMEFRAME)).toThrow(
      /not available/,
    )
  })
})

describe('mapping instruments Twelve Data', () => {
  it('toTwelveDataSymbol EUR_USD → EUR/USD', () => {
    expect(toTwelveDataSymbol('EUR_USD')).toBe('EUR/USD')
  })

  it('toTwelveDataSymbol XAU_USD → XAU/USD', () => {
    expect(toTwelveDataSymbol('XAU_USD')).toBe('XAU/USD')
  })

  it('toTwelveDataInterval H1/H4/D → 1h/4h/1day', () => {
    expect(toTwelveDataInterval('H1')).toBe('1h')
    expect(toTwelveDataInterval('H4')).toBe('4h')
    expect(toTwelveDataInterval('D')).toBe('1day')
  })
})
