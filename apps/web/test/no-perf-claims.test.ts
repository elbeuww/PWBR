/**
 * no-perf-claims.test.ts — garde anti-allégation de performance (VITR-03 / D-08).
 *
 * Behavior : aucune valeur de chaîne sous les namespaces marketing `home`,
 * `pricing`, `paiement` (dans les 3 langues) ne doit contenir une allégation de
 * gain ou un chiffre de performance — symbole `%`, motif `nombre%`, ou les mots
 * « garanti »/« guaranteed »/« profit »/« rentable ». Le test FAIL en listant la
 * clé fautive, la langue et la valeur.
 *
 * Autorisé explicitement (mentions factuelles, PAS des allégations de perf) :
 *   - le symbole `$` et les prix « 9 $ » / « 3 $ » ;
 *   - la mention « USDT (TRC-20) » ;
 *   - le terme de plan de trade « take-profit(s) » (le substring "profit" y est
 *     neutre : c'est un niveau de sortie, pas une promesse de gain). Il est retiré
 *     du texte avant le scan du mot « profit ».
 *
 * Exclus du scan : `legal`/`disclaimer` (le disclaimer mentionne légitimement
 * « risque de perte » / « no promise of gains » — hors périmètre marketing).
 *
 * Note placement : le glob Vitest (vitest.config.ts) inclut apps/web/test/**.
 */
import { describe, it, expect } from 'vitest'
import fr from '../src/messages/fr.json'
import en from '../src/messages/en.json'
import ar from '../src/messages/ar.json'

const MARKETING_NAMESPACES = ['home', 'pricing', 'paiement'] as const
const LOCALES = { fr, en, ar } as const

// « take-profit » / « take-profits » est un terme de plan de trade neutre :
// on le neutralise avant de chercher le mot « profit » comme allégation de gain.
function stripAllowed(value: string): string {
  return value.replace(/take-profits?/gi, '')
}

// Termes interdits : symbole %, motif nombre%, et mots de gain (par langue latine).
const FORBIDDEN = /%|\d+\s*%|garanti|guaranteed|\bprofit\b|rentable/i

function detectForbidden(value: string): boolean {
  return FORBIDDEN.test(stripAllowed(value))
}

// Collecte récursive de toutes les valeurs string sous un namespace, avec chemin.
function collectStrings(
  obj: unknown,
  prefix = '',
): Array<{ path: string; value: string }> {
  if (typeof obj === 'string') return [{ path: prefix, value: obj }]
  if (obj === null || typeof obj !== 'object') return []
  return Object.entries(obj as Record<string, unknown>).flatMap(([key, val]) =>
    collectStrings(val, prefix ? `${prefix}.${key}` : key),
  )
}

describe('no-perf-claims : aucun chiffre de perf / promesse de gain (VITR-03)', () => {
  it('le détecteur attrape bien une valeur de contrôle « 90% » (non trivial)', () => {
    expect(detectForbidden('90% de trades gagnants')).toBe(true)
    expect(detectForbidden('rendement garanti')).toBe(true)
    expect(detectForbidden('profit assuré')).toBe(true)
  })

  it('autorise les mentions factuelles ($, USDT TRC-20, take-profits)', () => {
    expect(detectForbidden('9 $ / mois')).toBe(false)
    expect(detectForbidden('payable en USDT (TRC-20)')).toBe(false)
    expect(detectForbidden('entrée, stop-loss, take-profits, ratio R:R')).toBe(false)
  })

  it('ne contient aucune allégation de perf dans home/pricing/paiement (fr/en/ar)', () => {
    const offenders: string[] = []
    for (const [name, messages] of Object.entries(LOCALES)) {
      for (const ns of MARKETING_NAMESPACES) {
        const namespace = (messages as Record<string, unknown>)[ns]
        for (const { path, value } of collectStrings(namespace, ns)) {
          if (detectForbidden(value)) {
            offenders.push(`${name}.${path} = "${value}"`)
          }
        }
      }
    }
    expect(offenders, `Allégations de perf détectées :\n${offenders.join('\n')}`).toEqual([])
  })
})
