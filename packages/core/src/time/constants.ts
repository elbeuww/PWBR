/**
 * Constantes temporelles partagées — packages/core (D-10)
 *
 * Source de vérité pour tous les timeframes et fuseau canonique.
 * Consommé par apps/jobs et les futures phases (indicateurs, moteur).
 */

/** Timeframes supportés en minutes (MVP). */
export const TIMEFRAMES = {
  H1: 60,
  H4: 240,
  D: 1440,
} as const

export type Timeframe = keyof typeof TIMEFRAMES

/** Fuseau canonique UTC utilisé pour tout stockage et calcul. */
export const UTC_ZONE = 'UTC' as const
