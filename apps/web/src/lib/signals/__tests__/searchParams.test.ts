/**
 * searchParams.test.ts — garde-fou du parsing/sérialisation des filtres+tri de la
 * surface signaux (Plan 03-01, Task 3 ; MEMB-01/02).
 *
 * Behavior testé :
 *  - round-trip : serialize(parse(x)) reproduit les mêmes valeurs.
 *  - défaut : parseSignalsParams({}) → sort='score' (D-08), aucun filtre.
 *  - rejet hors-enum (anti-injection .eq/.in, threat T-03-05) : une valeur hors
 *    whitelist Zod est ignorée (undefined), JAMAIS propagée vers une requête.
 *
 * Analog : apps/web/src/lib/__tests__/legal-gate.test.ts (structure vitest du repo).
 */
import { describe, it, expect } from 'vitest'
import {
  SignalsParamsSchema,
  parseSignalsParams,
  serializeSignalsParams,
} from '../searchParams'

describe('searchParams: défaut (D-08)', () => {
  it('parseSignalsParams({}) → sort=score et aucun filtre', () => {
    const p = parseSignalsParams({})
    expect(p.sort).toBe('score')
    expect(p.style).toBeUndefined()
    expect(p.risk).toBeUndefined()
    expect(p.class).toBeUndefined()
    expect(p.asset).toBeUndefined()
  })
})

describe('searchParams: round-trip serialize/parse (MEMB-01/02)', () => {
  it('reproduit les mêmes valeurs après serialize→parse', () => {
    const source = parseSignalsParams({ style: 'swing', risk: 'low', sort: 'rr' })
    const qs = serializeSignalsParams(source)
    const back = parseSignalsParams(Object.fromEntries(qs.entries()))
    expect(back.style).toBe('swing')
    expect(back.risk).toBe('low')
    expect(back.sort).toBe('rr')
  })

  it('serialize omet le tri par défaut score et les filtres absents', () => {
    const qs = serializeSignalsParams(parseSignalsParams({}))
    expect(qs.toString()).toBe('')
  })

  it('round-trip avec class + asset', () => {
    const source = parseSignalsParams({ class: 'crypto', asset: 'BTCUSDT', sort: 'recent' })
    const back = parseSignalsParams(
      Object.fromEntries(serializeSignalsParams(source).entries()),
    )
    expect(back.class).toBe('crypto')
    expect(back.asset).toBe('BTCUSDT')
    expect(back.sort).toBe('recent')
  })
})

describe('searchParams: rejet hors-enum (anti-injection T-03-05)', () => {
  it('style hors enum → undefined (pas injecté dans .eq)', () => {
    expect(parseSignalsParams({ style: 'scalp' }).style).toBeUndefined()
  })

  it('risk = injection SQL → undefined', () => {
    expect(parseSignalsParams({ risk: 'DROP TABLE trade_setups' }).risk).toBeUndefined()
  })

  it('class hors enum → undefined', () => {
    expect(parseSignalsParams({ class: 'stocks' }).class).toBeUndefined()
  })

  it('sort hors enum → revient au défaut score', () => {
    expect(parseSignalsParams({ sort: 'price' }).sort).toBe('score')
  })

  it('valeurs valides mêlées à une invalide : garde les valides, ignore l’invalide', () => {
    const p = parseSignalsParams({ style: 'day', risk: 'nope', sort: 'rr' })
    expect(p.style).toBe('day')
    expect(p.risk).toBeUndefined()
    expect(p.sort).toBe('rr')
  })
})

describe('searchParams: schema exposé', () => {
  it('SignalsParamsSchema parse un objet valide complet', () => {
    const r = SignalsParamsSchema.safeParse({
      style: 'swing',
      risk: 'high',
      class: 'forex',
      asset: 'EURUSD',
      sort: 'rr',
    })
    expect(r.success).toBe(true)
  })
})
