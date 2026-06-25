/**
 * affiliation.ts — dimension AFFILIATION de la cohorte démo (Plan 18-03 Task 2, D-05).
 *
 * Cohorte FK-cohérente affiliates → affiliate_codes → referrals, puis CALCUL des
 * commissions DÉLÉGUÉ AU RPC `compute_affiliate_commissions` (jamais en JS).
 *
 *   1. affiliates       (source='demo') — 1 ligne par user role='affiliate'.
 *   2. affiliate_codes  — 1 code vanity ^[A-Z0-9]{3,20}$ par affilié.
 *   3. referrals        — distribution LONGUE TRAÎNE (quelques affiliés ~50 filleuls,
 *                          beaucoup 0-5). Les filleuls sont des users démo ABONNÉS
 *                          réels (cohérence FK avec subscriptions/payments du Plan 02).
 *                          AUCUNE PII filleul (miroir 0016 : seul user_id, pas d'email).
 *   4. commissions      — calculées par le RPC `compute_affiliate_commissions(period)`
 *                          pour chaque mois seedé (grille basis points jusqu'à 20%,
 *                          D-05). ZÉRO arithmétique de commission en TS (anti-pattern
 *                          double source de vérité — RESEARCH §Don't Hand-Roll).
 *   5. payouts          — un sous-ensemble des commissions `due` marquées `paid` via
 *                          le RPC `mark_commission_paid` (insert payout atomique).
 *
 * ⚠️ Le taux (rate_bps) et le montant de commission sont produits par la DB. Ce module
 * ne fait QUE seeder les fixtures (affiliates/codes/referrals) puis INVOQUER les RPC.
 *
 * Déterminisme (D-06) : Faker seedé FAKER_SEED ; affiliés/filleuls choisis par index
 * croissant → re-run = même dataset = N stable.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { Faker, en, base } from '@faker-js/faker'
import { DateTime } from 'luxon'
import type { Database } from '@app/supabase'
import { computeCommissions, markCommissionPaid } from '@app/supabase'
import { FAKER_SEED, SEED_SOURCE, DEMO_TIMELINE } from './config'
import type { SeededUser } from './users'

type Client = SupabaseClient<Database>
type AffiliateInsert = Database['public']['Tables']['affiliates']['Insert']
type AffiliateCodeInsert = Database['public']['Tables']['affiliate_codes']['Insert']
type ReferralInsert = Database['public']['Tables']['referrals']['Insert']

/** Ancre temporelle commune au seed. */
const ANCHOR = DateTime.utc(2026, 6, 25)

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/**
 * Nombre de filleuls d'un affilié, distribution LONGUE TRAÎNE déterministe :
 * la plupart 0-5, quelques-uns (1 sur ~10) jusqu'à ~50 (D-05, audience hétérogène).
 */
function referralCountFor(i: number): number {
  if (i % 10 === 0) return 30 + (i % 21) // gros affiliés : 30..50
  return i % 6 // longue traîne : 0..5
}

/** Code vanity déterministe borné ^[A-Z0-9]{3,20}$ (check 0016 / T-07-REFINJ). */
function codeFor(i: number): string {
  return `DEMO${i.toString(36).toUpperCase().padStart(3, '0')}`
}

/**
 * Liste des mois calendaires UTC 'YYYY-MM' couverts par le seed (monthsBack mois
 * avant l'ancre → ancre). Format strict accepté par le RPC (M-04).
 */
function seededPeriods(): string[] {
  const periods: string[] = []
  for (let m = DEMO_TIMELINE.monthsBack; m >= 0; m -= 1) {
    periods.push(ANCHOR.minus({ months: m }).toFormat('yyyy-MM'))
  }
  return periods
}

/**
 * Seede affiliates/codes/referrals (longue traîne, sans PII), puis CALCULE les
 * commissions via le RPC pour chaque mois seedé, puis marque un sous-ensemble payé.
 * Retourne un récap de volumétrie pour le log de l'orchestrateur.
 */
export async function seedAffiliation(
  client: Client,
  users: SeededUser[],
): Promise<{ affiliates: number; referrals: number; commissionRows: number; payouts: number }> {
  const f = new Faker({ locale: [en, base] })
  f.seed(FAKER_SEED)

  // Population : affiliés = users role='affiliate' ; pool de filleuls = autres users
  // (members/superadmins exclus comme filleuls de leur propre affilié — l'auto-parrainage
  // est de toute façon exclu AU CALCUL par le RPC, D-12).
  const affiliateUsers = users.filter((u) => u.role === 'affiliate')
  const memberPool = users.filter((u) => u.role === 'member')

  if (affiliateUsers.length === 0 || memberPool.length === 0) {
    // Échelle trop réduite pour seeder l'affiliation : no-op silencieux (N stable).
    return { affiliates: 0, referrals: 0, commissionRows: 0, payouts: 0 }
  }

  // ── 1. affiliates ──────────────────────────────────────────────────────────
  const affiliateRows: AffiliateInsert[] = affiliateUsers.map((u) => ({
    user_id: u.id,
    created_at: u.createdAt,
    source: SEED_SOURCE,
  }))

  const affiliateIds: string[] = []
  for (const batch of chunk(affiliateRows, 1000)) {
    const { data, error } = await client.from('affiliates').insert(batch).select('id, user_id')
    if (error) throw new Error(`seed affiliation (affiliates): ${error.message}`)
    for (const row of data ?? []) affiliateIds.push(row.id)
  }

  // ── 2. affiliate_codes (1 par affilié) ───────────────────────────────────────
  const codeRows: AffiliateCodeInsert[] = affiliateIds.map((affiliateId, i) => ({
    affiliate_id: affiliateId,
    code: codeFor(i),
  }))
  for (const batch of chunk(codeRows, 1000)) {
    const { error } = await client.from('affiliate_codes').insert(batch)
    if (error) throw new Error(`seed affiliation (affiliate_codes): ${error.message}`)
  }

  // ── 3. referrals (longue traîne, sans PII, filleuls = members abonnés réels) ──
  // UNIQUE(user_id) sur referrals (0016) : un filleul attribué une seule fois. On
  // distribue le pool de members SANS répétition sur les affiliés (curseur global).
  const referralRows: ReferralInsert[] = []
  let cursor = 0
  for (let i = 0; i < affiliateIds.length && cursor < memberPool.length; i += 1) {
    const want = referralCountFor(i)
    for (let k = 0; k < want && cursor < memberPool.length; k += 1) {
      const filleul = memberPool[cursor]
      cursor += 1
      referralRows.push({
        affiliate_id: affiliateIds[i],
        user_id: filleul.id, // user_id SEULEMENT — aucune PII filleul (D-13, T-18-13)
        attributed_at: filleul.createdAt,
      })
    }
  }
  for (const batch of chunk(referralRows, 1000)) {
    const { error } = await client.from('referrals').insert(batch)
    if (error) throw new Error(`seed affiliation (referrals): ${error.message}`)
  }

  // ── 4. commissions via RPC (jamais de calcul JS — D-05/T-18-12) ──────────────
  // Pour chaque mois seedé, le RPC applique la grille bps × Σ revenu filleul actif,
  // exclut l'auto-parrainage, upsert idempotent. computeCommissions = wrapper mince.
  let commissionRows = 0
  for (const period of seededPeriods()) {
    const res = (await computeCommissions(client, period)) as { rows?: number } | null
    commissionRows += res?.rows ?? 0
  }

  // ── 5. payouts : marquer un sous-ensemble des commissions 'due' → 'paid' (RPC) ─
  // mark_commission_paid insère le payout ET transitionne la commission en une
  // transaction atomique. On paie 1 commission due sur 4 (déterministe).
  const { data: dueRows, error: dueErr } = await client
    .from('commissions')
    .select('id, amount_atomic')
    .eq('status', 'due')
  if (dueErr) throw new Error(`seed affiliation (read due commissions): ${dueErr.message}`)

  let payouts = 0
  const due = dueRows ?? []
  for (let i = 0; i < due.length; i += 1) {
    if (i % 4 !== 0) continue // ~25% payées
    const row = due[i]
    await markCommissionPaid(client, {
      commission_id: row.id,
      tx_hash: `demo-payout-${i}`,
      amount_atomic: String(row.amount_atomic), // bigint → string (CR-02, jamais Number)
    })
    payouts += 1
  }

  return { affiliates: affiliateIds.length, referrals: referralRows.length, commissionRows, payouts }
}
