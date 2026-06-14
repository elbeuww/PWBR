/**
 * lib/fonts.ts — polices self-hostées (D-03, zéro CDN au runtime).
 *
 * - `inter` (latin) : via next/font/google → self-hosté AU BUILD (aucune requête CDN
 *   au runtime, conforme à l'esprit D-03 — décision A5 du RESEARCH).
 * - `ibmPlexArabic` (arabe) : via next/font/local sur les .woff2 versionnés dans
 *   src/fonts/ (copiés depuis @fontsource/ibm-plex-sans-arabic), weights 400 + 600.
 *
 * Les deux exposent des variables CSS consommées par globals.css :
 *   --font-inter            → --font-latin
 *   --font-ibm-plex-arabic  → --font-arabic (appliqué via :lang(ar))
 *
 * Source : 02-RESEARCH.md §Pattern 2 ; 02-PATTERNS.md §lib/fonts.ts ; 02-UI-SPEC.md §Design System
 */
import localFont from 'next/font/local'
import { Inter } from 'next/font/google'

export const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const ibmPlexArabic = localFont({
  src: [
    { path: '../fonts/IBMPlexSansArabic-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/IBMPlexSansArabic-SemiBold.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-ibm-plex-arabic',
  display: 'swap',
})
