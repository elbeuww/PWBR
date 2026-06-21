/**
 * lib/fonts.ts — les 5 familles NEXA self-hostées (D-01/D-02/D-03, zéro CDN au runtime).
 *
 * Toutes via next/font/local sur les .woff2 versionnés dans src/fonts/ (copiés depuis
 * les paquets @fontsource au build-time, weights 400 + 600). Aucune requête vers
 * fonts.googleapis.com / fonts.gstatic.com au runtime — self-host pur (D-03).
 *
 * Familles → variable CSS → rôle (10-CONTEXT D-02 / UI-SPEC §Typography) :
 *   Archivo          → --font-archivo          (display/titres/wordmark)
 *   Space Grotesk    → --font-space-grotesk    (corps/UI ; body repointe ici en plan 03)
 *   JetBrains Mono   → --font-jetbrains-mono   (chiffres/tabulaire)
 *   Chakra Petch     → --font-chakra-petch     (accents techniques)
 *   Noto Sans Arabic → --font-noto-arabic      (arabe via :lang(ar) ; REMPLACE IBM Plex, D-01)
 *
 * Subset : latin pour les 4 latines ; arabic pour Noto (Pitfall 4 — jamais latin pour Noto).
 *
 * Source : 10-RESEARCH.md §Pattern 2 ; 10-PATTERNS.md §lib/fonts.ts ; 10-CONTEXT D-01/D-02/D-03.
 */
import localFont from 'next/font/local'

export const archivo = localFont({
  src: [
    { path: '../fonts/Archivo-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/Archivo-SemiBold.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-archivo',
  display: 'swap',
})

export const spaceGrotesk = localFont({
  src: [
    { path: '../fonts/SpaceGrotesk-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/SpaceGrotesk-SemiBold.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-space-grotesk',
  display: 'swap',
})

export const jetbrainsMono = localFont({
  src: [
    { path: '../fonts/JetBrainsMono-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/JetBrainsMono-SemiBold.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

export const chakraPetch = localFont({
  src: [
    { path: '../fonts/ChakraPetch-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/ChakraPetch-SemiBold.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-chakra-petch',
  display: 'swap',
})

export const notoArabic = localFont({
  src: [
    { path: '../fonts/NotoSansArabic-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/NotoSansArabic-SemiBold.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-noto-arabic',
  display: 'swap',
})
