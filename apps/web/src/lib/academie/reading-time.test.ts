/**
 * reading-time.test.ts — golden values du temps de lecture déterministe (D-10).
 *
 * Behavior testé :
 *  - `computeReadingTime` est déterministe (même entrée → même sortie) ;
 *  - 3 golden values assertées en dur (fr/en/ar) pour des corps de longueur connue ;
 *  - indépendant du pipeline MDX (calcul pur sur le corps brut, Q4).
 *
 * Golden values calculées via la lib `reading-time` (Math.ceil des minutes).
 */
import { describe, it, expect } from 'vitest'
import { computeReadingTime } from './reading-time'

const fr = 'Le trading discipliné repose sur la gestion du risque. '.repeat(40)
const en = 'Risk management is the core of disciplined trading practice. '.repeat(40)
const ar = 'إدارة المخاطر هي جوهر التداول المنضبط والناجح دائما. '.repeat(40)

describe('computeReadingTime: golden values (D-10)', () => {
  it('corps FR → 2 minutes', () => {
    expect(computeReadingTime(fr)).toBe(2)
  })

  it('corps EN → 2 minutes', () => {
    expect(computeReadingTime(en)).toBe(2)
  })

  it('corps AR → 2 minutes', () => {
    expect(computeReadingTime(ar)).toBe(2)
  })
})

describe('computeReadingTime: déterminisme', () => {
  it('même entrée → même sortie (idempotent)', () => {
    expect(computeReadingTime(fr)).toBe(computeReadingTime(fr))
  })

  it('corps vide → 0 minute', () => {
    expect(computeReadingTime('')).toBe(0)
  })

  it('retourne un entier (Math.ceil)', () => {
    expect(Number.isInteger(computeReadingTime(en))).toBe(true)
  })
})
