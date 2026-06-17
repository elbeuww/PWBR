/**
 * Rendu SVG d'une matrice QR — 100% offline, zéro réseau, zéro dépendance.
 *
 * Produit un attribut `d` de <path> (un seul path = un seul nœud DOM, perf).
 * La quiet zone (marge blanche obligatoire, ISO/IEC 18004 §9.1 = 4 modules) est
 * intégrée dans le viewBox pour garantir la scannabilité.
 */
import type { QrMatrix } from './qrcodegen.js'

/** Marge blanche obligatoire autour du QR (en modules). */
export const QR_QUIET_ZONE = 4

/**
 * Convertit la matrice en attribut `d` de path SVG (modules noirs uniquement).
 * Coordonnées décalées de la quiet zone.
 */
export function toSvgPath(matrix: QrMatrix, quietZone = QR_QUIET_ZONE): string {
  const parts: string[] = []
  for (let y = 0; y < matrix.size; y++) {
    for (let x = 0; x < matrix.size; x++) {
      if (matrix.modules[y]![x]) {
        parts.push(`M${x + quietZone},${y + quietZone}h1v1h-1z`)
      }
    }
  }
  return parts.join('')
}

/** Côté total du viewBox (modules + 2 × quiet zone). */
export function svgViewBoxSize(matrix: QrMatrix, quietZone = QR_QUIET_ZONE): number {
  return matrix.size + quietZone * 2
}
