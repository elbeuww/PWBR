/**
 * queries.sanitize.test.ts — garde-fou anti-injection du curseur keyset de la table
 * utilisateurs superadmin (Plan 20-03, Task 1 ; threat T-20-13).
 *
 * Behavior testé :
 *  - un curseur dont `createdAt` n'est pas ISO ou `id` n'est pas UUID → null (1re page),
 *    JAMAIS interpolé dans `.or()` (une virgule/parenthèse ne peut survivre).
 *  - un curseur ISO+UUID valide est conservé tel quel.
 *  - le décodage d'un jeton opaque corrompu → null (tolérant, jamais throw).
 *
 * Analog : la même garde existe verbatim dans lib/watchlist/queries.ts (19-03).
 */
import { describe, it, expect } from 'vitest'
import { sanitizeCursor } from '../queries'
import { decodeCursor, encodeCursor } from '../../keyset/cursor'

const VALID_TS = '2026-06-26T12:34:56.789Z'
const VALID_UUID = '11111111-2222-3333-4444-555555555555'

describe('sanitizeCursor — anti-injection keyset (T-20-13)', () => {
  it('curseur ISO+UUID valide → conservé', () => {
    expect(sanitizeCursor({ createdAt: VALID_TS, id: VALID_UUID })).toEqual({
      createdAt: VALID_TS,
      id: VALID_UUID,
    })
  })

  it('null → null (1re page)', () => {
    expect(sanitizeCursor(null)).toBeNull()
  })

  it('createdAt non-ISO → null', () => {
    expect(sanitizeCursor({ createdAt: 'not-a-date', id: VALID_UUID })).toBeNull()
  })

  it('id non-UUID → null', () => {
    expect(sanitizeCursor({ createdAt: VALID_TS, id: 'not-a-uuid' })).toBeNull()
  })

  it('payload d’injection (virgule/parenthèse dans id) → null', () => {
    const injected = { createdAt: VALID_TS, id: `1,and(role.eq.superadmin)` }
    expect(sanitizeCursor(injected)).toBeNull()
  })

  it('createdAt portant une virgule (break-out .or()) → null', () => {
    const injected = { createdAt: `${VALID_TS},id.gt.0`, id: VALID_UUID }
    expect(sanitizeCursor(injected)).toBeNull()
  })
})

describe('sanitizeCursor ∘ decodeCursor — round-trip opaque', () => {
  it('jeton encodé d’un tuple valide survit au round-trip', () => {
    const token = encodeCursor({ createdAt: VALID_TS, id: VALID_UUID })
    expect(sanitizeCursor(decodeCursor(token))).toEqual({
      createdAt: VALID_TS,
      id: VALID_UUID,
    })
  })

  it('jeton encodé d’un tuple injecté → null après sanitize', () => {
    const token = encodeCursor({ createdAt: VALID_TS, id: 'x,or(true)' })
    expect(sanitizeCursor(decodeCursor(token))).toBeNull()
  })

  it('jeton opaque corrompu → null (tolérant)', () => {
    expect(sanitizeCursor(decodeCursor('not-base64-$$$'))).toBeNull()
  })
})
