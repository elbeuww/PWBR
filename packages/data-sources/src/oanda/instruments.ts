/**
 * Mapping symbole canonique <-> source_symbol OANDA — D-18.
 *
 * Ce mapping documente la convention de nommage entre le symbole canonique
 * utilisé dans la base et le symbole source attendu par l'API OANDA.
 *
 * Le job market-ingest lit instruments.source_symbol depuis la base,
 * mais ce mapping sert de référence et de documentation.
 */

/** Mapping canonical_symbol → source_symbol OANDA pour les 7 instruments OANDA */
export const OANDA_SYMBOLS: Record<string, string> = {
  'EUR/USD': 'EUR_USD',
  'GBP/USD': 'GBP_USD',
  'USD/JPY': 'USD_JPY',
  'AUD/USD': 'AUD_USD',
  'XAU/USD': 'XAU_USD',
  'XAG/USD': 'XAG_USD',
  'WTI/USD': 'WTICO_USD',
} as const
