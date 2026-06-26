/**
 * kpis.ts — wrappers typés des RPC KPI du cockpit superadmin (Plan 20-03, Task 2 ;
 * ADASH-01/07).
 *
 * Frontière (threat T-20-12/14) : chaque KPI est lu via `supabase.rpc(get_*)` sur
 * le client anon @supabase/ssr. La garde DB (`where is_superadmin()` dans le wrapper
 * SQL, 0021) renvoie 0 ligne pour un non-superadmin — JAMAIS de throw. NE JAMAIS
 * lire `mv_mrr` via `.from()` : `revoke all` (0017) → seul `get_mrr` (SECURITY
 * DEFINER) y accède (Pitfall 3).
 *
 * MRR honnête (D-13) : le montant = `cash encaissé / mois` (paiements réellement
 * encaissés), formaté via `formatAtomic(BigInt(revenue_atomic))`. JAMAIS « MRR
 * récurrent » (aucune projection d'abonnement). Les `%` (churn) restent des nombres
 * mesurés rendus côté composant (applyThreshold), jamais des littéraux.
 */
import { formatAtomic } from '@app/core'
import type {
  AcquisitionFunnelRow,
  ChurnRow,
  MvMrrRow,
  PlanMixRow,
} from '@app/supabase'
import { createClient } from '../supabase/server'

/** Libellé verrouillé du MRR (D-13) — cash réellement encaissé, pas une projection. */
export const MRR_LABEL = 'cash encaissé / mois'

/** Résumé MRR prêt à rendre : montant formaté + libellé honnête. */
export interface MrrSummary {
  month: string | null
  paymentsCount: number
  amount: string
  label: string
}

/**
 * Dernier mois de MRR (cash encaissé). Via `get_mrr` gated — 0 ligne (→ null)
 * pour un non-superadmin, jamais throw. Aucune lecture directe de `mv_mrr`.
 */
export async function getMrr(): Promise<MvMrrRow | null> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_mrr')
  const rows = (data ?? []) as MvMrrRow[]
  if (rows.length === 0) return null
  // Mois le plus récent (month ISO date → comparaison lexicale stable).
  return rows.reduce((latest, r) => ((r.month ?? '') > (latest.month ?? '') ? r : latest))
}

/**
 * Formate une ligne MRR pour l'affichage : montant via `formatAtomic`, libellé
 * verrouillé « cash encaissé / mois » (D-13). `null` → 0 cash encaissé.
 */
export function formatMrr(row: MvMrrRow | null): MrrSummary {
  return {
    month: row?.month ?? null,
    paymentsCount: row?.payments_count ?? 0,
    amount: formatAtomic(BigInt(row?.revenue_atomic ?? '0')),
    label: MRR_LABEL,
  }
}

/**
 * Funnel d'acquisition par source/étape sur une fenêtre. Via `get_acquisition_funnel`
 * gated (args optionnels → defaults SQL). 0 ligne pour non-superadmin.
 */
export async function getAcquisitionFunnel(
  pFrom?: string,
  pTo?: string,
): Promise<AcquisitionFunnelRow[]> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_acquisition_funnel', { p_from: pFrom, p_to: pTo })
  return (data ?? []) as AcquisitionFunnelRow[]
}

/**
 * Churn d'un mois (active_start + churn_count). Via `get_churn` gated. Une seule
 * ligne agrégée (ou null si non-superadmin / pas de données). Le `%` est dérivé
 * côté composant via applyThreshold, jamais un littéral ici.
 */
export async function getChurn(pMonth?: string): Promise<ChurnRow | null> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_churn', { p_month: pMonth })
  const rows = (data ?? []) as ChurnRow[]
  return rows.length > 0 ? rows[0] : null
}

/**
 * Répartition des abonnements par plan. Via `get_plan_mix` gated. 0 ligne pour
 * non-superadmin.
 */
export async function getPlanMix(): Promise<PlanMixRow[]> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_plan_mix')
  return (data ?? []) as PlanMixRow[]
}
