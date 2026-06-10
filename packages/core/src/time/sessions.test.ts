/**
 * Golden values DATA-05 — DAILY_ANCHOR + dailyAnchorStart
 *
 * Vérifie les constantes d'ancrage daily par source (D-09) :
 * - OANDA : daily aligné 17:00 NY (America/New_York)
 * - Binance : daily aligné 00:00 UTC
 */
import { describe, expect, it } from 'vitest'
import { DateTime } from 'luxon'
import { DAILY_ANCHOR, dailyAnchorStart } from './sessions.js'

describe('DAILY_ANCHOR — constantes par source (D-09)', () => {
  it('OANDA anchor zone = America/New_York', () => {
    expect(DAILY_ANCHOR.oanda.zone).toBe('America/New_York')
  })

  it('OANDA anchor hour = 17', () => {
    expect(DAILY_ANCHOR.oanda.hour).toBe(17)
  })

  it('Binance anchor zone = UTC', () => {
    expect(DAILY_ANCHOR.binance.zone).toBe('UTC')
  })

  it('Binance anchor hour = 0', () => {
    expect(DAILY_ANCHOR.binance.hour).toBe(0)
  })
})

describe('dailyAnchorStart — dernière clôture daily par source', () => {
  describe('Binance (00:00 UTC)', () => {
    it('avant minuit UTC → daily clôturé = hier 00:00 UTC', () => {
      // now = 2026-06-09T15:00:00Z (dans la journée)
      const now = DateTime.fromISO('2026-06-09T15:00:00Z', { zone: 'utc' })
      const result = dailyAnchorStart('binance', now)
      // Daily en cours = 2026-06-09T00:00:00Z → dernière clôturée = 2026-06-08T00:00:00Z
      expect(result.toISO()).toBe('2026-06-08T00:00:00.000Z')
    })

    it('exactement à minuit UTC → daily clôturé = hier 00:00 UTC', () => {
      // Minuit exact = début du daily en cours → le daily en cours n'est PAS clôturé
      const now = DateTime.fromISO('2026-06-09T00:00:00Z', { zone: 'utc' })
      const result = dailyAnchorStart('binance', now)
      expect(result.toISO()).toBe('2026-06-08T00:00:00.000Z')
    })
  })

  describe('OANDA (17:00 NY)', () => {
    it('après 17:00 NY → daily en cours depuis 17:00 → dernière clôturée = hier 17:00 NY (en UTC)', () => {
      // now = 2026-06-09T23:00:00Z = 19:00 NY EDT (UTC-4 en été)
      // Daily NY en cours a démarré à 17:00 NY = 21:00 UTC
      // Dernière clôturée = 2026-06-08T21:00:00Z (17:00 NY le 8 juin EDT)
      const now = DateTime.fromISO('2026-06-09T23:00:00Z', { zone: 'utc' })
      const result = dailyAnchorStart('oanda', now)
      // Retourné en UTC : 17:00 EDT = 21:00 UTC
      expect(result.toUTC().toISO()).toBe('2026-06-08T21:00:00.000Z')
    })

    it('avant 17:00 NY → daily en cours depuis hier 17:00 NY → dernière clôturée = avant-hier 17:00 NY', () => {
      // now = 2026-06-09T15:00:00Z = 11:00 NY EDT
      // Daily NY en cours a démarré à 17:00 NY le 8 juin = 21:00 UTC le 8 juin
      // Dernière clôturée = 17:00 NY le 7 juin = 21:00 UTC le 7 juin
      const now = DateTime.fromISO('2026-06-09T15:00:00Z', { zone: 'utc' })
      const result = dailyAnchorStart('oanda', now)
      expect(result.toUTC().toISO()).toBe('2026-06-07T21:00:00.000Z')
    })
  })

  it('retourne un résultat strictement < now (anti look-ahead)', () => {
    const now = DateTime.fromISO('2026-06-09T10:00:00Z', { zone: 'utc' })
    expect(dailyAnchorStart('binance', now).toMillis()).toBeLessThan(now.toMillis())
    expect(dailyAnchorStart('oanda', now).toMillis()).toBeLessThan(now.toMillis())
  })
})
