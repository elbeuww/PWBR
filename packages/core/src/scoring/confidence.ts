/**
 * deriveConfidence (D-48) — confiance dérivée par règle code (golden).
 *
 * Mapping reproductible depuis :
 *  - opportunity_score (déjà calculé — ordre figé score→confidence→risk)
 *  - alignedConfluences : nb de blocs alignés dans le sens (tendance/niveau/
 *    momentum/fondamental/news)
 *  - news_risk (D-40) : dégrade la confiance d'un cran.
 *
 * Fonction PURE, sortie enum stable.
 */
export type Confidence = 'low' | 'moderate' | 'high'

/** Seuils nommés (data-not-magic). */
const CONFIDENCE_THRESHOLDS = {
  /** Score minimal pour viser high. */
  highScore: 70,
  /** Confluences alignées minimales pour viser high. */
  highConfluences: 4,
  /** Score minimal pour moderate (sinon low). */
  moderateScore: 45,
} as const

const ORDER: readonly Confidence[] = ['low', 'moderate', 'high']

/** Dégrade d'un cran (jamais sous low). */
function downgrade(level: Confidence): Confidence {
  const idx = ORDER.indexOf(level)
  return ORDER[Math.max(0, idx - 1)]!
}

export interface ConfidenceInput {
  opportunity_score: number
  alignedConfluences: number
  news_risk: boolean
}

export function deriveConfidence({
  opportunity_score,
  alignedConfluences,
  news_risk,
}: ConfidenceInput): Confidence {
  let base: Confidence
  if (
    opportunity_score >= CONFIDENCE_THRESHOLDS.highScore &&
    alignedConfluences >= CONFIDENCE_THRESHOLDS.highConfluences
  ) {
    base = 'high'
  } else if (opportunity_score >= CONFIDENCE_THRESHOLDS.moderateScore) {
    base = 'moderate'
  } else {
    base = 'low'
  }

  return news_risk ? downgrade(base) : base
}

export { CONFIDENCE_THRESHOLDS }
