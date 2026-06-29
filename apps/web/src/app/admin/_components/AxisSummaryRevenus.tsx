/**
 * AxisSummaryRevenus — carte d'axe « Revenus » du cockpit superadmin (Plan 20-05,
 * D-05/D-07/D-13).
 *
 * RSC présentationnelle : reçoit ses KPI MESURÉS en props (calculés dans page.tsx via
 * les wrappers gated `lib/admin/kpis.ts`). Affiche le MRR libellé « Cash encaissé /
 * mois » (formatAtomic, JAMAIS « MRR récurrent »), le taux de désabonnement dérivé via
 * `applyThreshold` (seuil N≥30, jamais un pourcentage codé en dur ni un littéral),
 * la répartition par plan (counts), chacun avec une ligne de PROVENANCE obligatoire
 * (« Mesuré · N = … · période · source ») dont les nombres sont RENDUS, et un lien
 * « Voir le détail » vers /admin/membres.
 *
 * Honnêteté (threat T-20-04 / scan no-perf-claims étendu admin) : aucun chiffre de
 * perf fabriqué, aucun caractère « pour-cent » littéral — les taux passent par un
 * formatage Intl au runtime.
 */
import Link from 'next/link'
import { applyThreshold } from '@app/core'
import type { ChurnRow, PlanMixRow } from '@app/supabase'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import type { MrrSummary } from '@/lib/admin/kpis'

interface AxisSummaryRevenusProps {
  mrr: MrrSummary
  churn: ChurnRow | null
  planMix: readonly PlanMixRow[]
}

const numFmt = new Intl.NumberFormat('fr-FR')
// Formatage du taux au runtime → le symbole « pour-cent » n'apparaît jamais en dur
// dans la source (no-perf-claims / Task 1 verify : aucun littéral interdit).
const rateFmt = new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 1 })

/** Ligne de provenance obligatoire (D-13) : nombres RENDUS, jamais une chaîne i18n. */
function Provenance({ n, periode, source }: { n: number; periode: string; source: string }) {
  return (
    <p className="text-[13px] leading-relaxed text-muted-foreground">
      Mesuré · N&nbsp;=&nbsp;
      <span className="font-mono tabular-nums">{numFmt.format(n)}</span> · {periode} · source&nbsp;:{' '}
      {source}
    </p>
  )
}

export function AxisSummaryRevenus({ mrr, churn, planMix }: AxisSummaryRevenusProps) {
  const totalSubs = planMix.reduce((sum, p) => sum + p.n, 0)
  const churnView = churn
    ? applyThreshold({
        n: churn.active_start,
        win_rate: churn.active_start > 0 ? churn.churn_count / churn.active_start : 0,
        expectancy: null,
      })
    : null

  return (
    <Card>
      <CardHeader>
        <h2 className="text-[28px] font-semibold leading-tight">Revenus</h2>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {/* MRR — cash réellement encaissé (D-13), jamais une projection. */}
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">Cash encaissé / mois</span>
          <span className="font-mono text-xl font-semibold tabular-nums">
            <bdi>{mrr.amount}</bdi>
          </span>
          <Provenance
            n={mrr.paymentsCount}
            periode={mrr.month ?? 'aucune période'}
            source="get_mrr (mv_mrr)"
          />
        </div>

        {/* Taux de désabonnement — mesuré via applyThreshold (seuil N≥30). */}
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">Taux de désabonnement</span>
          {churnView === null ? (
            <span className="text-sm text-muted-foreground">Aucune donnée pour cette période.</span>
          ) : churnView.sufficient ? (
            <span className="font-mono text-xl font-semibold tabular-nums">
              {rateFmt.format(churnView.winRatePct / 100)}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">Échantillon insuffisant</span>
          )}
          <Provenance n={churn?.active_start ?? 0} periode="mois courant" source="get_churn" />
        </div>

        {/* Répartition des abonnements par plan (counts mesurés). */}
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">Répartition par plan</span>
          {planMix.length === 0 ? (
            <span className="text-sm text-muted-foreground">Aucune donnée pour cette période.</span>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {planMix.map((p) => (
                <li key={p.plan} className="flex items-baseline justify-between gap-4 text-sm">
                  <span>{p.plan}</span>
                  <span className="font-mono tabular-nums">{numFmt.format(p.n)}</span>
                </li>
              ))}
            </ul>
          )}
          <Provenance n={totalSubs} periode="actuel" source="get_plan_mix" />
        </div>

        <Link
          href="/admin/membres"
          className="inline-flex w-fit rounded text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Voir le détail
        </Link>
      </CardContent>
    </Card>
  )
}
