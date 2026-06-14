/**
 * Config sessions versionnée (D-49) — mapping session → asset_classes + styles.
 *
 * Source de vérité de l'univers couvert par chaque routine planifiée (JOB-02).
 * Data-not-code : un changement de périmètre = un changement de cette config
 * versionnée, jamais une logique dispersée. Patron `as const` + `keyof typeof`
 * (miroir packages/core/src/time/sessions.ts).
 *
 * D-49 : crypto (24/7) est incluse dans CHAQUE session ; energy absente de asia
 * (marchés énergie non actifs sur la fenêtre Tokyo).
 *
 * L'univers réel d'une session = SESSIONS[session].asset_classes ∩ instruments
 * actifs (résolu par resolveSessionUniverse, sessionUniverse.ts).
 */

/** Style de trading couvert par une session. */
export type TradeStyle = 'day' | 'swing'

/** Définition figée d'une session : classes d'actifs couvertes + styles produits. */
export interface SessionDef {
  readonly asset_classes: readonly string[]
  readonly styles: readonly TradeStyle[]
}

/**
 * Univers par session (D-49). Crypto dans chaque session ; energy hors asia.
 * Crons UTC associés (config agent hors git, ARCHITECTURE §5) :
 *  - asia      `00 23 * * 0-4`
 *  - london    `00 07 * * 1-5`
 *  - newyork   `30 12 * * 1-5`
 *  - eod-swing `00 21 * * 1-5`
 */
export const SESSIONS = {
  asia: {
    asset_classes: ['forex', 'metal', 'crypto'],
    styles: ['day'],
  },
  london: {
    asset_classes: ['forex', 'metal', 'energy', 'crypto'],
    styles: ['day', 'swing'],
  },
  newyork: {
    asset_classes: ['forex', 'metal', 'energy', 'crypto'],
    styles: ['day'],
  },
  'eod-swing': {
    asset_classes: ['forex', 'metal', 'energy', 'crypto'],
    styles: ['swing'],
  },
} as const satisfies Record<string, SessionDef>

/** Nom d'une session connue (clé de SESSIONS). */
export type SessionName = keyof typeof SESSIONS
