/**
 * messages-parity-payment.test.ts — parité du namespace `payment` (Plan 04-03, Task 3).
 *
 * Behavior testé : le namespace `payment` (member-facing) existe et est à parité
 * de clés STRICTE et RÉCURSIVE (sous-clés incluses : polling.steps.*, errors.*,
 * hash.*, screenshot.*, status.*, expiredGated.*) entre fr / en / ar. Une clé
 * manquante ou en trop à n'importe quelle profondeur casse le rendu localisé des
 * écrans de paiement (PAY-01..06). Garde aussi contre toute allégation de perf
 * (VITR-03, D-02-02-D) : aucun '%', 'garanti', 'profit' dans ce namespace.
 *
 * Le namespace `admin` est volontairement mono-FR (back-office hors [locale],
 * UI-SPEC Producer-boundary / D-09) → NON soumis à la parité 3 langues.
 */
import { describe, it, expect } from 'vitest'
import fr from '../fr.json'
import en from '../en.json'
import ar from '../ar.json'

const LOCALES = { fr, en, ar } as const

// Aplatit récursivement les clés d'un objet : { a: { b: 1 } } -> ['a.b'].
function flattenKeys(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object') return [prefix]
  return Object.entries(obj as Record<string, unknown>).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return value !== null && typeof value === 'object'
      ? flattenKeys(value, path)
      : [path]
  })
}

function namespaceKeys(messages: unknown, ns: string): string[] {
  const namespace = (messages as Record<string, unknown>)[ns]
  return flattenKeys(namespace).sort()
}

describe('messages: namespace `payment` parité fr/en/ar (récursive)', () => {
  it('expose le namespace payment dans chaque locale', () => {
    for (const [name, messages] of Object.entries(LOCALES)) {
      expect(messages, `${name}.json doit contenir le namespace payment`).toHaveProperty('payment')
    }
  })

  it('a une parité de clés stricte RÉCURSIVE sur payment (sous-clés incluses)', () => {
    const frKeys = namespaceKeys(fr, 'payment')
    expect(frKeys.length, 'fr.payment ne doit pas être vide').toBeGreaterThan(0)
    // Sentinelles : sous-clés imbriquées attendues par le contrat de copy (UI-SPEC).
    expect(frKeys).toEqual(expect.arrayContaining([
      'polling.steps.found',
      'polling.steps.activated',
      'errors.wrong_amount',
      'errors.replay',
      'status.activeUntil',
      'expiredGated.cta',
    ]))
    expect(namespaceKeys(en, 'payment'), 'en.payment doit avoir les mêmes clés que fr.payment').toEqual(
      frKeys,
    )
    expect(namespaceKeys(ar, 'payment'), 'ar.payment doit avoir les mêmes clés que fr.payment').toEqual(
      frKeys,
    )
  })

  it('expose le namespace admin (mono-FR acceptable)', () => {
    expect(fr, 'fr.json doit contenir le namespace admin').toHaveProperty('admin')
    expect(namespaceKeys(fr, 'admin').length, 'fr.admin ne doit pas être vide').toBeGreaterThan(0)
  })

  it('ne contient aucune allégation de performance dans payment (VITR-03)', () => {
    const FORBIDDEN = /%|garanti|profit/i
    for (const [name, messages] of Object.entries(LOCALES)) {
      const json = JSON.stringify((messages as Record<string, unknown>).payment)
      expect(FORBIDDEN.test(json), `${name}.payment contient une allégation interdite`).toBe(false)
    }
  })
})
