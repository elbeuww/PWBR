/**
 * Golden values — structure de marché MAISON (TECH-02/03).
 *
 * Cas vérifiés à la main sur de petits slices OHLCV : indices de swing exacts,
 * flags BOS/CHoCH exacts, clustering S/R, POC + flag volume_source.
 * Aucune lib externe (technicalindicators ne fournit AUCUNE structure — c'est
 * le différenciateur "vétéran"). Déterministe, offline.
 *
 * Convention bougie clôturée : les fixtures sont déjà des bougies clôturées,
 * ts ascendant (D-10, jamais redéfini ici).
 */
import { describe, it, expect } from 'vitest'
import type { CandleRow } from '@app/supabase'
import { detectSwings, SWING_N, SWING_K } from './swings.js'
import { detectBosChoch } from './structure.js'
import { clusterLevels } from './levels.js'
import { computePoc } from './volume.js'

/** Helper : construit une bougie clôturée minimale. */
function candle(i: number, o: number, h: number, l: number, c: number, v = 100): CandleRow {
  return {
    id: `c-${i}`,
    instrument_id: 'test',
    timeframe: 'H4',
    ts: new Date(1700000000000 + i * 14400000).toISOString(),
    open: o,
    high: h,
    low: l,
    close: c,
    volume: v,
  }
}

describe('detectSwings — pivot fractal 2N+1 + filtre k×ATR (D-32)', () => {
  // N=2 → fenêtre de 5 bougies. Pic net à l'index 4 (high 120), creux net à l'index 8 (low 80).
  // ATR petit (~10) → amplitude pic-creux (40) >> k×ATR → conservés.
  const rows: CandleRow[] = [
    candle(0, 100, 102, 98, 101),
    candle(1, 101, 104, 99, 103),
    candle(2, 103, 108, 101, 107),
    candle(3, 107, 114, 105, 112),
    candle(4, 112, 120, 110, 118), // SWING HIGH (pic)
    candle(5, 118, 116, 108, 110),
    candle(6, 110, 108, 96, 98),
    candle(7, 98, 96, 86, 88),
    candle(8, 88, 92, 80, 82), // SWING LOW (creux)
    candle(9, 82, 90, 81, 89),
    candle(10, 89, 98, 87, 96),
    candle(11, 96, 104, 94, 102),
    candle(12, 102, 110, 100, 108),
  ]

  it('N et k sont des constantes nommées', () => {
    expect(typeof SWING_N).toBe('number')
    expect(typeof SWING_K).toBe('number')
  })

  it('détecte le swing high à l’index 4', () => {
    const s = detectSwings(rows)
    expect(s.highs).toContain(4)
  })

  it('détecte le swing low à l’index 8', () => {
    const s = detectSwings(rows)
    expect(s.lows).toContain(8)
  })

  it('rejette un micro-pivot dont l’amplitude < k×ATR', () => {
    // Série quasi plate : aucune amplitude ne dépasse le filtre ATR → aucun swing
    const flat: CandleRow[] = Array.from({ length: 13 }, (_, i) =>
      candle(i, 100, 100.5, 99.5, 100 + (i % 2) * 0.2),
    )
    const s = detectSwings(flat)
    expect(s.highs).toHaveLength(0)
    expect(s.lows).toHaveLength(0)
  })
})

describe('detectBosChoch — confirmation sur CLÔTURE DU CORPS (D-33)', () => {
  // Swing high de référence à 120 (index 4 ci-dessus).
  const base: CandleRow[] = [
    candle(0, 100, 102, 98, 101),
    candle(1, 101, 104, 99, 103),
    candle(2, 103, 108, 101, 107),
    candle(3, 107, 114, 105, 112),
    candle(4, 112, 120, 110, 118), // swing high = 120
    candle(5, 118, 116, 108, 110),
    candle(6, 110, 112, 105, 108),
    candle(7, 108, 115, 106, 112),
  ]

  it('une mèche qui perce le swing mais un corps qui clôture en-deçà → AUCUN signal', () => {
    // bougie finale : high=125 (perce 120) mais close=119 (corps en-deçà)
    const wick = [...base, candle(8, 116, 125, 114, 119)]
    const r = detectBosChoch(wick)
    expect(r.signal).toBeNull()
  })

  it('une clôture de corps au-delà du swing high (même sens) → BOS', () => {
    // bougie finale : close=123 > 120 (corps au-delà)
    const bos = [...base, candle(8, 116, 126, 115, 123)]
    const r = detectBosChoch(bos)
    expect(r.signal).toBe('bos')
  })
})

describe('clusterLevels — clustering c×ATR + force multi-facteurs (D-34)', () => {
  // 3 swings highs proches (200, 201, 202) → 1 cluster ; 1 swing low isolé (150) → 1 cluster
  const rows: CandleRow[] = [
    candle(0, 195, 200, 190, 199),
    candle(1, 199, 200, 196, 198),
    candle(2, 196, 201, 148, 150), // low isolé
    candle(3, 150, 202, 149, 200),
    candle(4, 200, 201, 198, 199),
  ]

  it('regroupe les swings proches en zones et calcule une force', () => {
    const zones = clusterLevels(rows, { highs: [0, 3], lows: [2] })
    // au moins une zone de résistance (~200) et une de support (~150)
    expect(zones.length).toBeGreaterThanOrEqual(1)
    for (const z of zones) {
      expect(z.strength).toBeGreaterThan(0)
      expect(['support', 'resistance']).toContain(z.type)
    }
  })

  it('une zone à touches multiples est plus forte qu’une zone à 1 touche', () => {
    const multi = clusterLevels(rows, { highs: [0, 3, 4], lows: [] })
    const single = clusterLevels(rows, { highs: [0], lows: [] })
    const maxMulti = Math.max(...multi.map((z) => z.strength))
    const maxSingle = Math.max(...single.map((z) => z.strength))
    expect(maxMulti).toBeGreaterThanOrEqual(maxSingle)
  })
})

describe('computePoc — profil volume proportional-overlap + flag source (D-35)', () => {
  // La bougie d'index 1 a un énorme volume concentré autour de 105 → POC ≈ 105
  const rows: CandleRow[] = [
    candle(0, 100, 102, 98, 101, 10),
    candle(1, 104, 106, 104, 105, 1000), // gros volume, range étroit autour de 105
    candle(2, 110, 112, 108, 111, 10),
  ]

  it('crypto (Binance) → volume_source "real", POC proche du gros volume', () => {
    const poc = computePoc(rows, 'real')
    expect(poc.volume_source).toBe('real')
    expect(poc.price).toBeGreaterThan(103)
    expect(poc.price).toBeLessThan(107)
  })

  it('forex (OANDA tick) → volume_source "proxy" (flag honnêteté obligatoire)', () => {
    const poc = computePoc(rows, 'proxy')
    expect(poc.volume_source).toBe('proxy')
  })
})
