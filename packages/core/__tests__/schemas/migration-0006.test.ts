/**
 * Test cross-platform de la migration 0006 (remplace le grep Windows-hostile).
 *
 * Lit le SQL versionné via fs.readFileSync, strip les lignes de commentaire (`--`),
 * et assert la forme RLS + structure attendue. Indépendant de l'OS (concern revue
 * nettoyage : plus de grep). Source de vérité = le fichier SQL appliqué via MCP.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sqlPath = path.resolve(
  __dirname,
  '../../../../supabase/migrations/0006_analyses_trade_setups.sql',
)

// Strip les lignes commençant (après trim) par `--` pour ne tester que le SQL effectif.
const rawSql = readFileSync(sqlPath, 'utf8')
const sql = rawSql
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n')
  .toLowerCase()

const countOccurrences = (haystack: string, needle: string): number =>
  haystack.split(needle).length - 1

describe('migration 0006 — DDL analyses + trade_setups (cross-platform)', () => {
  it('crée les deux tables', () => {
    expect(sql).toContain('create table public.analyses')
    expect(sql).toContain('create table public.trade_setups')
  })

  it('RLS select-only : exactement 2 policies for select to authenticated', () => {
    expect(countOccurrences(sql, 'for select to authenticated')).toBe(2)
  })

  it('AUCUNE write policy (insert/update/delete) — service_role bypass', () => {
    expect(countOccurrences(sql, 'for insert')).toBe(0)
    expect(countOccurrences(sql, 'for update')).toBe(0)
    expect(countOccurrences(sql, 'for delete')).toBe(0)
  })

  it('trade_setups porte session_day date not null (concern revue #1)', () => {
    expect(sql).toContain('session_day date not null')
  })

  it('trade_setups dénormalise style et session (A2)', () => {
    // colonnes dénormalisées présentes pour l'index d'expiry direct
    expect(sql).toMatch(/style\s+text\s+not\s+null\s+check\s*\(style/)
    expect(sql).toMatch(/session\s+text\s+not\s+null\s+check\s*\(session/)
  })

  it('index trade_setups_score_idx présent', () => {
    expect(sql).toContain('trade_setups_score_idx')
  })

  it('trade_setups_versionkey_idx est UNIQUE, porte la clé D-45 + where status active', () => {
    // index unique partiel = filet DB contre la race expire→insert
    const idxMatch = sql.match(
      /create\s+unique\s+index\s+trade_setups_versionkey_idx[\s\S]*?;/,
    )
    expect(idxMatch).not.toBeNull()
    const idx = idxMatch![0]
    expect(idx).toContain('(instrument_id, style, session, session_day)')
    expect(idx).toContain("where status = 'active'")
  })
})
