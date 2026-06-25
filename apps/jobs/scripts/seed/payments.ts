/**
 * payments.ts — dimension monétaire de la cohorte démo (Plan 18-02 Task 3, D-03/D-04).
 *
 * Pour chaque abonné actif/expiré, 1-N `payments` `status='verified'`, `source='demo'` :
 *   - amount_atomic = PRICE_ATOMIC[plan].toString() (USDT 6 décimales, bigint atomique,
 *     JAMAIS de float — T-18-08) ; expected_amount_atomic = amount_atomic (vérifié) ;
 *   - tx_hash déterministe UNIQUE (contrainte globale 0012) : `demo-{userIndex}-{n}` ;
 *   - verified_at étalé sur ~12 mois calendaires UTC (luxon), volume croissant vers les
 *     mois récents (courbe d'acquisition réaliste, RESEARCH §Fenêtre temporelle) ;
 *   - renouvellements : certains abonnés ont 2-N paiements successifs (MRR récurrent +
 *     LTV mesurable, D-11).
 *
 * Le MRR/churn ÉMERGE de mv_mrr (Σ amount_atomic verified par mois de verified_at) —
 * AUCUN MRR/% stocké ici (D-02, SEED-02). On ne pose que des lignes brutes.
 *
 * Insert batché (chunks 1000). Lève sur erreur.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { DateTime } from 'luxon'
import type { Database } from '@app/supabase'
import { SEED_SOURCE, PRICE_ATOMIC } from './config'
import type { SeededSubscription } from './subscriptions'

type Client = SupabaseClient<Database>
type PaymentInsert = Database['public']['Tables']['payments']['Insert']

/** Ancre temporelle commune au seed (cohérente avec users.ts / subscriptions.ts). */
const ANCHOR = DateTime.utc(2026, 6, 25)

/**
 * Nombre de paiements (renouvellements) pour un abonné, déterministe par index.
 * Distribution : la plupart 1-3, quelques-uns jusqu'à 6 (LTV longue traîne).
 */
function paymentCountFor(sub: SeededSubscription): number {
  if (sub.status === 'expired') return 1 + (sub.userIndex % 2) // 1-2 (churn tôt)
  // actifs : 1-6, biaisé vers les abonnés anciens (cohortStart ancien → plus de renouv.)
  const monthsSinceStart = Math.max(0, Math.floor(ANCHOR.diff(sub.cohortStart, 'months').months))
  return 1 + Math.min(5, Math.floor(monthsSinceStart / 2))
}

/**
 * verified_at du n-ième paiement : cohortStart + n mois (renouvellements mensuels),
 * borné à l'ancre. Jamais identique (n + jitter horaire déterministe) → MRR/churn
 * mesurables sur ~12 mois.
 */
function verifiedAtFor(sub: SeededSubscription, n: number): DateTime {
  const candidate = sub.cohortStart.plus({ months: n, hours: (sub.userIndex + n) % 24 })
  // Ne jamais dépasser l'ancre (pas de paiement dans le futur).
  return candidate > ANCHOR ? ANCHOR.minus({ hours: (sub.userIndex + n) % 24 }) : candidate
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/**
 * Seede les paiements verified démo. Retourne le nombre de lignes insérées.
 * source='demo', montants atomiques bigint en string, verified_at étalé.
 */
export async function seedPayments(
  client: Client,
  subscriptions: SeededSubscription[],
): Promise<number> {
  const rows: PaymentInsert[] = []

  for (const sub of subscriptions) {
    const amountAtomic = PRICE_ATOMIC[sub.plan].toString() // bigint → string (override repo)
    const count = paymentCountFor(sub)

    for (let n = 0; n < count; n += 1) {
      const verifiedAt = verifiedAtFor(sub, n)
      rows.push({
        user_id: sub.userId,
        plan: sub.plan,
        tx_hash: `demo-${sub.userIndex}-${n}`, // déterministe + UNIQUE global (0012)
        expected_amount_atomic: amountAtomic,
        amount_atomic: amountAtomic,
        status: 'verified',
        verified_at: verifiedAt.toISO() as string,
        created_at: verifiedAt.toISO() as string,
        source: SEED_SOURCE,
      })
    }
  }

  for (const batch of chunk(rows, 1000)) {
    const { error } = await client.from('payments').insert(batch)
    if (error) throw new Error(`seed payments: ${error.message}`)
  }

  return rows.length
}
