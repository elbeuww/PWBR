/**
 * Job affiliate-commission — calcul mensuel idempotent des commissions (AFF-03/AFF-05).
 *
 * Miroir de outcome-tracker.ts : service_role lazy, fonction async retournant Json,
 * enregistré dans dispatch.ts (runJob trace job_runs — RIEN à coder ici).
 *
 * Wrapper mince : tout le calcul vit dans le RPC compute_affiliate_commissions
 * (grille basis points, Σ revenu atomique, exclusion self-ref D-12, filtre filleul
 * actif AFF-05, upsert idempotent D-05). Le job ne fait que résoudre la PÉRIODE et
 * appeler le RPC.
 *
 * Idempotence (T-07-DOUBLEPAY) : portée par le RPC (UNIQUE(affiliate_id,referral_id,
 * period) + on conflict do update where status='due'). Un re-run du même mois =
 * même total, jamais d'écrasement d'une commission payée.
 *
 * Période = mois calendaire UTC `yyyy-MM` via luxon (T-07-TZ / Pitfall 4) — jamais
 * d'horloge JS locale. Optionnellement re-calcul d'un mois passé via process.argv[3]
 * (ex : `tsx src/dispatch.ts affiliate-commission 2026-05`).
 *
 * Référence : 07-RESEARCH §Pattern 3 (squelette) + outcome-tracker.ts (squelette job).
 */
import 'dotenv/config'
import { DateTime } from 'luxon'
import { createClient } from '@supabase/supabase-js'
import { computeCommissions } from '@app/supabase'
import type { Json, Database } from '@app/supabase'

// ─── Client service_role lazy ────────────────────────────────────────────────

function getServiceClient() {
  const url = process.env['SUPABASE_URL']
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!url || !key) {
    throw new Error(
      'affiliate-commission: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in apps/jobs/.env',
    )
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// ─── Job principal ────────────────────────────────────────────────────────────

/**
 * Calcule (upsert idempotent) les commissions du mois calendaire courant (UTC), ou
 * d'un mois fourni en argument. Retourne le jsonb du RPC enrichi de la période.
 */
export async function affiliateCommission(): Promise<Json> {
  const client = getServiceClient()

  // Période = mois calendaire UTC (luxon, T-07-TZ / Pitfall 4) — jamais d'horloge JS locale.
  // Argument optionnel (re-calcul d'un mois passé) : validé sur le format 'yyyy-MM'.
  const argPeriod = process.argv[3]
  const period =
    argPeriod && /^\d{4}-\d{2}$/.test(argPeriod)
      ? argPeriod
      : DateTime.utc().toFormat('yyyy-MM')

  const stats = await computeCommissions(client, period)

  return { period, ...(stats as object) } as Json
}
