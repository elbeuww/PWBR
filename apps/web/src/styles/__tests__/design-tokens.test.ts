/**
 * design-tokens.test.ts — garde Wave-0 de DESIGN-01 (Phase 10).
 *
 * Behavior gardé : la couche de tokens de `globals.css` doit migrer du bleu
 * institutionnel v2.0 (#1E5FBF en HEX) vers des primitives OKLCH NEXA en couches.
 * Ce test encode 4 assertions :
 *   1. `oklch(` présent au moins une fois (la palette vit en OKLCH, pas en HEX).
 *   2. la primitive `--nexa-green-500` est déclarée (échelle de marque cyber green).
 *   3. AUCUN littéral HEX de marque obsolète dans la couche sémantique :
 *      ni #1E5FBF (bleu v2.0), ni #03d87f / #63279b (marque NEXA — qui doit vivre
 *      en oklch, jamais en HEX brut dans le sémantique).
 *   4. le bloc `@theme inline` ne contient QUE des références `var(` pour ses
 *      valeurs de couleur et de police (anti-Pitfall 3 : aucune valeur oklch/hex
 *      littérale dans @theme inline, qui doit rester un mapping pur).
 *
 * État v2.0 actuel (globals.css) : #1E5FBF présent, aucun oklch(, pas de
 * --nexa-green-500 → assertions (1)(2)(3) RED. C'est ATTENDU : le RED prouve que
 * la garde mesure la migration des plans 02/03.
 *
 * Source : 10-VALIDATION.md §Per-Task Verification Map (DESIGN-01) ; 10-CONTEXT.md
 * D-04/D-05 ; 10-PATTERNS.md §Wave-0 Test Files.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// Résolution depuis le cwd racine (chemin relatif racine, cohérent avec les autres
// gardes text-scan). __dirname = apps/web/src/styles/__tests__ → remonter au fichier.
const GLOBALS_CSS = path.resolve(__dirname, '../globals.css')
const css = readFileSync(GLOBALS_CSS, 'utf-8')

// HEX de marque obsolètes interdits comme VALEUR dans la couche sémantique.
const FORBIDDEN_BRAND_HEX = ['#1E5FBF', '#03d87f', '#63279b'] as const

// Extrait le contenu textuel du bloc `@theme inline { ... }` (équilibrage simple
// d'accolade unique : ce bloc ne contient pas de nesting d'accolades).
function extractThemeInline(source: string): string {
  const start = source.indexOf('@theme inline')
  if (start === -1) return ''
  const open = source.indexOf('{', start)
  const close = source.indexOf('}', open)
  if (open === -1 || close === -1) return ''
  return source.slice(open + 1, close)
}

describe('DESIGN-01 : tokens OKLCH en couches (globals.css)', () => {
  it('contient au moins une valeur oklch( (palette en OKLCH, pas en HEX)', () => {
    expect(css.includes('oklch('), 'globals.css doit déclarer des couleurs en oklch()').toBe(true)
  })

  it('déclare la primitive --nexa-green-500 (échelle de marque cyber green)', () => {
    expect(/--nexa-green-500\s*:/.test(css), '--nexa-green-500 doit être défini').toBe(true)
  })

  it('ne contient AUCUN littéral HEX de marque obsolète (#1E5FBF / #03d87f / #63279b)', () => {
    const found = FORBIDDEN_BRAND_HEX.filter((hex) =>
      css.toLowerCase().includes(hex.toLowerCase()),
    )
    expect(found, `HEX de marque interdits trouvés (doivent vivre en oklch) : ${found.join(', ')}`).toEqual([])
  })

  it('le bloc @theme inline ne contient que des références var( (mapping pur)', () => {
    const inline = extractThemeInline(css)
    expect(inline.length, '@theme inline doit exister').toBeGreaterThan(0)
    // Aucune valeur littérale oklch( ou #HEX directement dans @theme inline.
    expect(inline.includes('oklch('), '@theme inline ne doit pas contenir de valeur oklch littérale').toBe(false)
    expect(/#[0-9a-fA-F]{3,8}\b/.test(inline), '@theme inline ne doit pas contenir de HEX littéral').toBe(false)
  })
})
