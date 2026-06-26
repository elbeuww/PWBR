/**
 * searchParams.test.ts — garde-fou du parsing/sérialisation des filtres de la table
 * utilisateurs admin (Plan 20-01, Task 1 ; ADASH-02/04).
 *
 * Behavior testé :
 *  - round-trip : serialize(parse(x)) reproduit les mêmes valeurs.
 *  - défaut : parseAdminUsersParams({}) → aucun filtre (tous undefined).
 *  - rejet hors-enum (anti-injection .eq/.in, threat T-20-02) : une valeur hors
 *    whitelist Zod est ignorée (undefined), JAMAIS propagée vers une requête.
 *  - cursor opaque conservé tel quel (validé plus tard par sanitizeCursor).
 *
 * Analog : apps/web/src/lib/signals/__tests__/searchParams.test.ts (structure repo).
 */
import { describe, it, expect } from 'vitest'
import {
  AdminUsersParamsSchema,
  parseAdminUsersParams,
  serializeAdminUsersParams,
} from '../searchParams'

describe('adminUsers searchParams: défaut', () => {
  it('parseAdminUsersParams({}) → aucun filtre', () => {
    const p = parseAdminUsersParams({})
    expect(p.status).toBeUndefined()
    expect(p.source).toBeUndefined()
    expect(p.q).toBeUndefined()
    expect(p.cursor).toBeUndefined()
  })
})

describe('adminUsers searchParams: round-trip serialize/parse (ADASH-02)', () => {
  it('reproduit les mêmes valeurs après serialize→parse', () => {
    const source = parseAdminUsersParams({ status: 'active', source: 'demo', q: 'a@b.co' })
    const qs = serializeAdminUsersParams(source)
    const back = parseAdminUsersParams(Object.fromEntries(qs.entries()))
    expect(back.status).toBe('active')
    expect(back.source).toBe('demo')
    expect(back.q).toBe('a@b.co')
  })

  it('serialize omet les champs absents → query string vide', () => {
    const qs = serializeAdminUsersParams(parseAdminUsersParams({}))
    expect(qs.toString()).toBe('')
  })

  it('round-trip avec cursor opaque conservé tel quel', () => {
    const source = parseAdminUsersParams({ status: 'expired', cursor: 'eyJrIjoxfQ' })
    const back = parseAdminUsersParams(
      Object.fromEntries(serializeAdminUsersParams(source).entries()),
    )
    expect(back.status).toBe('expired')
    expect(back.cursor).toBe('eyJrIjoxfQ')
  })
})

describe('adminUsers searchParams: rejet hors-enum (anti-injection T-20-02)', () => {
  it('status hors enum → undefined (pas de throw, pas injecté)', () => {
    expect(parseAdminUsersParams({ status: 'bogus' }).status).toBeUndefined()
  })

  it('source = injection SQL → undefined', () => {
    expect(parseAdminUsersParams({ source: 'DROP TABLE profiles' }).source).toBeUndefined()
  })

  it('q vide → undefined', () => {
    expect(parseAdminUsersParams({ q: '' }).q).toBeUndefined()
  })

  it('valeurs valides mêlées à une invalide : garde les valides, ignore l’invalide', () => {
    const p = parseAdminUsersParams({ status: 'none', source: 'nope', q: 'x' })
    expect(p.status).toBe('none')
    expect(p.source).toBeUndefined()
    expect(p.q).toBe('x')
  })
})

describe('adminUsers searchParams: schema exposé', () => {
  it('AdminUsersParamsSchema parse un objet valide complet', () => {
    const r = AdminUsersParamsSchema.safeParse({
      status: 'active',
      source: 'live',
      q: 'user@mail.co',
      cursor: 'opaque',
    })
    expect(r.success).toBe(true)
  })
})
