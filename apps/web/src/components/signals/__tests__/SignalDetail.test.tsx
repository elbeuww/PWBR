/**
 * SignalDetail.test.tsx — garde-fou MEMB-04/D-10 : le contenu IA est rendu VERBATIM.
 *
 * Behavior testé (RED→GREEN) :
 *  1. veteran_note apparaît EXACTEMENT (string identique) dans le rendu.
 *  2. Une technical_reason et l'invalidation apparaissent verbatim.
 *  3. Le score affiché == colonne opportunity_score (jamais dérivé du payload).
 *  4. ZÉRO dangerouslySetInnerHTML dans le markup (rendu échappé par React).
 *
 * Rendu via renderToStaticMarkup (react-dom/server) → pas de jsdom requis, exécution
 * Node. next-intl est mocké (t(key)=key) ; le contenu IA n'étant PAS une clé i18n,
 * il doit traverser le rendu inchangé. CollapsibleContent forceMount → le Niveau 2
 * est présent dans le DOM (caché) donc assertable.
 *
 * L'élément est construit via React.createElement (PAS de JSX) pour rester un
 * script TS parsable par le bundler de test (oxc) sans config JSX dédiée.
 */
import { createElement } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { SignalDetail, type TradeSetupDetail } from '../SignalDetail'

// next-intl : t(key) renvoie la clé (les titres de section), jamais le contenu IA.
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

// i18n/navigation : Link localisé mocké en <a> (évite de résoudre next/navigation
// côté next-intl createNavigation sous le runner ; on teste le rendu, pas le routage).
vi.mock('../../../i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children?: unknown }) =>
    createElement('a', { href, ...rest }, children as never),
}))

// WatchlistToggle : îlot client (react-query useMutation) câblé dans l'en-tête (19-06).
// Hors sujet de ce test (contenu IA VERBATIM) et il exige un QueryClientProvider absent
// du rendu statique → on le neutralise. Sa logique a son propre test dédié (dash/).
vi.mock('../../dash/WatchlistToggle', () => ({
  WatchlistToggle: () => null,
}))

const VETERAN_NOTE =
  'Setup propre sur cassure de structure H4 ; je laisse courir vers le TP2 si le momentum tient.'
const TECH_REASON = 'BOS haussier confirmé sur H4 avec retest de la zone de demande.'
const INVALIDATION = 'Clôture H4 sous 1.0820 invalide le scénario long.'

function makeSetup(): TradeSetupDetail {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    instrument_id: '22222222-2222-2222-2222-222222222222',
    opportunity_score: 83,
    risk_level: 'medium',
    risk_reward: 2.4,
    status: 'active',
    instruments: { symbol: 'EURUSD', asset_class: 'forex', precision: 5, display_name: 'EUR/USD' },
    payload: {
      direction: 'long',
      timeframe_analysis: 'H4',
      entry: { type: 'limit', price: 1.085, zone: [1.0845, 1.0855] },
      stop_loss: 1.082,
      take_profits: [
        { price: 1.092, alloc_pct: 50 },
        { price: 1.098, alloc_pct: 50 },
      ],
      technical_reasons: [TECH_REASON],
      fundamental_reasons: ['Différentiel de taux favorable à l’euro.'],
      news_catalysts: [],
      upcoming_risk_events: [],
      invalidation: INVALIDATION,
      veteran_note: VETERAN_NOTE,
    },
  }
}

describe('SignalDetail : contenu IA VERBATIM (MEMB-04 / D-10)', () => {
  const html = renderToStaticMarkup(
    createElement(SignalDetail, { setup: makeSetup(), locale: 'fr' }),
  )

  it('rend veteran_note exactement (aucune transformation)', () => {
    expect(html).toContain(VETERAN_NOTE)
  })

  it('rend une technical_reason et l’invalidation verbatim', () => {
    expect(html).toContain(TECH_REASON)
    expect(html).toContain(INVALIDATION)
  })

  it('affiche le score == colonne opportunity_score (jamais dérivé du payload)', () => {
    expect(html).toContain('83')
  })

  it('n’utilise JAMAIS dangerouslySetInnerHTML (rendu échappé)', () => {
    // Le markup nominal ne contient aucune balise injectée.
    expect(html).not.toContain('<script')
    expect(html).not.toContain('dangerouslySetInnerHTML')

    // WR-03 : prouver l'échappement réel avec un payload XSS multi-vecteurs.
    // React échappe les enfants texte → les balises brutes deviennent des entités.
    const xssSetup = makeSetup()
    const XSS = '<img src=x onerror=alert(1)><script>alert(2)</script>'
    xssSetup.payload.veteran_note = XSS
    xssSetup.payload.invalidation = XSS
    xssSetup.payload.technical_reasons = [XSS]
    const xssHtml = renderToStaticMarkup(
      createElement(SignalDetail, { setup: xssSetup, locale: 'fr' }),
    )

    // Aucune balise HTML brute issue du payload ne doit survivre au rendu :
    // les chevrons ouvrants sont échappés → le handler onerror reste du texte
    // inerte (jamais un attribut exécutable), car aucun élément n'est créé.
    expect(xssHtml).not.toContain('<img')
    expect(xssHtml).not.toContain('<script>alert')
    expect(xssHtml).not.toContain('onerror=alert(1)>') // pas de '>' brut → balise impossible
    // Le texte IA est bien présent mais sous forme échappée (entités HTML).
    expect(xssHtml).toContain('&lt;img')
    expect(xssHtml).toContain('&lt;script&gt;')
    expect(xssHtml).toContain('onerror=alert(1)&gt;') // le '>' est encodé
  })
})
