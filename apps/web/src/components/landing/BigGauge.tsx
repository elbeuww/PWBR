import { cn } from '@/lib/utils'

/**
 * BigGauge — gros anneau de score pour la section vitrine « Le score » (UI vitrine).
 *
 * Miroir agrandi de ScoreRing : couleur du stroke = RISQUE, jamais performance
 * (D-12). La lueur (drop-shadow) reprend la MÊME couleur de risque que l'anneau —
 * jamais le vert de marque (D-05 : pas de « vert = bon score »). Numéro en
 * `font-mono tabular-nums` dans un `<bdi>` (RTL-safe). Décoratif `aria-hidden` sur
 * le SVG ; l'accessibilité passe par `role="meter"` + `aria-label` traduit fourni.
 */
const RISK_STROKE = {
  faible: 'var(--muted-foreground)',
  modere: 'var(--risk-moderate)',
  eleve: 'var(--signal-bearish)',
} as const

export type GaugeRisk = keyof typeof RISK_STROKE

interface BigGaugeProps {
  score: number
  risk: GaugeRisk
  /** aria-label déjà traduit (score + risque). */
  label: string
  size?: number
  className?: string
}

export function BigGauge({ score, risk, label, size = 240, className }: BigGaugeProps) {
  const clamped = Math.max(0, Math.min(100, score))
  const r = (size - 18) / 2
  const c = 2 * Math.PI * r
  const offset = c * (1 - clamped / 100)
  const center = size / 2
  const stroke = RISK_STROKE[risk]

  return (
    <div
      role="meter"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn('relative inline-grid place-items-center', className)}
      style={{
        inlineSize: size,
        blockSize: size,
        filter: `drop-shadow(0 0 26px color-mix(in oklch, ${stroke} 40%, transparent))`,
      }}
    >
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="absolute inset-0 h-full w-full -rotate-90">
        <circle cx={center} cy={center} r={r} fill="none" stroke="var(--border)" strokeWidth={9} />
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth={9}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="font-mono text-6xl font-bold tabular-nums text-foreground md:text-7xl">
        <bdi>{clamped}</bdi>
      </span>
    </div>
  )
}
