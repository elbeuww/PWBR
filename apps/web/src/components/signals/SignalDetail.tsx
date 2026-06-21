/**
 * SignalDetail — niveaux 1/2 du détail d'un trade (Plan 03-03 Task 2 ; MEMB-04, D-09/D-10).
 *
 * Niveau 1 « Explication simple » : veteran_note (VERBATIM) + plan résumé
 * (direction, entrée/SL/TP via formatPrice+precision en <bdi>, R:R, niveau de risque).
 * Niveau 2 « Analyse approfondie » (collapsible, replié par défaut, forceMount pour
 * rester dans le DOM/SEO) : technical/fundamental/news (listes VERBATIM) +
 * ContributingFactors (repli D-11) + invalidation (VERBATIM) + upcoming_risk_events.
 *
 * Contenu IA = D-10 HARD : rendu échappé par React (texte enfant {…}), JAMAIS
 * d'injection HTML brute, JAMAIS reformulé, JAMAIS une clé i18n. Seuls les TITRES
 * de section passent par next-intl.
 *
 * Reskin NEXA (11-06) : le SCORE est rendu par `ScoreRing` dans l'en-tête de la
 * route ([id]/page.tsx) — ce composant ne réaffiche plus le nombre brut pour
 * éviter le doublon. Direction restituée ici dans l'en-tête sémantique.
 *
 * Server-renderable : compose des enfants client (Collapsible). Classes logiques (RTL).
 */
import { useTranslations } from 'next-intl'
import { Collapsible as CollapsiblePrimitive } from 'radix-ui'
import { Link } from '../../i18n/navigation'
import { formatPrice } from '../../lib/signals/format'
import { ContributingFactors } from './ContributingFactors'

/** Sous-ensemble §3 (Output) affiché VERBATIM dans le détail. */
export interface SignalPayload {
  direction: 'long' | 'short'
  timeframe_analysis: string
  entry: { type: string; price: number; zone: [number, number] }
  stop_loss: number
  take_profits: { price: number; alloc_pct: number }[]
  technical_reasons: string[]
  fundamental_reasons: string[]
  news_catalysts: { headline: string; impact: string; direction: string; ts: string }[]
  upcoming_risk_events: { event: string; ts: string; note: string }[]
  invalidation: string
  veteran_note: string
}

/** Forme du trade_setup détaillé lu par la route (colonnes + payload + join). */
export interface TradeSetupDetail {
  id: string
  instrument_id: string
  opportunity_score: number
  risk_level: string
  risk_reward: number
  status: string
  instruments: { symbol: string; asset_class: string; precision: number; display_name: string }
  payload: SignalPayload
}

interface SignalDetailProps {
  setup: TradeSetupDetail
  locale: string
}

/** Capitalise pour reconstruire la clé i18n (riskLow/riskMedium…). */
function capitalize(s: string): string {
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

export function SignalDetail({ setup, locale }: SignalDetailProps) {
  const t = useTranslations('signalDetail')
  const tSignals = useTranslations('signals')
  const tAcademy = useTranslations('academy')
  const p = setup.payload
  const precision = setup.instruments.precision
  const isLong = p.direction === 'long'

  // Color law D-03 : direction = vert/rouge ; score = NEUTRE.
  // Tokens flip-safe (--signal-bullish/bearish) — alignés sur SignalCard/CandleChart (11-03),
  // jamais de HEX ni de variante dark: manuelle (les tokens flippent via :root/.dark).
  const directionClass = isLong
    ? 'text-[var(--signal-bullish)]'
    : 'text-[var(--signal-bearish)]'

  const newsHeadlines = p.news_catalysts.map((n) => n.headline)

  return (
    <article className="mt-6 text-start">
      {/* En-tête : symbole + direction (sémantique). Le score est dans le ScoreRing
          de l'en-tête de page (11-06) — pas de doublon ici (D-03 préservé). */}
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-foreground/10 pb-4">
        <div className="flex items-baseline gap-3">
          <h1 className="font-heading text-2xl font-semibold">{setup.instruments.symbol}</h1>
          <span className={`text-sm font-semibold ${directionClass}`}>
            {isLong ? tSignals('direction.long') : tSignals('direction.short')}
          </span>
        </div>
      </header>

      {/* NIVEAU 1 — Explication simple : veteran_note VERBATIM + plan résumé. */}
      <section className="mt-6">
        <h2 className="text-lg font-semibold">{t('explicationSimple')}</h2>
        {/* veteran_note : rendu échappé par React (enfant texte), zéro injection HTML. */}
        <p className="mt-2 whitespace-pre-line text-foreground">{p.veteran_note}</p>

        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">{t('direction')}</dt>
            <dd className={`font-semibold ${directionClass}`}>
              {isLong ? tSignals('direction.long') : tSignals('direction.short')}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('entry')}</dt>
            <dd className="font-semibold tabular-nums">
              <bdi>{formatPrice(p.entry.price, precision, locale)}</bdi>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('stopLoss')}</dt>
            <dd className="font-semibold tabular-nums text-[var(--signal-bearish)]">
              <bdi>{formatPrice(p.stop_loss, precision, locale)}</bdi>
            </dd>
          </div>
          {p.take_profits.map((tp, i) => (
            <div key={i}>
              <dt className="text-muted-foreground">
                {t('takeProfit')} {i + 1}
              </dt>
              <dd className="font-semibold tabular-nums text-[var(--signal-bullish)]">
                <bdi>{formatPrice(tp.price, precision, locale)}</bdi>
              </dd>
            </div>
          ))}
          <div>
            <dt className="text-muted-foreground">{t('riskReward')}</dt>
            <dd className="font-semibold tabular-nums">
              <bdi>1:{Number.isFinite(setup.risk_reward) ? setup.risk_reward.toFixed(1) : '—'}</bdi>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('riskLevel')}</dt>
            <dd className="font-semibold">
              {tSignals(`filters.risk${capitalize(setup.risk_level)}`)}
            </dd>
          </div>
        </dl>

        {/* D-08b : lien funnel contextuel vers le cours « prendre en main MT5 ». */}
        <p className="mt-4 text-sm">
          <Link
            href="/academie/prendre-en-main-mt5"
            className="font-medium text-primary hover:underline"
          >
            {tAcademy('signalExecLink')}
          </Link>
        </p>
      </section>

      {/* NIVEAU 2 — Analyse approfondie : repliée par défaut, contenu VERBATIM. */}
      <CollapsiblePrimitive.Root defaultOpen={false} className="mt-6">
        <CollapsiblePrimitive.CollapsibleTrigger className="inline-flex min-h-11 items-center text-lg font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {t('analyseApprofondie')}
        </CollapsiblePrimitive.CollapsibleTrigger>
        {/* forceMount : reste dans le DOM (caché si replié) → SEO + a11y + testable. */}
        <CollapsiblePrimitive.CollapsibleContent
          forceMount
          className="mt-4 space-y-6 data-[state=closed]:hidden motion-reduce:transition-none"
        >
          {p.technical_reasons.length > 0 ? (
            <section>
              <h3 className="text-sm font-semibold">{t('technicalReasons')}</h3>
              <ul className="mt-2 list-disc space-y-1 ps-5 text-sm text-foreground">
                {p.technical_reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {p.fundamental_reasons.length > 0 ? (
            <section>
              <h3 className="text-sm font-semibold">{t('fundamentalReasons')}</h3>
              <ul className="mt-2 list-disc space-y-1 ps-5 text-sm text-foreground">
                {p.fundamental_reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {p.news_catalysts.length > 0 ? (
            <section>
              <h3 className="text-sm font-semibold">{t('newsCatalysts')}</h3>
              <ul className="mt-2 list-disc space-y-1 ps-5 text-sm text-foreground">
                {p.news_catalysts.map((n, i) => (
                  <li key={i}>{n.headline}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <ContributingFactors
            score={setup.opportunity_score}
            technicalReasons={p.technical_reasons}
            fundamentalReasons={p.fundamental_reasons}
            newsHeadlines={newsHeadlines}
          />

          <section>
            <h3 className="text-sm font-semibold">{t('scenarioInvalidation')}</h3>
            {/* invalidation : VERBATIM, rendu échappé. */}
            <p className="mt-2 whitespace-pre-line text-sm text-foreground">{p.invalidation}</p>
          </section>

          {p.upcoming_risk_events.length > 0 ? (
            <section>
              <h3 className="text-sm font-semibold">{t('evenementsRisque')}</h3>
              <ul className="mt-2 list-disc space-y-1 ps-5 text-sm text-foreground">
                {p.upcoming_risk_events.map((e, i) => (
                  <li key={i}>
                    {e.event}
                    {e.note ? ` — ${e.note}` : ''}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </CollapsiblePrimitive.CollapsibleContent>
      </CollapsiblePrimitive.Root>
    </article>
  )
}
