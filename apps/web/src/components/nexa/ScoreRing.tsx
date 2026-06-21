import { cn } from "@/lib/utils"

/**
 * ScoreRing — anneau radial de score NEXA (DESIGN-05, D-11/D-12).
 *
 * Rend un anneau SVG via `stroke-dasharray`/`stroke-dashoffset`
 * (`offset = c·(1 − score/100)`, `c = 2πr`), chiffre centré en `font-mono`
 * tabular-nums dans un `<bdi>` (anti-inversion RTL). Lisible en liste (~40px,
 * hit-area ≥44px) ET en détail (~96px), un seul composant paramétré par `size`.
 *
 * Couleur = RISQUE, JAMAIS performance (D-12) :
 *   faible → var(--muted-foreground) (neutre)
 *   modéré → var(--risk-moderate)    (amber, 11-01)
 *   élevé  → var(--signal-bearish)   (bear extrême)
 * Jamais le token CTA/actif ni le token de hausse : un score élevé n'est jamais
 * « vert = gagnant ». Le `<svg>` est décoratif (`aria-hidden`) ; l'accès passe par
 * le conteneur `role="meter"` + `aria-valuenow/min/max` + `aria-label`.
 *
 * Le `label` (déjà traduit, score + risque) est fourni par l'appelant pour rester
 * RSC sans `'use client'` (precedent dialog `closeLabel`, D-02-01-F). Il garantit
 * que l'information n'est pas portée par la seule couleur (colorblind-safe).
 */
const RISK_STROKE = {
  faible: "var(--muted-foreground)",
  modere: "var(--risk-moderate)",
  eleve: "var(--signal-bearish)",
} as const

export type ScoreRisk = keyof typeof RISK_STROKE

interface ScoreRingProps {
  /** Score 0–100 (clampé). */
  score: number
  /** Niveau de risque — pilote la couleur du stroke (jamais la performance). */
  risk: ScoreRisk
  /** Diamètre en px (liste ~40, détail ~96). */
  size?: number
  /** aria-label déjà traduit (score + risque) fourni par l'appelant. */
  label: string
  className?: string
}

export function ScoreRing({ score, risk, size = 40, label, className }: ScoreRingProps) {
  const clamped = Math.max(0, Math.min(100, score))
  const r = (size - 6) / 2
  const c = 2 * Math.PI * r
  const offset = c * (1 - clamped / 100)
  const center = size / 2

  return (
    <div
      data-slot="score-ring"
      data-risk={risk}
      role="meter"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn("relative inline-grid place-items-center", className)}
      style={{
        inlineSize: size,
        blockSize: size,
        minInlineSize: 44,
        minBlockSize: 44,
      }}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
      >
        <circle cx={center} cy={center} r={r} fill="none" stroke="var(--border)" strokeWidth={4} />
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke={RISK_STROKE[risk]}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
        <bdi>{clamped}</bdi>
      </span>
    </div>
  )
}
