/**
 * (admin)/signaux — vue back-office des signaux publiés (ADMIN-04, D-03/D-04/D-05).
 *
 * RSC, mono-FR, HORS [locale]. Le gate superadmin du layout (admin) protège déjà
 * → 404 pour non-superadmin (T-04-ADMIN-ELEV) : AUCUN re-guard inline dupliqué ici.
 *
 * Lecture via service_role LOCAL (RSC server-only, jamais bundle ; build casse si bundlé).
 * Croisement Telegram 2-états (D-03, Pitfall 3) : pas de FK entre telegram_posts et
 * trade_setups. Un setup est « Poste » SSI une ligne telegram_posts existe avec
 * dedupe_key === 'notable:' + setup.id. Les non-publications ne sont PAS persistées →
 * JAMAIS de 3e etat fabrique (les ratees de job Telegram se voient dans Sante via job_runs).
 *
 * Chronologie desc (D-04). Filtres instrument + statut Telegram synchronisés via l'URL
 * (GET form). Valeurs de filtre validées contre les ensembles connus avant usage (V5 / T-08-07).
 * Lecture seule (D-05) : aucun contrôle d'édition/suppression/publication.
 */
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { createAdminServiceClient } from '@/lib/supabase/admin-service'
import { postedSetupIdSet, telegramStatusFor, type TelegramStatus } from '@/lib/admin/signals'

interface SignalView {
  id: string
  instrument: string
  direction: string
  score: number
  createdAt: string
  telegram: TelegramStatus
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  )
}

async function loadSignals(): Promise<SignalView[]> {
  const client = createAdminServiceClient()

  const { data: setups, error } = await client
    .from('trade_setups')
    .select(
      'id, instrument_id, direction, opportunity_score, status, created_at, instruments!inner(canonical_symbol)',
    )
    .order('created_at', { ascending: false })
  if (error) throw new Error(`loadSignals setups: ${error.message}`)

  const { data: posts, error: postErr } = await client
    .from('telegram_posts')
    .select('dedupe_key')
    .like('dedupe_key', 'notable:%')
  if (postErr) throw new Error(`loadSignals posts: ${postErr.message}`)

  const postedIds = postedSetupIdSet(posts ?? [])

  return (setups ?? []).map((s) => {
    const instrument = s.instruments as unknown as { canonical_symbol: string }
    return {
      id: s.id,
      instrument: instrument?.canonical_symbol ?? '—',
      direction: s.direction,
      score: s.opportunity_score,
      createdAt: s.created_at,
      telegram: telegramStatusFor(s.id, postedIds),
    }
  })
}

const TELEGRAM_FILTER_VALUES = ['all', 'posted', 'unpublished'] as const
type TelegramFilter = (typeof TELEGRAM_FILTER_VALUES)[number]

export default async function AdminSignalsPage({
  searchParams,
}: {
  searchParams: Promise<{ instrument?: string; status?: string }>
}) {
  const t = await getTranslations('admin')
  const params = await searchParams

  const allSignals = await loadSignals()

  // Instruments distincts présents → options du filtre (V5 : ensemble connu).
  const instruments = Array.from(new Set(allSignals.map((s) => s.instrument))).sort()

  // Validation des params contre les ensembles connus (V5 / T-08-07) ; inconnu → 'all'.
  const instrumentFilter =
    params.instrument && instruments.includes(params.instrument) ? params.instrument : 'all'
  const statusFilter: TelegramFilter = TELEGRAM_FILTER_VALUES.includes(
    params.status as TelegramFilter,
  )
    ? (params.status as TelegramFilter)
    : 'all'

  // Filtrage en mémoire (miroir de membres/page.tsx).
  let rows = allSignals
  if (instrumentFilter !== 'all') {
    rows = rows.filter((r) => r.instrument === instrumentFilter)
  }
  if (statusFilter !== 'all') {
    rows = rows.filter((r) => r.telegram === statusFilter)
  }

  const telegramLabel: Record<TelegramStatus, string> = {
    posted: t('signals.statusPosted'),
    unpublished: t('signals.statusUnpublished'),
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold">{t('signals.title')}</h1>

      {/* Filtres (D-04) — GET form synchronisé via l'URL */}
      <form className="mt-6 flex flex-wrap items-end gap-3" method="get">
        <div className="grid gap-1.5">
          <label htmlFor="instrument" className="text-sm text-muted-foreground">
            {t('signals.filterInstrument')}
          </label>
          <select
            id="instrument"
            name="instrument"
            defaultValue={instrumentFilter}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="all">{t('signals.filterInstrument')}</option>
            {instruments.map((sym) => (
              <option key={sym} value={sym}>
                {sym}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="status" className="text-sm text-muted-foreground">
            {t('signals.filterStatus')}
          </label>
          <select
            id="status"
            name="status"
            defaultValue={statusFilter}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="all">{t('signals.filterStatus')}</option>
            <option value="posted">{t('signals.statusPosted')}</option>
            <option value="unpublished">{t('signals.statusUnpublished')}</option>
          </select>
        </div>
      </form>

      <div className="mt-6 w-full overflow-x-auto">
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center">
            <p className="font-medium">{t('signals.emptyHeading')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t('signals.emptyBody')}</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('signals.colDate')}</TableHead>
                <TableHead>{t('signals.colInstrument')}</TableHead>
                <TableHead>{t('signals.colDirection')}</TableHead>
                <TableHead>{t('signals.colScore')}</TableHead>
                <TableHead>{t('signals.colTelegram')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link
                      href={`/admin/signaux/${s.id}`}
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      {fmtDateTime(s.createdAt)}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">
                    <bdi>{s.instrument}</bdi>
                  </TableCell>
                  <TableCell>
                    {/* Direction neutre (D-04 : ni vert ni rouge) */}
                    <bdi>{s.direction}</bdi>
                  </TableCell>
                  <TableCell>{s.score}</TableCell>
                  <TableCell>
                    {s.telegram === 'posted' ? (
                      <Badge className="border-[--signal-bullish]/30 bg-[--signal-bullish]/10 text-[--signal-bullish]">
                        {telegramLabel.posted}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-muted-foreground">
                        {telegramLabel.unpublished}
                      </Badge>
                    )}
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
