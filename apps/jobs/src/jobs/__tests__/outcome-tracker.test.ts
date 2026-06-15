/**
 * Test outcome-tracker — idempotence du replay des setups expirés (Plan 05-02, TRACK-01 / D-05 / A1).
 *
 * Vérifie SANS DB réelle (mock du client service_role, store en mémoire) que :
 *  - Le job sélectionne les setups status IN (expired,invalidated) AND valid_until<now()
 *    encore ABSENTS de prediction_outcomes (sélection bornée, idempotence niveau 1).
 *  - Chaque setup éligible est rejoué via replayOutcome(setup, candlesH1) puis persisté.
 *  - 1er run insère N outcomes, retourne stats { resolved, skipped }.
 *  - 2e run consécutif insère 0 ligne (idempotent) — assertion clé.
 *  - Un setup non éligible (status 'active' ou valid_until futur) n'est JAMAIS traité.
 *  - Un setup 'invalidated' est rejoué PLEINEMENT (A1) — jamais présumé hit_sl.
 *
 * Le mock simule un store : setups[] + outcomes[] + candles[]. L'upsert onConflict
 * 'setup_id' ignoreDuplicates n'insère que les setup_id absents (filet idempotence DB).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// ─── Fixtures store en mémoire ────────────────────────────────────────────────

interface SetupRow {
  id: string
  instrument_id: string
  direction: 'long' | 'short'
  entry_price: number
  stop_loss: number
  take_profits: { price: number; alloc_pct: number }[]
  valid_until: string
  created_at: string
  style: string
  opportunity_score: number
  risk_level: string
  status: string
}
interface OutcomeRow {
  setup_id: string
  outcome: string
  realized_r: number
  candle_count: number | null
}
interface CandleRow {
  instrument_id: string
  timeframe: string
  ts: string
  open: number
  high: number
  low: number
  close: number
}

const PAST = '2020-01-01T00:00:00.000Z'
const PAST_END = '2020-01-02T00:00:00.000Z'
const FUTURE = '2999-01-01T00:00:00.000Z'

let setups: SetupRow[]
let outcomes: OutcomeRow[]
let candles: CandleRow[]

// ─── Mock chaînable du query builder Supabase ─────────────────────────────────
//
// trade_setups : .from('trade_setups').select(cols).in('status',[...]).lt('valid_until', iso)
//   -> thenable, résout les setups éligibles.
// prediction_outcomes (read) : .from('prediction_outcomes').select('setup_id') -> thenable.
// prediction_outcomes (write) : .from('prediction_outcomes').upsert(rows, {onConflict,ignoreDuplicates})
//   -> n'insère que les setup_id absents.
// candles : .from('candles').select(cols).eq('instrument_id',x).eq('timeframe','H1')
//   .gte('ts',from).lte('ts',to).order('ts',{ascending:true}) -> thenable.

function makeClient() {
  return {
    from(table: string) {
      const filters: {
        inStatus?: string[]
        ltValidUntil?: string
        instrumentId?: string
        timeframe?: string
        gteTs?: string
        lteTs?: string
      } = {}

      const resolveSelect = () => {
        if (table === 'trade_setups') {
          const eligible = setups.filter(
            (r) =>
              filters.inStatus!.includes(r.status) &&
              r.valid_until < filters.ltValidUntil!,
          )
          return { data: eligible, error: null }
        }
        if (table === 'prediction_outcomes') {
          return { data: outcomes.map((o) => ({ setup_id: o.setup_id })), error: null }
        }
        // candles
        const eligible = candles.filter(
          (c) =>
            c.instrument_id === filters.instrumentId &&
            c.timeframe === filters.timeframe &&
            c.ts >= filters.gteTs! &&
            c.ts <= filters.lteTs!,
        )
        eligible.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0))
        return { data: eligible, error: null }
      }

      const builder = {
        select(_cols: string) {
          return builder
        },
        in(_col: string, vals: string[]) {
          filters.inStatus = vals
          return builder
        },
        lt(_col: string, iso: string) {
          filters.ltValidUntil = iso
          return builder
        },
        eq(col: string, val: string) {
          if (col === 'instrument_id') filters.instrumentId = val
          if (col === 'timeframe') filters.timeframe = val
          return builder
        },
        gte(_col: string, iso: string) {
          filters.gteTs = iso
          return builder
        },
        lte(_col: string, iso: string) {
          filters.lteTs = iso
          return builder
        },
        order(_col: string, _opts: { ascending: boolean }) {
          // l'ordre est appliqué dans resolveSelect ; terminer la chaîne.
          return Promise.resolve(resolveSelect())
        },
        upsert(rows: OutcomeRow[], _opts: { onConflict: string; ignoreDuplicates: boolean }) {
          const existing = new Set(outcomes.map((o) => o.setup_id))
          for (const r of rows) {
            if (!existing.has(r.setup_id)) {
              outcomes.push(r)
              existing.add(r.setup_id)
            }
          }
          return Promise.resolve({ error: null })
        },
        // thenable : permet `await client.from(t).select(...).in(...).lt(...)`
        then(onFulfilled: (v: { data: unknown; error: null }) => unknown) {
          return Promise.resolve(resolveSelect()).then(onFulfilled)
        },
      }
      return builder
    },
  }
}

// `createClient` du SDK est remplacé par notre mock store-backed.
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => makeClient(),
}))

import { outcomeTracker } from '../outcome-tracker'

// Bougies H1 produisant un hit_tp long : high franchit tp1 (110) avant que low ne touche sl (90).
function candlesHitTp(instrumentId: string): CandleRow[] {
  return [
    { instrument_id: instrumentId, timeframe: 'H1', ts: '2020-01-01T01:00:00.000Z', open: 100, high: 102, low: 99, close: 101 },
    { instrument_id: instrumentId, timeframe: 'H1', ts: '2020-01-01T02:00:00.000Z', open: 101, high: 111, low: 100, close: 110 },
  ]
}

describe('outcome-tracker — idempotence du replay (TRACK-01)', () => {
  beforeEach(() => {
    process.env['SUPABASE_URL'] = 'http://localhost'
    process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'test-service-role'

    setups = [
      // éligible expired (long, hit_tp attendu)
      {
        id: 'su1',
        instrument_id: 'inst-1',
        direction: 'long',
        entry_price: 100,
        stop_loss: 90,
        take_profits: [{ price: 110, alloc_pct: 100 }],
        valid_until: PAST_END,
        created_at: PAST,
        style: 'day',
        opportunity_score: 85,
        risk_level: 'medium',
        status: 'expired',
      },
      // éligible invalidated — DOIT être rejoué pleinement (A1), pas présumé hit_sl
      {
        id: 'su2',
        instrument_id: 'inst-2',
        direction: 'long',
        entry_price: 100,
        stop_loss: 90,
        take_profits: [{ price: 110, alloc_pct: 100 }],
        valid_until: PAST_END,
        created_at: PAST,
        style: 'swing',
        opportunity_score: 70,
        risk_level: 'high',
        status: 'invalidated',
      },
      // NON éligible : status active
      {
        id: 'su3',
        instrument_id: 'inst-3',
        direction: 'long',
        entry_price: 100,
        stop_loss: 90,
        take_profits: [{ price: 110, alloc_pct: 100 }],
        valid_until: PAST_END,
        created_at: PAST,
        style: 'day',
        opportunity_score: 60,
        risk_level: 'low',
        status: 'active',
      },
      // NON éligible : valid_until futur
      {
        id: 'su4',
        instrument_id: 'inst-4',
        direction: 'long',
        entry_price: 100,
        stop_loss: 90,
        take_profits: [{ price: 110, alloc_pct: 100 }],
        valid_until: FUTURE,
        created_at: PAST,
        style: 'day',
        opportunity_score: 60,
        risk_level: 'low',
        status: 'expired',
      },
    ]
    outcomes = []
    candles = [...candlesHitTp('inst-1'), ...candlesHitTp('inst-2')]
  })

  it('1er run : rejoue les setups éligibles et persiste { resolved, skipped }', async () => {
    const stats = (await outcomeTracker()) as { resolved: number; skipped: number }
    expect(stats.resolved).toBe(2)
    expect(outcomes.map((o) => o.setup_id).sort()).toEqual(['su1', 'su2'])

    // su3 (active) et su4 (valid_until futur) ne sont jamais traités
    expect(outcomes.find((o) => o.setup_id === 'su3')).toBeUndefined()
    expect(outcomes.find((o) => o.setup_id === 'su4')).toBeUndefined()

    // su2 'invalidated' rejoué pleinement (A1) : hit_tp réel, pas hit_sl présumé
    expect(outcomes.find((o) => o.setup_id === 'su2')?.outcome).toBe('hit_tp')
  })

  it('2e run consécutif : 0 insert (idempotent)', async () => {
    await outcomeTracker() // 1er run consomme les éligibles
    const before = outcomes.length
    const second = (await outcomeTracker()) as { resolved: number; skipped: number }
    expect(second.resolved).toBe(0)
    expect(outcomes.length).toBe(before)
  })
})
