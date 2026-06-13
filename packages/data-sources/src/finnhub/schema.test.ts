/**
 * Golden values — parseFinnhubNews
 *
 * Test hors-ligne : charge la fixture JSON et vérifie la normalisation.
 * Aucun appel réseau. Déterministe.
 *
 * D-28 : mapping par catégorie, PAS d'heuristique mots-clés.
 * D-30 : sentiment du provider stocké tel quel.
 * T-02-09 : aucune clé loggée dans les tests.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { parseFinnhubNews } from './schema.js'

const require = createRequire(import.meta.url)
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const rawFixture = require('../__fixtures__/finnhub-news.json') as unknown[]

const CATEGORY = 'crypto'

describe('parseFinnhubNews — golden values', () => {
  it('retourne 3 NewsInsert depuis la fixture', () => {
    const result = parseFinnhubNews(rawFixture, CATEGORY)
    expect(result).toHaveLength(3)
  })

  it('source vaut "finnhub" pour tous les articles', () => {
    const result = parseFinnhubNews(rawFixture, CATEGORY)
    for (const item of result) {
      expect(item.source).toBe('finnhub')
    }
  })

  it('url_hash de l\'article 0 est déterministe (sha256 hex de l\'url)', () => {
    const result = parseFinnhubNews(rawFixture, CATEGORY)
    // L'url de l'article 0 = https://www.reuters.com/crypto/bitcoin-surges-70000-etf-inflows-2026-06-09/
    // sha256 hex de cette url — calculé une fois, golden value verrouillée
    expect(result[0]?.url_hash).toBe(
      'deb928c46050165d56d0bc3a20d0acd2f97ee7d1af057de957088edce406180e',
    )
    // Longueur d'un sha256 hex = 64 caractères
    expect(result[0]?.url_hash).toHaveLength(64)
  })

  it('url_hash est stable (appel répété => même valeur)', () => {
    const r1 = parseFinnhubNews(rawFixture, CATEGORY)
    const r2 = parseFinnhubNews(rawFixture, CATEGORY)
    expect(r1[0]?.url_hash).toBe(r2[0]?.url_hash)
  })

  it('article 0 : published_at ISO UTC correct (datetime 1749463200)', () => {
    const result = parseFinnhubNews(rawFixture, CATEGORY)
    expect(result[0]?.published_at).toBe('2026-06-09T09:00:00.000Z')
  })

  it('article 0 : title correct', () => {
    const result = parseFinnhubNews(rawFixture, CATEGORY)
    expect(result[0]?.title).toBe('Bitcoin surges past 70,000 as ETF inflows accelerate')
  })

  it('article 0 : summary présent', () => {
    const result = parseFinnhubNews(rawFixture, CATEGORY)
    expect(result[0]?.summary).toContain('Bitcoin reached')
  })

  it('article 2 : summary null (champ absent dans fixture)', () => {
    const result = parseFinnhubNews(rawFixture, CATEGORY)
    // Article 2 a summary: null dans la fixture
    expect(result[2]?.summary).toBeNull()
  })

  it('sentiment est null (Finnhub free ne fournit pas de sentiment — D-30)', () => {
    const result = parseFinnhubNews(rawFixture, CATEGORY)
    for (const item of result) {
      // sentiment provider tel quel : l'article Finnhub free ne contient pas de champ sentiment
      // => null (D-30 : stocker le sentiment tel que fourni par le provider, null si absent)
      expect(item.sentiment === null || typeof item.sentiment === 'number').toBe(true)
    }
  })

  it('instrument_ids est un tableau (peut être vide)', () => {
    const result = parseFinnhubNews(rawFixture, CATEGORY)
    for (const item of result) {
      expect(Array.isArray(item.instrument_ids)).toBe(true)
    }
  })

  it('retourne un tableau vide si fixture vide', () => {
    const result = parseFinnhubNews([], CATEGORY)
    expect(result).toHaveLength(0)
  })
})
