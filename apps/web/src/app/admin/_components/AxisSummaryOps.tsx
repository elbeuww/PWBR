/**
 * AxisSummaryOps — carte d'axe « Ops » du cockpit superadmin (Plan 20-05, D-07/D-08).
 *
 * RSC présentationnelle : reçoit les agrégats Ops MESURÉS en props (calculés dans
 * page.tsx). Affiche la fraîcheur des données (feu tokenisé via `freshness.ts`), le
 * nombre de jobs suivis (`jobs.ts`), la file de validation en attente (count due),
 * chacun avec sa ligne de provenance, et les liens « Voir le détail » (/admin/sante)
 * + « File de validation » (/admin/file).
 *
 * Feux tokenisés (D-08 swap law) : green→--signal-bullish, amber→--risk-moderate,
 * red→--destructive — jamais d'hex en dur. Accent --primary réservé aux liens.
 */
import Link from 'next/link'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import type { FreshnessColor } from '@/lib/admin/freshness'

interface AxisSummaryOpsProps {
  health: FreshnessColor
  dataLastTs: string | null
  jobsTotal: number
  lastJobStatus: string | null
  pendingQueue: number
}

// Feux sémantiques tokenisés (calque (admin)/page.tsx L.55-59).
const DOT_CLASS: Record<FreshnessColor, string> = {
  green: 'bg-[var(--signal-bullish)]',
  amber: 'bg-[var(--risk-moderate)]',
  red: 'bg-destructive',
}
const HEALTH_LABEL: Record<FreshnessColor, string> = {
  green: 'À jour',
  amber: 'Limite',
  red: 'Périmé',
}

const numFmt = new Intl.NumberFormat('fr-FR')

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  )
}

/** Feu du dernier run de job : success→vert, error→rouge, autre/null→ambre. */
function jobDot(status: string | null): string {
  if (status === 'success') return DOT_CLASS.green
  if (status === 'error') return DOT_CLASS.red
  return DOT_CLASS.amber
}

function Provenance({ n, periode, source }: { n: number; periode: string; source: string }) {
  return (
    <p className="text-[13px] leading-relaxed text-muted-foreground">
      Mesuré · N&nbsp;=&nbsp;
      <span className="font-mono tabular-nums">{numFmt.format(n)}</span> · {periode} · source&nbsp;:{' '}
      {source}
    </p>
  )
}

export function AxisSummaryOps({
  health,
  dataLastTs,
  jobsTotal,
  lastJobStatus,
  pendingQueue,
}: AxisSummaryOpsProps) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-[28px] font-semibold leading-tight">Ops</h2>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {/* Fraîcheur des données — pire feu des sources candles/news/macro. */}
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">Fraîcheur des données</span>
          <span className="flex items-center gap-2 text-xl font-semibold">
            <span className={`size-3 rounded-full ${DOT_CLASS[health]}`} aria-hidden />
            <span className="text-base">{HEALTH_LABEL[health]}</span>
          </span>
          <Provenance n={3} periode={fmtDateTime(dataLastTs)} source="v_data_freshness · news · macro_series" />
        </div>

        {/* Jobs suivis — dernier run par job (job_runs). */}
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">Jobs suivis</span>
          <span className="flex items-center gap-2 font-mono text-xl font-semibold tabular-nums">
            <span className={`size-3 rounded-full ${jobDot(lastJobStatus)}`} aria-hidden />
            {numFmt.format(jobsTotal)}
          </span>
          <Provenance n={jobsTotal} periode="dernier run par job" source="job_runs" />
        </div>

        {/* File de validation en attente — paiements ambigus. */}
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">File de validation en attente</span>
          <span className="font-mono text-xl font-semibold tabular-nums">
            {numFmt.format(pendingQueue)}
          </span>
          <Provenance n={pendingQueue} periode="actuel" source="payments (ambiguous)" />
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Link
            href="/admin/sante"
            className="inline-flex rounded text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Voir le détail
          </Link>
          <Link
            href="/admin/file"
            className="inline-flex rounded text-sm text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            File de validation
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
