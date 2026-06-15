/**
 * Golden values — normalisation d'adresse TRON base58check (hex <-> base58).
 *
 * Golden values figées dans __fixtures__/GOLDEN.md (déterministes, double-SHA256
 * crypto natif, hors-ligne). T-04-ADDR : un checksum corrompu DOIT throw — on ne
 * compare jamais une adresse non vérifiée. T-04-CRYPTO : sha256 via `crypto`
 * natif, jamais réimplémenté. Aucune dépendance tronweb.
 */
import { describe, it, expect } from 'vitest'
import { base58ToHex, hexToBase58, sameAddress } from './address.js'

// Golden values (GOLDEN.md)
const USDT_B58 = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
const USDT_HEX = '41a614f803b6fd780986a42c78ec9c7f77e6ded13c'
const RECV_B58 = 'TL1y3hnprGvKWAdAGRjZnoWJmEp5q8D9qR'
const RECV_HEX = '416e36db7034c9c00f631e7c95e44529525a09a10f'
const CORRUPT_B58 = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6u'

describe('base58ToHex', () => {
  it('TR7NH... -> hex golden (préfixe 41, 42 chars hex)', () => {
    const hex = base58ToHex(USDT_B58)
    expect(hex).toBe(USDT_HEX)
    expect(hex).toMatch(/^41[0-9a-f]{40}$/)
    expect(hex).toHaveLength(42)
  })

  it('throw si checksum corrompu', () => {
    expect(() => base58ToHex(CORRUPT_B58)).toThrow()
  })

  it('throw si caractère hors alphabet base58', () => {
    expect(() => base58ToHex('TR7NH0OIl...')).toThrow()
  })
})

describe('hexToBase58', () => {
  it('hex golden -> TR7NH... (round-trip)', () => {
    expect(hexToBase58(USDT_HEX)).toBe(USDT_B58)
  })

  it('round-trip base58 -> hex -> base58 conserve l\'adresse', () => {
    expect(hexToBase58(base58ToHex(RECV_B58))).toBe(RECV_B58)
  })
})

describe('sameAddress — normalisation hex <-> base58', () => {
  it('base58 vs hex de la MÊME adresse === true', () => {
    expect(sameAddress(USDT_B58, USDT_HEX)).toBe(true)
  })

  it('adresse de réception base58 vs hex === true', () => {
    expect(sameAddress(RECV_B58, RECV_HEX)).toBe(true)
  })

  it('hex avec préfixe 0x toléré', () => {
    expect(sameAddress(USDT_B58, '0x' + USDT_HEX)).toBe(true)
  })

  it('deux adresses différentes === false', () => {
    expect(sameAddress(USDT_B58, RECV_B58)).toBe(false)
  })

  it('comparaison insensible à la casse hex', () => {
    expect(sameAddress(USDT_HEX.toUpperCase(), USDT_B58)).toBe(true)
  })
})
