/**
 * Tests golden de formatMessage — formateur Telegram pur bilingue FR+AR.
 *
 * Couvre TG-02 (seuil N≥30), LEGAL-01 (disclaimer FR+AR), D-03/D-05 (jamais de
 * niveaux entrée/SL/TP), D-10 (jour vide), D-11 (cohérence seuil), bidi
 * (isolats U+2066/U+2069/U+200F), escapeHtml (T-06-INJ), cap 4096 (Pitfall 3).
 */
import { describe, expect, it } from 'vitest'
import { formatMessage, escapeHtml, type FormatTrade } from './format.js'

const LRI = '⁦'
const PDI = '⁩'
const RLM = '‏'

const sufficient = { n: 142, win_rate: 0.58, expectancy: 0.4, avg_r: 1.7 }
const insufficient = { n: 12, win_rate: null, expectancy: null, avg_r: null }

const tradeTp: FormatTrade = {
  symbol: 'EUR/USD',
  direction: 'long',
  outcome: 'hit_tp',
  realized_r: 2.3,
}

describe('escapeHtml — T-06-INJ', () => {
  it('échappe & < > dans le bon ordre', () => {
    expect(escapeHtml('a<b>&c')).toBe('a&lt;b&gt;&amp;c')
  })
  it('& d’abord pour ne pas double-échapper', () => {
    expect(escapeHtml('<')).toBe('&lt;')
    expect(escapeHtml('&amp;')).toBe('&amp;amp;')
  })
})

describe('formatMessage — seuil win rate (TG-02 / D-11)', () => {
  it('N≥30 → affiche « 58% » ET « N=142 »', () => {
    const out = formatMessage({ kind: 'winrate', winRate: sufficient, trades: [] })
    expect(out).toContain('58%')
    expect(out).toContain('N=142')
  })

  it('N<30 → « échantillon insuffisant » + « N=12 » + AUCUN %', () => {
    const out = formatMessage({ kind: 'winrate', winRate: insufficient, trades: [] })
    expect(out).toContain('échantillon insuffisant')
    expect(out).toContain('N=12')
    expect(out).not.toContain('%')
  })
})

describe('formatMessage — disclaimer LEGAL-01', () => {
  it('toute sortie contient le disclaimer FR ET AR', () => {
    const out = formatMessage({ kind: 'recap', winRate: sufficient, trades: [tradeTp] })
    expect(out).toContain('Contenu éducatif')
    expect(out).toContain('conseil en investissement')
    expect(out).toContain('تعليمي')
    expect(out).toContain('استثمارية')
  })
})

describe('formatMessage — minimisation de données D-03/D-05 (T-06-LEAK)', () => {
  it('rend actif+résultat+R, jamais de niveaux', () => {
    const out = formatMessage({ kind: 'recap', winRate: sufficient, trades: [tradeTp] })
    expect(out).toContain('EUR/USD')
    expect(out).toContain('+2.3R')
    expect(out).toContain('TP1')
    for (const banned of ['entry', 'stop_loss', 'take_profit', 'SL =', 'TP =']) {
      expect(out).not.toContain(banned)
    }
  })

  it('mapping outcome D-03', () => {
    const sl: FormatTrade = { symbol: 'BTC/USDT', direction: 'short', outcome: 'hit_sl', realized_r: -1 }
    const flat: FormatTrade = { symbol: 'XAU/USD', direction: 'long', outcome: 'flat', realized_r: 0.2 }
    const out = formatMessage({ kind: 'recap', winRate: sufficient, trades: [sl, flat] })
    expect(out).toContain('SL')
    expect(out).toContain('-1.0R')
    expect(out).toContain('flat')
    expect(out).toContain('+0.2R')
  })
})

describe('formatMessage — jour vide D-10', () => {
  it('récap sans trade → « Aucun trade » FR + AR + win rate, jamais de skip', () => {
    const out = formatMessage({ kind: 'recap', winRate: sufficient, trades: [] })
    expect(out).toContain('Aucun trade')
    expect(out).toContain('لا توجد')
    expect(out).toContain('58%')
  })
})

describe('formatMessage — bidi (T-06-BIDI)', () => {
  it('segments ticker/R isolés U+2066/U+2069 + lignes AR préfixées U+200F', () => {
    const out = formatMessage({ kind: 'recap', winRate: sufficient, trades: [tradeTp] })
    expect(out).toContain(LRI)
    expect(out).toContain(PDI)
    expect(out).toContain(RLM)
  })
})

describe('formatMessage — cap 4096 (Pitfall 3)', () => {
  it('50 trades → < 4096 chars + « autres »', () => {
    const trades: FormatTrade[] = Array.from({ length: 50 }, (_, i) => ({
      symbol: `SYM${i}/USDT`,
      direction: i % 2 === 0 ? 'long' : 'short',
      outcome: i % 3 === 0 ? 'hit_tp' : i % 3 === 1 ? 'hit_sl' : 'flat',
      realized_r: (i % 7) - 3 + 0.1 * i,
    }))
    const out = formatMessage({ kind: 'recap', winRate: sufficient, trades })
    expect(out.length).toBeLessThan(4096)
    expect(out).toContain('autres')
  })
})

describe('formatMessage — escape sur donnée dynamique (T-06-INJ)', () => {
  it('un symbol injectant du HTML est échappé', () => {
    const evil: FormatTrade = {
      symbol: '<b>x</b>',
      direction: 'long',
      outcome: 'hit_tp',
      realized_r: 1,
    }
    const out = formatMessage({ kind: 'recap', winRate: sufficient, trades: [evil] })
    expect(out).not.toContain('<b>x</b>')
    expect(out).toContain('&lt;b&gt;x&lt;/b&gt;')
  })
})
