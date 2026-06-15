/**
 * Barrel @app/data-sources
 *
 * Exports : clients Binance/OANDA, parsers normalisation UTC, mapping instruments.
 *           Clients news (Finnhub/Marketaux), macro (FRED), calendrier (FairEconomy).
 */

// Binance
export { fetchBinanceKlines } from './binance/client.js'
export { parseBinanceKlines } from './binance/schema.js'

// OANDA
export { fetchOandaCandles } from './oanda/client.js'
export { parseOandaCandles } from './oanda/schema.js'
export { OANDA_SYMBOLS } from './oanda/instruments.js'

// Finnhub news (D-28 : marketNews par catégorie uniquement)
export { fetchFinnhubNews, type FinnhubCategory } from './finnhub/client.js'
export { parseFinnhubNews } from './finnhub/schema.js'

// Marketaux news (fallback Finnhub — D-29, câblé dans le job plan 04)
export { fetchMarketauxNews, parseMarketauxNews } from './marketaux/client.js'

// FRED macro (DFF, CPIAUCSL, DTWEXBGS proxy DXY, DFII10)
export { fetchFredSeries, parseFredObservations } from './fred/client.js'

// FairEconomy calendrier économique (FOMC, CPI, NFP — sans clé, cache 24h)
export { fetchFairEconomyCalendar, parseFairEconomyCalendar } from './faireconomy/client.js'

// TronGrid — vérification on-chain paiements USDT TRC-20 (Phase 4, serveur/jobs only)
export {
  base58ToHex,
  hexToBase58,
  sameAddress,
  Trc20TransfersResponseSchema,
  Trc20TransferSchema,
  Trc20TokenInfoSchema,
  fetchTrc20TransfersForReceiver,
  getTransferByHash,
  verifyTransfer,
} from './trongrid/index.js'
export type {
  Trc20Transfer,
  Trc20TransfersResponse,
  Trc20TokenInfo,
  VerificationResult,
  VerifyContext,
} from './trongrid/index.js'
