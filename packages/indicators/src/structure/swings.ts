/**
 * Swings — pivot fractal (fenêtre 2N+1) + filtre k×ATR (TECH-02, D-32).
 *
 * MAISON : technicalindicators ne fournit AUCUNE détection de structure
 * (CLAUDE.md "What NOT to Use"). Algorithme : une bougie i est un swing high
 * si son high domine ses N voisins de chaque côté ; conservé seulement si
 * l'amplitude pic↔creux voisin dépasse k×ATR (rejette le bruit). Symétrique
 * pour les lows. N et k = constantes nommées, épinglées par golden test.
 *
 * Convention bougie clôturée : on n'opère QUE sur des bougies déjà clôturées
 * (D-10) ; la bougie en cours n'est jamais passée ici.
 */
import type { CandleRow } from '@app/supabase'
import { toOhlcv } from '../ohlcv.js'
import { atrSeries, ATR_PERIOD } from '../wrappers/atr.js'

/** Demi-fenêtre du pivot fractal : fenêtre totale = 2N+1. */
export const SWING_N = 2
/** Multiplicateur ATR du filtre d'amplitude. */
export const SWING_K = 1.0

export interface Swings {
  /** Indices (dans rows) des swing highs confirmés. */
  readonly highs: number[]
  /** Indices (dans rows) des swing lows confirmés. */
  readonly lows: number[]
}

/**
 * Aligne la série ATR (plus courte de ATR_PERIOD) sur l'index de bougie i.
 * Retourne une valeur ATR de repli (moyenne) si i tombe dans le warmup.
 */
function atrAt(atr: number[], i: number, fallback: number): number {
  const idx = i - ATR_PERIOD
  return atr[idx] ?? fallback
}

/**
 * Détecte les swing highs/lows par pivot fractal filtré par ATR.
 * @param rows - bougies clôturées, ts ascendant
 * @returns indices des swings confirmés
 */
export function detectSwings(rows: readonly CandleRow[]): Swings {
  const { highs, lows } = toOhlcv(rows)
  const atr = atrSeries(rows)
  const avgAtr = atr.length > 0 ? atr.reduce((a, b) => a + b, 0) / atr.length : 0
  const n = rows.length

  const swingHighs: number[] = []
  const swingLows: number[] = []

  for (let i = SWING_N; i < n - SWING_N; i++) {
    const hi = highs[i]!
    const lo = lows[i]!
    let isHigh = true
    let isLow = true
    let neighborLowMin = Infinity
    let neighborHighMax = -Infinity

    for (let j = i - SWING_N; j <= i + SWING_N; j++) {
      if (j === i) continue
      if (highs[j]! >= hi) isHigh = false
      if (lows[j]! <= lo) isLow = false
      if (lows[j]! < neighborLowMin) neighborLowMin = lows[j]!
      if (highs[j]! > neighborHighMax) neighborHighMax = highs[j]!
    }

    const threshold = SWING_K * atrAt(atr, i, avgAtr)
    if (isHigh && hi - neighborLowMin > threshold) swingHighs.push(i)
    if (isLow && neighborHighMax - lo > threshold) swingLows.push(i)
  }

  return { highs: swingHighs, lows: swingLows }
}
