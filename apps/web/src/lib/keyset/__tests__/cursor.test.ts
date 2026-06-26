/**
 * cursor.test.ts — garde-fou du curseur keyset opaque (Plan 19-03, Task 1 ; UDASH-02).
 *
 * Behavior testé :
 *  - round-trip : decodeCursor(encodeCursor(c)) reproduit le tuple (createdAt, id).
 *  - première page : decodeCursor(undefined) → null (jamais throw).
 *  - tolérance : un curseur corrompu ou vide → null (dégradation gracieuse, jamais throw).
 *
 * Philosophie (miroir lib/signals/searchParams.ts) : une valeur d'URL corrompue
 * ne doit JAMAIS faire échouer le rendu. Le curseur est OPAQUE (pas un secret) :
 * même falsifié, la RLS scope toujours à auth.uid() → pas d'élévation.
 */
import { describe, it, expect } from 'vitest'
import { encodeCursor, decodeCursor } from '../cursor'

describe('cursor: round-trip (UDASH-02)', () => {
  it('decodeCursor(encodeCursor(c)) === c', () => {
    const c = { createdAt: '2026-06-26T12:00:00.000Z', id: 'a1b2c3d4-0000-0000-0000-000000000001' }
    const encoded = encodeCursor(c)
    expect(typeof encoded).toBe('string')
    expect(decodeCursor(encoded)).toEqual(c)
  })

  it('encode produit une string base64url (pas de +, /, =)', () => {
    const encoded = encodeCursor({ createdAt: '2026-01-01T00:00:00.000Z', id: 'xx-yy' })
    expect(encoded).not.toMatch(/[+/=]/)
  })
})

describe('cursor: décodage tolérant (jamais throw)', () => {
  it('decodeCursor(undefined) → null (première page)', () => {
    expect(decodeCursor(undefined)).toBeNull()
  })

  it("decodeCursor('') → null", () => {
    expect(decodeCursor('')).toBeNull()
  })

  it("decodeCursor('@@corrompu@@') → null (jamais throw)", () => {
    expect(decodeCursor('@@corrompu@@')).toBeNull()
  })

  it('curseur base64url décodant un JSON non-tuple → null', () => {
    const notATuple = Buffer.from(JSON.stringify({ foo: 'bar' })).toString('base64url')
    expect(decodeCursor(notATuple)).toBeNull()
  })

  it('curseur base64url décodant un tuple non-string → null', () => {
    const badTuple = Buffer.from(JSON.stringify([123, 456])).toString('base64url')
    expect(decodeCursor(badTuple)).toBeNull()
  })
})
