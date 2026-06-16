/**
 * TrackRecordBlock — bloc track record mesuré (TRACK-03, RSC).
 *
 * Surface PUBLIQUE de confiance : le chiffre qui fonde la valeur du projet, TOUJOURS
 * mesuré, jamais inventé. Rendu sur la vitrine (débloque le slot D-08) ET miroité
 * dans l'espace membre payant (D-13) depuis la MÊME source/composant.
 *
 * Pipeline serveur (frontière producteur-unique) :
 *   anon-client (createClient) → getPatternStats (lecture vue pattern_stats) →
 *   applyThreshold par ligne (seuil N≥30, D-09 ; N toujours exposé, D-12) →
 *   TrackRecordView (présentation interactive : tabs/tooltip/table).
 * AUCUN service-client, AUCUN repo service_role (T-05-07). prediction_outcomes
 * n'est jamais requêté côté front.
 *
 * Le disclaimer LEGAL-01 cohabite avec le % mesuré (D-15) : un track record mesuré
 * n'est pas une promesse de performance future.
 *
 * Source : 05-UI-SPEC §Component Anatomy ; 05-PATTERNS §lecture anon RSC.
 */
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getPatternStats, type PatternStatRow } from '@/lib/track-record/patternStats'
import { applyThreshold } from '@/lib/track-record/threshold'
import { Disclaimer } from '@/components/Disclaimer'
import { TrackRecordView } from './TrackRecordView'
import type { CategoryStat, PeriodStats, TrackRecordData } from './types'

/** Construit les stats d'une période à partir des lignes brutes de cette période. */
function buildPeriod(rows: PatternStatRow[]): PeriodStats {
  const overallRow = rows.find((r) => r.dimension === 'overall')
  const overall = overallRow
    ? applyThreshold({
        n: overallRow.n ?? 0,
        win_rate: overallRow.win_rate,
        expectancy: overallRow.expectancy,
        avg_r: overallRow.avg_r,
      })
    : null

  const categories: CategoryStat[] = rows
    .filter((r) => r.dimension !== 'overall' && r.dimension !== null && r.bucket !== null)
    .map((r) => ({
      dimension: r.dimension as string,
      bucket: r.bucket as string,
      stat: applyThreshold({
        n: r.n ?? 0,
        win_rate: r.win_rate,
        expectancy: r.expectancy,
        avg_r: r.avg_r,
      }),
    }))

  return { overall, categories }
}

export async function TrackRecordBlock() {
  const t = await getTranslations('trackRecord')
  const supabase = await createClient()
  const { rows, error } = await getPatternStats(supabase)

  if (error) {
    return (
      <section className="rounded-xl bg-card p-6 text-start ring-1 ring-foreground/10 md:p-8">
        <h2 className="font-heading text-2xl font-semibold">{t('title')}</h2>
        <p className="mt-3 text-base text-muted-foreground">{t('errorBody')}</p>
        {/* Recharger relance la requête RSC (repli sans état client). */}
        <a
          href="."
          className="mt-4 inline-flex min-h-11 items-center rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground"
        >
          {t('errorRetry')}
        </a>
        <div className="mt-6">
          <Disclaimer />
        </div>
      </section>
    )
  }

  const data: TrackRecordData = {
    allTime: buildPeriod(rows.filter((r) => r.period === 'all_time')),
    last90d: buildPeriod(rows.filter((r) => r.period === '90d')),
  }

  return (
    <div className="text-start">
      <TrackRecordView data={data} />
      <div className="mt-4">
        <Disclaimer />
      </div>
    </div>
  )
}
