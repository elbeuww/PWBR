/**
 * messages-parity-legal.test.ts — parité des namespaces légaux (Plan 02-02, Task 2).
 *
 * Behavior testé : les namespaces `disclaimer` et `legal` existent et sont à parité
 * de clés STRICTE (récursive sur les sous-clés {doc}.title / {doc}.navLabel) entre
 * fr / en / ar. Une clé manquante ou en trop casse le rendu localisé du disclaimer
 * (LEGAL-01) ou d'une page légale. Garde aussi contre toute allégation de perf
 * (VITR-03) : aucun '%', 'garanti', 'profit' dans ces namespaces.
 *
 * Note placement : le glob Vitest (vitest.config.ts) inclut les dossiers
 * apps + __tests__, d'où ce dossier (cohérent avec theme-parity.test.ts P1).
 */
import { describe, it, expect } from 'vitest'
import fr from '../fr.json'
import en from '../en.json'
import ar from '../ar.json'

const LEGAL_NAMESPACES = ['disclaimer', 'legal'] as const
const LOCALES = { fr, en, ar } as const

// Aplatit récursivement les clés d'un objet : { a: { b: 1 } } -> ['a.b'].
function flattenKeys(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object') return [prefix]
  return Object.entries(obj as Record<string, unknown>).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return flattenKeysGuard(value, path)
  })
}
function flattenKeysGuard(value: unknown, path: string): string[] {
  if (value !== null && typeof value === 'object') return flattenKeys(value, path)
  return [path]
}

function namespaceKeys(messages: unknown, ns: string): string[] {
  const namespace = (messages as Record<string, unknown>)[ns]
  return flattenKeys(namespace).sort()
}

describe('messages: namespaces légaux (disclaimer/legal) parité fr/en/ar', () => {
  it('expose les namespaces disclaimer et legal dans chaque locale', () => {
    for (const [name, messages] of Object.entries(LOCALES)) {
      for (const ns of LEGAL_NAMESPACES) {
        expect(messages, `${name}.json doit contenir le namespace ${ns}`).toHaveProperty(ns)
      }
    }
  })

  it('a une parité de clés stricte (récursive) sur disclaimer et legal', () => {
    for (const ns of LEGAL_NAMESPACES) {
      const frKeys = namespaceKeys(fr, ns)
      expect(frKeys.length, `fr.${ns} ne doit pas être vide`).toBeGreaterThan(0)
      expect(namespaceKeys(en, ns), `en.${ns} doit avoir les mêmes clés que fr.${ns}`).toEqual(
        frKeys,
      )
      expect(namespaceKeys(ar, ns), `ar.${ns} doit avoir les mêmes clés que fr.${ns}`).toEqual(
        frKeys,
      )
    }
  })

  it('expose un title + navLabel pour chacun des 4 docs de l\'allowlist', () => {
    const DOCS = ['cgu', 'risques', 'confidentialite', 'mentions']
    for (const [name, messages] of Object.entries(LOCALES)) {
      const legal =
        (messages as unknown as Record<string, Record<string, Record<string, string>>>).legal ?? {}
      for (const doc of DOCS) {
        expect(legal[doc]?.title, `${name}.legal.${doc}.title manquant`).toBeTruthy()
        expect(legal[doc]?.navLabel, `${name}.legal.${doc}.navLabel manquant`).toBeTruthy()
      }
    }
  })

  it('ne contient aucune allégation de performance (VITR-03)', () => {
    const FORBIDDEN = /%|garanti|profit/i
    for (const [name, messages] of Object.entries(LOCALES)) {
      for (const ns of LEGAL_NAMESPACES) {
        const namespace = (messages as Record<string, unknown>)[ns]
        const json = JSON.stringify(namespace)
        expect(FORBIDDEN.test(json), `${name}.${ns} contient une allégation interdite`).toBe(false)
      }
    }
  })
})
