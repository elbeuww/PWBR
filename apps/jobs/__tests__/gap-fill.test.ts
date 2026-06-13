/**
 * Test gap-fill — fenêtre since/until pour market-ingest.
 *
 * Unit test déterministe (pas de réseau, pas de Supabase).
 * Vérifie que :
 *  1. Avec un dernier ts en base, since = dernier ts, until = début de la bougie EN COURS.
 *  2. Au 1er run (getLastCandleTs => null), since = backfillStart (2 ans D / 6 mois H4/H1).
 *  3. until < now (anti look-ahead — la bougie en cours n'est jamais incluse).
 *  4. La dernière bougie CLÔTURÉE est bien dans la fenêtre [since, until[.
 *
 * Style golden : valeurs calculées déterministes via luxon.
 *
 * Convention CR-01 fix :
 *   until = lastClosedCandleStart(now, tf).plus({ minutes: tf })
 *          = début de la bougie EN COURS (borne exclusive correcte)
 *   ≠ lastClosedCandleStart(now, tf) seul (ancienne valeur bogguée = retard 1 bougie)
 */
import { describe, it, expect } from 'vitest'
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

    it('until = début bougie en cours = 2026-06-09T10:00:00.000Z (CR-01 fix)', () => {
      const lastTs = '2026-06-09T08:00:00.000Z'
      const { until } = computeGapFillWindow('H1', lastTs, 'binance', now)
      // now=10:30 → bougie en cours = [10:00..11:00[ → until = 10:00 (borne exclusive)
      // Ancienne valeur bogguée : 09:00 (exclut la bougie 09:00-10:00 clôturée)
      // Valeur correcte       : 10:00 (inclut toutes les bougies clôturées jusqu'à 09:00)
      expect(until.toISO()).toBe('2026-06-09T10:00:00.000Z')
    })

    it('until < now (anti look-ahead — bougie en cours exclue)', () => {
      const lastTs = '2026-06-09T08:00:00.000Z'
      const { until } = computeGapFillWindow('H1', lastTs, 'binance', now)
      // until = 10:00 < now = 10:30 → bougie en cours [10:00..11:00[ jamais ingérée
      expect(until.toMillis()).toBeLessThan(now.toMillis())
    })

    it('la dernière bougie clôturée (09:00) est dans la fenêtre [since, until[', () => {
      const lastTs = '2026-06-09T08:00:00.000Z'
      const { since, until } = computeGapFillWindow('H1', lastTs, 'binance', now)
      // lastClosedCandleStart = 09:00
      const lastClosed = DateTime.fromISO('2026-06-09T09:00:00.000Z', { zone: 'utc' })
      expect(lastClosed.toMillis()).toBeGreaterThanOrEqual(since.toMillis())
      expect(lastClosed.toMillis()).toBeLessThan(until.toMillis())
    })
  })

  describe('H4 — depuis un dernier ts connu', () => {
    it('until = début bougie H4 en cours = 2026-06-09T08:00:00.000Z (CR-01 fix)', () => {
      const lastTs = '2026-06-09T00:00:00.000Z'
      const { until } = computeGapFillWindow('H4', lastTs, 'binance', now)
      // now=10:30 → bougie H4 en cours = [08:00..12:00[ → until = 08:00 (borne exclusive)
      // Ancienne valeur bogguée : 04:00 (exclut la bougie 04:00-08:00 clôturée)
      // Valeur correcte       : 08:00 (inclut toutes les bougies clôturées jusqu'à 04:00)
      expect(until.toISO()).toBe('2026-06-09T08:00:00.000Z')
    })

    it('until < now (anti look-ahead H4)', () => {
      const lastTs = '2026-06-09T00:00:00.000Z'
      const { until } = computeGapFillWindow('H4', lastTs, 'binance', now)
      expect(until.toMillis()).toBeLessThan(now.toMillis())
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
