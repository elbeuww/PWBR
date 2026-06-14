/**
 * Barème §3 (ARCHITECTURE lignes 103-118) — source de vérité du scoring /100.
 *
 * Constantes `as const` (patron sessions.ts:17). Aucune valeur magique dans
 * score.ts : tout poids/pénalité/borne/seuil vit ici, nommé et figé (golden).
 */
import type { Output } from '../schemas/output.js'

/** Poids par bloc, par style (somme blocs = 100 avant pénalités). §3. */
export const WEIGHTS = {
  day: { trendAlign: 25, keyLevel: 20, momentum: 15, fundamental: 15, news: 10, rr: 15 },
  swing: { trendAlign: 30, keyLevel: 20, momentum: 10, fundamental: 20, news: 10, rr: 10 },
} as const

/** Pénalités §3 (soustraites après les blocs). */
export const PENALTIES = {
  /** News high-impact imminente (upcoming_risk_events / news_risk). */
  newsHighImpact: -15,
  /** Volatilité extrême (atr_percentile ≥ seuil). */
  extremeVol: -10,
} as const

/**
 * Bornes des inputs numériques (concern security #4, T-04-14).
 * RSI/atr_percentile clampés ; net_sentiment clampé. ATR<0 → throw (bug upstream).
 */
export const INPUT_BOUNDS = {
  rsi: [0, 100],
  atrPercentile: [0, 100],
  netSentiment: [-1, 1],
} as const

/** Cibles R:R §3 par style (qualité du bloc rr). */
export const RR_TARGETS = {
  day: 1.5,
  swing: 2.0,
} as const

/** Seuil atr_percentile (0-100) au-delà duquel la volatilité est « extrême ». */
export const EXTREME_VOL_PERCENTILE = 90

/** Plafond appliqué quand HTF contredit ET pas de catalyseur fort (§3 règle dure). */
export const HTF_CONTRADICT_CAP = 45

/**
 * Catalyseur fort (condition EXACTE, concern revue) : il existe au moins un
 * `output.news_catalysts[]` avec `impact === 'high'` ET dont la `direction`
 * correspond à la direction du setup. Mapping textuel bullish↔long / bearish↔short.
 */
export function hasStrongCatalyst(output: Output): boolean {
  const wanted = output.direction === 'long' ? 'bullish' : 'bearish'
  return output.news_catalysts.some(
    (c) => c.impact === 'high' && c.direction.toLowerCase() === wanted,
  )
}
