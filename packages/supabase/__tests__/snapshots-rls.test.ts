/**
 * Test d'intégration idempotence upsert snapshots (D-41)
 *
 * Vérifie que upsertSnapshot appelé deux fois avec le même
 * (instrument_id, style, kind, computed_for_ts) ne crée aucun doublon
 * (count identique après les deux passes — clé snapshots_uniq de 0005).
 *
 * Pré-requis : SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY dans apps/jobs/.env
 * Stratégie (miroir idempotency.test.ts) :
 *  1. Récupérer l'ID de BTCUSDT via le symbol seedé.
 *  2. Upsert un snapshot SYNTHÉTIQUE (computed_for_ts=2020-01-01, content_hash marqueur TEST).
 *  3. Vérifier count = 1 après la première passe.
 *  4. Upsert la même ligne une seconde fois.
 *  5. Vérifier count = 1 (inchangé) → idempotence prouvée.
 *  6. Cleanup : delete la ligne test avec vérification d'absence post-delete (WR-06).
 *
 * Vérifie aussi getSnapshotByHash (résolution par content_hash, D-41).
 *
 * Note WR-06 : le delete afterAll vérifie son propre résultat (error + count post-delete).
 */

import { existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Charger apps/jobs/.env (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
// process.loadEnvFile est natif Node ≥ 20.12 (pas de dépendance dotenv).
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const jobsEnvPath = path.resolve(__dirname, '../../../apps/jobs/.env')
if (existsSync(jobsEnvPath)) {
  process.loadEnvFile(jobsEnvPath)
}

import { createClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Database, SnapshotInsert } from '../src/database.types'
import { getSnapshotByHash, upsertSnapshot } from '../src/repositories/snapshots'

// ─── config ─────────────────────────────────────────────────────────────────

function getSupabaseUrl() {
  return process.env['SUPABASE_URL'] ?? ''
}
function getServiceRoleKey() {
  return process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? ''
}

// Marqueurs de test (clairement synthétiques, hors plage réelle)
const TEST_TS = '2020-01-01T00:00:00Z'
const TEST_HASH = 'TEST_SNAPSHOT_HASH_2020-01-01'
const TEST_STYLE = 'day'
const TEST_KIND = 'technical'

// ─── helpers ────────────────────────────────────────────────────────────────

function getServiceClient() {
  return createClient<Database>(getSupabaseUrl(), getServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function getInstrumentId(symbol: string): Promise<string> {
  const client = getServiceClient()
  const { data, error } = await client
    .from('instruments')
    .select('id')
    .eq('symbol', symbol)
    .single()
  if (error || !data) {
    throw new Error(`Instrument "${symbol}" introuvable : ${error?.message ?? 'no data'}`)
  }
  return data.id
}

async function countSnapshots(instrumentId: string): Promise<number> {
  const client = getServiceClient()
  const { count, error } = await client
    .from('snapshots')
    .select('id', { count: 'exact', head: true })
    .eq('instrument_id', instrumentId)
    .eq('style', TEST_STYLE)
    .eq('kind', TEST_KIND)
    .eq('computed_for_ts', TEST_TS)
  if (error) {
    throw new Error(`countSnapshots failed: ${error.message}`)
  }
  return count ?? 0
}

// ─── tests ──────────────────────────────────────────────────────────────────

describe('Idempotence upsert snapshots (D-41)', () => {
  let serviceClient: ReturnType<typeof getServiceClient>
  let btcInstrumentId: string

  beforeAll(async () => {
    if (!getSupabaseUrl() || !getServiceRoleKey()) {
      throw new Error(
        '[snapshots-rls.test] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquantes dans apps/jobs/.env',
      )
    }
    serviceClient = getServiceClient()
    btcInstrumentId = await getInstrumentId('BTCUSDT')
  })

  afterAll(async () => {
    if (!getSupabaseUrl() || !getServiceRoleKey() || !btcInstrumentId) return

    // WR-06 : cleanup de la ligne test — vérifier le delete pour détecter des
    // données synthétiques résiduelles en cas d'échec réseau ou interruption.
    const { error: deleteError } = await serviceClient
      .from('snapshots')
      .delete()
      .eq('instrument_id', btcInstrumentId)
      .eq('style', TEST_STYLE)
      .eq('kind', TEST_KIND)
      .eq('computed_for_ts', TEST_TS)

    if (deleteError) {
      throw new Error(
        `[snapshots-rls.test] cleanup snapshots échoué — données synthétiques résiduelles dans la base : ${deleteError.message}`,
      )
    }

    const residualCount = await countSnapshots(btcInstrumentId)
    if (residualCount !== 0) {
      throw new Error(
        `[snapshots-rls.test] cleanup incomplet — ${residualCount} ligne(s) synthétique(s) résiduelles détectées`,
      )
    }
  })

  it('upsert x2 du même snapshot => count inchangé (D-41)', async () => {
    const row: SnapshotInsert = {
      instrument_id: btcInstrumentId,
      style: TEST_STYLE,
      timeframe_set: 'H4/H1',
      kind: TEST_KIND,
      computed_for_ts: TEST_TS,
      content_hash: TEST_HASH,
      payload: { test: true, marker: 'snapshots-rls' },
      partial: false,
    }

    // Passe 1 : insertion initiale
    await upsertSnapshot(serviceClient, row)
    const countAfterPass1 = await countSnapshots(btcInstrumentId)
    expect(countAfterPass1).toBe(1)

    // Passe 2 : re-run du même snapshot — idempotence
    await upsertSnapshot(serviceClient, row)
    const countAfterPass2 = await countSnapshots(btcInstrumentId)
    expect(countAfterPass2).toBe(1)
  })

  it('getSnapshotByHash retourne le snapshot par content_hash (D-41)', async () => {
    const found = await getSnapshotByHash(serviceClient, TEST_HASH)
    expect(found).not.toBeNull()
    expect(found?.content_hash).toBe(TEST_HASH)
    expect(found?.instrument_id).toBe(btcInstrumentId)
  })

  it('getSnapshotByHash retourne null pour un hash inconnu', async () => {
    const found = await getSnapshotByHash(serviceClient, 'HASH_INEXISTANT_xyz')
    expect(found).toBeNull()
  })
})
