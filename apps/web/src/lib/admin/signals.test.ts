/**
 * Tests des mappeurs purs du statut Telegram (ADMIN-03, D-03).
 *
 * Contrat 2-états (Pitfall 3) : un setup est « posté » SSI une ligne telegram_posts
 * existe avec dedupe_key === 'notable:' + setup.id. Les échecs ne sont JAMAIS persistés
 * → jamais d'état « failed ». Clés non-notable ignorées. Entrée vide → set vide.
 */
import { describe, expect, it } from 'vitest'
import { postedSetupIdSet, telegramStatusFor } from './signals.js'

describe('postedSetupIdSet — extraction des ids postés (D-03)', () => {
  it('garde uniquement les clés notable: et strippe le préfixe', () => {
    const set = postedSetupIdSet([
      { dedupe_key: 'notable:abc' },
      { dedupe_key: 'notable:def' },
    ])
    expect(set.has('abc')).toBe(true)
    expect(set.has('def')).toBe(true)
    expect(set.size).toBe(2)
  })

  it('ignore les clés non-notable (recap:, winrate:, …)', () => {
    const set = postedSetupIdSet([
      { dedupe_key: 'recap:2026-06-19' },
      { dedupe_key: 'winrate:90d' },
      { dedupe_key: 'notable:keep' },
    ])
    expect(set.has('keep')).toBe(true)
    expect(set.size).toBe(1)
  })

  it('entrée vide → set vide', () => {
    expect(postedSetupIdSet([]).size).toBe(0)
  })

  it('entrée undefined → set vide (robustesse)', () => {
    expect(postedSetupIdSet(undefined as unknown as { dedupe_key: string }[]).size).toBe(0)
  })

  it('ne strippe que le premier préfixe notable: (id contenant des deux-points)', () => {
    const set = postedSetupIdSet([{ dedupe_key: 'notable:id:with:colons' }])
    expect(set.has('id:with:colons')).toBe(true)
  })
})

describe('telegramStatusFor — 2 états posté/non-publié (Pitfall 3)', () => {
  const posted = new Set(['abc'])

  it('posté SSI présent dans le set', () => {
    expect(telegramStatusFor('abc', posted)).toBe('posted')
  })

  it('non publié si absent', () => {
    expect(telegramStatusFor('zzz', posted)).toBe('unpublished')
  })

  it('set vide → non publié', () => {
    expect(telegramStatusFor('abc', new Set())).toBe('unpublished')
  })

  it("ne retourne JAMAIS 'failed' — seulement posted | unpublished", () => {
    const results = ['a', 'b', 'c'].map((id) => telegramStatusFor(id, posted))
    for (const r of results) {
      expect(['posted', 'unpublished']).toContain(r)
    }
  })
})
