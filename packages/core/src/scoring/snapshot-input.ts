/**
 * Types d'ENTRÉE du scoring — forme §3 consommée par scoreSetup.
 *
 * Pourquoi local à @app/core et NON `import type` depuis @app/indicators :
 * importer le type via les `paths` tsconfig tire la SOURCE d'indicators
 * (`packages/indicators/src/index.ts`) hors du `rootDir` du projet composite
 * `@app/core` → TS6059/TS6307 (rootDir) + traîne la dépendance @app/supabase.
 * @app/core est le package le plus BAS (indicators dépend de core, pas l'inverse) :
 * il ne doit RIEN importer en runtime d'indicators (concern archi, anti-cycle).
 *
 * Ces interfaces sont un MIROIR STRUCTUREL de TechnicalSnapshotSchema /
 * FundamentalContextSchema / NewsContextSchema (§3, source de vérité Zod côté
 * indicators). Le snapshot est validé Zod À LA PRODUCTION (P3, T-03-08) ; côté
 * consommateur, un contrat structurel suffit et garde le graphe de dépendances
 * unidirectionnel. Compatibilité structurelle : un `TechnicalSnapshot`
 * d'@app/indicators est assignable à `TechnicalSnapshotInput` (mêmes champs §3).
 */

export type TrendState = 'bullish' | 'bearish' | 'range'

export interface KeyLevelInput {
  price: number
  type: 'support' | 'resistance' | 'poc'
  strength: number
  volume_source?: 'real' | 'proxy'
}

export interface TechnicalSnapshotInput {
  trend_htf: TrendState
  trend_ltf: TrendState
  momentum: { rsi: number; macd_hist: number; slope: number }
  volatility: { atr: number; atr_percentile: number }
  key_levels: KeyLevelInput[]
  structure: { last_swing_high: number; last_swing_low: number; bos_choch: 'bos' | 'choch' | null }
  volume_state: 'expanding' | 'contracting'
}

export interface FundamentalContextInput {
  macro_bias: 'risk_on' | 'risk_off' | 'neutral'
  rate_environment: 'hawkish' | 'dovish' | 'neutral'
  dxy_trend: string
  real_yields: string
  asset_specific_drivers: string[]
}

export interface NewsContextInput {
  net_sentiment: number
  recent_catalysts: string[]
  upcoming_events: string[]
  news_risk: boolean
}

/** Snapshot combiné §3 (les 3 kinds assemblés) consommé par scoreSetup. */
export interface CombinedSnapshot {
  technical: TechnicalSnapshotInput
  fundamental: FundamentalContextInput
  news: NewsContextInput
}
