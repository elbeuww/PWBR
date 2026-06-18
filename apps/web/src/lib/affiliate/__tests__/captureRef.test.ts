/**
 * Tests captureRef — pose du cookie aff_ref (AFF-01, D-09/D-10).
 *
 * Couvre :
 *  - code valide → cookie posé (valeur exacte, options 30j/httpOnly/sameSite=lax/secure)
 *  - code minuscule → normalisé en majuscules
 *  - code non conforme (espace/symbole) → aucun cookie (anti-injection T-07-REFINJ)
 *  - absence de ?ref → no-op
 *  - last-touch (D-10) : le dernier ?ref écrase le précédent
 *
 * Mocks minimaux NextRequest (nextUrl.searchParams) + NextResponse (cookies.set).
 *
 * Source : 07-04-PLAN.md Task 1 ; 07-RESEARCH.md §Pattern 1.
 */
import { describe, it, expect } from 'vitest'
import type { NextRequest, NextResponse } from 'next/server'
import { captureRef } from '../captureRef'

interface CookieSetArg {
  name: string
  value: string
  maxAge?: number
  httpOnly?: boolean
  sameSite?: 'lax' | 'strict' | 'none' | boolean
  secure?: boolean
  path?: string
}

/** Mock NextRequest : seul nextUrl.searchParams est lu par captureRef. */
function mockRequest(ref: string | null): NextRequest {
  const params = new URLSearchParams()
  if (ref !== null) params.set('ref', ref)
  return {
    nextUrl: { searchParams: params },
  } as unknown as NextRequest
}

/** Mock NextResponse : capte les appels response.cookies.set(...). */
function mockResponse(): { response: NextResponse; sets: CookieSetArg[] } {
  const sets: CookieSetArg[] = []
  const response = {
    cookies: {
      set: (arg: CookieSetArg) => {
        sets.push(arg)
      },
    },
  } as unknown as NextResponse
  return { response, sets }
}

describe('captureRef', () => {
  it('pose le cookie aff_ref pour un code valide (valeur + options)', () => {
    const { response, sets } = mockResponse()
    captureRef(mockRequest('BORHANE'), response)

    expect(sets).toHaveLength(1)
    const cookie = sets[0]!
    expect(cookie.name).toBe('aff_ref')
    expect(cookie.value).toBe('BORHANE')
    expect(cookie.maxAge).toBe(60 * 60 * 24 * 30) // 30 jours (D-09)
    expect(cookie.httpOnly).toBe(true)
    expect(cookie.sameSite).toBe('lax')
    expect(cookie.secure).toBe(true)
    expect(cookie.path).toBe('/')
  })

  it('normalise un code minuscule en majuscules', () => {
    const { response, sets } = mockResponse()
    captureRef(mockRequest('borhane'), response)

    expect(sets).toHaveLength(1)
    expect(sets[0]!.value).toBe('BORHANE')
  })

  it('ignore une valeur non conforme (espace/symbole) — anti-injection', () => {
    const { response, sets } = mockResponse()
    captureRef(mockRequest('bad code!'), response)
    expect(sets).toHaveLength(0)
  })

  it('ignore un code trop court (< 3)', () => {
    const { response, sets } = mockResponse()
    captureRef(mockRequest('AB'), response)
    expect(sets).toHaveLength(0)
  })

  it('ignore un code trop long (> 20)', () => {
    const { response, sets } = mockResponse()
    captureRef(mockRequest('A'.repeat(21)), response)
    expect(sets).toHaveLength(0)
  })

  it('no-op en absence de ?ref', () => {
    const { response, sets } = mockResponse()
    captureRef(mockRequest(null), response)
    expect(sets).toHaveLength(0)
  })

  it('no-op si ?ref est vide', () => {
    const { response, sets } = mockResponse()
    captureRef(mockRequest(''), response)
    expect(sets).toHaveLength(0)
  })

  it('last-touch (D-10) : le dernier ?ref écrase le précédent', () => {
    const { response, sets } = mockResponse()
    captureRef(mockRequest('CODEONE'), response)
    captureRef(mockRequest('CODETWO'), response)

    expect(sets).toHaveLength(2)
    expect(sets[0]!.value).toBe('CODEONE')
    expect(sets[1]!.value).toBe('CODETWO') // le dernier gagne
  })
})
