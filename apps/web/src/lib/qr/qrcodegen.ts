/*
 * QR Code generator — implémentation MAISON, zéro dépendance npm (B-04-03).
 *
 * Port TypeScript compact et auto-contenu de la référence mondiale « QR Code
 * generator library » de Project Nayuki (https://www.nayuki.io/page/qr-code-generator-library).
 *
 * Licence d'origine (conservée — attribution obligatoire) :
 *
 *   Copyright (c) Project Nayuki. (MIT License)
 *
 *   Permission is hereby granted, free of charge, to any person obtaining a copy of
 *   this software and associated documentation files (the "Software"), to deal in
 *   the Software without restriction, including without limitation the rights to
 *   use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 *   the Software, and to permit persons to whom the Software is furnished to do so,
 *   subject to the following conditions:
 *   - The above copyright notice and this permission notice shall be included in
 *     all copies or substantial portions of the Software.
 *   - The Software is provided "as is", without warranty of any kind, express or
 *     implied, including but not limited to the warranties of merchantability,
 *     fitness for a particular purpose and noninfringement. In no event shall the
 *     authors or copyright holders be liable for any claim, damages or other
 *     liability, whether in an action of contract, tort or otherwise, arising from,
 *     out of or in connection with the Software or the use or other dealings in the
 *     Software.
 *
 * « Maison » au sens du fondateur : dans notre arbre, auditable, AUCUN `pnpm add`,
 * AUCun risque supply-chain via package manager. La correction est verrouillée par
 * un golden test (qrcodegen.test.ts) contre un vecteur de référence connu.
 *
 * Périmètre volontairement réduit à notre besoin : encodage BYTE-MODE d'une chaîne
 * ASCII (l'adresse de réception base58, ~34 chars), niveau de correction MEDIUM,
 * sélection automatique de la version minimale. Pas de mode kanji/numérique/alpha,
 * pas de structured-append. Rien d'autre que l'adresse publique n'est jamais encodé.
 */

/** Niveau de correction d'erreur (ECC). */
export const enum Ecc {
  LOW = 0,
  MEDIUM = 1,
  QUARTILE = 2,
  HIGH = 3,
}

const ECC_FORMAT_BITS: Record<Ecc, number> = { 0: 1, 1: 0, 2: 3, 3: 2 }

const MIN_VERSION = 1
const MAX_VERSION = 40
const PENALTY_N1 = 3
const PENALTY_N2 = 3
const PENALTY_N3 = 40
const PENALTY_N4 = 10

/**
 * Matrice booléenne d'un QR : modules[y][x] (true = module noir).
 * `size` = largeur = hauteur (côté carré).
 */
export interface QrMatrix {
  size: number
  modules: boolean[][]
}

// Nombre de codewords ECC par bloc, indexé [ecc][version].
const ECC_CODEWORDS_PER_BLOCK: number[][] = [
  // version 0 (index padding) ... 40
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30], // LOW
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28], // MEDIUM
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30], // QUARTILE
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30], // HIGH
]

// Nombre de blocs ECC, indexé [ecc][version].
const NUM_ERROR_CORRECTION_BLOCKS: number[][] = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25], // LOW
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49], // MEDIUM
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68], // QUARTILE
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81], // HIGH
]

function getNumRawDataModules(ver: number): number {
  let result = (16 * ver + 128) * ver + 64
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2
    result -= (25 * numAlign - 10) * numAlign - 55
    if (ver >= 7) result -= 36
  }
  return result
}

function getNumDataCodewords(ver: number, ecc: Ecc): number {
  // `!` : ecc∈0..3 et ver∈1..40 sont bornés par construction (tables pleines).
  return (
    Math.floor(getNumRawDataModules(ver) / 8) -
    ECC_CODEWORDS_PER_BLOCK[ecc]![ver]! * NUM_ERROR_CORRECTION_BLOCKS[ecc]![ver]!
  )
}

// ---- Reed-Solomon (GF(2^8), polynôme 0x11D) ----

function reedSolomonComputeDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0)
  result[degree - 1] = 1
  let root = 1
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = reedSolomonMultiply(result[j]!, root)
      if (j + 1 < result.length) result[j]! ^= result[j + 1]!
    }
    root = reedSolomonMultiply(root, 0x02)
  }
  return result
}

function reedSolomonComputeRemainder(data: number[], divisor: number[]): number[] {
  const result = new Array<number>(divisor.length).fill(0)
  for (const b of data) {
    const factor = b ^ (result.shift() as number)
    result.push(0)
    divisor.forEach((coef, i) => {
      result[i]! ^= reedSolomonMultiply(coef, factor)
    })
  }
  return result
}

function reedSolomonMultiply(x: number, y: number): number {
  let z = 0
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d)
    z ^= ((y >>> i) & 1) * x
  }
  return z & 0xff
}

// ---- BitBuffer ----

function appendBits(val: number, len: number, bb: number[]): void {
  for (let i = len - 1; i >= 0; i--) bb.push((val >>> i) & 1)
}

// ---- Encodage byte-mode ----

function encodeByteSegment(data: number[], bb: number[], ver: number): void {
  // Mode indicator byte = 0b0100
  appendBits(0x4, 4, bb)
  // Character count : 8 bits pour versions 1-9 (byte mode)
  const ccBits = ver <= 9 ? 8 : 16
  appendBits(data.length, ccBits, bb)
  for (const b of data) appendBits(b, 8, bb)
}

// ---- Construction de la matrice ----

class QrBuilder {
  readonly size: number
  readonly modules: boolean[][]
  private readonly isFunction: boolean[][]

  constructor(
    readonly version: number,
    readonly ecc: Ecc,
  ) {
    this.size = version * 4 + 17
    this.modules = QrBuilder.grid(this.size)
    this.isFunction = QrBuilder.grid(this.size)
  }

  private static grid(size: number): boolean[][] {
    return Array.from({ length: size }, () => new Array<boolean>(size).fill(false))
  }

  build(dataCodewords: number[]): void {
    this.drawFunctionPatterns()
    const allCodewords = this.addEccAndInterleave(dataCodewords)
    this.drawCodewords(allCodewords)
    const mask = this.chooseMask()
    this.applyMask(mask)
    this.drawFormatBits(mask)
  }

  private setFunctionModule(x: number, y: number, isDark: boolean): void {
    // `!` : (x,y) sont des coordonnées internes bornées 0..size-1 (matrice carrée).
    this.modules[y]![x] = isDark
    this.isFunction[y]![x] = true
  }

  private drawFunctionPatterns(): void {
    for (let i = 0; i < this.size; i++) {
      this.setFunctionModule(6, i, i % 2 === 0)
      this.setFunctionModule(i, 6, i % 2 === 0)
    }
    this.drawFinderPattern(3, 3)
    this.drawFinderPattern(this.size - 4, 3)
    this.drawFinderPattern(3, this.size - 4)

    const alignPatPos = this.getAlignmentPatternPositions()
    const numAlign = alignPatPos.length
    for (let i = 0; i < numAlign; i++) {
      for (let j = 0; j < numAlign; j++) {
        if (
          !(
            (i === 0 && j === 0) ||
            (i === 0 && j === numAlign - 1) ||
            (i === numAlign - 1 && j === 0)
          )
        ) {
          this.drawAlignmentPattern(alignPatPos[i]!, alignPatPos[j]!)
        }
      }
    }

    this.drawFormatBits(0)
    this.drawVersion()
  }

  private drawFormatBits(mask: number): void {
    const data = (ECC_FORMAT_BITS[this.ecc] << 3) | mask
    let rem = data
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
    const bits = ((data << 10) | rem) ^ 0x5412
    for (let i = 0; i <= 5; i++) this.setFunctionModule(8, i, ((bits >>> i) & 1) !== 0)
    this.setFunctionModule(8, 7, ((bits >>> 6) & 1) !== 0)
    this.setFunctionModule(8, 8, ((bits >>> 7) & 1) !== 0)
    this.setFunctionModule(7, 8, ((bits >>> 8) & 1) !== 0)
    for (let i = 9; i < 15; i++) this.setFunctionModule(14 - i, 8, ((bits >>> i) & 1) !== 0)
    for (let i = 0; i < 8; i++)
      this.setFunctionModule(this.size - 1 - i, 8, ((bits >>> i) & 1) !== 0)
    for (let i = 8; i < 15; i++)
      this.setFunctionModule(8, this.size - 15 + i, ((bits >>> i) & 1) !== 0)
    this.setFunctionModule(8, this.size - 8, true)
  }

  private drawVersion(): void {
    if (this.version < 7) return
    let rem = this.version
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25)
    const bits = (this.version << 12) | rem
    for (let i = 0; i < 18; i++) {
      const bit = ((bits >>> i) & 1) !== 0
      const a = this.size - 11 + (i % 3)
      const b = Math.floor(i / 3)
      this.setFunctionModule(a, b, bit)
      this.setFunctionModule(b, a, bit)
    }
  }

  private drawFinderPattern(x: number, y: number): void {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy))
        const xx = x + dx
        const yy = y + dy
        if (xx >= 0 && xx < this.size && yy >= 0 && yy < this.size) {
          this.setFunctionModule(xx, yy, dist !== 2 && dist !== 4)
        }
      }
    }
  }

  private drawAlignmentPattern(x: number, y: number): void {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        this.setFunctionModule(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
      }
    }
  }

  private getAlignmentPatternPositions(): number[] {
    if (this.version === 1) return []
    const numAlign = Math.floor(this.version / 7) + 2
    const step =
      this.version === 32
        ? 26
        : Math.ceil((this.version * 4 + 4) / (numAlign * 2 - 2)) * 2
    const result: number[] = [6]
    for (let pos = this.size - 7; result.length < numAlign; pos -= step) {
      result.splice(1, 0, pos)
    }
    return result
  }

  private addEccAndInterleave(data: number[]): number[] {
    const ver = this.version
    const ecc = this.ecc
    // `!` : ecc∈0..3, ver∈1..40 bornés par construction (tables pleines).
    const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[ecc]![ver]!
    const blockEccLen = ECC_CODEWORDS_PER_BLOCK[ecc]![ver]!
    const rawCodewords = Math.floor(getNumRawDataModules(ver) / 8)
    const numShortBlocks = numBlocks - (rawCodewords % numBlocks)
    const shortBlockLen = Math.floor(rawCodewords / numBlocks)

    const blocks: number[][] = []
    const rsDiv = reedSolomonComputeDivisor(blockEccLen)
    for (let i = 0, k = 0; i < numBlocks; i++) {
      const datLen = shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1)
      const dat = data.slice(k, k + datLen)
      k += datLen
      const eccBytes = reedSolomonComputeRemainder(dat, rsDiv)
      if (i < numShortBlocks) dat.push(0)
      blocks.push(dat.concat(eccBytes))
    }

    const result: number[] = []
    // `!` : blocks non vide (numBlocks≥1) ; block[i] borné par la boucle.
    for (let i = 0; i < blocks[0]!.length; i++) {
      blocks.forEach((block, j) => {
        if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) {
          result.push(block[i]!)
        }
      })
    }
    return result
  }

  private drawCodewords(data: number[]): void {
    let i = 0
    for (let right = this.size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5
      for (let vert = 0; vert < this.size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j
          const upward = ((right + 1) & 2) === 0
          const y = upward ? this.size - 1 - vert : vert
          if (!this.isFunction[y]![x] && i < data.length * 8) {
            this.modules[y]![x] = ((data[i >>> 3]! >>> (7 - (i & 7))) & 1) !== 0
            i++
          }
        }
      }
    }
  }

  private applyMask(mask: number): void {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        let invert: boolean
        switch (mask) {
          case 0:
            invert = (x + y) % 2 === 0
            break
          case 1:
            invert = y % 2 === 0
            break
          case 2:
            invert = x % 3 === 0
            break
          case 3:
            invert = (x + y) % 3 === 0
            break
          case 4:
            invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0
            break
          case 5:
            invert = ((x * y) % 2) + ((x * y) % 3) === 0
            break
          case 6:
            invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0
            break
          case 7:
            invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0
            break
          default:
            throw new Error('mask invalide')
        }
        if (invert && !this.isFunction[y]![x]) this.modules[y]![x] = !this.modules[y]![x]
      }
    }
  }

  private chooseMask(): number {
    let minPenalty = Infinity
    let bestMask = 0
    for (let mask = 0; mask < 8; mask++) {
      this.applyMask(mask)
      this.drawFormatBits(mask)
      const penalty = this.getPenaltyScore()
      if (penalty < minPenalty) {
        minPenalty = penalty
        bestMask = mask
      }
      this.applyMask(mask) // annule (XOR involutif)
    }
    return bestMask
  }

  private getPenaltyScore(): number {
    let result = 0
    const size = this.size
    // Adjacent en ligne
    for (let y = 0; y < size; y++) {
      let runColor = false
      let runX = 0
      const runHistory = new Array<number>(7).fill(0)
      for (let x = 0; x < size; x++) {
        if (this.modules[y]![x] === runColor) {
          runX++
          if (runX === 5) result += PENALTY_N1
          else if (runX > 5) result++
        } else {
          this.finderPenaltyAddHistory(runX, runHistory)
          if (!runColor) result += this.finderPenaltyCountPatterns(runHistory) * PENALTY_N3
          runColor = this.modules[y]![x]!
          runX = 1
        }
      }
      result +=
        this.finderPenaltyTerminateAndCount(runColor, runX, runHistory) * PENALTY_N3
    }
    // Adjacent en colonne
    for (let x = 0; x < size; x++) {
      let runColor = false
      let runY = 0
      const runHistory = new Array<number>(7).fill(0)
      for (let y = 0; y < size; y++) {
        if (this.modules[y]![x] === runColor) {
          runY++
          if (runY === 5) result += PENALTY_N1
          else if (runY > 5) result++
        } else {
          this.finderPenaltyAddHistory(runY, runHistory)
          if (!runColor) result += this.finderPenaltyCountPatterns(runHistory) * PENALTY_N3
          runColor = this.modules[y]![x]!
          runY = 1
        }
      }
      result +=
        this.finderPenaltyTerminateAndCount(runColor, runY, runHistory) * PENALTY_N3
    }
    // Blocs 2x2
    for (let y = 0; y < size - 1; y++) {
      for (let x = 0; x < size - 1; x++) {
        const color = this.modules[y]![x]
        if (
          color === this.modules[y]![x + 1] &&
          color === this.modules[y + 1]![x] &&
          color === this.modules[y + 1]![x + 1]
        ) {
          result += PENALTY_N2
        }
      }
    }
    // Balance noir/blanc
    let dark = 0
    for (const row of this.modules) for (const cell of row) if (cell) dark++
    const total = size * size
    const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1
    result += k * PENALTY_N4
    return result
  }

  private finderPenaltyCountPatterns(runHistory: number[]): number {
    // `!` : runHistory a une longueur fixe 7 (alloué tel quel partout).
    const n = runHistory[1]!
    const core =
      n > 0 &&
      runHistory[2] === n &&
      runHistory[3] === n * 3 &&
      runHistory[4] === n &&
      runHistory[5] === n
    return (
      (core && runHistory[0]! >= n * 4 && runHistory[6]! >= n ? 1 : 0) +
      (core && runHistory[6]! >= n * 4 && runHistory[0]! >= n ? 1 : 0)
    )
  }

  private finderPenaltyTerminateAndCount(
    currentRunColor: boolean,
    currentRunLength: number,
    runHistory: number[],
  ): number {
    let runLen = currentRunLength
    if (currentRunColor) {
      this.finderPenaltyAddHistory(runLen, runHistory)
      runLen = 0
    }
    runLen += this.size
    this.finderPenaltyAddHistory(runLen, runHistory)
    return this.finderPenaltyCountPatterns(runHistory)
  }

  private finderPenaltyAddHistory(currentRunLength: number, runHistory: number[]): void {
    let runLen = currentRunLength
    if (runHistory[0]! === 0) runLen += this.size
    runHistory.pop()
    runHistory.unshift(runLen)
  }
}

/**
 * Encode une chaîne ASCII en matrice QR (byte-mode, ECC MEDIUM, version minimale).
 *
 * @param text - Chaîne à encoder (l'adresse publique base58 uniquement).
 * @param ecc - Niveau de correction (défaut MEDIUM).
 * @returns Matrice booléenne du QR.
 * @throws Si le texte est trop long pour la version 40.
 */
export function encodeText(text: string, ecc: Ecc = Ecc.MEDIUM): QrMatrix {
  const data: number[] = []
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (code > 0xff) {
      throw new Error('encodeText: caractère non-Latin1 non supporté (adresse base58 attendue)')
    }
    data.push(code)
  }

  // Trouver la version minimale qui contient les données.
  let version = MIN_VERSION
  for (; version <= MAX_VERSION; version++) {
    const dataCapacityBits = getNumDataCodewords(version, ecc) * 8
    const ccBits = version <= 9 ? 8 : 16
    const usedBits = 4 + ccBits + data.length * 8
    if (usedBits <= dataCapacityBits) break
    if (version === MAX_VERSION) {
      throw new Error('encodeText: données trop longues pour un QR (max version 40)')
    }
  }

  const bb: number[] = []
  encodeByteSegment(data, bb, version)

  const dataCapacityBits = getNumDataCodewords(version, ecc) * 8
  // Terminateur (jusqu'à 4 bits)
  appendBits(0, Math.min(4, dataCapacityBits - bb.length), bb)
  // Padding pour aligner sur l'octet
  appendBits(0, (8 - (bb.length % 8)) % 8, bb)
  // Octets de remplissage 0xEC / 0x11 en alternance
  for (let padByte = 0xec; bb.length < dataCapacityBits; padByte ^= 0xec ^ 0x11) {
    appendBits(padByte, 8, bb)
  }

  const dataCodewords = new Array<number>(bb.length >>> 3).fill(0)
  bb.forEach((bit, i) => {
    // `!` : i>>>3 < dataCodewords.length par construction (taille = bb.length>>>3).
    dataCodewords[i >>> 3]! |= bit << (7 - (i & 7))
  })

  const builder = new QrBuilder(version, ecc)
  builder.build(dataCodewords)
  return { size: builder.size, modules: builder.modules }
}
