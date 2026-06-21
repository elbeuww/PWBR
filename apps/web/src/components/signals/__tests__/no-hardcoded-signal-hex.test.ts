/**
 * no-hardcoded-signal-hex.test.ts — garde Phase 11 de DESIGN-05 / WR-01.
 *
 * Behavior gardé : les composants du dossier `components/signals/` ne doivent contenir
 * AUCUN code couleur HEX directionnel (haussier/baissier) en dur. Ces couleurs doivent
 * transiter exclusivement via les tokens CSS flip-safe :
 *   --signal-bullish  (vert haussier)
 *   --signal-bearish  (rouge baissier)
 *
 * WR-01 (commit c34ae9d) a corrigé SignalDetail.tsx qui contenait :
 *   #15803D / #B91C1C  (valeurs « light »)
 *   #22C55E / #EF4444  (valeurs « dark »)
 * — remplacés par var(--signal-bullish) / var(--signal-bearish).
 *
 * Ce garde verrouille la régression : si un futur diff réintroduit l'un de ces HEX
 * dans n'importe quel .tsx sous components/signals/, le test FAIL immédiatement.
 *
 * Structure : text-scan déterministe sur le contenu des fichiers source, sans jsdom
 * ni serveur. Mirror exact du style de rtl-logical-props.test.ts (Phase 10/11).
 * Tolérance : si le dossier signals/ est absent, le scan retourne [] → GREEN.
 *
 * Source : 11-VALIDATION.md §WR-01 ; 11-CONTEXT.md DESIGN-05 ; commit c34ae9d
 * (fix flip-safe + RTL invariants) ; 11-PATTERNS.md §Tokens flip-safe.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

// Dossier signals/ à scanner récursivement. Tolérance à l'absence.
const SIGNALS_DIR = path.resolve(__dirname, '..')

// Codes HEX directionnels (haussier/baissier) interdits en dur dans les composants.
// Phase 11 (WR-01) : ces valeurs étaient hardcodées dans SignalDetail.tsx.
// Les variantes uppercase/lowercase sont toutes capturées via le flag /i.
const FORBIDDEN_HEX = [
  '#15803D', // vert haussier light — remplacé par var(--signal-bullish)
  '#B91C1C', // rouge baissier light — remplacé par var(--signal-bearish)
  '#22C55E', // vert haussier dark  — remplacé par var(--signal-bullish)
  '#EF4444', // rouge baissier dark  — remplacé par var(--signal-bearish)
] as const

// Regex unique qui matche l'un quelconque des HEX interdits (case-insensitive).
const FORBIDDEN_PATTERN = new RegExp(
  FORBIDDEN_HEX.map((h) => h.replace('#', '#')).join('|'),
  'i',
)

// Liste récursive des .tsx d'un dossier, tolérante à son absence.
function listTsx(dir: string): string[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return [] // dossier absent → vert
  }
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry)
    try {
      if (statSync(full).isDirectory()) return listTsx(full)
    } catch {
      return []
    }
    return path.extname(entry) === '.tsx' ? [full] : []
  })
}

// Retourne les lignes offensantes (fichier:numéro → contenu) pour un fichier donné.
function scanFile(filePath: string): string[] {
  const content = readFileSync(filePath, 'utf-8')
  const offenders: string[] = []
  content.split('\n').forEach((line, idx) => {
    if (FORBIDDEN_PATTERN.test(line)) {
      offenders.push(`${path.basename(filePath)}:${idx + 1} → ${line.trim()}`)
    }
  })
  return offenders
}

describe('DESIGN-05 / WR-01 : aucun HEX directionnel hardcodé dans components/signals/', () => {
  it('le détecteur attrape bien un HEX planté de contrôle (non trivial)', () => {
    // Chaque HEX interdit doit être détecté (contrôle de non-trivialité).
    expect(FORBIDDEN_PATTERN.test('color: #15803D')).toBe(true)
    expect(FORBIDDEN_PATTERN.test("className='text-[#B91C1C]'")).toBe(true)
    expect(FORBIDDEN_PATTERN.test('fill="#22C55E"')).toBe(true)
    expect(FORBIDDEN_PATTERN.test('stroke="#ef4444"')).toBe(true) // lowercase

    // Les tokens flip-safe ne doivent PAS être flagués.
    expect(FORBIDDEN_PATTERN.test('color: var(--signal-bullish)')).toBe(false)
    expect(FORBIDDEN_PATTERN.test('color: var(--signal-bearish)')).toBe(false)

    // Une couleur HEX neutre (bleue, grise) ne doit pas être flagée.
    expect(FORBIDDEN_PATTERN.test('color: #3B82F6')).toBe(false)
  })

  it('scan tolérant : dossier signals/ absent ne jette pas (DESIGN-05)', () => {
    expect(listTsx(path.resolve(__dirname, '../../__signals_inexistant__'))).toEqual([])
  })

  it("components/signals/ ne contient aucun HEX directionnel hardcodé (WR-01)", () => {
    // Exclure les fichiers de test (__tests__/) du scan : ils peuvent contenir
    // des valeurs de contrôle plantées sans violer l'invariant de production.
    const allTsx = listTsx(SIGNALS_DIR)
    const productionTsx = allTsx.filter(
      (f) => !f.includes(`${path.sep}__tests__${path.sep}`),
    )

    const offenders = productionTsx.flatMap(scanFile)
    expect(
      offenders,
      `HEX directionnels interdits détectés — utiliser var(--signal-bullish) / var(--signal-bearish) :\n${offenders.join('\n')}`,
    ).toEqual([])
  })
})
