/**
 * rtl-logical-props.test.ts — garde Wave-0 de DESIGN-04 (Phase 10).
 *
 * Behavior gardé : la couche fondation (globals.css + [locale]/layout.tsx) ne doit
 * utiliser QUE des propriétés/classes utilitaires LOGIQUES (ms-/me-/ps-/pe-/start-/
 * end-), jamais leurs équivalents PHYSIQUES (ml-/mr-/pl-/pr-/left-/right-). C'est ce
 * qui garantit le miroir RTL arabe sans retrofit (D-V2-02 : RTL = propriétés
 * logiques natives Tailwind v4, pas de plugin).
 *
 * Le test scanne le texte des fichiers fondation et FAIL si une classe physique
 * apparaît. Les propriétés direction-neutres (font-family, line-height) ne sont PAS
 * flaguées (le regex ne cible que les préfixes utilitaires physiques bornés).
 *
 * État actuel : layout.tsx utilise ms-6 / ms-auto (logiques), globals.css n'a aucune
 * classe utilitaire physique → ce test est GREEN dès maintenant. C'est ATTENDU : il
 * agit comme garde de NON-RÉGRESSION pendant que les plans 02/03 touchent ces
 * fichiers fondation.
 *
 * Source : 10-VALIDATION.md §DESIGN-04 ; 10-CONTEXT.md D-V2-02 ; 10-PATTERNS.md
 * §Wave-0 Test Files ; mirror du style text-scan de apps/web/test/no-perf-claims.test.ts.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// Fichiers fondation surveillés (touchés par la migration Phase 10).
const FOUNDATION_FILES = [
  path.resolve(__dirname, '../globals.css'),
  path.resolve(__dirname, '../../app/[locale]/layout.tsx'),
] as const

// Classes utilitaires Tailwind à propriété PHYSIQUE interdites. Frontière `\b` à
// gauche, et le préfixe se termine par `-` (ml-, mr-, pl-, pr-, left-, right-).
// NE matche PAS ms-/me-/ps-/pe-/start-/end- (logiques) car ml/mr/pl/pr sont des
// préfixes distincts ; left-/right- restent physiques.
const PHYSICAL_CLASS = /\b(ml-|mr-|pl-|pr-|left-|right-)/

function scanFile(filePath: string): string[] {
  const content = readFileSync(filePath, 'utf-8')
  const offenders: string[] = []
  content.split('\n').forEach((line, idx) => {
    if (PHYSICAL_CLASS.test(line)) {
      offenders.push(`${path.basename(filePath)}:${idx + 1} → ${line.trim()}`)
    }
  })
  return offenders
}

describe('DESIGN-04 : propriétés logiques uniquement (fichiers fondation)', () => {
  it('le détecteur attrape bien une classe physique de contrôle (non trivial)', () => {
    expect(PHYSICAL_CLASS.test('class="ml-4 pr-2"')).toBe(true)
    expect(PHYSICAL_CLASS.test('class="ms-4 pe-2 start-0"')).toBe(false)
  })

  it("n'utilise aucune classe utilitaire physique dans les fichiers fondation", () => {
    const offenders = FOUNDATION_FILES.flatMap(scanFile)
    expect(
      offenders,
      `Classes physiques (utiliser logiques ms-/me-/ps-/pe-/start-/end-) :\n${offenders.join('\n')}`,
    ).toEqual([])
  })
})
