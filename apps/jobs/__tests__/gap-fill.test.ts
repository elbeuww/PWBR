/**
 * Test gap-fill — fenêtre since/until pour market-ingest.
 *
 * Unit test avec repository mocké (pas de réseau, pas de Supabase).
 * Vérifie que :
 *  1. Avec un dernier ts en base, since = dernier ts, until = borne haute exclusive.
 *  2. Au 1er run (getLastCandleTs => null), since = backfillStart (2 ans D / 6 mois H4/H1).
 *  3. until < now (anti look-ahead).
 *
 * Style golden : valeurs calculées déterministes via luxon.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DateTime } from 'luxon'
import { computeGapFillWindow } from '../src/jobs/market-ingest.js'

// --- helpers ---

const TIMEFRAMES = { H1: 60, H4: 240, D: 1440 } as const
type Timeframe = keyof typeof TIMEFRAMES

describe('computeGapFillWindow — gap-fill fenêtre since/until', () => {
  // Instant de référence fixe : 2026-06-09T10:30:00Z (30 min dans la bougie H1 10:00)
  const now = DateTime.fromISO('2026-06-09T10:30:00Z', { zone: 'utc' })

  describe('H1 — depuis un dernier ts connu', () => {
    it('since = dernier ts en base', () => {
      const lastTs = '2026-06-09T08:00:00.000Z'
      const { since } = computeGapFillWindow('H1', lastTs, 'binance', now)
      expect(since.toISO()).toBe('2026-06-09T08:00:00.000Z')
    })

    it('until = lastClosedCandleStart(now, 60) = 2026-06-09T09:00:00.000Z', () => {
      const lastTs = '2026-06-09T08:00:00.000Z'
      const { until } = computeGapFillWindow('H1', lastTs, 'binance', now)
      // Bougie H1 10:00 en cours → dernière clôturée = 09:00
      expect(until.toISO()).toBe('2026-06-09T09:00:00.000Z')
    })

    it('until < now (anti look-ahead)', () => {
      const lastTs = '2026-06-09T08:00:00.000Z'
      const { until } = computeGapFillWindow('H1', lastTs, 'binance', now)
      expect(until.toMillis()).toBeLessThan(now.toMillis())
    })
  })

  describe('H4 — depuis un dernier ts connu', () => {
    it('until = lastClosedCandleStart(now, 240) = 2026-06-09T04:00:00.000Z', () => {
      const lastTs = '2026-06-09T00:00:00.000Z'
      const { until } = computeGapFillWindow('H4', lastTs, 'binance', now)
      // now=10:30, bougie H4 en cours=[08:00..12:00[ → dernière clôturée = 04:00
      expect(until.toISO()).toBe('2026-06-09T04:00:00.000Z')
    })
  })

  describe('D binance — depuis un dernier ts connu', () => {
    it('until = dailyAnchorStart(binance, now) < now', () => {
      const lastTs = '2026-06-07T00:00:00.000Z'
      const { until } = computeGapFillWindow('D', lastTs, 'binance', now)
      expect(until.toMillis()).toBeLessThan(now.toMillis())
    })
  })

  describe('D oanda — depuis un dernier ts connu', () => {
    it('until = dailyAnchorStart(oanda, now) < now', () => {
      const lastTs = '2026-06-07T21:00:00.000Z'
      const { until } = computeGapFillWindow('D', lastTs, 'oanda', now)
      expect(until.toMillis()).toBeLessThan(now.toMillis())
    })
  })

  describe('1er run (null) — backfill', () => {
    it('H1 : since ≈ 6 mois avant now', () => {
      const { since } = computeGapFillWindow('H1', null, 'binance', now)
      const expectedSince = now.minus({ months: 6 })
      // Tolérance de 1 minute (arrondi possible)
      expect(Math.abs(since.toMillis() - expectedSince.toMillis())).toBeLessThan(60_000)
    })

    it('H4 : since ≈ 6 mois avant now', () => {
      const { since } = computeGapFillWindow('H4', null, 'binance', now)
      const expectedSince = now.minus({ months: 6 })
      expect(Math.abs(since.toMillis() - expectedSince.toMillis())).toBeLessThan(60_000)
    })

    it('D : since ≈ 2 ans avant now', () => {
      const { since } = computeGapFillWindow('D', null, 'binance', now)
      const expectedSince = now.minus({ years: 2 })
      expect(Math.abs(since.toMillis() - expectedSince.toMillis())).toBeLessThan(60_000)
    })

    it('since < until dans tous les cas', () => {
      const tfs: Timeframe[] = ['H1', 'H4', 'D']
      for (const tf of tfs) {
        const { since, until } = computeGapFillWindow(tf, null, 'binance', now)
        expect(since.toMillis()).toBeLessThan(until.toMillis())
      }
    })
  })
})
