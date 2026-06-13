/**
 * Levels — clustering S/R + force multi-facteurs (TECH-03, D-34).
 *
 * MAISON : on regroupe les prix de swings dans une tolérance c×ATR en zones,
 * puis on note chaque zone par une force pondérée (touches + récence + ancienneté).
 * Plus de touches, retest récent et persistance longue ⇒ zone plus forte.
 * Les poids sont des constantes nommées (épinglées par golden test).
 */
import type { CandleRow } from '@app/supabase'
import { toOhlcv } from '../ohlcv.js'
import { atrSeries } from '../wrappers/atr.js'
import type { Swings } from './swings.js'

/** Tolérance de clustering = c × ATR. */
export const CLUSTER_C = 1.5
/** Poids du nombre de touches dans la force. */
export const W_TOUCHES = 0.5
/** Poids de la récence du dernier test. */
export const W_RECENCY = 0.3
/** Poids de l'ancienneté (persistance). */
export const W_AGE = 0.2

export type LevelType = 'support' | 'resistance'

export interface Level {
  readonly price: number
  readonly type: LevelType
  readonly strength: number
  readonly touches: number
}

interface SwingPoint {
  readonly idx: number
  readonly price: number
  readonly type: LevelType
}

/**
 * Regroupe les swings en zones S/R et calcule une force multi-facteurs.
 * @param rows - bougies clôturées, ts ascendant
 * @param swings - indices de swings highs/lows
 */
export function clusterLevels(rows: readonly CandleRow[], swings: Swings): Level[] {
  const { highs, lows } = toOhlcv(rows)
  const atr = atrSeries(rows)
  const avgAtr = atr.length > 0 ? atr.reduce((a, b) => a + b, 0) / atr.length : 1
  const tol = CLUSTER_C * (avgAtr || 1)
  const n = rows.length

  const points: SwingPoint[] = [
    ...swings.highs.map((i) => ({ idx: i, price: highs[i]!, type: 'resistance' as const })),
    ...swings.lows.map((i) => ({ idx: i, price: lows[i]!, type: 'support' as const })),
  ].sort((a, b) => a.price - b.price)

  const clusters: SwingPoint[][] = []
  for (const p of points) {
    const last = clusters.at(-1)
    if (last && Math.abs(p.price - last[0]!.price) <= tol && p.type === last[0]!.type) {
      last.push(p)
    } else {
      clusters.push([p])
    }
  }

  return clusters.map((members) => {
    const touches = members.length
    const meanPrice = members.reduce((a, m) => a + m.price, 0) / touches
    const lastIdx = Math.max(...members.map((m) => m.idx))
    const firstIdx = Math.min(...members.map((m) => m.idx))
    const recency = n > 1 ? lastIdx / (n - 1) : 0 // dernier test récent ⇒ proche de 1
    const age = n > 1 ? (n - 1 - firstIdx) / (n - 1) : 0 // existe depuis longtemps ⇒ proche de 1
    const touchScore = Math.min(touches / 3, 1) // saturé à 3 touches
    const strength =
      W_TOUCHES * touchScore + W_RECENCY * recency + W_AGE * age
    return {
      price: Math.round(meanPrice * 100) / 100,
      type: members[0]!.type,
      strength: Math.round(strength * 1000) / 1000,
      touches,
    }
  })
}
