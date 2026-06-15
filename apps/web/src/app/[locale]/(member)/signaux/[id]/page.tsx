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
 * Le chart (lightweight-charts) est client-only → monté via next/dynamic ssr:false
 * (Pitfall 5). Render-fail du chart → le plan résumé (SignalDetail) reste lisible.
 */
import { notFound } from 'next/navigation'
import dynamic from 'next/dynamic'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { Link } from '../../../../../i18n/navigation'
import { createClient } from '../../../../../lib/supabase/server'
import { SignalDetail, type TradeSetupDetail } from '../../../../../components/signals/SignalDetail'
import { SignalsDisclaimerBanner } from '../../../../../components/signals/SignalsDisclaimerBanner'

// Chart client-only : jamais rendu côté serveur (référence window/canvas).
const CandleChart = dynamic(
  () => import('../../../../../components/signals/CandleChart').then((m) => m.CandleChart),
  { ssr: false },
)

interface SignalDetailPageProps {
  params: Promise<{ locale: string; id: string }>
}

/** Mappe le timeframe d'analyse (payload §3) vers la valeur colonne candles. */
function mapTimeframe(raw: string): 'H1' | 'H4' | 'D' {
  const v = (raw ?? '').toUpperCase()
  if (v.includes('H4') || v.includes('4H')) return 'H4'
  if (v.includes('D') || v.includes('1D') || v.includes('DAY')) return 'D'
  return 'H1'
}

export default async function SignalDetailPage({ params }: SignalDetailPageProps) {
  const { locale, id } = await params
  setRequestLocale(locale)
  const t = await getTranslations('signalDetail')

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

  const detail = setup as unknown as TradeSetupDetail
  const payload = detail.payload

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

  return (
    <main className="mx-auto max-w-screen-lg px-4 py-10 text-start md:px-6 lg:px-8">
      <Link
        href="/signaux"
        className="inline-flex min-h-11 items-center text-sm font-medium text-primary"
      >
        {t('backLink')}
      </Link>

      <SignalsDisclaimerBanner />

      {candles && candles.length > 0 ? (
        <section className="mt-6">
          <CandleChart
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
