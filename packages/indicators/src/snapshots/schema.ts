/**
 * Schéma §3 LOCKED — formes technical/fundamental/news (TECH-04, FUND-01/02/03).
 *
 * Encode champ par champ les formes verrouillées par ARCHITECTURE.md §3.
 * Validé AVANT tout upsert snapshot (V5 ASVS, T-03-08) : un enum hors §3 ou
 * un sentiment hors borne est rejeté à la frontière. Zod v4.
 * Les types TS sont dérivés via z.infer (source de vérité unique = schéma).
 */
import { z } from 'zod'

// --- technical_snapshot (§3) ---
const TrendEnum = z.enum(['bullish', 'bearish', 'range'])

export const KeyLevelSchema = z.object({
  price: z.number(),
  type: z.enum(['support', 'resistance', 'poc']),
  strength: z.number(),
  // D-35 : flag d'honnêteté — chaque poc porte sa source de volume
  volume_source: z.enum(['real', 'proxy']).optional(),
})

export const TechnicalSnapshotSchema = z.object({
  trend_htf: TrendEnum,
  trend_ltf: TrendEnum,
  momentum: z.object({
    rsi: z.number(),
    macd_hist: z.number(),
    slope: z.number(),
  }),
  volatility: z.object({
    atr: z.number(),
    atr_percentile: z.number(),
  }),
  key_levels: z.array(KeyLevelSchema),
  structure: z.object({
    last_swing_high: z.number(),
    last_swing_low: z.number(),
    bos_choch: z.enum(['bos', 'choch']).nullable(),
  }),
  volume_state: z.enum(['expanding', 'contracting']),
})

// --- fundamental_context (§3) ---
export const FundamentalContextSchema = z.object({
  macro_bias: z.enum(['risk_on', 'risk_off', 'neutral']),
  rate_environment: z.enum(['hawkish', 'dovish', 'neutral']),
  dxy_trend: z.string(),
  real_yields: z.string(),
  asset_specific_drivers: z.array(z.string()),
})

// --- news_context (§3) ---
export const NewsContextSchema = z.object({
  net_sentiment: z.number().min(-1).max(1),
  recent_catalysts: z.array(z.string()),
  upcoming_events: z.array(z.string()),
  // D-40 : événement à fort impact imminent
  news_risk: z.boolean(),
})

export type TechnicalSnapshot = z.infer<typeof TechnicalSnapshotSchema>
export type FundamentalContext = z.infer<typeof FundamentalContextSchema>
export type NewsContext = z.infer<typeof NewsContextSchema>
export type KeyLevel = z.infer<typeof KeyLevelSchema>
