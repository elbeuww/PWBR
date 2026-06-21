/**
 * fonts.test.ts — garde Wave-0 de DESIGN-02 (Phase 10).
 *
 * Behavior gardé : `lib/fonts.ts` doit passer du setup v2.0 (Inter via
 * next/font/google + IBM Plex Sans Arabic) aux 5 familles NEXA self-hostées
 * (Archivo, Space Grotesk, JetBrains Mono, Chakra Petch, Noto Sans Arabic),
 * toutes via next/font/local, zéro CDN au runtime (D-01/D-02/D-03 du 10-CONTEXT).
 *
 * Assertions :
 *   1. lib/fonts.ts expose les 5 noms de variables CSS NEXA :
 *      --font-archivo, --font-space-grotesk, --font-jetbrains-mono,
 *      --font-chakra-petch, --font-noto-arabic.
 *   2. lib/fonts.ts ne contient PLUS --font-inter ni --font-ibm-plex-arabic.
 *   3. lib/fonts.ts n'importe PLUS next/font/google (self-host pur).
 *   4. src/fonts/ liste les 10 .woff2 attendus (5 familles × Regular+SemiBold)
 *      et NE liste PLUS IBMPlexSansArabic-Regular/-SemiBold.woff2.
 *
 * État v2.0 actuel : --font-inter / --font-ibm-plex-arabic présents, import
 * next/font/google présent, .woff2 NEXA absents, IBM Plex présents → RED attendu.
 * Le RED prouve que la garde mesure la migration du plan 02.
 *
 * Source : 10-VALIDATION.md §DESIGN-02 ; 10-CONTEXT.md D-01/D-02/D-03 ;
 * 10-PATTERNS.md §Wave-0 Test Files.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

const FONTS_TS = path.resolve(__dirname, '../../lib/fonts.ts')
const FONTS_DIR = path.resolve(__dirname, '../../fonts')

const src = readFileSync(FONTS_TS, 'utf-8')

const REQUIRED_FONT_VARS = [
  '--font-archivo',
  '--font-space-grotesk',
  '--font-jetbrains-mono',
  '--font-chakra-petch',
  '--font-noto-arabic',
] as const

const FORBIDDEN_FONT_VARS = ['--font-inter', '--font-ibm-plex-arabic'] as const

const EXPECTED_WOFF2 = [
  'Archivo-Regular.woff2',
  'Archivo-SemiBold.woff2',
  'SpaceGrotesk-Regular.woff2',
  'SpaceGrotesk-SemiBold.woff2',
  'JetBrainsMono-Regular.woff2',
  'JetBrainsMono-SemiBold.woff2',
  'ChakraPetch-Regular.woff2',
  'ChakraPetch-SemiBold.woff2',
  'NotoSansArabic-Regular.woff2',
  'NotoSansArabic-SemiBold.woff2',
] as const

const FORBIDDEN_WOFF2 = [
  'IBMPlexSansArabic-Regular.woff2',
  'IBMPlexSansArabic-SemiBold.woff2',
] as const

function listFonts(): string[] {
  try {
    return readdirSync(FONTS_DIR)
  } catch {
    return []
  }
}

describe('DESIGN-02 : 5 polices NEXA self-hostées (lib/fonts.ts + src/fonts)', () => {
  it('expose les 5 variables CSS de police NEXA', () => {
    const missing = REQUIRED_FONT_VARS.filter((v) => !src.includes(v))
    expect(missing, `variables --font-* NEXA manquantes : ${missing.join(', ')}`).toEqual([])
  })

  it('ne contient plus les variables de police v2.0 (--font-inter / --font-ibm-plex-arabic)', () => {
    const leftover = FORBIDDEN_FONT_VARS.filter((v) => src.includes(v))
    expect(leftover, `variables de police obsolètes encore présentes : ${leftover.join(', ')}`).toEqual([])
  })

  it("n'importe plus next/font/google (self-host pur, zéro CDN au runtime)", () => {
    expect(src.includes('next/font/google'), 'lib/fonts.ts ne doit plus importer next/font/google').toBe(false)
  })

  it('src/fonts/ contient les 10 .woff2 NEXA attendus', () => {
    const present = listFonts()
    const missing = EXPECTED_WOFF2.filter((f) => !present.includes(f))
    expect(missing, `.woff2 NEXA manquants dans src/fonts/ : ${missing.join(', ')}`).toEqual([])
  })

  it('src/fonts/ ne contient plus les .woff2 IBM Plex Arabic obsolètes', () => {
    const present = listFonts()
    const leftover = FORBIDDEN_WOFF2.filter((f) => present.includes(f))
    expect(leftover, `.woff2 IBM Plex obsolètes encore présents : ${leftover.join(', ')}`).toEqual([])
  })
})
