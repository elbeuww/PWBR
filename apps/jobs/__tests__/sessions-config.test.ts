/**
 * Golden tests — config sessions (D-49) + résolveur d'univers.
 *
 * Vérifie :
 *  - SESSIONS figé (asset_classes/styles par session) ; crypto dans CHAQUE session.
 *  - resolveSessionUniverse = produit cartésien (instruments filtrés par
 *    asset_class ∈ SESSIONS[session].asset_classes ET active) × styles de la session.
 *  - instrument inactif (active=false) exclu.
 *  - asset_class hors session (ex. energy pour asia) exclu.
 *  - fonction pure (instruments injectés) — offline testable (D-23).
 */
import { describe, it, expect } from 'vitest'
import type { InstrumentRow } from '@app/supabase'
import { SESSIONS, type SessionName } from '../config/sessions'
import { resolveSessionUniverse } from '../src/jobs/sessionUniverse'

// ── Univers d'instruments figé couvrant les 4 asset_classes + 1 inactif ────────
function mkInstrument(over: Partial<InstrumentRow> & Pick<InstrumentRow, 'id' | 'asset_class'>): InstrumentRow {
  return {
    active: true,
    broker: 'oanda',
    canonical_symbol: null,
    display_name: over.id,
    min_size: null,
    pip_size: null,
    precision: null,
    price_decimals: null,
    quote_hours: null,
    source_symbol: null,
    symbol: over.id,
    ...over,
  } as InstrumentRow
}

const INSTRUMENTS: InstrumentRow[] = [
  mkInstrument({ id: 'EUR_USD', asset_class: 'forex' }),
  mkInstrument({ id: 'XAU_USD', asset_class: 'metal' }),
  mkInstrument({ id: 'WTICO_USD', asset_class: 'energy' }),
  mkInstrument({ id: 'BTC_USDT', asset_class: 'crypto', broker: 'binance' }),
  // inactif : doit être exclu de TOUTES les sessions
  mkInstrument({ id: 'GBP_USD', asset_class: 'forex', active: false }),
]

describe('SESSIONS config (D-49)', () => {
  it('crypto est présente dans CHAQUE session', () => {
    for (const name of Object.keys(SESSIONS) as SessionName[]) {
      expect(SESSIONS[name].asset_classes).toContain('crypto')
    }
  })

  it('asia n exclut PAS energy ? (D-49 : asia = forex/metal/crypto, sans energy)', () => {
    expect(SESSIONS['asia'].asset_classes).not.toContain('energy')
  })

  it('london expose day ET swing', () => {
    expect(SESSIONS['london'].styles).toEqual(['day', 'swing'])
  })

  it('eod-swing expose uniquement swing', () => {
    expect(SESSIONS['eod-swing'].styles).toEqual(['swing'])
  })
})

describe('resolveSessionUniverse', () => {
  it('london : paires instrument×style pour asset_class ∈ {forex,metal,energy,crypto} × {day,swing}', () => {
    const universe = resolveSessionUniverse('london', INSTRUMENTS)
    // 4 instruments actifs (EUR_USD, XAU_USD, WTICO_USD, BTC_USDT) × 2 styles = 8
    expect(universe).toHaveLength(8)
    const ids = universe.map((u) => `${u.instrument.id}:${u.style}`).sort()
    expect(ids).toContain('EUR_USD:day')
    expect(ids).toContain('EUR_USD:swing')
    expect(ids).toContain('BTC_USDT:swing')
  })

  it('crypto présente dans CHAQUE session résolue', () => {
    for (const name of Object.keys(SESSIONS) as SessionName[]) {
      const universe = resolveSessionUniverse(name, INSTRUMENTS)
      const hasCrypto = universe.some((u) => u.instrument.asset_class === 'crypto')
      expect(hasCrypto, `crypto manquante dans ${name}`).toBe(true)
    }
  })

  it('un instrument inactif (active=false) est exclu', () => {
    const universe = resolveSessionUniverse('london', INSTRUMENTS)
    expect(universe.some((u) => u.instrument.id === 'GBP_USD')).toBe(false)
  })

  it('un asset_class hors session est exclu (energy absent de asia)', () => {
    const universe = resolveSessionUniverse('asia', INSTRUMENTS)
    expect(universe.some((u) => u.instrument.asset_class === 'energy')).toBe(false)
    // asia = forex/metal/crypto × [day] → 3 instruments actifs × 1 style = 3
    expect(universe).toHaveLength(3)
    expect(universe.every((u) => u.style === 'day')).toBe(true)
  })
})
