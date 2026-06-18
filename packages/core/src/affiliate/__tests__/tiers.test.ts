/**
 * Tests golden de la grille de paliers d'affiliation + commission BigInt
 * (AFF-03, D-01/D-02, Q3). Miroir bit-à-bit de la fonction SQL `affiliate_rate_bps`
 * (migration 0016) : toute divergence aux bornes casse un test (T-07-DRIFT).
 *
 * Le palier (taux bps) est dérivé du NOMBRE D'INSCRITS via le code (audience, D-02),
 * pas des abonnés actifs. La commission = (base_atomic × rate_bps) / 10000 en
 * division entière BigInt (troncature/floor, zéro float, T-07-FLOAT).
 */
import { describe, expect, it } from 'vitest'
import { affiliateRateBps, computeCommissionAtomic, TIERS } from '../tiers.js'

describe('affiliateRateBps — grille D-01 (miroir SQL 0016)', () => {
  // Table golden : signups → bps attendus aux bornes basses ET hautes des 8 paliers.
  const cases: ReadonlyArray<readonly [number, number]> = [
    [0, 0],
    [1, 800],
    [99, 800],
    [100, 1200],
    [500, 1200],
    [501, 1400],
    [600, 1400], // exemple Pitfall 2 — palier 3
    [1000, 1400],
    [1001, 1500],
    [5000, 1500],
    [5001, 1600],
    [10000, 1600],
    [10001, 1700],
    [25000, 1700],
    [25001, 1800],
    [50000, 2000],
    [50001, 2000],
  ]

  for (const [signups, bps] of cases) {
    it(`${signups} inscrits → ${bps} bps`, () => {
      expect(affiliateRateBps(signups)).toBe(bps)
    })
  }

  it('0 inscrit → 0 bps (aucun palier atteint)', () => {
    expect(affiliateRateBps(0)).toBe(0)
  })

  it('50001 → 2000 bps (plafond 20 %)', () => {
    expect(affiliateRateBps(50001)).toBe(2000)
  })
})

describe('TIERS — table source (8 paliers)', () => {
  it('contient exactement 8 paliers', () => {
    expect(TIERS).toHaveLength(8)
  })

  it('chaque borne de TIERS rend le bon bps via affiliateRateBps', () => {
    for (const tier of TIERS) {
      expect(affiliateRateBps(tier.minSignups)).toBe(tier.rateBps)
    }
  })

  it('les bps couvrent 800..2000 (8 % à 20 %)', () => {
    const bpsValues = TIERS.map((t) => t.rateBps)
    expect(Math.min(...bpsValues)).toBe(800)
    expect(Math.max(...bpsValues)).toBe(2000)
  })
})

describe('computeCommissionAtomic — BigInt troncature (Q3, T-07-FLOAT)', () => {
  it('9 USDT (9_000_000n) × 1400 bps → 1_260_000n', () => {
    expect(computeCommissionAtomic(9_000_000n, 1400)).toBe(1_260_000n)
  })

  it('arrondi floor sur cas non divisible : 1n × 800 → 0n', () => {
    expect(computeCommissionAtomic(1n, 800)).toBe(0n)
  })

  it('floor : 12345n × 1500 → 1851n (18517500 / 10000 = 1851.75 → 1851)', () => {
    expect(computeCommissionAtomic(12345n, 1500)).toBe(1851n)
  })

  it('rate 0 bps → 0n', () => {
    expect(computeCommissionAtomic(9_000_000n, 0)).toBe(0n)
  })

  it('exact sur gros montant atomique > 2^53 (zéro perte float)', () => {
    // 1_000_000 USDT = 1e12 atomique ; × 2000 bps / 10000 = 2e11 atomique
    const base = 1_000_000_000_000n
    expect(computeCommissionAtomic(base, 2000)).toBe(200_000_000_000n)
  })

  it('base 0n → 0n', () => {
    expect(computeCommissionAtomic(0n, 2000)).toBe(0n)
  })
})
