/**
 * ohlcv — mapping CandleRow[] (ts ascendant) → arrays typés pour les wrappers.
 *
 * TECH-01 : frontière d'entrée du moteur déterministe. Le volume null
 * (FX OANDA avant tick-volume confirmé) est normalisé à 0 (RESEARCH ligne 304).
 * Aucune logique d'indicateur ici — uniquement la projection colonne.
 */
import type { CandleRow } from '@app/supabase'

export interface Ohlcv {
  readonly closes: number[]
  readonly highs: number[]
  readonly lows: number[]
  readonly vols: number[]
}

/**
 * Projette des bougies (ordre ts ascendant) en colonnes numériques.
 * @param rows - bougies clôturées, ts croissant
 * @returns colonnes closes/highs/lows/vols alignées sur rows
 */
export function toOhlcv(rows: readonly CandleRow[]): Ohlcv {
  return {
    closes: rows.map((r) => r.close),
    highs: rows.map((r) => r.high),
    lows: rows.map((r) => r.low),
    vols: rows.map((r) => r.volume ?? 0),
  }
}
