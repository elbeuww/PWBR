/**
 * Mapping symbole/intervalle Twelve Data — remplace OANDA (token mort, 401).
 *
 * source_symbol DB (ex 'EUR_USD') → symbole Twelve Data ('EUR/USD') : underscore → slash.
 * Granularité interne (H1/H4/D) → intervalle Twelve Data (1h/4h/1day).
 *
 * FREE couvre EUR/USD, GBP/USD, USD/JPY, AUD/USD, XAU/USD. PAS XAG/USD ni WTI
 * (→ 404 "Grow or Venture plan") : ces deux instruments sont désactivés en DB (0022).
 */

/** source_symbol DB → symbole Twelve Data ('EUR_USD' → 'EUR/USD'). */
export function toTwelveDataSymbol(sourceSymbol: string): string {
  return sourceSymbol.replace('_', '/')
}

const TWELVEDATA_INTERVAL_MAP: Record<string, string> = {
  H1: '1h',
  H4: '4h',
  D: '1day',
}

/** Granularité interne ('H1'|'H4'|'D') → intervalle Twelve Data ('1h'|'4h'|'1day'). */
export function toTwelveDataInterval(timeframe: string): string {
  const interval = TWELVEDATA_INTERVAL_MAP[timeframe]
  if (!interval) {
    throw new Error(`toTwelveDataInterval: timeframe non supporté "${timeframe}"`)
  }
  return interval
}

/**
 * Mapping canonical_symbol → source_symbol pour les 5 instruments couverts par
 * le plan FREE Twelve Data (documentaire, calqué sur OANDA_SYMBOLS).
 */
export const TWELVEDATA_SYMBOLS: Record<string, string> = {
  'EUR/USD': 'EUR_USD',
  'GBP/USD': 'GBP_USD',
  'USD/JPY': 'USD_JPY',
  'AUD/USD': 'AUD_USD',
  'XAU/USD': 'XAU_USD',
} as const
