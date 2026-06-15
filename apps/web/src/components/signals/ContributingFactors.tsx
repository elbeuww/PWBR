/**
 * ContributingFactors — repli D-11 (Plan 03-03 Task 2).
 *
 * Le ScoreBreakdown par dimension N'EST PAS persisté (preuve persist.ts) → AUCUNE
 * barre par dimension, AUCUN graphe de décomposition. À la place, on dérive une
 * liste « Facteurs contributifs » des raisons IA déjà présentes dans le payload §3
 * (technical/fundamental/news). Le contenu reste VERBATIM (rendu échappé React).
 *
 * Optionnel : une unique barre de progression NEUTRE du score global (div Tailwind,
 * D-03) — neutre (--primary), jamais vert/rouge.
 */
import { useTranslations } from 'next-intl'

export interface ContributingFactorsProps {
  /** opportunity_score (colonne trade_setups) — pour la barre neutre globale. */
  score: number
  technicalReasons: string[]
  fundamentalReasons: string[]
  newsHeadlines: string[]
}

export function ContributingFactors({
  score,
  technicalReasons,
  fundamentalReasons,
  newsHeadlines,
}: ContributingFactorsProps) {
  const t = useTranslations('signalDetail')
  const factors = [...technicalReasons, ...fundamentalReasons, ...newsHeadlines]
  const scoreBar = Math.max(0, Math.min(100, score))

  return (
    <section className="text-start">
      <h3 className="text-sm font-semibold">{t('facteursContributifs')}</h3>

      {/* Barre NEUTRE du score global (D-03/D-11) — PAS de barres par dimension. */}
      <div className="mt-2 flex items-center gap-2">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ inlineSize: `${scoreBar}%` }} />
        </div>
        <span className="text-sm font-semibold tabular-nums text-primary">
          <bdi>{score}</bdi>
        </span>
      </div>

      {factors.length > 0 ? (
        <ul className="mt-3 list-disc space-y-1 ps-5 text-sm text-muted-foreground">
          {factors.map((factor, i) => (
            <li key={i}>{factor}</li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
