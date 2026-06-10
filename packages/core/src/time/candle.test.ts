/**
 * Golden values DATA-05 — lastClosedCandleStart (anti look-ahead)
 *
 * Ces tests vérifient que la fonction retourne toujours la borne de début
 * de la DERNIÈRE BOUGIE CLÔTURÉE, c'est-à-dire qu'elle n'inclut JAMAIS
 * la bougie en cours (anti look-ahead, D-10).
 */
import { describe, expect, it } from 'vitest'
import { DateTime } from 'luxon'
import { lastClosedCandleStart } from './candle.js'

describe('lastClosedCandleStart — golden values DATA-05', () => {
  // Fixture fixe : 2026-06-09T10:30:00Z (30 minutes dans la bougie H1 10:00)
  const now = DateTime.fromISO('2026-06-09T10:30:00Z', { zone: 'utc' })

  describe('H1 (60 min)', () => {
    it('retourne le début de la dernière bougie H1 clôturée (09:00)', () => {
      const result = lastClosedCandleStart(now, 60)
      // Bougie 10:00 est en cours → dernière clôturée = 09:00
      expect(result.toISO()).toBe('2026-06-09T09:00:00.000Z')
    })

    it('retourne bien une DateTime UTC', () => {
      const result = lastClosedCandleStart(now, 60)
      expect(result.zoneName).toBe('UTC')
    })

    it('retourne un résultat strictement < now (anti look-ahead)', () => {
      const result = lastClosedCandleStart(now, 60)
      expect(result.toMillis()).toBeLessThan(now.toMillis())
    })
  })

  describe('H4 (240 min)', () => {
    it('retourne le début de la dernière bougie H4 clôturée (04:00)', () => {
      // now = 10:30 → bougie H4 en cours = 08:00 (bucket [8..12[) → dernière clôturée = 04:00
      const result = lastClosedCandleStart(now, 240)
      expect(result.toISO()).toBe('2026-06-09T04:00:00.000Z')
    })

    it('retourne un résultat strictement < now (anti look-ahead)', () => {
      const result = lastClosedCandleStart(now, 240)
      expect(result.toMillis()).toBeLessThan(now.toMillis())
    })
  })

  describe('cas limites', () => {
    it('ne retourne jamais une borne >= now (invariant anti look-ahead)', () => {
      // Tester plusieurs timeframes et instants
      const testCases: Array<[string, number]> = [
        ['2026-06-09T00:00:00Z', 60],
        ['2026-06-09T00:01:00Z', 60],
        ['2026-06-09T08:00:00Z', 240],
        ['2026-06-09T12:00:00Z', 240],
        ['2026-06-09T00:00:00Z', 1440],
      ]
      for (const [isoNow, tfMinutes] of testCases) {
        const testNow = DateTime.fromISO(isoNow, { zone: 'utc' })
        const result = lastClosedCandleStart(testNow, tfMinutes)
        expect(result.toMillis()).toBeLessThan(testNow.toMillis())
      }
    })

    it('est déterministe : deux appels au même instant retournent le même résultat', () => {
      const r1 = lastClosedCandleStart(now, 60)
      const r2 = lastClosedCandleStart(now, 60)
      expect(r1.toMillis()).toBe(r2.toMillis())
    })
  })
})
