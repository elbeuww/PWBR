/**
 * Test technical-engine — non-régression du cap 1000 lignes PostgREST (BUGFIX-CAP1000).
 *
 * Bug : readClosedCandles triait `ts ascending` SANS `.limit()`. PostgREST plafonne
 * une réponse non bornée à 1000 lignes → renvoie les 1000 plus VIEILLES bougies →
 * `ltf.at(-1).ts` (computed_for_ts) tombe sur une bougie périmée. Tout l'aval gèle.
 *
 * Ce test reproduit le plafond : le mock `candles` tronque le résultat à 1000 lignes
 * APRÈS tri quand aucun `.limit()` n'a été posé sur la chaîne (et à n si `.limit(n)`).
 * Avec >1000 bougies seedées par TF :
 *  - code buggé (asc sans limit) → mock renvoie les 1000 plus vieilles → computed_for_ts
 *    = vieille bougie → ASSERTION ÉCHOUE (RED).
 *  - code fixé (desc + limit CANDLE_WARMUP, puis reverse) → mock renvoie les N plus
 *    récentes → computed_for_ts = dernière bougie clôturée → PASSE (GREEN).
 *
 * Sans DB réelle : store en mémoire (instruments[] + candles[]), builder thenable,
 * `@supabase/supabase-js` mocké pour le client candles, `@app/supabase` mocké pour
 * listActiveInstruments + upsertSnapshot (capture de la SnapshotInsert).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// ─── Store en mémoire ─────────────────────────────────────────────────────────

interface CandleStoreRow {
  id: string
  instrument_id: string
  timeframe: string
  ts: string
  open: number
  high: number
  low: number
  close: number
  volume: number | null
}

interface InstrumentStoreRow {
  id: string
  symbol: string
  broker: string
  active: boolean
}

const POSTGREST_CAP = 1000

let candles: CandleStoreRow[]
let instruments: InstrumentStoreRow[]
let capturedSnapshots: Array<{ computed_for_ts: string; style: string; timeframe_set: string }>

// ─── Mock chaînable du query builder Supabase (client candles) ────────────────
//
// .from('candles').select('*').eq('instrument_id',x).eq('timeframe',tf)
//   .lte('ts',cutoff).order('ts',{ascending}) [.limit(n)]
//   -> thenable. Le tri demandé est appliqué dans resolveSelect ; le PLAFOND 1000
//      PostgREST est simulé : si aucune .limit() n'a été posée, troncature à 1000
//      APRÈS tri ; sinon troncature à n. C'est ce qui capture le bug.

function makeClient() {
  return {
    from(table: string) {
      const filters: {
        instrumentId?: string
        timeframe?: string
        lteTs?: string
        ascending?: boolean
        limit?: number
      } = {}

      const resolveSelect = () => {
        if (table === 'candles') {
          const matched = candles.filter(
            (c) =>
              c.instrument_id === filters.instrumentId &&
              c.timeframe === filters.timeframe &&
              (filters.lteTs === undefined || c.ts <= filters.lteTs),
          )
          // Tri demandé (par défaut asc si non posé).
          const asc = filters.ascending ?? true
          matched.sort((a, b) =>
            a.ts < b.ts ? (asc ? -1 : 1) : a.ts > b.ts ? (asc ? 1 : -1) : 0,
          )
          // Plafond PostgREST : limite explicite sinon cap implicite 1000 APRÈS tri.
          const cap = filters.limit ?? POSTGREST_CAP
          return { data: matched.slice(0, cap), error: null }
        }
        return { data: [], error: null }
      }

      const builder = {
        select(_cols: string) {
          return builder
        },
        eq(col: string, val: string) {
          if (col === 'instrument_id') filters.instrumentId = val
          if (col === 'timeframe') filters.timeframe = val
          return builder
        },
        lte(_col: string, iso: string) {
          filters.lteTs = iso
          return builder
        },
        limit(n: number) {
          filters.limit = n
          return builder
        },
        order(_col: string, opts: { ascending: boolean }) {
          filters.ascending = opts.ascending
          // .order() peut être suivi de .limit() (chaîne fixée) → rester chaînable
          // ET thenable : retourner le builder, la résolution se fait via then().
          return builder
        },
        then(onFulfilled: (v: { data: unknown; error: null }) => unknown) {
          return Promise.resolve(resolveSelect()).then(onFulfilled)
        },
      }
      return builder
    },
  }
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => makeClient(),
}))

// listActiveInstruments + upsertSnapshot mockés : pas de DB instruments, capture des snapshots.
vi.mock('@app/supabase', () => ({
  listActiveInstruments: () => Promise.resolve(instruments),
  upsertSnapshot: (
    _client: unknown,
    row: { computed_for_ts: string; style: string; timeframe_set: string },
  ) => {
    capturedSnapshots.push({
      computed_for_ts: row.computed_for_ts,
      style: row.style,
      timeframe_set: row.timeframe_set,
    })
    return Promise.resolve()
  },
}))

import { technicalEngine } from '../technical-engine'

// ─── Seed : > 1000 bougies par TF, ts croissants, la plus récente clôturée ─────
//
// On ancre la série dans un passé sûr (toutes <= cutoff quel que soit l'instant du test)
// et on espace régulièrement. Le ts MAX seedé par TF = computed_for_ts attendu.

const SEED_COUNT = 1100 // > cap 1000 : déclenche le plafond PostgREST

/** Génère SEED_COUNT bougies pour (instrumentId, timeframe), pas = stepMinutes, finissant à endIso. */
function seedCandles(
  instrumentId: string,
  timeframe: string,
  stepMinutes: number,
  endMs: number,
): CandleStoreRow[] {
  const rows: CandleStoreRow[] = []
  const stepMs = stepMinutes * 60_000
  for (let i = SEED_COUNT - 1; i >= 0; i--) {
    const ts = new Date(endMs - i * stepMs).toISOString()
    // Léger drift pour des séries d'indicateurs non dégénérées (EMA/ATR/structure).
    const base = 100 + (SEED_COUNT - 1 - i) * 0.01
    rows.push({
      id: `${instrumentId}-${timeframe}-${i}`,
      instrument_id: instrumentId,
      timeframe,
      ts,
      open: base,
      high: base + 1,
      low: base - 1,
      close: base + 0.5,
      volume: 1000 + i,
    })
  }
  return rows
}

// Ancrage : 2023-01-01 — bien dans le passé, toutes bougies clôturées.
// La PLUS RÉCENTE de chaque TF = ts max seedé = computed_for_ts attendu.
const ANCHOR_H1_END = Date.parse('2023-06-01T00:00:00.000Z')
const ANCHOR_H4_END = Date.parse('2023-06-01T00:00:00.000Z')

describe('technical-engine — non-régression cap 1000 (BUGFIX-CAP1000)', () => {
  beforeEach(() => {
    process.env['SUPABASE_URL'] = 'http://localhost'
    process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'test-service-role'

    instruments = [{ id: 'inst-1', symbol: 'BTCUSDT', broker: 'binance', active: true }]

    // Day = H4/H1, Swing = D/H4 → on seede H1, H4, D (>1000 chacun).
    candles = [
      ...seedCandles('inst-1', 'H1', 60, ANCHOR_H1_END),
      ...seedCandles('inst-1', 'H4', 240, ANCHOR_H4_END),
      ...seedCandles('inst-1', 'D', 1440, ANCHOR_H4_END),
    ]
    capturedSnapshots = []
  })

  it('computed_for_ts = ts de la DERNIÈRE bougie clôturée du LTF (pas la 1000ᵉ plus ancienne)', async () => {
    await technicalEngine()

    // Day : LTF = H1 → computed_for_ts attendu = ts max H1 seedé.
    const expectedDayTs = candles
      .filter((c) => c.timeframe === 'H1')
      .map((c) => c.ts)
      .sort()
      .at(-1)!

    // Swing : LTF = H4 → computed_for_ts attendu = ts max H4 seedé.
    const expectedSwingTs = candles
      .filter((c) => c.timeframe === 'H4')
      .map((c) => c.ts)
      .sort()
      .at(-1)!

    const day = capturedSnapshots.find((s) => s.style === 'day')
    const swing = capturedSnapshots.find((s) => s.style === 'swing')

    expect(day, 'snapshot day produit').toBeDefined()
    expect(swing, 'snapshot swing produit').toBeDefined()

    // Assertion clé : sur le code buggé (asc sans limit), le mock renvoie les 1000
    // plus VIEILLES → computed_for_ts = ts ancien ≠ ts max → ÉCHOUE (RED).
    expect(day!.computed_for_ts).toBe(expectedDayTs)
    expect(swing!.computed_for_ts).toBe(expectedSwingTs)
  })
})
