/**
 * Golden values — OutputSchema §3 PERMISSIF (contrat JSON de l'agent IA).
 *
 * A1 (concern revue quality [HIGH]) : OutputSchema est PERMISSIF (z.object SANS
 * .strict()). L'exemple §3 d'ARCHITECTURE contient opportunity_score/risk_level/
 * confidence — produits par le CODE (D-42/46/48), PAS dans le schéma. Si l'agent
 * les émet, Zod les strip au lieu de rejeter.
 *
 * Fixture XAU_USD figée, dérivée d'ARCHITECTURE §3. Patron valid/bad de snapshots.test.ts.
 */
import { describe, it, expect } from 'vitest'
import { OutputSchema } from '../../src/schemas/output.js'

// Fixture valide §3 (XAU_USD) — SANS opportunity_score/risk_level/confidence/
// risk_reward/atr_distance_sl (ces champs ne figurent PAS dans le contrat agent ; A1).
const valid = {
  schema_version: '1.0',
  generated_at: '2026-06-09T07:00:00Z',
  session: 'london',
  style: 'day',
  instrument: 'XAU_USD',
  direction: 'long',
  timeframe_analysis: 'Daily haussier, H4 pullback sur support, H1 momentum repart',
  entry: { type: 'limit', price: 2318.5, zone: [2316.0, 2320.0] },
  stop_loss: 2305.0,
  take_profits: [
    { price: 2335.0, alloc_pct: 50 },
    { price: 2352.0, alloc_pct: 50 },
  ],
  technical_reasons: [
    'Daily en HH/HL, prix au-dessus EMA200',
    'Rejet du support H4 2316 (POC volume)',
  ],
  fundamental_reasons: ['DXY en repli, real yields baissent → favorable à l’or'],
  news_catalysts: [
    {
      headline: 'Fed minutes dovish',
      impact: 'high',
      direction: 'bullish',
      ts: '2026-06-08T18:00:00Z',
    },
  ],
  upcoming_risk_events: [
    { event: 'US CPI', ts: '2026-06-10T12:30:00Z', note: 'réduire/clôturer avant' },
  ],
  invalidation: 'Clôture H4 sous 2305 = thèse invalidée (perte de structure)',
  veteran_note: 'Pullback propre dans une tendance saine. J’attends le retest.',
  raw_indicators_ref: 'hash du snapshot utilisé',
}

describe('OutputSchema — §3 PERMISSIF (contrat JSON IA)', () => {
  it('parse la fixture §3 valide (XAU_USD)', () => {
    expect(() => OutputSchema.parse(valid)).not.toThrow()
  })

  it('A1 : clés en trop (opportunity_score/risk_level/confidence) → parse RÉUSSIT et les strip', () => {
    const withExtras = {
      ...valid,
      opportunity_score: 78,
      risk_level: 'medium',
      confidence: 'high',
    }
    const result = OutputSchema.parse(withExtras)
    expect(result).not.toHaveProperty('opportunity_score')
    expect(result).not.toHaveProperty('risk_level')
    expect(result).not.toHaveProperty('confidence')
  })

  it('A1 : un objet §3 SANS ces 3 champs parse quand même (ils ne sont pas dans le schéma)', () => {
    expect(valid).not.toHaveProperty('opportunity_score')
    expect(() => OutputSchema.parse(valid)).not.toThrow()
  })

  it('rejette une session hors §3 (tokyo)', () => {
    const bad = { ...valid, session: 'tokyo' }
    expect(() => OutputSchema.parse(bad)).toThrow()
  })

  it('rejette un style hors §3', () => {
    const bad = { ...valid, style: 'scalp' }
    expect(() => OutputSchema.parse(bad)).toThrow()
  })

  it('rejette une direction hors §3', () => {
    const bad = { ...valid, direction: 'flat' }
    expect(() => OutputSchema.parse(bad)).toThrow()
  })

  it('rejette un entry.type hors {limit,market,stop}', () => {
    const bad = { ...valid, entry: { ...valid.entry, type: 'trailing' } }
    expect(() => OutputSchema.parse(bad)).toThrow()
  })

  it('rejette take_profits vide (0)', () => {
    const bad = { ...valid, take_profits: [] }
    expect(() => OutputSchema.parse(bad)).toThrow()
  })

  it('rejette take_profits avec 4 entrées (max 3)', () => {
    const bad = {
      ...valid,
      take_profits: [
        { price: 1, alloc_pct: 25 },
        { price: 2, alloc_pct: 25 },
        { price: 3, alloc_pct: 25 },
        { price: 4, alloc_pct: 25 },
      ],
    }
    expect(() => OutputSchema.parse(bad)).toThrow()
  })

  it('accepte take_profits 1 à 3 entrées', () => {
    const one = { ...valid, take_profits: [{ price: 2335, alloc_pct: 100 }] }
    expect(() => OutputSchema.parse(one)).not.toThrow()
    const three = {
      ...valid,
      take_profits: [
        { price: 1, alloc_pct: 34 },
        { price: 2, alloc_pct: 33 },
        { price: 3, alloc_pct: 33 },
      ],
    }
    expect(() => OutputSchema.parse(three)).not.toThrow()
  })

  it('rejette entry.zone non-tuple (1 seul nombre)', () => {
    const bad = { ...valid, entry: { ...valid.entry, zone: [2316.0] } }
    expect(() => OutputSchema.parse(bad)).toThrow()
  })

  it('rejette un generated_at non-ISO', () => {
    const bad = { ...valid, generated_at: 'pas-une-date' }
    expect(() => OutputSchema.parse(bad)).toThrow()
  })
})
