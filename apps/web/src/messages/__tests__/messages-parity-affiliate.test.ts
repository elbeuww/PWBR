/**
 * messages-parity-affiliate.test.ts — parité du namespace `affiliate` (Plan 07-06).
 *
 * Behavior testé : le namespace `affiliate` (member-facing, surfaces candidature +
 * dashboard) existe et est à parité de clés STRICTE et RÉCURSIVE (sous-clés incluses :
 * application.errors.*, dashboard.*, tiers.*) entre fr / en / ar. Une clé manquante
 * ou en trop à n'importe quelle profondeur casse le rendu localisé des surfaces
 * affilié (AFF-01/AFF-02). Garde aussi contre toute PROMESSE DE GAIN (LEGAL-01 /
 * VITR-03) : aucun « garanti / profit / gagnez » (et équivalents en/ar) dans la copy.
 *
 * Note : le caractère '%' N'EST PAS interdit ici (contrairement au namespace payment) —
 * il représente le TAUX D'AFFILIATION factuel (8 %→20 %, grille D-01), pas une
 * allégation de performance. Seules les promesses de gain sont bannies.
 *
 * Le back-office (admin.affiliateQueue / admin.payouts) est mono-FR (hors [locale],
 * D-04-03-B) → NON soumis à la parité 3 langues.
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
    return value !== null && typeof value === 'object' ? flattenKeys(value, path) : [path]
  })
}

function namespaceKeys(messages: unknown, ns: string): string[] {
  const namespace = (messages as Record<string, unknown>)[ns]
  return flattenKeys(namespace).sort()
}

describe('messages: namespace `affiliate` parité fr/en/ar (récursive)', () => {
  it('expose le namespace affiliate dans chaque locale', () => {
    for (const [name, messages] of Object.entries(LOCALES)) {
      expect(messages, `${name}.json doit contenir le namespace affiliate`).toHaveProperty(
        'affiliate',
      )
    }
  })

  it('a une parité de clés stricte RÉCURSIVE sur affiliate (sous-clés incluses)', () => {
    const frKeys = namespaceKeys(fr, 'affiliate')
    expect(frKeys.length, 'fr.affiliate ne doit pas être vide').toBeGreaterThan(0)
    // Sentinelles : sous-clés imbriquées attendues par le contrat de copy (UI-SPEC).
    expect(frKeys).toEqual(
      expect.arrayContaining([
        'application.submit',
        'application.success',
        'application.errors.channel',
        'application.errors.submitFailed',
        'dashboard.revenueTotal',
        'dashboard.revenueCurrentMonth',
        'dashboard.progressToNext',
        'dashboard.maxTierReached',
        'dashboard.emptyHeading',
        'tiers.gridTitle',
        'tiers.tierName',
      ]),
    )
    expect(
      namespaceKeys(en, 'affiliate'),
      'en.affiliate doit avoir les mêmes clés que fr.affiliate',
    ).toEqual(frKeys)
    expect(
      namespaceKeys(ar, 'affiliate'),
      'ar.affiliate doit avoir les mêmes clés que fr.affiliate',
    ).toEqual(frKeys)
  })

  it('ne contient aucune promesse de gain dans affiliate (LEGAL-01 / VITR-03)', () => {
    // Promesses de gain bannies (fr/en/ar). '%' autorisé (taux factuel de la grille).
    const FORBIDDEN = /garanti|profit|gagnez|guaranteed|earn money|مضمون|ربح/i
    for (const [name, messages] of Object.entries(LOCALES)) {
      const json = JSON.stringify((messages as Record<string, unknown>).affiliate)
      expect(FORBIDDEN.test(json), `${name}.affiliate contient une promesse interdite`).toBe(false)
    }
  })
})
