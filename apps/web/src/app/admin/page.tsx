/**
 * (admin)/page — cockpit superadmin 4 axes (D-05/D-07, ADASH-01..03/06).
 *
 * RSC, mono-FR, HORS [locale]. Le layout (admin) applique déjà le gate superadmin
 * (404 non-superadmin, T-08-10) : AUCUN guard inline dupliqué.
 *
 * Lecture ANON-CLIENT uniquement (threat T-20-03) : `createClient()` @supabase/ssr,
 * JAMAIS `createAdminServiceClient`. Les KPI sont lus via les wrappers gated
 * `lib/admin/kpis.ts` (RPC `get_*`, 0 ligne pour non-superadmin) — jamais la matview
 * directement. Les agrégats Ops réutilisent les mappeurs purs `freshness/jobs`.
 *
 * Ordre des sections VERROUILLÉ (D-07) : Revenus → Ops → Acquisition → Conformité.
 * Présentation seule : chaque axe est une carte avec KPI mesuré + provenance + lien
 * « Voir le détail ». Aucun chiffre fabriqué (no-perf-claims étendu admin).
 */
import { createClient } from '@/lib/supabase/server'
import {
  getMrr,
  formatMrr,
  getChurn,
  getPlanMix,
  getAcquisitionFunnel,
} from '@/lib/admin/kpis'
import {
  candleColor,
  ageColor,
  NEWS_THRESHOLDS,
  MACRO_THRESHOLDS,
  type FreshnessColor,
} from '@/lib/admin/freshness'
import { latestPerJob, type JobRunInput } from '@/lib/admin/jobs'
import { AxisSummaryRevenus } from './_components/AxisSummaryRevenus'
import { AxisSummaryOps } from './_components/AxisSummaryOps'
import { AxisSummaryAcquisition } from './_components/AxisSummaryAcquisition'
import { AxisSummaryConformite } from './_components/AxisSummaryConformite'

const HOUR_MS = 3_600_000

/** Heures couvertes par un timeframe (défaut sûr 1h). */
function timeframeHours(raw: string | null): number {
  switch ((raw ?? '').toUpperCase().trim()) {
    case 'H4':
    case '4H':
      return 4
    case 'D':
    case '1D':
    case 'DAY':
    case 'DAILY':
      return 24
    default:
      return 1
  }
}

/** Pire couleur entre deux feux (red > amber > green). */
function worstColor(a: FreshnessColor, b: FreshnessColor): FreshnessColor {
  if (a === 'red' || b === 'red') return 'red'
  if (a === 'amber' || b === 'amber') return 'amber'
  return 'green'
}

interface OpsSummary {
  health: FreshnessColor
  dataLastTs: string | null
  jobsTotal: number
  lastJobStatus: string | null
  pendingQueue: number
}

/**
 * Agrégats Ops sur anon-client (RLS superadmin, 0021). Dégradation gracieuse : sous
 * RLS, un accès non autorisé renvoie 0 ligne (jamais une erreur) → feu rouge honnête,
 * pas de zéro fabriqué masquant un défaut d'accès.
 */
async function loadOps(): Promise<OpsSummary> {
  const supabase = await createClient()
  const now = Date.now()

  // File de validation : paiements ambigus en attente.
  const { count: pendingQueue } = await supabase
    .from('payments')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'ambiguous')

  // Fraîcheur candles : is_stale LU de la vue (jamais re-dérivé) + bande ambre.
  let health: FreshnessColor = 'green'
  let dataLastTs: string | null = null
  const { data: fresh } = await supabase
    .from('v_data_freshness')
    .select('timeframe, last_ts, is_stale')
  if (!fresh || fresh.length === 0) {
    health = 'red'
  } else {
    for (const row of fresh) {
      const ageHours = row.last_ts
        ? (now - Date.parse(row.last_ts)) / HOUR_MS
        : Number.POSITIVE_INFINITY
      health = worstColor(
        health,
        candleColor(Boolean(row.is_stale), ageHours, 2 * timeframeHours(row.timeframe)),
      )
      if (row.last_ts && (dataLastTs === null || row.last_ts > dataLastTs)) dataLastTs = row.last_ts
    }
  }

  // News : âge depuis max(published_at).
  const { data: lastNews } = await supabase
    .from('news')
    .select('published_at')
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  health = worstColor(
    health,
    lastNews?.published_at
      ? ageColor(
          (now - Date.parse(lastNews.published_at)) / HOUR_MS,
          NEWS_THRESHOLDS.amberHours,
          NEWS_THRESHOLDS.redHours,
        )
      : 'red',
  )

  // Macro : âge depuis max(ts).
  const { data: lastMacro } = await supabase
    .from('macro_series')
    .select('ts')
    .order('ts', { ascending: false })
    .limit(1)
    .maybeSingle()
  health = worstColor(
    health,
    lastMacro?.ts
      ? ageColor(
          (now - Date.parse(lastMacro.ts)) / HOUR_MS,
          MACRO_THRESHOLDS.amberHours,
          MACRO_THRESHOLDS.redHours,
        )
      : 'red',
  )

  // Jobs : dernier run par job (triés started_at desc).
  const { data: runs } = await supabase
    .from('job_runs')
    .select('job_name, status, started_at, finished_at')
    .order('started_at', { ascending: false })
  const jobs = latestPerJob((runs ?? []) as JobRunInput[])

  return {
    health,
    dataLastTs,
    jobsTotal: jobs.length,
    lastJobStatus: jobs[0]?.status ?? null,
    pendingQueue: pendingQueue ?? 0,
  }
}

export default async function AdminDashboardPage() {
  const [mrrRow, churn, planMix, funnel, ops] = await Promise.all([
    getMrr(),
    getChurn(),
    getPlanMix(),
    getAcquisitionFunnel(),
    loadOps(),
  ])
  const mrr = formatMrr(mrrRow)

  return (
    <main className="mx-auto max-w-6xl px-8 py-8">
      <h1 className="text-[28px] font-semibold leading-tight">Cockpit superadmin</h1>

      {/* Ordre verrouillé D-07 : Revenus → Ops → Acquisition → Conformité. */}
      <div className="mt-12 flex flex-col gap-8">
        <AxisSummaryRevenus mrr={mrr} churn={churn} planMix={planMix} />
        <AxisSummaryOps
          health={ops.health}
          dataLastTs={ops.dataLastTs}
          jobsTotal={ops.jobsTotal}
          lastJobStatus={ops.lastJobStatus}
          pendingQueue={ops.pendingQueue}
        />
        <AxisSummaryAcquisition funnel={funnel} />
        <AxisSummaryConformite />
      </div>
    </main>
  )
}
