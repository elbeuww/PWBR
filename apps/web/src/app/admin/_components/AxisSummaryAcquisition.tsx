/**
 * AxisSummaryAcquisition — carte d'axe « Acquisition » du cockpit superadmin (Plan
 * 20-05, D-05/D-07).
 *
 * RSC présentationnelle : reçoit le funnel d'acquisition MESURÉ en props (calculé dans
 * page.tsx via `getAcquisitionFunnel` gated). Agrège les counts par étape (inscription
 * → activation → rétention), affiche chaque étape avec son count, une ligne de
 * provenance obligatoire, et un lien « Voir le détail » vers /admin/affiliation.
 *
 * Honnêteté : counts mesurés uniquement — aucun pourcentage fabriqué, aucun chiffre de
 * perf (no-perf-claims étendu admin).
 */
import Link from 'next/link'
import type { AcquisitionFunnelRow } from '@app/supabase'
import { Card, CardHeader, CardContent } from '@/components/ui/card'

interface AxisSummaryAcquisitionProps {
  funnel: readonly AcquisitionFunnelRow[]
}

const numFmt = new Intl.NumberFormat('fr-FR')

function Provenance({ n, periode, source }: { n: number; periode: string; source: string }) {
  return (
    <p className="text-[13px] leading-relaxed text-muted-foreground">
      Mesuré · N&nbsp;=&nbsp;
      <span className="font-mono tabular-nums">{numFmt.format(n)}</span> · {periode} · source&nbsp;:{' '}
      {source}
    </p>
  )
}

export function AxisSummaryAcquisition({ funnel }: AxisSummaryAcquisitionProps) {
  // Agrégat par étape (somme des sources), ordre d'apparition stable.
  const byStage = new Map<string, number>()
  for (const row of funnel) {
    byStage.set(row.stage, (byStage.get(row.stage) ?? 0) + row.n)
  }
  const stages = [...byStage.entries()]
  const total = stages.reduce((sum, [, n]) => sum + n, 0)

  return (
    <Card>
      <CardHeader>
        <h2 className="text-[28px] font-semibold leading-tight">Acquisition</h2>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">Étapes du funnel</span>
          {stages.length === 0 ? (
            <span className="text-sm text-muted-foreground">Aucune donnée pour cette période.</span>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {stages.map(([stage, n]) => (
                <li key={stage} className="flex items-baseline justify-between gap-4 text-sm">
                  <span>{stage}</span>
                  <span className="font-mono tabular-nums">{numFmt.format(n)}</span>
                </li>
              ))}
            </ul>
          )}
          <Provenance n={total} periode="fenêtre par défaut" source="get_acquisition_funnel" />
        </div>

        <Link
          href="/admin/affiliation/affilies"
          className="inline-flex w-fit rounded text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Voir le détail
        </Link>
      </CardContent>
    </Card>
  )
}
