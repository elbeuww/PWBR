/**
 * Volume — POC (point of control) par profil proportional-overlap (TECH-03, D-35).
 *
 * MAISON : sans données intrabar, on répartit le volume de chaque bougie sur des
 * bins de prix proportionnellement au recouvrement de [low, high] avec chaque bin.
 * Le POC = bin de plus fort volume cumulé. CHAQUE POC porte son volume_source :
 *  - 'real'  : volume réel (crypto Binance)
 *  - 'proxy' : tick-volume (forex/commodities OANDA) — flag d'honnêteté NON NÉGOCIABLE.
 *
 * RESEARCH Pattern 5 / Pitfall 4 : un tick-volume présenté comme volume réel
 * tromperait le "vétéran" — d'où le flag obligatoire.
 */
import type { CandleRow } from '@app/supabase'
import { toOhlcv } from '../ohlcv.js'

export type VolumeSource = 'real' | 'proxy'

/** Nombre de bins du profil de volume. */
export const POC_BINS = 24

export interface Poc {
  readonly price: number
  readonly volume_source: VolumeSource
}

/**
 * Calcule le POC par recouvrement proportionnel sur l'ensemble des bougies.
 * @param rows - bougies clôturées, ts ascendant
 * @param source - 'real' (Binance) | 'proxy' (OANDA tick)
 */
export function computePoc(rows: readonly CandleRow[], source: VolumeSource): Poc {
  const { highs, lows, vols } = toOhlcv(rows)
  const priceMin = Math.min(...lows)
  const priceMax = Math.max(...highs)
  const span = priceMax - priceMin || 1
  const binSize = span / POC_BINS

  const binVolume = new Array<number>(POC_BINS).fill(0)

  for (let i = 0; i < rows.length; i++) {
    const lo = lows[i]!
    const hi = highs[i]!
    const vol = vols[i]!
    const range = hi - lo || binSize // bougie à range nul → tout dans un bin

    for (let b = 0; b < POC_BINS; b++) {
      const binLo = priceMin + b * binSize
      const binHi = binLo + binSize
      const overlap = Math.max(0, Math.min(hi, binHi) - Math.max(lo, binLo))
      if (overlap > 0) binVolume[b]! += vol * (overlap / range)
    }
  }

  let pocBin = 0
  for (let b = 1; b < POC_BINS; b++) {
    if (binVolume[b]! > binVolume[pocBin]!) pocBin = b
  }

  const pocPrice = priceMin + (pocBin + 0.5) * binSize
  return { price: Math.round(pocPrice * 100) / 100, volume_source: source }
}
