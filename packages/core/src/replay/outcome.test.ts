/**
 * Golden values TRACK-01 — replayOutcome (replay first-touch déterministe)
 *
 * Vérifie la simulation binaire « TP1 atteint avant SL » sur bougies H1 (D-01,
 * granularité H1 D-03), la règle de distance sur bougie ambiguë (D-04), le trade
 * flat valorisé au close de la dernière bougie ≤ valid_until (D-02), pour long
 * ET short, et le déterminisme (Core Value « jamais inventé »).
 *
 * Fixtures candles H1 synthétiques inline (séquences OHLC contrôlées).
 */
import { describe, expect, it } from 'vitest'
import { replayOutcome } from './outcome.js'

// Helper fixture : bougie H1 minimale. ts croissants pour respecter l'ordre.
function candle(ts: string, open: number, high: number, low: number, close: number) {
  return { ts, open, high, low, close }
}

// Setup long de référence : entrée 100, SL 98 (risque = 2), TP1 104 (gain = 4 → R = 2).
const longSetup = {
  direction: 'long' as const,
  entry_price: 100,
  stop_loss: 98,
  take_profits: [{ price: 104, alloc_pct: 100 }],
  valid_until: '2026-06-10T00:00:00.000Z',
}

// Setup short de référence : entrée 100, SL 102 (risque = 2), TP1 96 (gain = 4 → R = 2).
const shortSetup = {
  direction: 'short' as const,
  entry_price: 100,
  stop_loss: 102,
  take_profits: [{ price: 96, alloc_pct: 100 }],
  valid_until: '2026-06-10T00:00:00.000Z',
}

describe('replayOutcome — golden values TRACK-01', () => {
  it('first-touch hit_tp simple (long) : high >= tp1 avant tout low <= sl', () => {
    const candles = [
      candle('2026-06-09T10:00:00.000Z', 100, 101, 99.5, 100.5), // ni TP ni SL
      candle('2026-06-09T11:00:00.000Z', 100.5, 104.5, 100, 104), // TP1 touché (high 104.5 >= 104)
      candle('2026-06-09T12:00:00.000Z', 104, 105, 97, 98), // poste-TP, ignoré
    ]
    const result = replayOutcome(longSetup, candles)
    expect(result.outcome).toBe('hit_tp')
    // realized_r = |104-100| / (100-98) = 4/2 = 2
    expect(result.realized_r).toBe(2)
    expect(result.realized_r).toBeGreaterThan(0)
  })

  it('first-touch hit_sl simple (long) : low <= sl avant high >= tp1', () => {
    const candles = [
      candle('2026-06-09T10:00:00.000Z', 100, 101, 99.5, 100), // rien
      candle('2026-06-09T11:00:00.000Z', 100, 100.5, 97, 98.5), // SL touché (low 97 <= 98)
      candle('2026-06-09T12:00:00.000Z', 98.5, 105, 98, 104), // TP plus tard, ignoré
    ]
    const result = replayOutcome(longSetup, candles)
    expect(result.outcome).toBe('hit_sl')
    expect(result.realized_r).toBe(-1)
  })

  it('cas ambigu D-04 : TP1 plus proche de l’entrée que SL → hit_tp', () => {
    // entrée 100, TP1 101 (dist 1), SL 95 (dist 5) → TP plus proche → hit_tp
    const setup = {
      direction: 'long' as const,
      entry_price: 100,
      stop_loss: 95,
      take_profits: [{ price: 101, alloc_pct: 100 }],
      valid_until: '2026-06-10T00:00:00.000Z',
    }
    const candles = [
      // une SEULE bougie touche TP1 (high>=101) ET SL (low<=95)
      candle('2026-06-09T10:00:00.000Z', 100, 102, 94, 99),
    ]
    const result = replayOutcome(setup, candles)
    expect(result.outcome).toBe('hit_tp')
    // realized_r = |101-100| / (100-95) = 1/5 = 0.2
    expect(result.realized_r).toBeCloseTo(0.2, 10)
  })

  it('cas ambigu D-04 : SL plus proche de l’entrée que TP1 → hit_sl', () => {
    // entrée 100, TP1 105 (dist 5), SL 99 (dist 1) → SL plus proche → hit_sl
    const setup = {
      direction: 'long' as const,
      entry_price: 100,
      stop_loss: 99,
      take_profits: [{ price: 105, alloc_pct: 100 }],
      valid_until: '2026-06-10T00:00:00.000Z',
    }
    const candles = [candle('2026-06-09T10:00:00.000Z', 100, 106, 98, 100)]
    const result = replayOutcome(setup, candles)
    expect(result.outcome).toBe('hit_sl')
    expect(result.realized_r).toBe(-1)
  })

  it('cas ambigu D-04 : égalité distTp == distSl → hit_tp (tie-break ≤)', () => {
    // entrée 100, TP1 102 (dist 2), SL 98 (dist 2) → égalité → tie ≤ → hit_tp
    const setup = {
      direction: 'long' as const,
      entry_price: 100,
      stop_loss: 98,
      take_profits: [{ price: 102, alloc_pct: 100 }],
      valid_until: '2026-06-10T00:00:00.000Z',
    }
    const candles = [candle('2026-06-09T10:00:00.000Z', 100, 103, 97, 100)]
    const result = replayOutcome(setup, candles)
    expect(result.outcome).toBe('hit_tp')
    // realized_r = |102-100| / (100-98) = 2/2 = 1
    expect(result.realized_r).toBe(1)
  })

  it('flat D-02 long : aucun TP/SL, close de la dernière bougie au-dessus de l’entrée → R > 0', () => {
    const candles = [
      candle('2026-06-09T10:00:00.000Z', 100, 101, 99.5, 100.5),
      candle('2026-06-09T11:00:00.000Z', 100.5, 101.5, 100, 101), // close 101 > entrée 100
    ]
    const result = replayOutcome(longSetup, candles)
    expect(result.outcome).toBe('flat')
    // long : (close - entry) / denom = (101 - 100) / (100 - 98) = 1/2 = 0.5
    expect(result.realized_r).toBe(0.5)
    expect(result.realized_r).toBeGreaterThan(0)
  })

  it('flat D-02 long : close en dessous de l’entrée → R < 0', () => {
    const candles = [
      candle('2026-06-09T10:00:00.000Z', 100, 100.5, 99.5, 100),
      candle('2026-06-09T11:00:00.000Z', 100, 100.5, 99, 99), // close 99 < entrée 100
    ]
    const result = replayOutcome(longSetup, candles)
    expect(result.outcome).toBe('flat')
    // (99 - 100) / 2 = -0.5
    expect(result.realized_r).toBe(-0.5)
    expect(result.realized_r).toBeLessThan(0)
  })

  it('flat D-02 short : aucun TP/SL, close en dessous de l’entrée → R > 0 (sens short)', () => {
    const candles = [
      candle('2026-06-09T10:00:00.000Z', 100, 100.5, 99.5, 100),
      candle('2026-06-09T11:00:00.000Z', 100, 100.5, 98.5, 99), // close 99 < entrée 100 → gagnant pour un short
    ]
    const result = replayOutcome(shortSetup, candles)
    expect(result.outcome).toBe('flat')
    // short : (entry - close) / denom = (100 - 99) / (102 - 100) = 1/2 = 0.5
    expect(result.realized_r).toBe(0.5)
    expect(result.realized_r).toBeGreaterThan(0)
  })

  it('flat D-02 short : close au-dessus de l’entrée → R < 0 (sens short)', () => {
    const candles = [
      candle('2026-06-09T10:00:00.000Z', 100, 100.5, 99.5, 100),
      candle('2026-06-09T11:00:00.000Z', 100, 101.5, 100, 101), // close 101 > entrée 100 → perdant pour un short
    ]
    const result = replayOutcome(shortSetup, candles)
    expect(result.outcome).toBe('flat')
    // (100 - 101) / 2 = -0.5
    expect(result.realized_r).toBe(-0.5)
    expect(result.realized_r).toBeLessThan(0)
  })

  it('short hit_tp : low <= tp1 avant high >= sl', () => {
    const candles = [
      candle('2026-06-09T10:00:00.000Z', 100, 100.5, 99, 99.5),
      candle('2026-06-09T11:00:00.000Z', 99.5, 100, 95.5, 96), // TP1 96 touché (low 95.5 <= 96)
    ]
    const result = replayOutcome(shortSetup, candles)
    expect(result.outcome).toBe('hit_tp')
    // |96-100| / (102-100) = 4/2 = 2
    expect(result.realized_r).toBe(2)
  })

  it('déterministe : deux appels successifs sur les mêmes entrées retournent un résultat identique', () => {
    const candles = [
      candle('2026-06-09T10:00:00.000Z', 100, 101, 99.5, 100.5),
      candle('2026-06-09T11:00:00.000Z', 100.5, 104.5, 100, 104),
    ]
    const r1 = replayOutcome(longSetup, candles)
    const r2 = replayOutcome(longSetup, candles)
    expect(r1).toEqual(r2)
  })
})
