/**
 * QrCode — composant React rendant un QR en SVG inline, 100% offline.
 *
 * Aucun appel réseau, aucun service QR distant, aucune dépendance npm. Encode
 * UNIQUEMENT la chaîne `value` (l'adresse publique de réception). Rendu en un
 * seul <path> sur fond blanc avec quiet zone. LTR forcé (un QR n'est jamais
 * miroité en RTL). `aria-label` fourni pour l'accessibilité.
 */
import { encodeText, type Ecc } from './qrcodegen'
import { toSvgPath, svgViewBoxSize } from './toSvgPath'

interface QrCodeProps {
  /** Chaîne à encoder (adresse publique base58 uniquement). */
  value: string
  /** Label accessible (alt). */
  ariaLabel: string
  /** Taille de rendu en px (carré). Défaut 200. */
  size?: number
  /** Niveau de correction d'erreur (optionnel). */
  ecc?: Ecc
  className?: string
}

export function QrCode({ value, ariaLabel, size = 200, ecc, className }: QrCodeProps) {
  const matrix = encodeText(value, ecc)
  const viewBox = svgViewBoxSize(matrix)
  const path = toSvgPath(matrix)

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      width={size}
      height={size}
      viewBox={`0 0 ${viewBox} ${viewBox}`}
      dir="ltr"
      shapeRendering="crispEdges"
      className={className}
    >
      <rect width={viewBox} height={viewBox} fill="#ffffff" />
      <path d={path} fill="#000000" />
    </svg>
  )
}
