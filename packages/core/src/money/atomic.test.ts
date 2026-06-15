/**
 * Golden values — conversion monétaire atomique BigInt (zéro float).
 *
 * Point clé (T-04-PREC / Pitfall 4) : 9.02 N'EST PAS représentable exactement
 * en flottant IEEE-754. Toute la chaîne doit rester en BigInt : aucun
 * Number()/parseFloat()/* 1e6. Test déterministe, hors-ligne.
 */
import { describe, it, expect } from 'vitest'
import { USDT_DECIMALS, toAtomic, formatAtomic } from './atomic.js'

describe('USDT_DECIMALS', () => {
  it('vaut 6n (USDT TRC-20)', () => {
    expect(USDT_DECIMALS).toBe(6n)
  })
})

describe('toAtomic — décimal string -> BigInt atomique', () => {
  it('9.02 -> 9020000n (cas NON représentable en float)', () => {
    expect(toAtomic('9.02')).toBe(9020000n)
  })

  it('entier sans décimale : "9" -> 9000000n', () => {
    expect(toAtomic('9')).toBe(9000000n)
  })

  it('"3.01" -> 3010000n', () => {
    expect(toAtomic('3.01')).toBe(3010000n)
  })

  it('précision max 6 décimales : "0.000001" -> 1n', () => {
    expect(toAtomic('0.000001')).toBe(1n)
  })

  it('"0" -> 0n', () => {
    expect(toAtomic('0')).toBe(0n)
  })

  it('throw si plus de 6 décimales : "9.0000001"', () => {
    expect(() => toAtomic('9.0000001')).toThrow()
  })

  it('throw si non numérique : "abc"', () => {
    expect(() => toAtomic('abc')).toThrow()
  })

  it('throw si vide : ""', () => {
    expect(() => toAtomic('')).toThrow()
  })

  it('throw si point sans décimale : "9."', () => {
    expect(() => toAtomic('9.')).toThrow()
  })

  it('throw si décimale sans entier : ".5"', () => {
    expect(() => toAtomic('.5')).toThrow()
  })

  it('throw si signe négatif : "-9.02"', () => {
    expect(() => toAtomic('-9.02')).toThrow()
  })
})

describe('formatAtomic — BigInt atomique -> décimal string', () => {
  it('9020000n -> "9.020000"', () => {
    expect(formatAtomic(9020000n)).toBe('9.020000')
  })

  it('9000000n -> "9.000000"', () => {
    expect(formatAtomic(9000000n)).toBe('9.000000')
  })

  it('1n -> "0.000001"', () => {
    expect(formatAtomic(1n)).toBe('0.000001')
  })

  it('0n -> "0.000000"', () => {
    expect(formatAtomic(0n)).toBe('0.000000')
  })
})

describe('round-trip toAtomic(formatAtomic(x)) === x', () => {
  it('conserve la valeur exacte', () => {
    for (const x of [0n, 1n, 9020000n, 9000000n, 3010000n, 123456789n]) {
      expect(toAtomic(formatAtomic(x))).toBe(x)
    }
  })
})
