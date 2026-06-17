/**
 * Re-export mince du seuil d'affichage track record (TRACK-03, D-09/D-12).
 *
 * La logique vit désormais en @app/core (source unique partagée vitrine ↔ Telegram,
 * D-11) — voir packages/core/src/track-record/threshold.ts. Ce module préserve la
 * surface d'import historique de la vitrine P5 sans dupliquer la décision de seuil.
 */
export { MIN_SAMPLE, applyThreshold } from '@app/core'
export type { StatRow, SufficientStat, InsufficientStat, ThresholdResult } from '@app/core'
