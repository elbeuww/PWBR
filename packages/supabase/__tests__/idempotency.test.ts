/**
 * Test d'intégration idempotence upsert (DATA-06)
 *
 * Vérifie que upsertCandles appelé deux fois avec le même lot ne crée
 * aucun doublon (count identique après les deux passes).
 *
 * Pré-requis : SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY dans apps/jobs/.env
 * Stratégie :
 *  1. Récupérer l'ID de BTCUSDT via le symbol seedé.
 *  2. Upsert un petit lot de candles SYNTHÉTIQUES (ts=2020-01-01, marqueur TEST_TS_*)
 *     sur timeframe H1 — valeurs clairement fictives (open=10000) hors plage réelle.
 *  3. Vérifier count = 2 après la première passe.
 *  4. Upsert les mêmes lignes une seconde fois.
 *  5. Vérifier count = 2 (inchangé) → idempotence prouvée.
 *  6. Cleanup : delete les lignes test avec vérification d'absence post-delete (WR-06).
 *
 * Note WR-06 : le delete afterAll vérifie son propre résultat (error + count post-delete).
 * Un échec réseau ou process tué entre upsert et afterAll laisse des données synthétiques
 * résiduelles détectables : le count post-delete != 0 fait échouer bruyamment.
 */

import { existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Charger apps/jobs/.env (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
// process.loadEnvFile est natif Node ≥ 20.12 (pas de dépendance dotenv).
// CWD = racine monorepo quand vitest run est lancé depuis la racine.
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const jobsEnvPath = path.resolve(__dirname, '../../../apps/jobs/.env')
if (existsSync(jobsEnvPath)) {
  process.loadEnvFile(jobsEnvPath)
}

import { createClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Database, CandleInsert } from '../src/database.types'
import { upsertCandles } from '../src/repositories/candles'

// ─── config ─────────────────────────────────────────────────────────────────
// Lire depuis process.env au moment de l'utilisation (pas au niveau module) pour
// que process.loadEnvFile() ait eu le temps de peupler les variables.

function getSupabaseUrl() {
  return process.env['SUPABASE_URL'] ?? ''
}
function getServiceRoleKey() {
  return process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? ''
}

// ts de test (passé, clairement en dehors des bougies réelles)
const TEST_TS_1 = '2020-01-01T00:00:00Z'
const TEST_TS_2 = '2020-01-01T01:00:00Z'

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

async function countCandles(instrumentId: string, timeframe: string): Promise<number> {
  const client = getServiceClient()
  const { count, error } = await client
    .from('candles')
    .select('id', { count: 'exact', head: true })
    .eq('instrument_id', instrumentId)
    .eq('timeframe', timeframe)
    .in('ts', [TEST_TS_1, TEST_TS_2])
  if (error) {
    throw new Error(`countCandles failed: ${error.message}`)
  }
  return count ?? 0
}

// ─── tests ──────────────────────────────────────────────────────────────────

describe('Idempotence upsert candles (DATA-06)', () => {
  let serviceClient: ReturnType<typeof getServiceClient>
  let btcInstrumentId: string

  beforeAll(async () => {
    if (!getSupabaseUrl() || !getServiceRoleKey()) {
      throw new Error(
        '[idempotency.test] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquantes dans apps/jobs/.env',
      )
    }
    serviceClient = getServiceClient()
    btcInstrumentId = await getInstrumentId('BTCUSDT')
  })

  afterAll(async () => {
    if (!getSupabaseUrl() || !getServiceRoleKey() || !btcInstrumentId) return

    // WR-06 : cleanup des lignes test — vérifier le delete pour détecter des
    // données synthétiques résiduelles en cas d'échec réseau ou interruption.
    const { error: deleteError } = await serviceClient
      .from('candles')
      .delete()
      .eq('instrument_id', btcInstrumentId)
      .eq('timeframe', 'H1')
      .in('ts', [TEST_TS_1, TEST_TS_2])

    if (deleteError) {
      throw new Error(
        `[idempotency.test] cleanup candles échoué — données synthétiques résiduelles dans la base : ${deleteError.message}`,
      )
    }

    // Vérification post-delete : les lignes ne doivent plus exister
    const residualCount = await countCandles(btcInstrumentId, 'H1')
    if (residualCount !== 0) {
      throw new Error(
        `[idempotency.test] cleanup incomplet — ${residualCount} ligne(s) synthétique(s) résiduelles détectées (instrument_id=${btcInstrumentId}, timeframe=H1, ts in [${TEST_TS_1}, ${TEST_TS_2}])`,
      )
    }
  })

  it("upsert x2 du même lot => count inchangé (DATA-06)", async () => {
    const testRows: CandleInsert[] = [
      {
        instrument_id: btcInstrumentId,
        timeframe: 'H1',
        ts: TEST_TS_1,
        open: 10000,
        high: 10100,
        low: 9900,
        close: 10050,
        volume: 100,
      },
      {
        instrument_id: btcInstrumentId,
        timeframe: 'H1',
        ts: TEST_TS_2,
        open: 10050,
        high: 10200,
        low: 10000,
        close: 10150,
        volume: 120,
      },
    ]

    // Passe 1 : insertion initiale
    await upsertCandles(serviceClient, testRows)
    const countAfterPass1 = await countCandles(btcInstrumentId, 'H1')
    expect(countAfterPass1).toBe(2)

    // Passe 2 : re-run du même lot — idempotence
    await upsertCandles(serviceClient, testRows)
    const countAfterPass2 = await countCandles(btcInstrumentId, 'H1')
    expect(countAfterPass2).toBe(2)
  })

  it('upsertCandles avec tableau vide ne lance pas (early-return)', async () => {
    await expect(upsertCandles(serviceClient, [])).resolves.toBeUndefined()
  })
})
