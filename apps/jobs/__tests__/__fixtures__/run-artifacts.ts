/**
 * Fixtures golden pour la frontière de confiance (persist.ts) — §3.
 *
 * Construit un `Output` agent valide (long, R:R sain), un snapshot combiné
 * (`CombinedSnapshot` aligné, partial=false) et un `SnapshotRow` enveloppe.
 * Des builders immutables (spread) dérivent les variantes de rejet
 * (R:R<1.2, SL incohérent, alloc≠100, structure contre, partial, short...).
 */
import type { Output } from '@app/core'
import type { CombinedSnapshot } from '@app/core'
import type { SnapshotRow, Json } from '@app/supabase'

export const INSTRUMENT_ID = '11111111-1111-1111-1111-111111111111'
export const CONTENT_HASH = 'hash-eurusd-day-001'
export const GENERATED_AT = '2026-06-14T07:05:00Z'

/** Output agent LONG valide : entrée 1.0800–1.0810, SL 1.0750, TP1/TP2 (alloc 60/40). */
export const validLongOutput: Output = {
  schema_version: '1.0.0',
  generated_at: GENERATED_AT,
  session: 'london',
  style: 'day',
  instrument: 'EURUSD',
  direction: 'long',
  timeframe_analysis: 'H4/H1',
  entry: { type: 'limit', price: 1.0805, zone: [1.08, 1.081] },
  stop_loss: 1.075,
  take_profits: [
    { price: 1.092, alloc_pct: 60 },
    { price: 1.1, alloc_pct: 40 },
  ],
  technical_reasons: ['EMA200 haussière', 'rebond support'],
  fundamental_reasons: ['EUR risk-on'],
  news_catalysts: [],
  upcoming_risk_events: [],
  invalidation: 'clôture H4 sous 1.0750',
  veteran_note: 'patience, laisser le prix venir',
  raw_indicators_ref: CONTENT_HASH,
}

/** Snapshot combiné §3 aligné LONG (HTF/LTF bullish), partial=false. */
export const alignedTechnical = {
  trend_htf: 'bullish' as const,
  trend_ltf: 'bullish' as const,
  momentum: { rsi: 58, macd_hist: 0.0004, slope: 0.0002 },
  volatility: { atr: 0.004, atr_percentile: 0.4 },
  key_levels: [{ price: 1.0795, type: 'support' as const, strength: 0.8 }],
  structure: { last_swing_high: 1.085, last_swing_low: 1.075, bos_choch: 'bos' as const },
  volume_state: 'expanding' as const,
}

export const alignedFundamental = {
  macro_bias: 'risk_on' as const,
  rate_environment: 'dovish' as const,
  dxy_trend: 'down',
  real_yields: 'falling',
  asset_specific_drivers: ['ECB dovish'],
}

export const alignedNews = {
  net_sentiment: 0.6,
  recent_catalysts: [],
  upcoming_events: [],
  news_risk: false,
}

export const combinedSnapshot: CombinedSnapshot = {
  technical: alignedTechnical,
  fundamental: alignedFundamental,
  news: alignedNews,
}

/** SnapshotRow enveloppe (payload = CombinedSnapshot), partial=false par défaut. */
export function makeSnapshotRow(
  payload: CombinedSnapshot = combinedSnapshot,
  partial = false,
): SnapshotRow {
  return {
    id: '22222222-2222-2222-2222-222222222222',
    instrument_id: INSTRUMENT_ID,
    style: 'day',
    timeframe_set: 'H4/H1',
    kind: 'combined',
    computed_for_ts: '2026-06-14T06:00:00Z',
    content_hash: CONTENT_HASH,
    payload: payload as unknown as Json,
    partial,
    created_at: '2026-06-14T06:01:00Z',
  }
}

/** Sérialise un Output en JSON brut (option fence markdown). */
export function toRaw(output: Output, fenced = false): string {
  const json = JSON.stringify(output, null, 2)
  return fenced ? '```json\n' + json + '\n```' : json
}
