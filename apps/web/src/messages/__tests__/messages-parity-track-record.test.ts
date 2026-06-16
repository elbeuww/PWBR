/**
 * messages-parity-track-record.test.ts — parité des namespaces `trackRecord` et
 * `methodology` (Plan 05-03, TRACK-03).
 *
 * Behavior testé : les namespaces publics du track record mesuré existent et sont à
 * parité de clés STRICTE et RÉCURSIVE entre fr / en / ar. Une clé manquante ou en
 * trop à n'importe quelle profondeur casse le rendu localisé du bloc vitrine, du
 * miroir membre ou de la page méthodologie.
 *
 * Garde anti-allégation (VITR-03, D-02-02-D) : aucune PROMESSE de performance
 * (« garanti / guaranteed / guarantee ») ni pourcentage LITTÉRAL dans la copy.
 * Note : « take-profit » / « جني الأرباح » sont des termes d'ordre techniques
 * légitimes (le nom de l'ordre TP), PAS une allégation — non interdits.
 */
import { describe, it, expect } from 'vitest'
import fr from '../fr.json'
import en from '../en.json'
import ar from '../ar.json'

const LOCALES = { fr, en, ar } as const
const NAMESPACES = ['trackRecord', 'methodology'] as const

// Aplatit récursivement les clés d'un objet : { a: { b: 1 } } -> ['a.b'].
function flattenKeys(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object') return [prefix]
  return Object.entries(obj as Record<string, unknown>).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return value !== null && typeof value === 'object' ? flattenKeys(value, path) : [path]
  })
}

function namespaceKeys(messages: unknown, ns: string): string[] {
  const namespace = (messages as Record<string, unknown>)[ns]
  return flattenKeys(namespace).sort()
}

describe('messages: namespaces track record parité fr/en/ar (récursive)', () => {
  it('expose trackRecord et methodology dans chaque locale', () => {
    for (const [name, messages] of Object.entries(LOCALES)) {
      for (const ns of NAMESPACES) {
        expect(messages, `${name}.json doit contenir le namespace ${ns}`).toHaveProperty(ns)
      }
    }
  })

  it('a une parité de clés stricte RÉCURSIVE sur trackRecord', () => {
    const frKeys = namespaceKeys(fr, 'trackRecord')
    expect(frKeys.length, 'fr.trackRecord ne doit pas être vide').toBeGreaterThan(0)
    // Sentinelles : clés exigées par le contrat de copy (UI-SPEC).
    expect(frKeys).toEqual(
      expect.arrayContaining([
        'title',
        'periodAllTime',
        'period90d',
        'winRate',
        'avgR',
        'expectancy',
        'sampleSize',
        'insufficient',
        'methodologyLink',
        'colCategory',
        'colWinRate',
        'colTrades',
        'emptyHeading',
        'errorRetry',
      ]),
    )
    expect(namespaceKeys(en, 'trackRecord'), 'en.trackRecord == fr.trackRecord').toEqual(frKeys)
    expect(namespaceKeys(ar, 'trackRecord'), 'ar.trackRecord == fr.trackRecord').toEqual(frKeys)
  })

  it('a une parité de clés stricte RÉCURSIVE sur methodology', () => {
    const frKeys = namespaceKeys(fr, 'methodology')
    expect(frKeys.length, 'fr.methodology ne doit pas être vide').toBeGreaterThan(0)
    // Sentinelles : sections décisions D-01/02/03/04/09/10/11.
    expect(frKeys).toEqual(
      expect.arrayContaining([
        'title',
        'intro',
        'definitionBody',
        'flatBody',
        'granularityBody',
        'tieBreakBody',
        'metricsBody',
        'periodsBody',
        'thresholdBody',
      ]),
    )
    expect(namespaceKeys(en, 'methodology'), 'en.methodology == fr.methodology').toEqual(frKeys)
    expect(namespaceKeys(ar, 'methodology'), 'ar.methodology == fr.methodology').toEqual(frKeys)
  })

  it('ne contient aucune promesse de performance ni pourcentage littéral (VITR-03)', () => {
    // Interdit : promesses (garanti/guaranteed/guarantee) + % littéral.
    // Autorisé : « take-profit » / « جني الأرباح » (terme d'ordre technique).
    const FORBIDDEN = /garanti|guaranteed|guarantee|%/i
    for (const [name, messages] of Object.entries(LOCALES)) {
      for (const ns of NAMESPACES) {
        const json = JSON.stringify((messages as Record<string, unknown>)[ns])
        expect(
          FORBIDDEN.test(json),
          `${name}.${ns} contient une allégation/pourcentage interdit`,
        ).toBe(false)
      }
    }
  })
})
