/**
 * messages-parity-dash.test.ts — parité du namespace `dash` (Plan 19-02, Task 1).
 *
 * Behavior testé : le namespace `dash` (shell membre du dashboard) existe et est à
 * parité de clés STRICTE et RÉCURSIVE (sous-clés incluses : nav.*, overview.*,
 * suivis.*, historique.*, renewal.*, watchlist.*, affiliate.*, error.*, settings.*)
 * entre fr / en / ar. Une clé manquante/en trop à n'importe quelle profondeur casse
 * le rendu localisé de tout le groupe (dash) consommé par 19-02..19-07.
 *
 * Garde aussi l'état RENOUVELLEMENT (D-03) : `renewal.cta` FR contient « Renouveler »
 * et le namespace ne contient AUCUN « gratuit »/« free » (jamais un upsell compte
 * gratuit), ni allégation de performance ('%','garanti','profit', VITR-03).
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

describe('messages: namespace `dash` parité fr/en/ar (récursive)', () => {
  it('expose le namespace dash dans chaque locale', () => {
    for (const [name, messages] of Object.entries(LOCALES)) {
      expect(messages, `${name}.json doit contenir le namespace dash`).toHaveProperty('dash')
    }
  })

  it('a une parité de clés stricte RÉCURSIVE sur dash (sous-clés incluses)', () => {
    const frKeys = namespaceKeys(fr, 'dash')
    expect(frKeys.length, 'fr.dash ne doit pas être vide').toBeGreaterThan(0)
    // Sentinelles : clés attendues par le contrat de copy (UI-SPEC Copywriting).
    expect(frKeys).toEqual(expect.arrayContaining([
      'nav.overview',
      'nav.suivis',
      'nav.historique',
      'nav.watchlist',
      'nav.abonnement',
      'nav.affiliation',
      'nav.parametres',
      'renewal.cta',
      'suivis.emptyTitle',
      'historique.emptyTitle',
      'watchlist.add',
      'watchlist.remove',
      'affiliate.summary',
      'error.retry',
      'settings.savePreferences',
    ]))
    expect(namespaceKeys(en, 'dash'), 'en.dash doit avoir les mêmes clés que fr.dash').toEqual(
      frKeys,
    )
    expect(namespaceKeys(ar, 'dash'), 'ar.dash doit avoir les mêmes clés que fr.dash').toEqual(
      frKeys,
    )
  })

  it('expose un état RENOUVELLEMENT, jamais un upsell gratuit (D-03)', () => {
    expect(fr.dash.renewal.cta, 'renewal.cta FR doit proposer de renouveler').toMatch(/Renouveler/)
    const FREE = /gratuit|free/i
    for (const [name, messages] of Object.entries(LOCALES)) {
      const json = JSON.stringify((messages as Record<string, unknown>).dash)
      expect(FREE.test(json), `${name}.dash ne doit pas proposer de compte gratuit`).toBe(false)
    }
  })

  it('ne contient aucune allégation de performance dans dash (VITR-03)', () => {
    const FORBIDDEN = /%|garanti|profit/i
    for (const [name, messages] of Object.entries(LOCALES)) {
      const json = JSON.stringify((messages as Record<string, unknown>).dash)
      expect(FORBIDDEN.test(json), `${name}.dash contient une allégation interdite`).toBe(false)
    }
  })
})
