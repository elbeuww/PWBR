/**
 * Job outcome-tracker — replay déterministe des setups expirés (Plan 05-02, TRACK-01).
 *
 * Miroir de subscription-expiry.ts : service_role lazy, fonction async retournant Json,
 * enregistré dans dispatch.ts (runJob trace job_runs — RIEN à coder ici).
 *
 * Pipeline idempotent à 2 niveaux (T-05-05, frontière producteur-unique D-05) :
 *  1. SELECT trade_setups status IN ('expired','invalidated') AND valid_until<now()
 *     ENCORE absents de prediction_outcomes (getResolvedSetupIds) → sélection bornée.
 *  2. Pour chaque setup éligible : charger les bougies H1 de la fenêtre
 *     [created_at, valid_until], rejouer via replayOutcome (@app/core, golden-testé
 *     05-01), accumuler une ligne prediction_outcomes.
 *  3. insertOutcomes (onConflict setup_id ignoreDuplicates) → filet DB (niveau 2).
 *
 * A1 : les setups 'invalidated' sont rejoués PLEINEMENT (replayOutcome décide
 * hit_tp/hit_sl/flat) — jamais présumés hit_sl. Un 2e run consécutif insère 0 ligne.
 *
 * Référence : subscription-expiry.ts (squelette) ; 05-RESEARCH §Code Examples l.242-249.
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { replayOutcome } from '@app/core'
import type { ReplaySetup, ReplayCandle } from '@app/core'
import {
  insertOutcomes,
  getResolvedSetupIds,
  getCandlesForReplay,
} from '@app/supabase'
import type { Json, Database, PredictionOutcomeInsert } from '@app/supabase'

// ─── Client service_role lazy ────────────────────────────────────────────────

function getServiceClient() {
  const url = process.env['SUPABASE_URL']
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!url || !key) {
    throw new Error(
      'outcome-tracker: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in apps/jobs/.env',
    )
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// ─── Forme minimale d'un setup éligible (colonnes sélectionnées) ───────────────

interface PendingSetup {
  id: string
  instrument_id: string
  direction: 'long' | 'short'
  entry_price: number
  stop_loss: number
  take_profits: { price: number; alloc_pct: number }[]
  valid_until: string
  created_at: string
  style: string
  opportunity_score: number
  risk_level: string
}

// ─── Job principal ────────────────────────────────────────────────────────────

/**
 * Rejoue tous les setups expirés/invalidés non encore résolus contre leurs bougies H1
 * et persiste l'issue. Idempotent : un second run consécutif retourne resolved=0.
 */
export async function outcomeTracker(): Promise<Json> {
  const client = getServiceClient()

  // 1. Sélection bornée : setups terminés (expired/invalidated) déjà échus.
  const { data, error } = await client
    .from('trade_setups')
    .select(
      'id, instrument_id, direction, entry_price, stop_loss, take_profits, valid_until, created_at, style, opportunity_score, risk_level',
    )
    .in('status', ['expired', 'invalidated'])
    .lt('valid_until', new Date().toISOString())

  if (error) {
    throw new Error(`outcome-tracker: select trade_setups failed: ${error.message}`)
  }

  const pending = (data ?? []) as unknown as PendingSetup[]

  // Exclure les setups déjà résolus (idempotence niveau 1).
  const resolvedIds = await getResolvedSetupIds(client)
  const eligible = pending.filter((s) => !resolvedIds.has(s.id))

  // 2. Rejouer chaque setup éligible contre ses bougies H1 bornées.
  const rows: PredictionOutcomeInsert[] = []
  for (const s of eligible) {
    const candles = await getCandlesForReplay(client, s.instrument_id, s.created_at, s.valid_until)
    const candlesH1: ReplayCandle[] = candles.map((c) => ({
      ts: c.ts,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }))

    const setup: ReplaySetup = {
      direction: s.direction,
      entry_price: s.entry_price,
      stop_loss: s.stop_loss,
      take_profits: s.take_profits,
      valid_until: s.valid_until,
    }

    const { outcome, realized_r } = replayOutcome(setup, candlesH1)
    rows.push({ setup_id: s.id, outcome, realized_r, candle_count: candlesH1.length })
  }

  // 3. Insert idempotent (filet DB niveau 2 : onConflict setup_id ignoreDuplicates).
  await insertOutcomes(client, rows)

  return { resolved: rows.length, skipped: pending.length - eligible.length } as Json
}
