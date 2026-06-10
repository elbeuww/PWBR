/**
 * Utilitaires de bougies — packages/core (D-10)
 *
 * Implémente la convention anti look-ahead : on ne retourne QUE les bougies
 * clôturées, jamais la bougie en cours.
 *
 * Source: moment.github.io/luxon (DateTime, toSeconds)
 */
import { DateTime } from 'luxon'

/**
 * Retourne le timestamp de début (borne haute EXCLUSIVE) de la dernière
 * bougie CLÔTURÉE pour le timeframe donné.
 *
 * Algorithme :
 *   bucket_en_cours = floor(epoch_sec / (tfMinutes * 60))
 *   dernière_clôturée = bucket_en_cours - 1
 *   résultat = (bucket_en_cours - 1) * tfMinutes * 60 (en secondes)
 *
 * Invariant garanti : résultat < now (anti look-ahead D-10)
 *
 * @param now     Instant de référence (tout fuseau, converti en UTC en interne)
 * @param tfMinutes Durée du timeframe en minutes (ex: 60 pour H1, 240 pour H4)
 * @returns DateTime UTC du début de la dernière bougie clôturée
 */
export function lastClosedCandleStart(now: DateTime, tfMinutes: number): DateTime {
  const utc = now.toUTC()
  const tfSeconds = tfMinutes * 60
  const bucketCurrent = Math.floor(utc.toSeconds() / tfSeconds)
  // La bougie en cours est bucketCurrent → la dernière clôturée est bucketCurrent - 1
  const lastClosedEpoch = (bucketCurrent - 1) * tfSeconds
  return DateTime.fromSeconds(lastClosedEpoch, { zone: 'utc' })
}
