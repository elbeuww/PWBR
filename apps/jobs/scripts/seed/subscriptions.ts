/**
 * subscriptions.ts — dimension abonnement de la cohorte démo (Plan 18-02 Task 3, D-03/D-04).
 *
 * Pour ~60% des users (active + expired + canceled, D-03), insère une subscription
 * `source='demo'` avec :
 *   - status déterministe : active 37% / expired 18% / canceled 5% (le reste = leads
 *     sans subscription = neverPaid 40%) ;
 *   - plan : 'standard' ~75% / 'discovery' ~25% (D-04) ;
 *   - current_period_end étalé via luxon (ancre 2026-06-25) :
 *       · actifs   → futur (now+1..30j), une fraction en J-3/J-1 (test ExpiryBanner P19) ;
 *       · expirés  → passé (1-6 mois avant now) → churn visible ;
 *       · annulés  → passé proche.
 *   - created_at étalé (cohorte d'acquisition, jamais identique — keyset).
 *
 * AUCUN MRR/% stocké : le MRR émerge de la matview mv_mrr (Σ amount_atomic des
 * payments verified). Ici on ne pose que des lignes brutes (D-02, SEED-02).
 *
 * Insert batché (chunks 1000) pour ne pas saturer PostgREST. Lève sur erreur.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { DateTime } from 'luxon'
import type { Database } from '@app/supabase'
import { SEED_SOURCE, DEMO_RATIOS, DEMO_TIMELINE } from './config'
import type { SeededUser } from './users'

type Client = SupabaseClient<Database>
type SubscriptionInsert = Database['public']['Tables']['subscriptions']['Insert']

type SubStatus = 'active' | 'expired' | 'canceled'
type Plan = 'standard' | 'discovery'

/** Subscription seedée, exposée à payments.ts (abonnés actifs/expirés payent). */
export interface SeededSubscription {
  userId: string
  userIndex: number
  status: SubStatus
  plan: Plan
  /** Mois (UTC) d'ancrage de la cohorte de paiement (début de période). */
  cohortStart: DateTime
}

/** Ancre temporelle commune au seed (cohérente avec users.ts). */
const ANCHOR = DateTime.utc(2026, 6, 25)

/**
 * Statut déterministe par index, conforme aux ratios D-03. Les `active` viennent en
 * premier, puis `expired`, puis `canceled` ; au-delà → null (lead, pas de subscription).
 */
function statusOf(i: number, total: number): SubStatus | null {
  const activeMax = Math.round(total * DEMO_RATIOS.activeSubscribers)
  const expiredMax = activeMax + Math.round(total * DEMO_RATIOS.expiredSubscribers)
  const canceledMax = expiredMax + Math.round(total * DEMO_RATIOS.canceledSubscribers)
  if (i < activeMax) return 'active'
  if (i < expiredMax) return 'expired'
  if (i < canceledMax) return 'canceled'
  return null
}

/** Plan déterministe : ~standardPlanShare 'standard', reste 'discovery' (D-04). */
function planOf(i: number): Plan {
  // Hash déterministe simple sur l'index pour disperser le mix sans regrouper.
  const r = (i * 2654435761) % 100
  return r < DEMO_RATIOS.standardPlanShare * 100 ? 'standard' : 'discovery'
}

/**
 * current_period_end étalé selon le statut (luxon, jamais constant — churn mesurable).
 * Déterministe : dérivé de l'index.
 */
function periodEndOf(status: SubStatus, i: number): DateTime {
  if (status === 'active') {
    // Une fraction des actifs expire en J-3/J-1 (teste ExpiryBanner P19).
    const inWarning = i % 7 === 0
    if (inWarning) {
      const days = 1 + (i % DEMO_TIMELINE.expiryWarningDays) // 1..3 jours
      return ANCHOR.plus({ days })
    }
    const days = 1 + (i % 30) // now+1..30j
    return ANCHOR.plus({ days })
  }
  if (status === 'expired') {
    const monthsAgo = 1 + (i % 6) // 1..6 mois avant now (churn)
    return ANCHOR.minus({ months: monthsAgo, days: i % 28 })
  }
  // canceled : passé proche.
  const daysAgo = 7 + (i % 60)
  return ANCHOR.minus({ days: daysAgo })
}

/**
 * Début de cohorte (created_at de la subscription) étalé sur l'historique
 * d'acquisition, volume croissant vers les mois récents. Jamais identique.
 */
function cohortStartOf(i: number, total: number): DateTime {
  const linear = total > 1 ? i / (total - 1) : 1
  const skewed = Math.sqrt(linear)
  const daysSpan = DEMO_TIMELINE.monthsBack * 30
  const daysAgo = Math.round((1 - skewed) * daysSpan)
  const jitterHours = i % 24
  return ANCHOR.minus({ days: daysAgo, hours: jitterHours })
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/**
 * Seede les abonnements démo. Retourne les subscriptions actives/expirées (celles qui
 * portent des paiements) pour payments.ts. Insert batché, source='demo'.
 */
export async function seedSubscriptions(
  client: Client,
  users: SeededUser[],
): Promise<SeededSubscription[]> {
  const total = users.length
  const rows: SubscriptionInsert[] = []
  const seeded: SeededSubscription[] = []

  for (const user of users) {
    const i = user.index
    const status = statusOf(i, total)
    if (!status) continue // lead (neverPaid) → pas de subscription

    const plan = planOf(i)
    const currentPeriodEnd = periodEndOf(status, i)
    const cohortStart = cohortStartOf(i, total)

    rows.push({
      user_id: user.id,
      status,
      plan,
      current_period_end: currentPeriodEnd.toISO() as string,
      created_at: cohortStart.toISO() as string,
      source: SEED_SOURCE,
    })

    // active/expired payent ; canceled n'est pas exposé aux payments (pas de cash récurrent).
    if (status === 'active' || status === 'expired') {
      seeded.push({ userId: user.id, userIndex: i, status, plan, cohortStart })
    }
  }

  for (const batch of chunk(rows, 1000)) {
    const { error } = await client.from('subscriptions').insert(batch)
    if (error) throw new Error(`seed subscriptions: ${error.message}`)
  }

  return seeded
}
