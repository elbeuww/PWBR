/**
 * lwc-recolor-intact.test.ts — garde structurelle Phase 16 (threat T-16-02).
 *
 * lightweight-charts (lwc) peint sur un canvas et NE LIT PAS les CSS vars. CandleChart
 * résout donc les couleurs de direction via getComputedStyle au montage ET re-colore
 * au flip de thème via applyOptions, observé par un MutationObserver sur <html>.
 * Un reskin qui « recolorerait via le CSS » casserait SILENCIEUSEMENT les couleurs de
 * direction (up/down) — elles ne sont jamais appliquées par le cascade CSS.
 *
 * Ce scan filesystem (node:fs / node:path uniquement) lit CandleChart.tsx et affirme :
 *   1. la mécanique de recolor est intacte : getComputedStyle + applyOptions + MutationObserver ;
 *   2. AUCUNE couleur de bougie litterale (upColor/downColor/wickUp/wickDown/borderUp/
 *      borderDown assignee a un hex ou un nom de couleur) - couleurs venant des tokens.
 *
 * ÉTAT ATTENDU EN WAVE 1 : l'arbre est conforme (Phase 11/15) → GREEN. Le RED ne
 * surviendrait que si un reskin de wave 2 cassait la mécanique. SANITY prouve que le
 * détecteur de littéral n'est pas trivial.
 *
 * Source : 16-PLAN.md task 1 (lwc scan) ; threat T-16-02 ; CandleChart.tsx (D-12, Pitfall 5).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// __dirname = apps/web/src/styles/__tests__ → racine src = ../../
const SRC_ROOT = path.resolve(__dirname, '../../')
const CANDLE_CHART = path.resolve(SRC_ROOT, 'components/signals/CandleChart.tsx')

/** Lecture stricte : un chemin manquant ÉCHOUE explicitement (pas de skip silencieux). */
function readStrict(abs: string, label: string): string {
  try {
    return readFileSync(abs, 'utf-8')
  } catch {
    throw new Error(`${label} introuvable : ${abs} — un déplacement doit surfacer.`)
  }
}

// Une couleur de bougie assignée à un LITTÉRAL (hex ou nom de couleur) = interdit.
// Les clés lwc concernées : upColor / downColor / wickUpColor / wickDownColor /
// borderUpColor / borderDownColor. La valeur autorisée est une variable (colors.up…),
// jamais une chaîne de couleur.
const CANDLE_COLOR_KEYS =
  'upColor|downColor|wickUpColor|wickDownColor|borderUpColor|borderDownColor'
// Valeur LITTÉRALE interdite : un hex non quoté (#abc…) OU une string quotée qui
// commence par un hex ou une lettre (nom de couleur / hex entre quotes : '#26a69a',
// "red"). Une valeur depuis une variable (colors.up) ne commence ni par # ni par quote.
const LITERAL_COLOR_VALUE = String.raw`(?:#[0-9a-fA-F]{3,8}|['"](?:#[0-9a-fA-F]{3,8}|[a-zA-Z]+)['"])`
const CANDLE_COLOR_LITERAL = new RegExp(
  `(?:${CANDLE_COLOR_KEYS})\\s*:\\s*${LITERAL_COLOR_VALUE}`,
)

describe('Phase 16 / T-16-02 : CandleChart conserve sa recolor lwc tokenisée', () => {
  it('la mécanique de recolor (getComputedStyle + applyOptions + MutationObserver) est intacte', () => {
    const src = readStrict(CANDLE_CHART, 'CandleChart.tsx')
    expect(src.includes('getComputedStyle'), 'getComputedStyle requis (lecture des tokens)').toBe(true)
    expect(src.includes('applyOptions'), 'applyOptions requis (re-color au flip)').toBe(true)
    expect(src.includes('MutationObserver'), 'MutationObserver requis (observe .dark sur <html>)').toBe(true)
  })

  it('aucune couleur de bougie littérale en CSS/JSX (couleurs résolues via tokens)', () => {
    const src = readStrict(CANDLE_CHART, 'CandleChart.tsx')
    const offenders = src
      .split('\n')
      .map((line, i) => ({ line, n: i + 1 }))
      .filter(({ line }) => CANDLE_COLOR_LITERAL.test(line))
      .map(({ line, n }) => `${n}: ${line.trim()}`)
    expect(
      offenders,
      `Couleur de bougie littérale (doit venir de getComputedStyle des tokens) :\n  ${offenders.join('\n  ')}`,
    ).toEqual([])
  })

  it('SANITY — le détecteur de littéral matche une couleur de bougie plantée', () => {
    expect(CANDLE_COLOR_LITERAL.test("upColor: '#26a69a'")).toBe(true)
    expect(CANDLE_COLOR_LITERAL.test('downColor: "red"')).toBe(true)
    // Une assignation depuis une variable (token résolu) ne doit PAS matcher.
    expect(CANDLE_COLOR_LITERAL.test('upColor: colors.up')).toBe(false)
  })
})
