/**
 * /[locale]/(member)/signaux/[id] — surface DÉTAIL d'un trade (RSC, Plan 03-03 Task 1).
 *
 * Lecture serveur gated : createClient() anon + cookies → la RLS
 * has_active_subscription() (0009/0010) tranche réellement. AUCUN guard inline
 * (le gate d'abonnement est posé par le layout (member)). AUCUN client/repo
 * service_role (frontière producteur-unique, V1).
 *
 * Anti-IDOR (T-03-IDOR) : SELECT by id AND status='active' via maybeSingle().
 * Un signal expiré entre liste et détail, un id inexistant, ou une lecture par un
 * non-abonné → 0 ligne → notFound() (aucune fuite, pas de 403 discriminant).
 *
 * Le chart (lightweight-charts) est client-only → monté via CandleChartLazy, un
 * Client Component qui héberge le next/dynamic ssr:false (Pitfall 5 ; ssr:false
 * interdit en RSC sous Next 15). Render-fail du chart → le plan résumé
 * (SignalDetail) reste lisible.
 */
import { z } from 'zod'
import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { Link } from '../../../../../i18n/navigation'
import { createClient } from '../../../../../lib/supabase/server'
import { SignalDetail, type TradeSetupDetail } from '../../../../../components/signals/SignalDetail'
import { SignalsDisclaimerBanner } from '../../../../../components/signals/SignalsDisclaimerBanner'
import { CandleChartLazy } from '../../../../../components/signals/CandleChartLazy'
import { Eyebrow } from '../../../../../components/nexa/Eyebrow'
import { ScoreRing, type ScoreRisk } from '../../../../../components/nexa/ScoreRing'

/**
 * Mappe le niveau de risque DB (low/medium/high/extreme) vers la palette ScoreRing
 * (faible→neutre, modere→amber, eleve→bearish, D-12). high ET extreme → eleve.
 * Valeur inconnue → modere (repli neutre, jamais l'extrême par défaut).
 */
function mapRiskToScoreRisk(risk: string): ScoreRisk {
  switch (risk) {
    case 'low':
      return 'faible'
    case 'high':
    case 'extreme':
      return 'eleve'
    default:
      return 'modere'
  }
}

/**
 * Schéma Zod du payload §3 affiché (frontière Zod, convention packages/core /
 * apps/jobs persist). Le payload JSONB n'est PAS de confiance (donnée externe au
 * front) : on le valide avant tout accès à entry/stop_loss/take_profits/etc.
 * Un payload IA malformé → safeParse échoue → notFound() (même UX que signal absent),
 * jamais un crash 500. Le score breakdown n'est PAS persisté → absent du schéma.
 * Forme alignée sur SignalPayload (SignalDetail.tsx).
 */
const SignalPayloadSchema = z.object({
  direction: z.enum(['long', 'short']),
  timeframe_analysis: z.string(),
  entry: z.object({
    type: z.string(),
    price: z.number(),
    zone: z.tuple([z.number(), z.number()]),
  }),
  stop_loss: z.number(),
  take_profits: z.array(z.object({ price: z.number(), alloc_pct: z.number() })),
  technical_reasons: z.array(z.string()),
  fundamental_reasons: z.array(z.string()),
  news_catalysts: z.array(
    z.object({
      headline: z.string(),
      impact: z.string(),
      direction: z.string(),
      ts: z.string(),
    }),
  ),
  upcoming_risk_events: z.array(
    z.object({ event: z.string(), ts: z.string(), note: z.string() }),
  ),
  invalidation: z.string(),
  veteran_note: z.string(),
})

interface SignalDetailPageProps {
  params: Promise<{ locale: string; id: string }>
}

/**
 * Mappe le timeframe d'analyse (payload §3) vers la valeur colonne candles.
 * Matching EXACT sur tokens whitelistés (WR-04) : `includes('D')` matchait
 * n'importe quelle string contenant la lettre D ('INTRADAY','UNDEFINED'). Token
 * non reconnu → repli sûr 'H1'.
 */
function mapTimeframe(raw: string): 'H1' | 'H4' | 'D' {
  const v = (raw ?? '').toUpperCase().trim()
  switch (v) {
    case 'H4':
    case '4H':
      return 'H4'
    case 'D':
    case '1D':
    case 'DAY':
    case 'DAILY':
      return 'D'
    case 'H1':
    case '1H':
      return 'H1'
    default:
      return 'H1'
  }
}

export default async function SignalDetailPage({ params }: SignalDetailPageProps) {
  const { locale, id } = await params
  setRequestLocale(locale)
  const t = await getTranslations('signalDetail')
  const tScore = await getTranslations('scoreRing')

  const supabase = await createClient()

  // anti-IDOR : by id + status=active ; RLS = vraie barrière (non-abonné → 0 ligne).
  const { data: setup } = await supabase
    .from('trade_setups')
    .select('*, instruments!inner(symbol, asset_class, precision, display_name)')
    .eq('id', id)
    .eq('status', 'active')
    .maybeSingle()

  if (!setup) {
    notFound()
  }

  // CR-01 : valider le payload JSONB (donnée non de confiance) AVANT tout accès.
  // entry/stop_loss/take_profits/timeframe_analysis manquants ou malformés →
  // safeParse échoue → notFound() (même UX qu'un signal absent), jamais un 500.
  const base = setup as unknown as Omit<TradeSetupDetail, 'payload'> & { payload: unknown }
  const payloadResult = SignalPayloadSchema.safeParse(base.payload)
  if (!payloadResult.success) {
    notFound()
  }

  const payload = payloadResult.data
  const detail: TradeSetupDetail = { ...base, payload }

  // Candles pour le chart (RLS gatée 0011). Échec → chart absent, plan lisible.
  const tf = mapTimeframe(payload.timeframe_analysis)
  const { data: candles } = await supabase
    .from('candles')
    .select('ts, open, high, low, close')
    .eq('instrument_id', detail.instrument_id)
    .eq('timeframe', tf)
    .order('ts', { ascending: true })
    .limit(150) // D-12

  const takeProfits = (payload.take_profits ?? []).map((tp) => tp.price)

  // ScoreRing large (couleur = risque, D-12). Label traduit fourni (RSC-safe).
  const scoreRisk = mapRiskToScoreRisk(detail.risk_level)
  const scoreLabel = tScore('ariaTemplate', {
    score: detail.opportunity_score,
    risk: tScore(`riskLabels.${scoreRisk}`),
  })

  return (
    <main className="mx-auto max-w-screen-lg px-4 py-10 text-start md:px-6 lg:px-8">
      <Link
        href="/signaux"
        className="inline-flex min-h-11 items-center text-sm font-medium text-primary"
      >
        {t('backLink')}
      </Link>

      <SignalsDisclaimerBanner />

      {/* En-tête NEXA : Eyebrow + symbole/direction + ScoreRing large (score = risque). */}
      <header className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col gap-2">
          <Eyebrow>{t('planTitle')}</Eyebrow>
          <h1 className="font-heading text-2xl font-semibold">
            <bdi>{detail.instruments.symbol}</bdi>
          </h1>
          <p className="text-sm text-muted-foreground">{t('scoreLabel')}</p>
        </div>
        <ScoreRing
          score={detail.opportunity_score}
          risk={scoreRisk}
          size={96}
          label={scoreLabel}
        />
      </header>

      {candles && candles.length > 0 ? (
        <section className="mt-6">
          <CandleChartLazy
            candles={candles}
            entry={payload.entry.price}
            stopLoss={payload.stop_loss}
            takeProfits={takeProfits}
            direction={payload.direction}
            precision={detail.instruments.precision}
          />
        </section>
      ) : null}

      <SignalDetail setup={detail} locale={locale} />
    </main>
  )
}
