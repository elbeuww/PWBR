/**
 * Job technical-engine — STUB (Task 1, TDD RED).
 *
 * Expose la signature de la fonction pure d'assemblage `buildTechnicalSnapshot`
 * (séparation logique/IO pour testabilité, D-23) afin que l'import du test se
 * résolve. Le corps lève NotImplemented : le RED vient de l'échec d'assertion,
 * pas d'un crash au chargement du module. L'implémentation réelle arrive en Task 2.
 */
import type { CandleRow } from '@app/supabase'
import type { TechnicalSnapshot, VolumeSource } from '@app/indicators'

export type Style = 'day' | 'swing'

export interface BuildResult {
  readonly snapshot: TechnicalSnapshot
  readonly partial: boolean
  readonly missing: string[]
}

/**
 * Fonction pure d'assemblage du technical_snapshot §3.
 * @param candlesByTf - bougies clôturées par timeframe (HTF, LTF), ts ascendant
 * @param style - 'day' (H4/H1) | 'swing' (D/H4)
 * @param volumeSource - 'real' (Binance) | 'proxy' (OANDA tick)
 */
export function buildTechnicalSnapshot(
  _candlesByTf: { htf: readonly CandleRow[]; ltf: readonly CandleRow[] },
  _style: Style,
  _volumeSource: VolumeSource,
): BuildResult {
  throw new Error('NotImplemented')
}
