/**
 * Barrel @app/data-sources
 *
 * Exports : clients Binance/OANDA, parsers normalisation UTC, mapping instruments.
 */

// Binance
export { fetchBinanceKlines } from './binance/client.js'
export { parseBinanceKlines } from './binance/schema.js'

// OANDA
export { fetchOandaCandles } from './oanda/client.js'
export { parseOandaCandles } from './oanda/schema.js'
export { OANDA_SYMBOLS } from './oanda/instruments.js'
