/**
 * theme-parity.test.ts — garde-fou i18n du namespace `theme` (Plan 02-01, Task 3).
 *
 * Behavior testé : le namespace `theme` existe et est à parité de clés STRICTE
 * entre fr / en / ar (toggleLabel, light, dark). Une clé manquante ou en trop
 * dans une locale casse le rendu du ThemeToggle dans cette langue.
 */
import { describe, it, expect } from 'vitest'
import fr from '../fr.json'
import en from '../en.json'
import ar from '../ar.json'

const REQUIRED_THEME_KEYS = ['toggleLabel', 'light', 'dark'] as const

const LOCALES = { fr, en, ar } as const

describe('messages: namespace `theme` parité fr/en/ar', () => {
  it('expose un namespace `theme` dans chaque locale', () => {
    for (const [name, messages] of Object.entries(LOCALES)) {
      expect(messages, `${name}.json doit contenir le namespace theme`).toHaveProperty('theme')
    }
  })

  it('contient toutes les clés requises (toggleLabel, light, dark) dans chaque locale', () => {
    for (const [name, messages] of Object.entries(LOCALES)) {
      const theme = (messages as Record<string, Record<string, string>>).theme ?? {}
      for (const key of REQUIRED_THEME_KEYS) {
        expect(theme[key], `${name}.json theme.${key} manquant`).toBeTruthy()
      }
    }
  })

  it('a une parité de clés stricte du namespace theme entre les 3 locales', () => {
    const keysOf = (m: unknown) =>
      Object.keys((m as Record<string, Record<string, string>>).theme ?? {}).sort()
    const frKeys = keysOf(fr)
    expect(keysOf(en), 'en.theme doit avoir les mêmes clés que fr.theme').toEqual(frKeys)
    expect(keysOf(ar), 'ar.theme doit avoir les mêmes clés que fr.theme').toEqual(frKeys)
  })
})
