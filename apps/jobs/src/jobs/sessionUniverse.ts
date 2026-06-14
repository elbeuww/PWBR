/**
 * Résolution de l'univers d'une session (JOB-02, D-49).
 *
 * univers(session) = produit cartésien
 *   { instruments actifs dont asset_class ∈ SESSIONS[session].asset_classes }
 *   × SESSIONS[session].styles
 *
 * Fonction PURE (instruments injectés, D-23) → testable hors-ligne, sans réseau.
 * L'appelant fournit la liste d'instruments via listActiveInstruments(@app/supabase).
 */
import type { InstrumentRow } from '@app/supabase'
import { SESSIONS, type SessionName, type TradeStyle } from '../../config/sessions.js'

/** Une paire instrument×style à analyser dans une session. */
export interface UniverseEntry {
  readonly instrument: InstrumentRow
  readonly style: TradeStyle
}

/**
 * Résout l'univers (instrument×style) d'une session à partir de la config figée
 * et de la liste d'instruments fournie. Filtre sur `active` ET appartenance de
 * `asset_class` aux classes de la session, puis croise avec les styles de la session.
 */
export function resolveSessionUniverse(
  session: SessionName,
  instruments: readonly InstrumentRow[],
): UniverseEntry[] {
  const def = SESSIONS[session]
  const assetClasses = new Set<string>(def.asset_classes)

  const eligible = instruments.filter(
    (inst) => inst.active && assetClasses.has(inst.asset_class),
  )

  const universe: UniverseEntry[] = []
  for (const instrument of eligible) {
    for (const style of def.styles) {
      universe.push({ instrument, style })
    }
  }
  return universe
}
