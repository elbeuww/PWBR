/**
 * (admin)/sante — santé jobs & données (ADMIN-04, D-06/D-07/D-08).
 *
 * RSC, mono-FR, HORS [locale]. Le layout (admin) applique déjà le gate superadmin
 * (404 non-superadmin, T-08-10) : AUCUN guard inline dupliqué. Lecture ANON-CLIENT
 * (threat T-20-03) : la policy 0021 `candles` débloque v_data_freshness sous RLS ;
 * un non-superadmin lit 0 ligne (feu rouge honnête, jamais service_role bundlé).
 *
 * Feux de fraîcheur par source (D-06) :
 *  - candles : booléen is_stale LU de v_data_freshness (la vue gère week-end FX/DST) +
 *    bande ambre dérivée via candleColor — JS ne RE-DÉRIVE jamais is_stale (T-08-12).
 *  - news    : âge depuis max(published_at) via ageColor + NEWS_THRESHOLDS.
 *  - macro   : âge depuis max(ts) via ageColor + MACRO_THRESHOLDS.
 *
 * Table job_runs (D-07) : dernier run par job via latestPerJob — statut / durée / dernier run.
 * Présentation seule (D-08) : aucun alerting, aucun polling, aucune action.
 */
import { getTranslations } from 'next-intl/server'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { createClient } from '@/lib/supabase/server'
import {
  candleColor,
  ageColor,
  NEWS_THRESHOLDS,
  MACRO_THRESHOLDS,
  type FreshnessColor,
} from '@/lib/admin/freshness'
import { latestPerJob, type JobRunInput } from '@/lib/admin/jobs'

const HOUR_MS = 3_600_000

/** Heures couvertes par un timeframe (tokens whitelistés ; défaut sûr 1h). */
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
    case 'H1':
    case '1H':
    default:
      return 1
  }
}

interface SourceFreshness {
  key: 'candles' | 'news' | 'macro'
  label: string
  color: FreshnessColor
  lastTs: string | null
}

// Feux de fraîcheur tokenisés (Tier 3 sober, swap law) : statut sémantique, jamais
// palette brute. green→signal-bullish, amber→risk-moderate, red→destructive.
const DOT_CLASS: Record<FreshnessColor, string> = {
  green: 'bg-[var(--signal-bullish)]',
  amber: 'bg-[var(--risk-moderate)]',
  red: 'bg-destructive',
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  )
}

function fmtDuration(ms: number | null): string {
  if (ms === null) return '—'
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(1)} s`
}

interface HealthData {
  sources: SourceFreshness[]
  jobs: ReturnType<typeof latestPerJob>
}

async function loadHealth(): Promise<HealthData> {
  const client = await createClient()
  const now = Date.now()

  // candles : is_stale LU de la vue (jamais re-dérivé) + worst-of sur toutes les lignes.
  const { data: fresh, error: freshErr } = await client
    .from('v_data_freshness')
    .select('canonical_symbol, timeframe, last_ts, is_stale')
  if (freshErr) throw new Error(`loadHealth candles: ${freshErr.message}`)

  let candleColorWorst: FreshnessColor = 'green'
  let candleLastTs: string | null = null
  if (!fresh || fresh.length === 0) {
    candleColorWorst = 'red' // aucune donnée → périmé
  } else {
    for (const row of fresh) {
      const ageHours = row.last_ts ? (now - Date.parse(row.last_ts)) / HOUR_MS : Number.POSITIVE_INFINITY
      const thresholdHours = 2 * timeframeHours(row.timeframe)
      const c = candleColor(Boolean(row.is_stale), ageHours, thresholdHours)
      candleColorWorst = worstColor(candleColorWorst, c)
      if (row.last_ts && (candleLastTs === null || row.last_ts > candleLastTs)) candleLastTs = row.last_ts
    }
  }

  // news : âge depuis max(published_at).
  const { data: lastNews, error: newsErr } = await client
    .from('news')
    .select('published_at')
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (newsErr) throw new Error(`loadHealth news: ${newsErr.message}`)
  const newsTs = lastNews?.published_at ?? null
  const newsColor: FreshnessColor = newsTs
    ? ageColor((now - Date.parse(newsTs)) / HOUR_MS, NEWS_THRESHOLDS.amberHours, NEWS_THRESHOLDS.redHours)
    : 'red'

  // macro : âge depuis max(ts).
  const { data: lastMacro, error: macroErr } = await client
    .from('macro_series')
    .select('ts')
    .order('ts', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (macroErr) throw new Error(`loadHealth macro: ${macroErr.message}`)
  const macroTs = lastMacro?.ts ?? null
  const macroColor: FreshnessColor = macroTs
    ? ageColor((now - Date.parse(macroTs)) / HOUR_MS, MACRO_THRESHOLDS.amberHours, MACRO_THRESHOLDS.redHours)
    : 'red'

  // job_runs : triés started_at desc → dernier run par job.
  const { data: runs, error: runsErr } = await client
    .from('job_runs')
    .select('job_name, status, started_at, finished_at')
    .order('started_at', { ascending: false })
  if (runsErr) throw new Error(`loadHealth jobs: ${runsErr.message}`)

  return {
    sources: [
      { key: 'candles', label: 'sourceCandles', color: candleColorWorst, lastTs: candleLastTs },
      { key: 'news', label: 'sourceNews', color: newsColor, lastTs: newsTs },
      { key: 'macro', label: 'sourceMacro', color: macroColor, lastTs: macroTs },
    ],
    jobs: latestPerJob((runs ?? []) as JobRunInput[]),
  }
}

/** Pire couleur entre deux feux (red > amber > green). */
function worstColor(a: FreshnessColor, b: FreshnessColor): FreshnessColor {
  if (a === 'red' || b === 'red') return 'red'
  if (a === 'amber' || b === 'amber') return 'amber'
  return 'green'
}

export default async function AdminHealthPage() {
  const t = await getTranslations('admin')
  const { sources, jobs } = await loadHealth()

  const stateLabel: Record<FreshnessColor, string> = {
    green: t('health.freshUp'),
    amber: t('health.freshLimit'),
    red: t('health.freshStale'),
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold">{t('health.title')}</h1>

      {/* Feux de fraîcheur par source (D-06) */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sources.map((s) => (
          <div key={s.key} className="flex flex-col gap-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <div className="flex items-center gap-2">
              <span className={`size-2.5 rounded-full ${DOT_CLASS[s.color]}`} aria-hidden />
              <span className="text-sm font-medium">{t(`health.${s.label}`)}</span>
            </div>
            <span className="text-sm text-muted-foreground">{stateLabel[s.color]}</span>
            <span className="text-xs text-muted-foreground">
              <bdi>{fmtDateTime(s.lastTs)}</bdi>
            </span>
          </div>
        ))}
      </div>

      {/* Table des derniers runs par job (D-07) */}
      <div className="mt-8 w-full overflow-x-auto">
        {jobs.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center">
            <p className="font-medium">{t('health.emptyHeading')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t('health.emptyBody')}</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('health.colJob')}</TableHead>
                <TableHead>{t('health.colStatus')}</TableHead>
                <TableHead>{t('health.colDuration')}</TableHead>
                <TableHead>{t('health.colLastRun')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((j) => (
                <TableRow key={j.job_name}>
                  <TableCell className="font-medium">
                    <bdi>{j.job_name}</bdi>
                  </TableCell>
                  <TableCell>
                    {j.status === 'success' ? (
                      <Badge className="border-[var(--signal-bullish)]/30 bg-[var(--signal-bullish)]/10 text-[var(--signal-bullish)]">
                        {t('health.statusOk')}
                      </Badge>
                    ) : j.status === 'error' ? (
                      <Badge className="border-destructive/30 bg-destructive/10 text-destructive">
                        {t('health.statusError')}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-muted-foreground">
                        {j.status}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <bdi>{fmtDuration(j.durationMs)}</bdi>
                  </TableCell>
                  <TableCell>
                    <bdi>{fmtDateTime(j.started_at)}</bdi>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </main>
  )
}
