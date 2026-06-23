/**
 * (admin)/page — tableau de bord back-office (D-02, ADMIN landing).
 *
 * RSC, mono-FR, HORS [locale]. Le layout (admin) applique déjà le gate superadmin
 * (404 non-superadmin, T-08-10) : AUCUN guard inline dupliqué. Lecture service_role
 * LOCAL server-only (T-08-11).
 *
 * ≥3 KPI (D-02) via head counts (cheap, no rows) :
 *  - membres actifs : abonnements active + period non-échue (CRITÈRE MIROIR de membres/page.tsx).
 *  - file de validation en attente : payments status='ambiguous'.
 *  - santé globale : pire feu (red>amber>green) des sources candles/news/macro via les mappeurs
 *    Plan 01 (candleColor/ageColor) — pas de règle ad-hoc nouvelle.
 *
 * Chaque carte est un lien vers sa page complète. Présentation seule (D-08).
 */
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { createAdminServiceClient } from '@/lib/supabase/admin-service'
import {
  candleColor,
  ageColor,
  NEWS_THRESHOLDS,
  MACRO_THRESHOLDS,
  type FreshnessColor,
} from '@/lib/admin/freshness'

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

// Feux de fraîcheur tokenisés (Tier 3 sober, swap law) : statut sémantique, jamais
// palette brute. green→signal-bullish, amber→risk-moderate, red→destructive.
const DOT_CLASS: Record<FreshnessColor, string> = {
  green: 'bg-[var(--signal-bullish)]',
  amber: 'bg-[var(--risk-moderate)]',
  red: 'bg-destructive',
}

interface DashboardKpis {
  activeMembers: number
  pendingQueue: number
  health: FreshnessColor
}

async function loadKpis(): Promise<DashboardKpis> {
  const client = createAdminServiceClient()
  const now = Date.now()
  const nowIso = new Date().toISOString()

  // Membres actifs : MIROIR du critère membres/page.tsx (status='active' && period non-échue).
  const { count: activeMembers, error: memErr } = await client
    .from('subscriptions')
    .select('user_id', { count: 'exact', head: true })
    .eq('status', 'active')
    .gt('current_period_end', nowIso)
  if (memErr) throw new Error(`loadKpis members: ${memErr.message}`)

  // File de validation en attente : payments status='ambiguous'.
  const { count: pendingQueue, error: queueErr } = await client
    .from('payments')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'ambiguous')
  if (queueErr) throw new Error(`loadKpis queue: ${queueErr.message}`)

  // Santé globale : pire feu des sources, mêmes mappeurs que la page Santé.
  let health: FreshnessColor = 'green'

  const { data: fresh, error: freshErr } = await client
    .from('v_data_freshness')
    .select('timeframe, last_ts, is_stale')
  if (freshErr) throw new Error(`loadKpis candles: ${freshErr.message}`)
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
    }
  }

  const { data: lastNews, error: newsErr } = await client
    .from('news')
    .select('published_at')
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (newsErr) throw new Error(`loadKpis news: ${newsErr.message}`)
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

  const { data: lastMacro, error: macroErr } = await client
    .from('macro_series')
    .select('ts')
    .order('ts', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (macroErr) throw new Error(`loadKpis macro: ${macroErr.message}`)
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

  return {
    activeMembers: activeMembers ?? 0,
    pendingQueue: pendingQueue ?? 0,
    health,
  }
}

export default async function AdminDashboardPage() {
  const t = await getTranslations('admin')
  const { activeMembers, pendingQueue, health } = await loadKpis()
  const nf = new Intl.NumberFormat('fr-FR')

  const healthWord: Record<FreshnessColor, string> = {
    green: t('dashboard.healthOk'),
    amber: t('dashboard.healthLimit'),
    red: t('dashboard.healthStale'),
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="font-display text-2xl font-semibold">{t('dashboard.title')}</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/admin/membres" className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <Card>
            <CardHeader>
              <span className="text-sm text-muted-foreground">{t('dashboard.kpiActiveMembers')}</span>
            </CardHeader>
            <CardContent>
              <span className="text-3xl font-semibold">
                <bdi>{nf.format(activeMembers)}</bdi>
              </span>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/file" className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <Card>
            <CardHeader>
              <span className="text-sm text-muted-foreground">{t('dashboard.kpiPendingQueue')}</span>
            </CardHeader>
            <CardContent>
              <span className="text-3xl font-semibold">
                <bdi>{nf.format(pendingQueue)}</bdi>
              </span>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/sante" className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <Card>
            <CardHeader>
              <span className="text-sm text-muted-foreground">{t('dashboard.kpiHealth')}</span>
            </CardHeader>
            <CardContent>
              <span className="flex items-center gap-2 text-3xl font-semibold">
                <span className={`size-3 rounded-full ${DOT_CLASS[health]}`} aria-hidden />
                <span className="text-xl">{healthWord[health]}</span>
              </span>
            </CardContent>
          </Card>
        </Link>
      </div>
    </main>
  )
}
