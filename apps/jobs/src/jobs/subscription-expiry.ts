/**
 * Job subscription-expiry — cycle de vie des abonnements + sweep des réservations (Plan 06).
 *
 * Fait DEUX choses idempotentes via service_role (hors requête user) :
 *  1. expireDue(client) — subscriptions active->expired WHERE current_period_end<=now()
 *     (D-10 : coupe nette à current_period_end ; la RLS has_active_subscription() gate déjà
 *      l'accès — rien à coder côté gating). Naturellement idempotent (re-run = 0 ligne).
 *  2. releaseExpiredReservations(client) — payments pending dont reservation_expires_at<=now()
 *     -> 'rejected' (reject_reason='reservation_expired'), libère l'offset (D-05). Ce sweep est
 *     applicatif car l'index unique partiel 0012 ne peut pas porter now() (Postgres 42P17 —
 *     prédicat IMMUTABLE requis). Sans lui, reserveOffset finit par s'épuiser (DoS auto-infligé).
 *
 * T-04-EXPIRE : UPDATE idempotent borné par WHERE (active AND period_end<=now()) + job_runs
 * (runJob wrappe la traçabilité). Aucune divergence : status-only, jamais de delete.
 *
 * Référence : calendar-ingest.ts (squelette getServiceClient lazy + stats Json) ; 04-RESEARCH §Pattern 5.
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { expireDue, releaseExpiredReservations } from '@app/supabase'
import type { Json, Database } from '@app/supabase'

// ─── Client service_role lazy ────────────────────────────────────────────────

function getServiceClient() {
  const url = process.env['SUPABASE_URL']
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!url || !key) {
    throw new Error(
      'subscription-expiry: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in apps/jobs/.env',
    )
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// ─── Job principal ────────────────────────────────────────────────────────────

/**
 * Expire les abonnements échus et libère les réservations d'offset expirées.
 * Les deux opérations sont idempotentes (un second run consécutif retourne 0/0).
 */
export async function subscriptionExpiry(): Promise<Json> {
  const client = getServiceClient()

  const { expired } = await expireDue(client)
  const { released } = await releaseExpiredReservations(client)

  return { expired, released } as Json
}
