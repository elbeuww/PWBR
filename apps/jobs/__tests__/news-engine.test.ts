/**
 * Golden tests — deriveNewsContext (sentiment pondéré-décroissant + news_risk imminent).
 *
 * Tests purs, hors-ligne, déterministes : `now` injecté, timestamps relatifs.
 *  1. forme §3 : le contexte passe NewsContextSchema.parse.
 *  2. décroissance temporelle : à sentiment égal, la news récente pèse plus (D-39).
 *  3. fenêtre style : day (≈24h) ≠ swing (≈7j) — une news à -3j compte en swing, pas en day.
 *  4. bornes : net_sentiment ∈ [-1, 1].
 *  5. news_risk (D-40) : event high-impact <2h (day) / <24h (swing) → true ; au-delà → false.
 *  6. robustesse : pas de news → net_sentiment 0 neutre ; sentiment null ignoré (pas un 0 pondéré).
 *  7. hash déterministe (D-41).
 */
import { describe, it, expect } from 'vitest'
import { DateTime } from 'luxon'
import { NewsContextSchema, snapshotContentHash } from '@app/indicators'
import type { NewsRow, EconomicCalendarRow } from '@app/supabase'
import { deriveNewsContext } from '../src/jobs/news-engine'

const NOW = DateTime.fromISO('2026-06-13T12:00:00.000Z', { zone: 'utc' })
const INSTR = 'xau'

let seq = 0
function news(opts: {
  hoursAgo: number
  sentiment: number | null
  impact?: string | null
  instrument?: string
}): NewsRow {
  return {
    id: `n-${seq++}`,
    title: `news ${seq}`,
    summary: null,
    source: 'finnhub',
    url_hash: `h-${seq}`,
    instrument_ids: [opts.instrument ?? INSTR],
    sentiment: opts.sentiment,
    impact: opts.impact ?? null,
    published_at: NOW.minus({ hours: opts.hoursAgo }).toISO()!,
  }
}

function calEvent(opts: { hoursAhead: number; impact: string }): EconomicCalendarRow {
  return {
    id: `c-${seq++}`,
    title: `event ${seq}`,
    event_key: `k-${seq}`,
    event_at: NOW.plus({ hours: opts.hoursAhead }).toISO()!,
    impact: opts.impact,
    country: 'US',
    forecast: null,
    previous: null,
    source: 'finnhub',
  }
}

describe('deriveNewsContext — forme §3 LOCKED', () => {
  it('produit un contexte qui passe NewsContextSchema.parse', () => {
    const ctx = deriveNewsContext([news({ hoursAgo: 1, sentiment: 0.5 })], [], INSTR, 'day', NOW)
    expect(() => NewsContextSchema.parse(ctx)).not.toThrow()
  })
})

describe('deriveNewsContext — décroissance temporelle (D-39)', () => {
  it('news récente (positive) pèse plus qu’ancienne (négative) à magnitude égale', () => {
    const recentPos = deriveNewsContext(
      [news({ hoursAgo: 1, sentiment: 0.8 }), news({ hoursAgo: 20, sentiment: -0.8 })],
      [],
      INSTR,
      'day',
      NOW,
    )
    // La récente pèse davantage → net_sentiment penche positif.
    expect(recentPos.net_sentiment).toBeGreaterThan(0)
  })

  it('inverser l’âge inverse le signe du sentiment net', () => {
    const recentNeg = deriveNewsContext(
      [news({ hoursAgo: 1, sentiment: -0.8 }), news({ hoursAgo: 20, sentiment: 0.8 })],
      [],
      INSTR,
      'day',
      NOW,
    )
    expect(recentNeg.net_sentiment).toBeLessThan(0)
  })
})

describe('deriveNewsContext — fenêtre par style', () => {
  it('news à -3j : exclue en day (≈24h), incluse en swing (≈7j)', () => {
    const oldNews = [news({ hoursAgo: 72, sentiment: 0.9 })]
    const day = deriveNewsContext(oldNews, [], INSTR, 'day', NOW)
    const swing = deriveNewsContext(oldNews, [], INSTR, 'swing', NOW)
    expect(day.net_sentiment).toBe(0) // hors fenêtre day → neutre
    expect(swing.net_sentiment).toBeGreaterThan(0) // dans fenêtre swing
  })
})

describe('deriveNewsContext — bornes net_sentiment', () => {
  it('net_sentiment toujours dans [-1, 1] même avec sentiments extrêmes', () => {
    const ctx = deriveNewsContext(
      [news({ hoursAgo: 1, sentiment: 1 }), news({ hoursAgo: 2, sentiment: 1 })],
      [],
      INSTR,
      'day',
      NOW,
    )
    expect(ctx.net_sentiment).toBeLessThanOrEqual(1)
    expect(ctx.net_sentiment).toBeGreaterThanOrEqual(-1)
  })
})

describe('deriveNewsContext — news_risk (D-40)', () => {
  it('day : event high-impact à <2h → news_risk true', () => {
    const ctx = deriveNewsContext([], [calEvent({ hoursAhead: 1, impact: 'High' })], INSTR, 'day', NOW)
    expect(ctx.news_risk).toBe(true)
  })

  it('day : event high-impact à 10h → news_risk false (>2h)', () => {
    const ctx = deriveNewsContext([], [calEvent({ hoursAhead: 10, impact: 'High' })], INSTR, 'day', NOW)
    expect(ctx.news_risk).toBe(false)
  })

  it('swing : event high-impact à 10h → news_risk true (<24h)', () => {
    const ctx = deriveNewsContext([], [calEvent({ hoursAhead: 10, impact: 'High' })], INSTR, 'swing', NOW)
    expect(ctx.news_risk).toBe(true)
  })

  it('event Low-impact imminent → news_risk false (seuls les High comptent)', () => {
    const ctx = deriveNewsContext([], [calEvent({ hoursAhead: 1, impact: 'Low' })], INSTR, 'day', NOW)
    expect(ctx.news_risk).toBe(false)
  })

  it('event passé → ignoré', () => {
    const ctx = deriveNewsContext([], [calEvent({ hoursAhead: -1, impact: 'High' })], INSTR, 'day', NOW)
    expect(ctx.news_risk).toBe(false)
  })
})

describe('deriveNewsContext — robustesse', () => {
  it('aucune news → net_sentiment 0 neutre, pas de crash', () => {
    const ctx = deriveNewsContext([], [], INSTR, 'day', NOW)
    expect(ctx.net_sentiment).toBe(0)
    expect(ctx.recent_catalysts).toEqual([])
  })

  it('sentiment null (free tier) ignoré, pas compté comme 0 pondéré', () => {
    // une seule news, sentiment null → pas de sentiment exploitable → net 0
    const ctx = deriveNewsContext([news({ hoursAgo: 1, sentiment: null })], [], INSTR, 'day', NOW)
    expect(ctx.net_sentiment).toBe(0)
  })

  it('news d’un autre instrument ignorée', () => {
    const ctx = deriveNewsContext(
      [news({ hoursAgo: 1, sentiment: 0.9, instrument: 'btc' })],
      [],
      INSTR,
      'day',
      NOW,
    )
    expect(ctx.net_sentiment).toBe(0)
  })
})

describe('deriveNewsContext — hash déterministe (D-41)', () => {
  it('deux appels sur les mêmes entrées → snapshotContentHash identique', () => {
    const input = [news({ hoursAgo: 1, sentiment: 0.5 })]
    const cal = [calEvent({ hoursAhead: 1, impact: 'High' })]
    const a = deriveNewsContext(input, cal, INSTR, 'day', NOW)
    const b = deriveNewsContext(input, cal, INSTR, 'day', NOW)
    expect(snapshotContentHash(a)).toBe(snapshotContentHash(b))
  })
})
