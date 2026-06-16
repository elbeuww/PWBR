/**
 * Types sérialisables passés du RSC TrackRecordBlock vers le client TrackRecordView.
 *
 * Les valeurs sont déjà passées par applyThreshold (05-01) côté serveur : la vue
 * client ne décide rien du seuil, elle se contente de rendre (% ou « insuffisant »),
 * formatant les nombres via Intl. N est toujours présent (D-12).
 */
import type { ThresholdResult } from '@/lib/track-record/threshold'

/** Une ligne de catégorie de la table par-dimension (seuil déjà appliqué). */
export interface CategoryStat {
  /** Dimension brute (asset | asset_class | style | score_band | risk). */
  dimension: string
  /** Clé de bucket brute (ex. 'day', 'low', 'BTCUSDT', '80-100'). */
  bucket: string
  /** Résultat seuillé : % + N (sufficient) ou N seul (insufficient). */
  stat: ThresholdResult
}

/** Données d'une période (all_time | 90d), déjà seuillées. */
export interface PeriodStats {
  /** Agrégat global (dimension 'overall'). null si aucune ligne overall. */
  overall: ThresholdResult | null
  /** Lignes par catégorie, regroupées par dimension. */
  categories: CategoryStat[]
}

/** Payload complet rendu par TrackRecordView. */
export interface TrackRecordData {
  allTime: PeriodStats
  last90d: PeriodStats
}
