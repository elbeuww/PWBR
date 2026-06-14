/**
 * Fixtures partagées scoring — outputs §3 figés (golden).
 *
 * Dérivés de l'exemple §3 ARCHITECTURE (XAU_USD). Un long + un short figés,
 * réutilisés par rr/risk/confidence/score tests. Patron valid/bad de
 * snapshots.test.ts : on part d'une base figée et on dérive `{...base, champ}`.
 *
 * Ces objets respectent le contrat `Output` (@app/core) MAIS sans les champs
 * produits par le code (opportunity_score/risk_level/confidence/risk_reward).
 */
import type { Output } from '../../../src/schemas/output.js'
import type {
  TechnicalSnapshot,
  FundamentalContext,
  NewsContext,
} from '@app/indicators'

/** Snapshot combiné §3 consommé par scoreSetup (les 3 kinds assemblés). */
export interface CombinedSnapshot {
  technical: TechnicalSnapshot
  fundamental: FundamentalContext
  news: NewsContext
}

// ─── Output LONG figé (XAU_USD, §3) ──────────────────────────────────────────
export const longOutput: Output = {
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
  technical_reasons: ['Daily en HH/HL, prix au-dessus EMA200', 'Rejet du support H4 2316'],
  fundamental_reasons: ['DXY en repli, real yields baissent → favorable à l’or'],
  news_catalysts: [
    { headline: 'Fed minutes dovish', impact: 'high', direction: 'bullish', ts: '2026-06-08T18:00:00Z' },
  ],
  upcoming_risk_events: [],
  invalidation: 'Clôture H4 sous 2305 = thèse invalidée',
  veteran_note: 'Pullback propre dans une tendance saine.',
  raw_indicators_ref: 'hash-technical-long',
}

// ─── Output SHORT figé (miroir, zone inversée) ───────────────────────────────
export const shortOutput: Output = {
  ...longOutput,
  direction: 'short',
  // short : on entre dans la zone, SL au-dessus, TP en dessous
  entry: { type: 'limit', price: 2318.5, zone: [2316.0, 2320.0] },
  stop_loss: 2335.0,
  take_profits: [
    { price: 2301.0, alloc_pct: 50 },
    { price: 2284.0, alloc_pct: 50 },
  ],
  news_catalysts: [
    { headline: 'Fed minutes hawkish', impact: 'high', direction: 'bearish', ts: '2026-06-08T18:00:00Z' },
  ],
  raw_indicators_ref: 'hash-technical-short',
}

// ─── Snapshots combinés §3 figés ─────────────────────────────────────────────

/** Snapshot confluence FORTE alignée LONG (tendance HTF/LTF bullish, momentum, etc.). */
export const bullishSnapshot: CombinedSnapshot = {
  technical: {
    trend_htf: 'bullish',
    trend_ltf: 'bullish',
    momentum: { rsi: 58, macd_hist: 0.8, slope: 0.5 },
    volatility: { atr: 12.0, atr_percentile: 40 },
    key_levels: [
      { price: 2316.0, type: 'support', strength: 0.9 },
      { price: 2352.0, type: 'resistance', strength: 0.6 },
    ],
    structure: { last_swing_high: 2330.0, last_swing_low: 2300.0, bos_choch: 'bos' },
    volume_state: 'expanding',
  },
  fundamental: {
    macro_bias: 'risk_on',
    rate_environment: 'dovish',
    dxy_trend: 'DXY(-)',
    real_yields: 'REAL_YIELDS(-)',
    asset_specific_drivers: ['DXY(-dir)', 'REAL_YIELDS(-dir)'],
  },
  news: { net_sentiment: 0.6, recent_catalysts: ['Fed dovish'], upcoming_events: [], news_risk: false },
}

/** Snapshot où le HTF CONTREDIT un setup LONG (HTF bearish) → cap testable. */
export const htfContradictsSnapshot: CombinedSnapshot = {
  ...bullishSnapshot,
  technical: { ...bullishSnapshot.technical, trend_htf: 'bearish', trend_ltf: 'bullish' },
}
