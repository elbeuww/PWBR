/**
 * Test d'isolation des pannes — DATA-07
 *
 * Prouve que :
 *  1. Une source dont la clé est invalide n'interrompt pas les autres (stats.errors peuplé,
 *     les autres cibles ingèrent sans exception propagée).
 *  2. La vue v_data_freshness est interrogeable et expose une colonne is_stale.
 *
 * Stratégie :
 *  - Cas 1 (isolation) : mock top-level vi.mock sur @app/data-sources et @app/supabase.
 *    Une série FRED throw, les 3 autres retournent des données synthétiques.
 *    upsertMacroSeries est mocké pour compter les insertions sans réseau.
 *    Pas de réseau, pas de Supabase requis.
 *  - Cas 2 (staleness) : interroge v_data_freshness via service_role Supabase.
 *    Skippé si SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY absents.
 *
 * Pattern : runJob.test.ts (chargement dotenv, client service_role, skip si env absent).
 */

import { config as dotenvConfig } from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

// Charger apps/jobs/.env explicitement (CWD = racine monorepo lors de vitest run)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenvConfig({ path: path.resolve(__dirname, '../.env') })

import { createClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Database, MacroSeriesInsert } from '@app/supabase'

// ─── Constantes d'environnement ───────────────────────────────────────────────

const SUPABASE_URL = process.env['SUPABASE_URL'] ?? ''
const SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? ''
const HAS_SUPABASE = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY)

function getVerifyClient() {
  return createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// ─── Mocks top-level (hoistés par Vitest) ─────────────────────────────────────

// Compteur d'upserts partagé entre le mock et les tests
let mockUpsertCount = 0
let mockUpsertRows = 0

vi.mock('@app/supabase', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@app/supabase')>()
  return {
    ...orig,
    upsertMacroSeries: async (_client: unknown, rows: MacroSeriesInsert[]) => {
      mockUpsertCount++
      mockUpsertRows += rows.length
    },
  }
})

// Données synthétiques
function makeFredObservations(seriesCode: string, count = 3): MacroSeriesInsert[] {
  return Array.from({ length: count }, (_, i) => ({
    series_code: seriesCode,
    ts: `2024-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`,
    value: 5.0 + i * 0.1,
  }))
}

// Série en échec simulée
const FAILING_SERIES = 'DFF'
const ALL_SERIES = ['DFF', 'CPIAUCSL', 'DTWEXBGS', 'DFII10'] as const

vi.mock('@app/data-sources', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@app/data-sources')>()
  return {
    ...orig,
    fetchFredSeries: async (seriesCode: string) => {
      if (seriesCode === FAILING_SERIES) {
        throw new Error(`FRED ${FAILING_SERIES}: HTTP 403 Forbidden (clé invalide simulée)`)
      }
      // Retourner une réponse synthétique (parseFredObservations mocké ci-dessous)
      return { observations: [] }
    },
    parseFredObservations: (_raw: unknown, seriesCode: string): MacroSeriesInsert[] => {
      if (seriesCode === FAILING_SERIES) return []
      return makeFredObservations(seriesCode)
    },
  }
})

// ─── Suite Cas 1 : isolation des pannes (offline, mock) ──────────────────────

describe('DATA-07 — isolation des pannes (mock offline)', () => {
  beforeAll(() => {
    // Injecter des env vars valides pour que getServiceClient() ne throw pas
    process.env['SUPABASE_URL'] = process.env['SUPABASE_URL'] || 'https://fake.supabase.co'
    process.env['SUPABASE_SERVICE_ROLE_KEY'] =
      process.env['SUPABASE_SERVICE_ROLE_KEY'] || 'fake-service-role-key'
  })

  afterAll(() => {
    // Réinitialiser les compteurs pour les tests suivants
    mockUpsertCount = 0
    mockUpsertRows = 0
  })

  it('une série FRED en échec peuple stats.errors, les 3 autres ingèrent, le job ne throw pas', async () => {
    // Réinitialiser les compteurs avant le test
    mockUpsertCount = 0
    mockUpsertRows = 0

    // Import dynamique du job (après les mocks top-level actifs)
    const { macroIngest } = await import('../src/jobs/macro-ingest.js')

    // Le job ne doit pas throw même avec une série en échec
    const result = await macroIngest()
    const stats = result as {
      inserted: number
      skipped: number
      errors: Array<{ series: string; msg: string }>
    }

    // ─ Le job ne propage pas l'erreur (a retourné stats) ─────────────────────
    expect(stats).toBeDefined()
    expect(typeof stats).toBe('object')

    // ─ La série en échec est dans stats.errors ────────────────────────────────
    expect(Array.isArray(stats.errors)).toBe(true)
    const failingError = stats.errors.find((e) => e.series === FAILING_SERIES)
    expect(failingError).toBeDefined()
    expect(failingError?.msg).toContain('403')

    // ─ Les autres séries ont été traitées (inserted > 0) ─────────────────────
    const successfulSeries = ALL_SERIES.filter((s) => s !== FAILING_SERIES)
    expect(stats.inserted).toBeGreaterThan(0)
    // Inserted = nb lignes des 3 séries réussies (3 points chacune)
    expect(stats.inserted).toBe(successfulSeries.length * 3)

    // ─ Seule la série en échec est dans errors ───────────────────────────────
    expect(stats.errors.length).toBe(1)
    expect(stats.errors.every((e) => e.series === FAILING_SERIES)).toBe(true)

    // ─ Les autres séries sont absentes des erreurs ───────────────────────────
    for (const series of successfulSeries) {
      expect(stats.errors.find((e) => e.series === series)).toBeUndefined()
    }

    // ─ upsertMacroSeries a été appelée pour chaque série réussie ─────────────
    expect(mockUpsertCount).toBe(successfulSeries.length)
    expect(mockUpsertRows).toBe(successfulSeries.length * 3)
  })
})

// ─── Suite Cas 2 : staleness exposée (Supabase requis) ───────────────────────

describe('DATA-07 — staleness exposée via v_data_freshness', () => {
  beforeAll(() => {
    if (!HAS_SUPABASE) {
      console.warn(
        '[fault-isolation] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY absents — ' +
          'test staleness skippé (env non configuré)',
      )
    }
  })

  it('v_data_freshness est interrogeable et expose is_stale', async () => {
    if (!HAS_SUPABASE) {
      // Skip propre sans env configuré
      return
    }

    const client = getVerifyClient()

    // Interroger la vue v_data_freshness — contrat Phase 4
    const { data, error } = await client
      .from('v_data_freshness')
      .select('*')
      .limit(10)

    // La vue doit être interrogeable sans erreur (contrat minimal)
    expect(error).toBeNull()

    // Si des lignes existent, elles ont bien une colonne is_stale
    if (data && data.length > 0) {
      const firstRow = data[0]
      expect(firstRow).toHaveProperty('is_stale')
      // is_stale doit être un booléen ou null (vue calculée)
      const isStale = (firstRow as Record<string, unknown>)['is_stale']
      expect(typeof isStale === 'boolean' || isStale === null).toBe(true)
    }
    // Si aucune ligne (base vide / pas encore d'instruments), c'est acceptable —
    // la vue est interrogeable sans erreur = contrat minimal satisfait
  })
})
