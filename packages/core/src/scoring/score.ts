/**
 * scoreSetup (D-42, SCORE-02) — opportunity_score /100 DÉCOMPOSABLE + dérivations.
 *
 * Cœur déterministe remplaçant le jugement chiffré de l'agent (anti-hallucination,
 * reproductibilité, calibration §6). Logique PURE : aucun IO, aucun Date.now()
 * (`now` injecté via opts). Golden-testé.
 *
 * Ordre FIGÉ (concern archi) : ÉTAPE 0 bornes inputs → ÉTAPE 1 opportunity_score
 * → ÉTAPE 2 confidence (dérive du score) → ÉTAPE 3 risk_level. Documenté + testé.
 *
 * Cycle évité (concern archi) : @app/core est le package le plus BAS — il
 * n'importe RIEN d'@app/indicators (ni type ni runtime). Les types d'entrée §3
 * sont un miroir structurel local (snapshot-input.ts) ; voir ce fichier pour le
 * « pourquoi » (rootDir composite + graphe de dépendances unidirectionnel).
 */
import type { Output } from '../schemas/output.js'
import type {
  TechnicalSnapshotInput,
  FundamentalContextInput,
  NewsContextInput,
  CombinedSnapshot,
} from './snapshot-input.js'
import { computeRiskReward } from './rr.js'
import { deriveConfidence, type Confidence } from './confidence.js'
import { deriveRiskLevel, type RiskLevel } from './risk.js'
import {
  WEIGHTS,
  PENALTIES,
  INPUT_BOUNDS,
  RR_TARGETS,
  EXTREME_VOL_PERCENTILE,
  HTF_CONTRADICT_CAP,
  hasStrongCatalyst,
} from './weights.js'

export type { CombinedSnapshot }

export type ScoreStyle = keyof typeof WEIGHTS

export interface ScoreBreakdown {
  trendAlign: number
  keyLevel: number
  momentum: number
  fundamental: number
  news: number
  rr: number
  penalties: number
  capApplied: boolean
}

export interface ScoreResult {
  opportunity_score: number
  breakdown: ScoreBreakdown
  risk_level: RiskLevel
  confidence: Confidence
}

export interface ScoreOptions {
  /** Instant de référence injecté (jamais Date.now() — déterminisme T-04-04). */
  now?: string
}

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))

/** Entrée conservatrice (miroir rr.ts, D-50). */
function conservativeEntry(output: Output): number {
  const [zMin, zMax] = output.entry.zone
  return output.direction === 'long' ? zMax : zMin
}

/** Le HTF contredit-il franchement la direction (≠ range, ≠ sens voulu) ? */
function htfContradicts(t: TechnicalSnapshotInput, direction: Output['direction']): boolean {
  const wanted = direction === 'long' ? 'bullish' : 'bearish'
  return t.trend_htf !== 'range' && t.trend_htf !== wanted
}

// ─── Blocs de scoring (purs, déterministes) ──────────────────────────────────

/** Alignement tendance HTF/LTF : plein si les deux alignés, moitié si un seul, 0 si contre. */
function scoreTrendAlign(t: TechnicalSnapshotInput, dir: Output['direction'], w: number): number {
  const wanted = dir === 'long' ? 'bullish' : 'bearish'
  if (htfContradicts(t, dir)) return 0
  const htfOk = t.trend_htf === wanted
  const ltfOk = t.trend_ltf === wanted
  if (htfOk && ltfOk) return w
  if (htfOk || ltfOk) return w / 2
  return 0
}

/** Confluence niveau clé : proximité (en ATR) × force du niveau le plus proche. */
function scoreKeyLevel(t: TechnicalSnapshotInput, output: Output, w: number): number {
  const atr = t.volatility.atr
  if (atr <= 0 || t.key_levels.length === 0) return 0
  const entry = conservativeEntry(output)
  let best = 0
  for (const lvl of t.key_levels) {
    const distAtr = Math.abs(lvl.price - entry) / atr
    const proximity = distAtr < 0.5 ? 1 : distAtr < 1.0 ? 0.5 : 0
    const strength = clamp(lvl.strength, 0, 1)
    best = Math.max(best, proximity * strength)
  }
  return w * best
}

/** Momentum confirmant : RSI dans le sens + MACD hist signe + slope signe. */
function scoreMomentum(t: TechnicalSnapshotInput, dir: Output['direction'], w: number): number {
  const rsi = clamp(t.momentum.rsi, INPUT_BOUNDS.rsi[0], INPUT_BOUNDS.rsi[1])
  let hits = 0
  if (dir === 'long') {
    if (rsi > 50) hits++
    if (t.momentum.macd_hist > 0) hits++
    if (t.momentum.slope > 0) hits++
  } else {
    if (rsi < 50) hits++
    if (t.momentum.macd_hist < 0) hits++
    if (t.momentum.slope < 0) hits++
  }
  return w * (hits / 3)
}

/** Contexte fondamental aligné : macro_bias + rate_environment dans le sens. */
function scoreFundamental(f: FundamentalContextInput, dir: Output['direction'], w: number): number {
  // long ⇒ favorable si risk_on (appétit) + dovish (taux bas) ; short = miroir.
  let hits = 0
  if (dir === 'long') {
    if (f.macro_bias === 'risk_on') hits++
    if (f.rate_environment === 'dovish') hits++
  } else {
    if (f.macro_bias === 'risk_off') hits++
    if (f.rate_environment === 'hawkish') hits++
  }
  return w * (hits / 2)
}

/** Sentiment news aligné : signe cohérent, échelonné par magnitude. */
function scoreNews(n: NewsContextInput, dir: Output['direction'], w: number): number {
  const s = clamp(n.net_sentiment, INPUT_BOUNDS.netSentiment[0], INPUT_BOUNDS.netSentiment[1])
  const signed = dir === 'long' ? s : -s
  if (signed <= 0) return 0 // contradiction ou neutre → pas de points
  // magnitude : ≥0.5 plein, 0.2-0.5 moitié, <0.2 rien
  if (signed >= 0.5) return w
  if (signed >= 0.2) return w / 2
  return 0
}

/** Qualité R:R : plein si ≥ cible style, moitié si ≥1.2 (règle dure), 0 sinon. */
function scoreRr(rrGlobal: number, style: ScoreStyle, w: number): number {
  const target = RR_TARGETS[style]
  if (rrGlobal >= target) return w
  if (rrGlobal >= 1.2) return w / 2
  return 0
}

/** Compte les confluences alignées (pour deriveConfidence). */
function countAlignedConfluences(b: ScoreBreakdown): number {
  let n = 0
  if (b.trendAlign > 0) n++
  if (b.keyLevel > 0) n++
  if (b.momentum > 0) n++
  if (b.fundamental > 0) n++
  if (b.news > 0) n++
  return n
}

/**
 * Calcule opportunity_score (/100, décomposable) + breakdown + risk_level +
 * confidence d'un setup. Ordre figé score→confidence→risk.
 *
 * @throws Error('invalid_atr') si snapshot.technical.volatility.atr < 0 (bug upstream).
 */
export function scoreSetup(
  snapshot: CombinedSnapshot,
  output: Output,
  style: ScoreStyle,
  _opts: ScoreOptions = {},
): ScoreResult {
  const t = snapshot.technical

  // ── ÉTAPE 0 : bornes inputs (concern #4, T-04-14) ─────────────────────────
  if (t.volatility.atr < 0) {
    throw new Error('invalid_atr')
  }
  // RSI / atr_percentile / net_sentiment sont clampés à l'usage (clamp() dans
  // chaque bloc) → score TOUJOURS dans [0,100] même si input hors borne.

  const w = WEIGHTS[style]

  // ── ÉTAPE 1 : opportunity_score décomposable ──────────────────────────────
  const rr = computeRiskReward(output)

  const breakdown: ScoreBreakdown = {
    trendAlign: scoreTrendAlign(t, output.direction, w.trendAlign),
    keyLevel: scoreKeyLevel(t, output, w.keyLevel),
    momentum: scoreMomentum(t, output.direction, w.momentum),
    fundamental: scoreFundamental(snapshot.fundamental, output.direction, w.fundamental),
    news: scoreNews(snapshot.news, output.direction, w.news),
    rr: scoreRr(rr.global, style, w.rr),
    penalties: 0,
    capApplied: false,
  }

  // Pénalités §3
  let penalties = 0
  const newsImminent = snapshot.news.news_risk || output.upcoming_risk_events.length > 0
  if (newsImminent) penalties += PENALTIES.newsHighImpact
  if (t.volatility.atr_percentile >= EXTREME_VOL_PERCENTILE) penalties += PENALTIES.extremeVol
  breakdown.penalties = penalties

  let raw =
    breakdown.trendAlign +
    breakdown.keyLevel +
    breakdown.momentum +
    breakdown.fundamental +
    breakdown.news +
    breakdown.rr +
    penalties

  raw = clamp(raw, 0, 100)

  // Règle dure §3 : HTF contredit franchement ET pas de catalyseur fort → cap 45.
  if (htfContradicts(t, output.direction) && !hasStrongCatalyst(output)) {
    breakdown.capApplied = raw > HTF_CONTRADICT_CAP
    raw = Math.min(raw, HTF_CONTRADICT_CAP)
  }

  const opportunity_score = Math.round(clamp(raw, 0, 100))

  // ── ÉTAPE 2 : confidence (dérive du score DÉJÀ calculé — ordre figé) ───────
  const confidence = deriveConfidence({
    opportunity_score,
    alignedConfluences: countAlignedConfluences(breakdown),
    news_risk: snapshot.news.news_risk,
  })

  // ── ÉTAPE 3 : risk_level ──────────────────────────────────────────────────
  const risk_level = deriveRiskLevel({ snapshot, output, rr: rr.global })

  return { opportunity_score, breakdown, risk_level, confidence }
}
