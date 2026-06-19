/**
 * reading-time.ts — temps de lecture déterministe d'un corps MDX brut (D-10, Q4).
 *
 * Calcul pur, indépendant du pipeline MDX : on mesure directement le corps brut via
 * la lib `reading-time` (CJS → default import, Pitfall 3 ; jamais `require`). Le
 * résultat est arrondi au supérieur (entier de minutes) pour un affichage stable et
 * des golden values testables (fr/en/ar).
 */
import readingTime from 'reading-time'

/** Minutes de lecture (entier, Math.ceil) pour un corps de contenu brut. */
export function computeReadingTime(body: string): number {
  return Math.ceil(readingTime(body).minutes)
}
