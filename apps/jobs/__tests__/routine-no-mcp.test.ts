/**
 * Static-check Wave-0 — ROUTINE-05 : pas de MCP, pas de cle Anthropic.
 *
 * Scanne RECURSIVEMENT apps/jobs/src et prouve que la voie d'ecriture DB passe
 * EXCLUSIVEMENT par supabase-js service_role (jamais MCP, jamais cle API
 * Anthropic). Toute introduction future d'un import MCP / anthropic-ai/sdk /
 * ANTHROPIC_API_KEY dans le CODE casse la CI.
 *
 * Hygiene grep-gate (CLAUDE.md) : les lignes de COMMENTAIRE sont retirees AVANT
 * de chercher les tokens interdits, sinon le commentaire de runJob.ts genere un
 * faux positif. Le filtre-commentaires est prouve non-trivial par le dernier test.
 *
 * Offline : scan FS pur (readdirSync recursive), aucun reseau, aucun Supabase.
 * Les fichiers .test.ts sont EXCLUS (ils referencent ces tokens legitimement).
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const SRC_DIR = path.resolve(__dirname, '../src')

const BLOCK_COMMENT = new RegExp('/\\*[\\s\\S]*?\\*/', 'g')

/** Retire les commentaires (ligne, bloc, JSDoc) d'un source TS. */
function stripComments(source: string): string {
  const noBlock = source.replace(BLOCK_COMMENT, '')
  return noBlock
    .split('\n')
    .filter((line) => {
      const t = line.trim()
      return t !== '' && !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*')
    })
    .join('\n')
}

/** Liste recursive des fichiers .ts de prod (hors .test.ts / .d.ts). */
function listSourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...listSourceFiles(full))
    } else if (
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.test.ts') &&
      !entry.name.endsWith('.d.ts')
    ) {
      out.push(full)
    }
  }
  return out
}

/** Map<chemin, code-sans-commentaires> pour tous les fichiers de prod. */
function loadCode(): Map<string, string> {
  const map = new Map<string, string>()
  for (const file of listSourceFiles(SRC_DIR)) {
    map.set(file, stripComments(readFileSync(file, 'utf8')))
  }
  return map
}

describe('ROUTINE-05 - apps/jobs/src : pas de MCP, pas de cle Anthropic', () => {
  const code = loadCode()

  it('au moins quelques fichiers de prod scannes (sanity du scan FS)', () => {
    expect(code.size).toBeGreaterThan(5)
  })

  it('aucun import MCP (modelcontextprotocol) dans le CODE', () => {
    const offenders: string[] = []
    for (const [file, src] of code) {
      const lower = src.toLowerCase()
      if (lower.includes('modelcontextprotocol') || lower.includes('mcp')) {
        offenders.push(path.basename(file))
      }
    }
    expect(offenders).toEqual([])
  })

  it('aucun import anthropic-ai/sdk dans le CODE', () => {
    const offenders: string[] = []
    for (const [file, src] of code) {
      if (src.includes('@anthropic-ai/sdk')) {
        offenders.push(path.basename(file))
      }
    }
    expect(offenders).toEqual([])
  })

  it('aucune occurrence de ANTHROPIC_API_KEY dans le CODE (env ni litteral)', () => {
    const offenders: string[] = []
    for (const [file, src] of code) {
      if (src.includes('ANTHROPIC_API_KEY')) {
        offenders.push(path.basename(file))
      }
    }
    expect(offenders).toEqual([])
  })

  it('sanity positive : createClient de supabase-js present (runJob.ts, persist.ts)', () => {
    const findByBasename = (name: string): string => {
      for (const [file, src] of code) {
        if (path.basename(file) === name) return src
      }
      throw new Error('fichier introuvable au scan : ' + name)
    }
    for (const name of ['runJob.ts', 'persist.ts']) {
      const src = findByBasename(name)
      expect(src.includes('createClient')).toBe(true)
      expect(src.includes('@supabase/supabase-js')).toBe(true)
    }
  })

  it('filtre-commentaires non-trivial : un commentaire mentionnant MCP est ignore', () => {
    // Le code depouille NE doit PAS contenir le token issu d'un commentaire.
    const sample = ['// Pas de MCP - jamais MCP', '/* bloc MCP */', 'const x = createClient()'].join(
      '\n',
    )
    const stripped = stripComments(sample)
    expect(stripped.toLowerCase().includes('mcp')).toBe(false)
    expect(stripped.includes('createClient')).toBe(true)
  })
})
