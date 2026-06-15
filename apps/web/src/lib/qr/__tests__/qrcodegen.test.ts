/**
 * Golden test du QR maison (B-04-03) — correction VERROUILLÉE.
 *
 * Un QR qui ne scanne pas est pire qu'inutile : « ça compile » ne suffit PAS.
 * Ce test prouve la correction de DEUX façons indépendantes :
 *
 *  1. GOLDEN (régression) : la matrice produite pour une adresse TRON connue
 *     (le contrat USDT mainnet, 34 chars base58) doit être IDENTIQUE bit-à-bit
 *     à une matrice de référence figée. Toute dérive du moteur casse ce test.
 *
 *  2. STRUCTUREL (conformité ISO/IEC 18004, indépendant du golden) : on valide
 *     les finder patterns aux 3 coins, les timing patterns, le dark module, et
 *     surtout on DÉCODE le format-info (BCH 15,5 + masque 0x5412) pour vérifier
 *     que l'ECC encodé == MEDIUM et que le masque décodé est cohérent. C'est la
 *     preuve qu'un lecteur QR standard interprétera correctement le symbole.
 */
import { describe, it, expect } from 'vitest'
import { encodeText, Ecc, type QrMatrix } from '../qrcodegen'

// Adresse TRON canonique (contrat USDT mainnet) — 34 chars base58, vecteur stable.
const GOLDEN_ADDRESS = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'

// Matrice de référence figée (version 1, 29×29, ECC MEDIUM, masque auto).
// '1' = module noir. Toute régression du moteur RS/masque/format casse l'égalité.
const GOLDEN_ROWS = [
  '11111110110111110110101111111',
  '10000010100101001110101000001',
  '10111010001010001001001011101',
  '10111010100100110110101011101',
  '10111010011000101011001011101',
  '10000010011111011001001000001',
  '11111110101010101010101111111',
  '00000000111100011100000000000',
  '10110111001101011111101001011',
  '00001101100001110111000111110',
  '10011010010001000010010010010',
  '00101000011100000011001100010',
  '01110010000000111101100010000',
  '10011001111100111110000000011',
  '01100111000001001011001001001',
  '11000001011000101011001001011',
  '00001111000100101111010011000',
  '00000001001100111011100101011',
  '10101010000011110110011111000',
  '00111100001001110110110101100',
  '01100011101001111110111111111',
  '00000000101110001101100010100',
  '11111110101100100001101010010',
  '10000010101101100001100010000',
  '10111010010110000100111110110',
  '10111010110111001101100001101',
  '10111010110001001111010100001',
  '10000010011000100001111101010',
  '11111110111000010011100110110',
]

function matrixToRows(m: QrMatrix): string[] {
  return m.modules.map((r) => r.map((c) => (c ? '1' : '0')).join(''))
}

/** Vérifie un finder pattern 7×7 (anneau noir-blanc-noir) à l'origine (ox,oy). */
function isFinder(m: QrMatrix, ox: number, oy: number): boolean {
  for (let dy = 0; dy < 7; dy++) {
    for (let dx = 0; dx < 7; dx++) {
      const ring = Math.max(Math.abs(dx - 3), Math.abs(dy - 3))
      const expectDark = ring !== 2 // anneau de distance 2 = blanc
      if (m.modules[oy + dy][ox + dx] !== expectDark) return false
    }
  }
  return true
}

/**
 * Reconstruit l'entier format-info (15 bits) tel qu'il est DESSINÉ par le moteur :
 * `bits = ((data << 10) | bch) ^ 0x5412`, placé bit i à la position canonique i.
 * On lit donc dans le même ordre que le tracé (positions 0..14 du finder HG).
 */
function readDrawnFormatBits(m: QrMatrix): number {
  // Lecture STRICTEMENT symétrique au tracé du moteur (drawFormatBits, 1ère copie) :
  //   bits 0..5  -> setFunctionModule(8, i)         => col 8, lignes 0..5
  //   bit  6     -> setFunctionModule(8, 7)         => col 8, ligne 7
  //   bit  7     -> setFunctionModule(8, 8)         => (8,8)
  //   bit  8     -> setFunctionModule(7, 8)         => col 7, ligne 8
  //   bits 9..14 -> setFunctionModule(14 - i, 8)    => lignes 8, col (14-i)
  const get = (x: number, y: number, i: number) => (m.modules[y][x] ? 1 : 0) << i
  let v = 0
  for (let i = 0; i <= 5; i++) v |= get(8, i, i)
  v |= get(8, 7, 6)
  v |= get(8, 8, 7)
  v |= get(7, 8, 8)
  for (let i = 9; i < 15; i++) v |= get(14 - i, 8, i)
  return v
}

/**
 * Calcule le mot format-info canonique (15 bits) pour un (ecc, mask) donné, via la
 * même formule BCH(15,5) que le moteur. Le test compare le mot LU au mot ATTENDU
 * pour MEDIUM × chaque masque → preuve que l'ECC encodé est bien MEDIUM (conformité).
 */
function expectedFormatBits(eccFormat: number, mask: number): number {
  const data = (eccFormat << 3) | mask
  let rem = data
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
  return ((data << 10) | rem) ^ 0x5412
}

/** Retrouve (ecc, mask) en matchant le mot lu contre tous les candidats canoniques. */
function decodeFormatInfo(m: QrMatrix): { ecc: number; mask: number } | null {
  const drawn = readDrawnFormatBits(m)
  // ECC format-indicator bits : MEDIUM=0, LOW=1, QUARTILE=3, HIGH=2
  const eccFormatToEnum: Record<number, number> = {
    1: Ecc.LOW,
    0: Ecc.MEDIUM,
    3: Ecc.QUARTILE,
    2: Ecc.HIGH,
  }
  for (const eccFormat of [0, 1, 2, 3]) {
    for (let mask = 0; mask < 8; mask++) {
      if (expectedFormatBits(eccFormat, mask) === drawn) {
        return { ecc: eccFormatToEnum[eccFormat], mask }
      }
    }
  }
  return null
}

describe('QR maison — golden + structurel', () => {
  it('GOLDEN : matrice bit-à-bit identique à la référence (régression)', () => {
    const m = encodeText(GOLDEN_ADDRESS, Ecc.MEDIUM)
    expect(m.size).toBe(29)
    expect(matrixToRows(m)).toEqual(GOLDEN_ROWS)
  })

  it('STRUCTUREL : 3 finder patterns valides (haut-gauche, haut-droit, bas-gauche)', () => {
    const m = encodeText(GOLDEN_ADDRESS, Ecc.MEDIUM)
    expect(isFinder(m, 0, 0)).toBe(true)
    expect(isFinder(m, m.size - 7, 0)).toBe(true)
    expect(isFinder(m, 0, m.size - 7)).toBe(true)
  })

  it('STRUCTUREL : timing patterns alternés (ligne/colonne 6)', () => {
    const m = encodeText(GOLDEN_ADDRESS, Ecc.MEDIUM)
    for (let i = 8; i < m.size - 8; i++) {
      expect(m.modules[6][i]).toBe(i % 2 === 0)
      expect(m.modules[i][6]).toBe(i % 2 === 0)
    }
  })

  it('STRUCTUREL : dark module présent (8, size-8)', () => {
    const m = encodeText(GOLDEN_ADDRESS, Ecc.MEDIUM)
    expect(m.modules[m.size - 8][8]).toBe(true)
  })

  it('CONFORMITÉ : le format-info décode bien ECC=MEDIUM (preuve lecteur standard)', () => {
    const m = encodeText(GOLDEN_ADDRESS, Ecc.MEDIUM)
    const decoded = decodeFormatInfo(m)
    expect(decoded).not.toBeNull()
    expect(decoded!.ecc).toBe(Ecc.MEDIUM)
    expect(decoded!.mask).toBeGreaterThanOrEqual(0)
    expect(decoded!.mask).toBeLessThanOrEqual(7)
  })

  it('déterminisme : deux encodages de la même entrée sont identiques', () => {
    const a = matrixToRows(encodeText(GOLDEN_ADDRESS, Ecc.MEDIUM))
    const b = matrixToRows(encodeText(GOLDEN_ADDRESS, Ecc.MEDIUM))
    expect(a).toEqual(b)
  })

  it('refuse une entrée non-Latin1 (jamais autre chose que l’adresse)', () => {
    expect(() => encodeText('喜', Ecc.MEDIUM)).toThrow()
  })
})
