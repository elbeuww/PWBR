/**
 * Structure — classification HH/HL + BOS/CHoCH sur CLÔTURE DU CORPS (TECH-02, D-33).
 *
 * MAISON : la confirmation se fait UNIQUEMENT sur la clôture du corps (close),
 * jamais sur la mèche (high/low). Une mèche qui perce un swing mais dont le corps
 * clôture en-deçà = anti stop-hunt → AUCUN signal. Aligné sur la convention
 * bougie clôturée de @app/core (D-10, jamais redéfinie ici).
 *
 * BOS  = clôture du corps au-delà du dernier swing de MÊME sens (continuation).
 * CHoCH = clôture du corps au-delà du dernier swing OPPOSÉ (retournement précoce).
 */
import type { CandleRow } from '@app/supabase'
import { detectSwings, type Swings } from './swings.js'

export type BreakSignal = 'bos' | 'choch'

export interface StructureState {
  /** Prix du dernier swing high confirmé, ou null. */
  readonly lastSwingHigh: number | null
  /** Prix du dernier swing low confirmé, ou null. */
  readonly lastSwingLow: number | null
  /** Signal de cassure sur la dernière bougie clôturée, ou null. */
  readonly signal: BreakSignal | null
}

/**
 * Évalue BOS/CHoCH sur la dernière bougie clôturée par rapport aux swings antérieurs.
 * @param rows - bougies clôturées, ts ascendant
 * @param swings - swings pré-calculés (optionnel ; sinon détectés)
 */
export function detectBosChoch(
  rows: readonly CandleRow[],
  swings?: Swings,
): StructureState {
  const s = swings ?? detectSwings(rows)
  const lastIdx = rows.length - 1
  const close = rows[lastIdx]?.close ?? null

  // Derniers swings STRICTEMENT antérieurs à la bougie évaluée.
  const priorHighIdx = [...s.highs].reverse().find((i) => i < lastIdx) ?? null
  const priorLowIdx = [...s.lows].reverse().find((i) => i < lastIdx) ?? null
  const lastSwingHigh = priorHighIdx !== null ? rows[priorHighIdx]!.high : null
  const lastSwingLow = priorLowIdx !== null ? rows[priorLowIdx]!.low : null

  let signal: BreakSignal | null = null
  if (close !== null) {
    // Sens de la tendance établie AVANT la cassure, déduit de la séquence des
    // swing highs (HH ⇒ haussier) et des swing lows (LL ⇒ baissier). Par défaut
    // (un seul swing de chaque côté ou ambigu) : haussier si le dernier pivot
    // observé est un high, baissier si c'est un low.
    const trend = trendDirection(rows, s, priorHighIdx, priorLowIdx)

    if (lastSwingHigh !== null && close > lastSwingHigh) {
      // clôture au-dessus du swing high. BOS si tendance déjà haussière OU
      // indéterminée (la cassure haussière confirme la continuation par défaut) ;
      // CHoCH uniquement si une tendance baissière était établie (retournement).
      signal = trend === 'down' ? 'choch' : 'bos'
    } else if (lastSwingLow !== null && close < lastSwingLow) {
      // clôture sous le swing low. BOS si tendance déjà baissière OU indéterminée ;
      // CHoCH uniquement si une tendance haussière était établie.
      signal = trend === 'up' ? 'choch' : 'bos'
    }
  }

  return { lastSwingHigh, lastSwingLow, signal }
}

type Trend = 'up' | 'down' | 'flat'

/**
 * Déduit le sens de tendance ÉTABLIE avant la cassure :
 *  - séquence de swing highs croissante (HH) ⇒ 'up'
 *  - séquence de swing lows décroissante (LL) ⇒ 'down'
 *  - sinon 'flat' (indéterminée) ⇒ la cassure elle-même définit BOS par défaut.
 */
function trendDirection(
  rows: readonly CandleRow[],
  s: Swings,
  priorHighIdx: number | null,
  priorLowIdx: number | null,
): Trend {
  const highIdx = s.highs.filter((i) => priorHighIdx === null || i <= priorHighIdx)
  const lowIdx = s.lows.filter((i) => priorLowIdx === null || i <= priorLowIdx)

  if (highIdx.length >= 2) {
    const a = rows[highIdx.at(-2)!]!.high
    const b = rows[highIdx.at(-1)!]!.high
    if (b > a) return 'up'
    if (b < a) return 'down'
  }
  if (lowIdx.length >= 2) {
    const a = rows[lowIdx.at(-2)!]!.low
    const b = rows[lowIdx.at(-1)!]!.low
    if (b < a) return 'down'
    if (b > a) return 'up'
  }
  return 'flat'
}
