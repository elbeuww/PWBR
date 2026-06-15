/**
 * Barrel QR maison — encodeur + rendu SVG, zéro dépendance npm (B-04-03).
 * N'encode JAMAIS que l'adresse publique de réception (jamais le montant, jamais de secret).
 */
export { encodeText, Ecc } from './qrcodegen.js'
export type { QrMatrix } from './qrcodegen.js'
export { toSvgPath, svgViewBoxSize, QR_QUIET_ZONE } from './toSvgPath.js'
