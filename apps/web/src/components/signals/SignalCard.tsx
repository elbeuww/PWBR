/**
 * SignalCard — carte signal (Plan 03-02 Task 2 ; MEMB-01, D-01/D-03/D-04 ;
 * reskin NEXA UI-03, Plan 11-06).
 *
 * Server-renderable (pas de 'use client') : rend les méta d'un trade_setup actif.
 *
 * Color law D-03 (HARD) : vert = LONG, rouge = SHORT, UNIQUEMENT sur le badge de
 * direction. Le SCORE passe par `ScoreRing` (11-04) : couleur = RISQUE (D-12),
 * JAMAIS « vert = gagnant ». Aucune classe directionnelle physique (text-left/right,
 * ml-/mr-/pl-/pr-) → propriétés logiques (ms/me/ps/pe/start/end) pour le RTL.
 *
 * Valeurs numériques (score, R:R, prix, fraîcheur) encadrées <bdi> + Intl
 * (formatPrice/formatRelativeAge, 03-01). Carte = Link localisé vers le détail.
 */
import { useTranslations } from 'next-intl'
import { Link } from '../../i18n/navigation'
import { Card, CardContent, CardHeader } from '../ui/card'
import { ScoreRing, type ScoreRisk } from '../nexa/ScoreRing'
import { formatRelativeAge } from '../../lib/signals/format'
import type { SignalRow } from '../../lib/signals/queries'

interface SignalCardProps {
  signal: SignalRow
  locale: string
}

/** Bande qualitative neutre du score (D-03). Bornes : ≥80 / 60-79 / <60. */
function scoreBandKey(score: number): 'strong' | 'moderate' | 'cautious' {
  if (score >= 80) return 'strong'
  if (score >= 60) return 'moderate'
  return 'cautious'
}

/**
 * Mappe le niveau de risque DB (low/medium/high/extreme) vers la palette ScoreRing
 * (faible→neutre, modere→amber, eleve→bearish, D-12). high ET extreme → eleve
 * (un seul cran extrême colorimétrique ; le label texte reste distinct via i18n).
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

export function SignalCard({ signal, locale }: SignalCardProps) {
  const t = useTranslations('signals')
  const tScore = useTranslations('scoreRing')
  const isLong = signal.direction === 'long'

  // Direction via tokens NEXA flip-safe (--signal-*, 11-01) — UNIQUEMENT direction (D-03).
  // Le token flippe seul selon le thème → plus de variantes dark: manuelles.
  const directionClass = isLong
    ? 'bg-[var(--signal-bullish)]/10 text-[var(--signal-bullish)]'
    : 'bg-[var(--signal-bearish)]/10 text-[var(--signal-bearish)]'

  // ScoreRing (11-04) : couleur = risque, label traduit fourni par l'appelant (RSC-safe).
  const scoreRisk = mapRiskToScoreRisk(signal.risk_level)
  const scoreLabel = tScore('ariaTemplate', {
    score: signal.opportunity_score,
    risk: tScore(`riskLabels.${scoreRisk}`),
  })

  return (
    <Link
      href={`/signaux/${signal.id}`}
      className="group block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      aria-label={t('cardAction')}
    >
      <Card className="h-full transition-shadow group-hover:ring-foreground/20 group-focus-visible:ring-foreground/20">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-sm font-semibold">{signal.instruments.symbol}</span>
            <span
              className={`inline-flex min-h-6 items-center rounded-4xl px-2 py-0.5 text-xs font-medium ${directionClass}`}
            >
              {isLong ? t('direction.long') : t('direction.short')}
            </span>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-3">
          {/* Bloc score — ScoreRing NEXA (couleur = risque, D-12). */}
          <div className="flex items-center gap-3">
            <ScoreRing
              score={signal.opportunity_score}
              risk={scoreRisk}
              size={40}
              label={scoreLabel}
            />
            <span className="text-sm font-medium text-muted-foreground">
              {t(`scoreBands.${scoreBandKey(signal.opportunity_score)}`)}
            </span>
          </div>

          {/* Méta : risque · R:R · style. */}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex min-h-6 items-center rounded-4xl bg-muted px-2 py-0.5 font-medium text-muted-foreground">
              {t('filters.risk')}: {t(`filters.risk${capitalize(signal.risk_level)}`)}
            </span>
            <span className="inline-flex min-h-6 items-center rounded-4xl bg-muted px-2 py-0.5 font-medium text-muted-foreground">
              R:R <bdi>1:{formatRr(signal.risk_reward)}</bdi>
            </span>
            <span className="inline-flex min-h-6 items-center rounded-4xl bg-muted px-2 py-0.5 font-medium text-muted-foreground">
              {t(`filters.style${capitalize(signal.style)}`)}
            </span>
          </div>

          {/* Fraîcheur (D-04). */}
          <p className="text-sm text-muted-foreground">
            <bdi>{formatRelativeAge(signal.created_at, locale)}</bdi>
            {signal.valid_until ? (
              <>
                {' · '}
                <bdi>{formatRelativeAge(signal.valid_until, locale)}</bdi>
              </>
            ) : null}
          </p>

          <span className="text-sm font-semibold text-primary">{t('cardAction')}</span>
        </CardContent>
      </Card>
    </Link>
  )
}

/** Capitalise la 1re lettre pour reconstruire la clé i18n (riskLow/styleDay…). */
function capitalize(s: string): string {
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

/** Affiche le R:R avec une décimale (ex. 2.4) sans encoder de couleur. */
function formatRr(rr: number): string {
  return Number.isFinite(rr) ? rr.toFixed(1) : '—'
}
