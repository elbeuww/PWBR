/**
 * Golden values — parseFairEconomyCalendar
 *
 * Test hors-ligne : charge la fixture JSON et vérifie la normalisation.
 * Points clés : event_key déterministe, impact validé enum, schéma tolérant.
 * Aucun appel réseau. Déterministe.
 *
 * T-02-08 : schéma Zod tolérant, champs inconnus ignorés.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { parseFairEconomyCalendar } from './client.js'

const require = createRequire(import.meta.url)
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const rawFixture = require('../__fixtures__/faireconomy-calendar.json') as unknown

describe('parseFairEconomyCalendar — golden values', () => {
  it('retourne 5 EconomicCalendarInsert depuis la fixture', () => {
    const result = parseFairEconomyCalendar(rawFixture)
    expect(result).toHaveLength(5)
  })

  it('source vaut "faireconomy" pour tous les events', () => {
    const result = parseFairEconomyCalendar(rawFixture)
    for (const item of result) {
      expect(item.source).toBe('faireconomy')
    }
  })

  it('event_key est déterministe (sha256 hex, longueur 64)', () => {
    const result = parseFairEconomyCalendar(rawFixture)
    for (const item of result) {
      expect(item.event_key).toHaveLength(64)
    }
  })

  it('event_key est stable (appel répété => même valeur)', () => {
    const r1 = parseFairEconomyCalendar(rawFixture)
    const r2 = parseFairEconomyCalendar(rawFixture)
    for (let i = 0; i < r1.length; i++) {
      expect(r1[i]?.event_key).toBe(r2[i]?.event_key)
    }
  })

  it('event_key diffère entre events différents', () => {
    const result = parseFairEconomyCalendar(rawFixture)
    const keys = result.map((r) => r.event_key)
    const unique = new Set(keys)
    expect(unique.size).toBe(result.length)
  })

  it('event_at ISO UTC correct pour l\'event 0 (NFP)', () => {
    const result = parseFairEconomyCalendar(rawFixture)
    // date: "2026-06-06T12:30:00+00:00" => UTC
    expect(result[0]?.event_at).toBe('2026-06-06T12:30:00.000Z')
  })

  it('impact validé dans l\'enum High|Medium|Low', () => {
    const result = parseFairEconomyCalendar(rawFixture)
    const valid = new Set(['High', 'Medium', 'Low'])
    for (const item of result) {
      if (item.impact !== null && item.impact !== undefined) {
        expect(valid.has(item.impact)).toBe(true)
      }
    }
  })

  it('event 0 impact = "High"', () => {
    const result = parseFairEconomyCalendar(rawFixture)
    expect(result[0]?.impact).toBe('High')
  })

  it('event 2 impact = "Medium"', () => {
    const result = parseFairEconomyCalendar(rawFixture)
    expect(result[2]?.impact).toBe('Medium')
  })

  it('event 4 impact = "Low"', () => {
    const result = parseFairEconomyCalendar(rawFixture)
    expect(result[4]?.impact).toBe('Low')
  })

  it('titre de l\'event 0 correct', () => {
    const result = parseFairEconomyCalendar(rawFixture)
    expect(result[0]?.title).toBe('Non-Farm Employment Change')
  })

  it('country de l\'event 0 correct', () => {
    const result = parseFairEconomyCalendar(rawFixture)
    expect(result[0]?.country).toBe('USD')
  })

  it('champs inattendus dans la fixture (extra_field) n\'empêchent pas le parse — schéma tolérant', () => {
    // event 3 a un champ extra_field dans la fixture — ne doit pas throw
    expect(() => parseFairEconomyCalendar(rawFixture)).not.toThrow()
  })

  it('forecast et previous optionnels (event 2 forecast null)', () => {
    const result = parseFairEconomyCalendar(rawFixture)
    // event 2 a forecast: null
    expect(result[2]?.forecast === null || result[2]?.forecast === undefined || result[2]?.forecast === '').toBe(true)
  })

  it('retourne un tableau vide si fixture vide []', () => {
    const result = parseFairEconomyCalendar([])
    expect(result).toHaveLength(0)
  })
})
