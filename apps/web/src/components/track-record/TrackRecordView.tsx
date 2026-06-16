'use client'

/**
 * TrackRecordView — rendu interactif du track record mesuré (TRACK-03, D-07/10/11/12/13/14).
 *
 * Client component PUR de présentation : reçoit des données DÉJÀ seuillées côté
 * serveur (applyThreshold, 05-01) ; ne décide jamais du seuil ni ne lit la DB.
 * Gère les tabs périodes (D-11), l'agrégat hero, la table par catégorie, le tooltip
 * méthode et le lien « Voir la méthodologie ». Toutes les chaînes via next-intl
 * (namespace trackRecord) ; tous les nombres via Intl (useFormatter) + <bdi> (RTL-safe).
 *
 * Loi semantic-color (D-04 P3) : le % hero reste NEUTRE (anti-arnaque, retenue) ; le
 * signe de R moyen / expectancy peut être coloré vert/rouge UNIQUEMENT s'il est
 * explicitement ± (résultat mesuré, jamais décoratif). « Échantillon insuffisant »
 * est NEUTRE muted, jamais une erreur.
 *
 * Classes logiques uniquement (ms/me/ps/pe/start/end) — jamais left/right.
 *
 * Source : 05-UI-SPEC §Component Anatomy, §Color result-rule, §Interaction & States.
 */
import { useTranslations, useFormatter } from 'next-intl'
import { HelpCircle } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import type { PeriodStats, TrackRecordData, CategoryStat } from './types'

/** Dimensions rendues dans la table catégories (asset UUID brut exclu — illisible). */
const CATEGORY_DIMENSIONS = ['asset_class', 'style', 'score_band', 'risk'] as const

interface TrackRecordViewProps {
  data: TrackRecordData
}

export function TrackRecordView({ data }: TrackRecordViewProps) {
  const t = useTranslations('trackRecord')

  return (
    <TooltipProvider>
      <section
        aria-labelledby="track-record-title"
        className="rounded-xl bg-card p-6 text-start ring-1 ring-foreground/10 md:p-8"
      >
        <header className="flex flex-wrap items-center gap-2">
          <h2 id="track-record-title" className="font-heading text-2xl font-semibold">
            {t('title')}
          </h2>
          <MethodTooltip label={t('methodTooltipBody')} link={t('methodologyLink')} />
        </header>

        <Tabs defaultValue="all_time" className="mt-6">
          <TabsList>
            <TabsTrigger value="all_time" className="min-h-11">
              {t('periodAllTime')}
            </TabsTrigger>
            <TabsTrigger value="90d" className="min-h-11">
              {t('period90d')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all_time">
            <PeriodPanel period={data.allTime} />
          </TabsContent>
          <TabsContent value="90d">
            <PeriodPanel period={data.last90d} />
          </TabsContent>
        </Tabs>

        <Separator className="my-6" />

        <Link
          href="/methodologie"
          className="inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {t('methodologyLink')}
        </Link>
      </section>
    </TooltipProvider>
  )
}

/** Tooltip méthode : déclencheur "?" + corps + rappel du lien méthodologie. */
function MethodTooltip({ label, link }: { label: string; link: string }) {
  const t = useTranslations('trackRecord')
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        aria-label={t('methodTooltipAria')}
        className="inline-flex size-11 items-center justify-center text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <HelpCircle className="size-4" />
      </TooltipTrigger>
      <TooltipContent>
        <span className="block">{label}</span>
        <span className="mt-1 block font-semibold underline">{link}</span>
      </TooltipContent>
    </Tooltip>
  )
}

/** Panneau d'une période : agrégat hero + table catégories (ou empty). */
function PeriodPanel({ period }: { period: PeriodStats }) {
  const t = useTranslations('trackRecord')

  if (!period.overall) {
    return (
      <div className="mt-6 rounded-lg bg-muted/40 p-6 text-center">
        <p className="text-base font-semibold">{t('emptyHeading')}</p>
        <p className="mx-auto mt-2 max-w-prose text-sm text-muted-foreground">
          {t('emptyBody')}
        </p>
      </div>
    )
  }

  return (
    <div className="mt-6">
      <AggregateRow stat={period.overall} />
      <CategoryTable categories={period.categories} />
    </div>
  )
}

/** Agrégat global : % hero NEUTRE + R moyen + expectancy + N toujours visible. */
function AggregateRow({ stat }: { stat: PeriodStats['overall'] }) {
  const t = useTranslations('trackRecord')
  const format = useFormatter()

  if (!stat) return null

  if (!stat.sufficient) {
    return (
      <div className="rounded-lg bg-muted/40 p-6">
        <p className="text-base text-muted-foreground">
          {t('insufficient', { n: stat.n })}
        </p>
      </div>
    )
  }

  const sampleLabel = t('sampleSize', { n: stat.n })

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {/* Win rate — hero, Display, NEUTRE (retenue anti-arnaque). */}
      <div>
        <p className="text-sm font-semibold text-muted-foreground">{t('winRate')}</p>
        <p className="mt-1 text-[40px] leading-none font-semibold md:text-[56px]">
          <bdi>{format.number(stat.winRatePct / 100, { style: 'percent' })}</bdi>
        </p>
        <p className="mt-2 text-sm text-muted-foreground">{sampleLabel}</p>
      </div>

      {/* R moyen (gagnants) — Heading, signe coloré seulement si ±. */}
      <SignedMetric
        label={t('avgR')}
        value={stat.avgR}
        sampleLabel={sampleLabel}
        suffix={t('rUnit')}
      />

      {/* Expectancy (tous trades) — Heading, signe coloré seulement si ±. */}
      <SignedMetric
        label={t('expectancy')}
        value={stat.expectancy}
        sampleLabel={sampleLabel}
        suffix={t('rUnit')}
      />
    </div>
  )
}

/**
 * Métrique en R signée : vert si > 0, rouge si < 0, neutre si 0/null.
 * Le signe est toujours énoncé textuellement (colorblind-safe) avant la couleur.
 */
function SignedMetric({
  label,
  value,
  sampleLabel,
  suffix,
}: {
  label: string
  value: number | null
  sampleLabel: string
  suffix: string
}) {
  const t = useTranslations('trackRecord')
  const format = useFormatter()

  if (value === null) {
    return (
      <div>
        <p className="text-sm font-semibold text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-muted-foreground">{t('noData')}</p>
        <p className="mt-2 text-sm text-muted-foreground">{sampleLabel}</p>
      </div>
    )
  }

  const tone =
    value > 0
      ? 'text-emerald-700 dark:text-emerald-400'
      : value < 0
        ? 'text-red-700 dark:text-red-400'
        : 'text-foreground'

  return (
    <div>
      <p className="text-sm font-semibold text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone}`}>
        <bdi>
          {format.number(value, { signDisplay: 'exceptZero', maximumFractionDigits: 2 })}{' '}
          {suffix}
        </bdi>
      </p>
      <p className="mt-2 text-sm text-muted-foreground">{sampleLabel}</p>
    </div>
  )
}

/** Table par catégorie : une ligne par bucket, % ou « insuffisant » par ligne (D-09). */
function CategoryTable({ categories }: { categories: CategoryStat[] }) {
  const t = useTranslations('trackRecord')

  const rows = categories.filter((c) =>
    (CATEGORY_DIMENSIONS as readonly string[]).includes(c.dimension),
  )

  if (rows.length === 0) return null

  return (
    <div className="mt-8">
      <h3 className="text-sm font-semibold text-muted-foreground">{t('byCategory')}</h3>
      <div className="mt-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-start">{t('colCategory')}</TableHead>
              <TableHead className="text-start">{t('colWinRate')}</TableHead>
              <TableHead className="text-start">{t('colTrades')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <CategoryRow key={`${row.dimension}:${row.bucket}`} row={row} />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

/** Une ligne de catégorie : label localisé + % ou « insuffisant » neutre + N. */
function CategoryRow({ row }: { row: CategoryStat }) {
  const t = useTranslations('trackRecord')
  const format = useFormatter()

  return (
    <TableRow>
      <TableCell className="text-start font-medium">
        <BucketLabel dimension={row.dimension} bucket={row.bucket} />
      </TableCell>
      <TableCell className="text-start">
        {row.stat.sufficient ? (
          <bdi>{format.number(row.stat.winRatePct / 100, { style: 'percent' })}</bdi>
        ) : (
          <span className="text-muted-foreground">
            {t('insufficientShort', { n: row.stat.n })}
          </span>
        )}
      </TableCell>
      <TableCell className="text-start">
        <bdi>{format.number(row.stat.n)}</bdi>
      </TableCell>
    </TableRow>
  )
}

/**
 * Libellé localisé d'un bucket. style/risk/score_band ont des clés i18n ;
 * asset_class est une donnée DB lisible (crypto/forex/…) rendue telle quelle
 * en <bdi> (jamais une chaîne en dur — vient de la base).
 */
function BucketLabel({ dimension, bucket }: { dimension: string; bucket: string }) {
  const t = useTranslations('trackRecord')

  if (dimension === 'style') {
    const key = bucket === 'day' ? 'styleDay' : bucket === 'swing' ? 'styleSwing' : null
    if (key) return <>{t(key)}</>
  }
  if (dimension === 'risk') {
    const map: Record<string, string> = {
      low: 'riskLow',
      medium: 'riskMedium',
      high: 'riskHigh',
      extreme: 'riskExtreme',
    }
    const key = map[bucket]
    if (key) return <>{t(key)}</>
  }
  if (dimension === 'score_band') {
    return (
      <>
        {t('scoreBand')} <bdi>{bucket}</bdi>
      </>
    )
  }
  // asset_class : donnée DB lisible.
  return <bdi>{bucket}</bdi>
}
