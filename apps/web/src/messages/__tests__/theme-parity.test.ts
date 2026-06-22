/**
 * theme-parity.test.ts — garde-fou i18n du namespace `theme` (Plan 15-02, Task 3).
 *
 * Behavior testé (INVERSÉ en Phase 15, D-05) : le namespace TOP-LEVEL `theme`
 * (ex-ThemeToggle : toggleLabel/light/dark) est PURGÉ des trois locales en PARITÉ
 * stricte. Sous forcedTheme="dark" (D-04) il n'y a plus de bascule de thème → la
 * clé est morte. Ce test prouve que la purge a bien eu lieu dans fr/en/ar à la
 * fois (jamais une seule locale), bloquant une suppression asymétrique (T-15-02).
 *
 * NB : un AUTRE `theme` existe imbriqué dans le namespace `(admin)` — il n'est PAS
 * concerné (on n'inspecte que la propriété de premier niveau).
 */
import { describe, it, expect } from 'vitest'
import fr from '../fr.json'
import en from '../en.json'
import ar from '../ar.json'

const LOCALES = { fr, en, ar } as const

describe('messages: namespace top-level `theme` purgé (Phase 15, D-05)', () => {
  it("n'expose plus de namespace top-level `theme` dans aucune locale", () => {
    for (const [name, messages] of Object.entries(LOCALES)) {
      expect(messages, `${name}.json ne doit plus contenir le namespace top-level theme`).not.toHaveProperty('theme')
    }
  })

  it('a purgé le namespace en parité stricte (aucune locale orpheline)', () => {
    const hasTheme = (m: unknown) =>
      Object.prototype.hasOwnProperty.call(m as object, 'theme')
    expect(hasTheme(fr), 'fr ne doit pas avoir theme').toBe(false)
    expect(hasTheme(en), 'en ne doit pas avoir theme').toBe(false)
    expect(hasTheme(ar), 'ar ne doit pas avoir theme').toBe(false)
  })
})
