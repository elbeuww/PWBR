/**
 * content.test.ts — couche fichiers de l'Académie (CMS-01, D-14, threat T-09-PATH).
 *
 * Behavior testé :
 *  - resolveContent : résolution (slug, locale) → chemin du fichier réel ;
 *  - fallback D-14 : locale absente mais FR présent → {locale:'fr', fallback:true}, jamais null ;
 *  - slug absent partout → null ;
 *  - path-traversal (threat T-09-PATH, plus haute sévérité) : slug `../`, slash, MAJ, locale
 *    hors routing.locales → rejetés (null) AVANT tout accès disque ;
 *  - listContent : index frontmatter-seul (gray-matter, pas de compile MDX) + readingMinutes ;
 *  - listAllContent : énumère les locales RÉELLEMENT présentes (pas les fallbacks).
 *
 * S'appuie sur les fixtures de preuve réelles (Task 3) sous content/academie/.
 */
import { describe, it, expect, vi } from 'vitest'
import { promises as fs } from 'node:fs'
import { resolveContent, listContent, listAllContent } from './content'

describe('resolveContent: résolution (slug, locale)', () => {
  it('résout un article présent dans la locale demandée (fallback:false)', async () => {
    const r = await resolveContent('ratio-risque-rendement', 'en')
    expect(r).not.toBeNull()
    expect(r?.locale).toBe('en')
    expect(r?.fallback).toBe(false)
    expect(r?.absPath.endsWith('ratio-risque-rendement.en.mdx')).toBe(true)
  })

  it('résout une leçon de cours (chemin cours/{course}/{order}-{lesson})', async () => {
    const r = await resolveContent('01-installer-mt5', 'fr')
    expect(r).not.toBeNull()
    expect(r?.locale).toBe('fr')
    expect(r?.absPath.endsWith('01-installer-mt5.fr.mdx')).toBe(true)
  })

  it('null si slug inexistant dans TOUTES les langues', async () => {
    const r = await resolveContent('slug-qui-nexiste-pas', 'fr')
    expect(r).toBeNull()
  })
})

describe('resolveContent: fallback FR (D-14)', () => {
  it("locale manquante mais FR présent → {locale:'fr', fallback:true} + absPath FR", async () => {
    // 03-poser-tp-sl existe en fr+ar, PAS en en → demande en → fallback FR servi.
    // (Tous les articles sont désormais trilingues ; seule cette leçon est partielle.)
    const r = await resolveContent('03-poser-tp-sl', 'en')
    expect(r).not.toBeNull()
    expect(r?.locale).toBe('fr')
    expect(r?.fallback).toBe(true)
    expect(r?.absPath.endsWith('03-poser-tp-sl.fr.mdx')).toBe(true)
  })

  it('leçon 3 (fr seul) demandée en en → fallback FR', async () => {
    const r = await resolveContent('03-poser-tp-sl', 'en')
    expect(r?.locale).toBe('fr')
    expect(r?.fallback).toBe(true)
  })

  it('jamais de fallback quand la locale demandée existe', async () => {
    const r = await resolveContent('comprendre-le-levier', 'en')
    expect(r?.fallback).toBe(false)
    expect(r?.locale).toBe('en')
  })
})

describe('resolveContent: garde path-traversal (threat T-09-PATH)', () => {
  it('rejette un slug avec ../ AVANT tout fs.readFile', async () => {
    const spy = vi.spyOn(fs, 'readFile')
    const r = await resolveContent('../../etc/passwd', 'fr')
    expect(r).toBeNull()
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('rejette un slug contenant un slash', async () => {
    const spy = vi.spyOn(fs, 'readFile')
    expect(await resolveContent('a/b', 'fr')).toBeNull()
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('rejette un slug en MAJUSCULES (hors ^[a-z0-9-]+$)', async () => {
    expect(await resolveContent('Abc', 'fr')).toBeNull()
  })

  it('rejette un slug vide', async () => {
    expect(await resolveContent('', 'fr')).toBeNull()
  })

  it('rejette une locale hors routing.locales', async () => {
    const spy = vi.spyOn(fs, 'readFile')
    expect(await resolveContent('ratio-risque-rendement', 'xx')).toBeNull()
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('listContent: index frontmatter-seul (Pattern 3)', () => {
  it('retourne un catalogue non vide pour fr', async () => {
    const cat = await listContent('fr')
    expect(cat.length).toBeGreaterThan(0)
  })

  it('chaque entrée a un frontmatter typé + readingMinutes, SANS corps compilé', async () => {
    const cat = await listContent('fr')
    const entry = cat.find((c) => c.slug === 'ratio-risque-rendement')
    expect(entry).toBeDefined()
    expect(entry?.type).toBe('article')
    expect(entry?.theme).toBe('gestion-risque')
    expect(entry?.titre.length).toBeGreaterThan(0)
    expect(entry?.readingMinutes).toBeGreaterThan(0)
    // index frontmatter-seul : aucun champ de corps compilé exposé
    expect((entry as unknown as Record<string, unknown>).content).toBeUndefined()
    expect((entry as unknown as Record<string, unknown>).body).toBeUndefined()
  })

  it('catalogue une leçon avec course + order', async () => {
    const cat = await listContent('fr')
    const lecon = cat.find((c) => c.slug === '01-installer-mt5')
    expect(lecon?.type).toBe('lecon')
    expect(lecon?.course).toBe('prendre-en-main-mt5')
    expect(lecon?.order).toBe(1)
  })

  it('catalogue ar complet — chaque slug apparaît (natif ou via fallback FR, jamais 404)', async () => {
    const cat = await listContent('ar')
    // Le catalogue ar liste TOUS les slugs : ceux avec variante ar native ET ceux
    // servis en FR par fallback (D-14). comprendre-le-levier doit y figurer.
    const entry = cat.find((c) => c.slug === 'comprendre-le-levier')
    expect(entry).toBeDefined()
  })
})

describe('listAllContent: locales réellement présentes (sitemap)', () => {
  it('liste les locales réelles par slug (sans fallback)', async () => {
    const all = await listAllContent()
    const levier = all.find((c) => c.slug === 'comprendre-le-levier')
    expect(levier?.locales.sort()).toEqual(['ar', 'en', 'fr'])
    const ratio = all.find((c) => c.slug === 'ratio-risque-rendement')
    expect(ratio?.locales.sort()).toEqual(['ar', 'en', 'fr'])
  })

  it('leçon 3 (poser TP/SL) a fr + ar, mais pas en', async () => {
    const all = await listAllContent()
    const l3 = all.find((c) => c.slug === '03-poser-tp-sl')
    expect(l3?.locales.sort()).toEqual(['ar', 'fr'])
  })
})
