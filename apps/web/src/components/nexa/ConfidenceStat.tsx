import { applyThreshold } from "@/lib/track-record/threshold"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

/**
 * ConfidenceStat — statistique de confiance NEXA (DESIGN-05, D-13/BRAND-04).
 *
 * HARD : tout pourcentage affiché passe par `applyThreshold` (source unique,
 * @app/core via @/lib/track-record/threshold). Sous `MIN_SAMPLE=30`, l'union
 * discriminée renvoie `{ sufficient:false }` → état « en construction (N
 * insuffisant) », AUCUN winRatePct rendu. Au-dessus → winRatePct + N + provenance.
 * Le N et la provenance (backtest/réel) sont visibles dans LES DEUX branches (D-12) :
 * un track record mesuré, jamais inventé. Jamais un % nu hors `applyThreshold`.
 *
 * Couleur neutre (`text-foreground`/`text-muted-foreground`) : la confiance n'est
 * jamais encodée en vert (D-12). Les chiffres sont en `font-mono` dans un `<bdi>`
 * (anti-inversion RTL). Composé via Card (data-slot par sous-élément, precedent
 * ui/card.tsx).
 *
 * Les libellés traduits sont fournis par l'appelant (RSC sans `'use client'`).
 */
interface ConfidenceStatLabels {
  /** Titre du bloc (ex. « Taux de réussite mesuré »). */
  title: string
  /** Texte affiché sous le seuil (ex. « Track record en construction »). */
  inConstruction: string
  /** Gabarit du compte d'échantillon, ICU `{n}` (ex. « sur {n} trades »). */
  sampleLabel: string
  /** Libellé provenance backtest. */
  provenanceBacktest: string
  /** Libellé provenance track record réel. */
  provenanceReel: string
}

interface ConfidenceStatProps {
  n: number
  win_rate: number | null
  expectancy?: number | null
  avg_r?: number | null
  provenance: "backtest" | "reel"
  labels: ConfidenceStatLabels
  className?: string
}

export function ConfidenceStat({
  n,
  win_rate,
  expectancy = null,
  avg_r = null,
  provenance,
  labels,
  className,
}: ConfidenceStatProps) {
  const result = applyThreshold({ n, win_rate, expectancy, avg_r })
  const provenanceLabel =
    provenance === "backtest" ? labels.provenanceBacktest : labels.provenanceReel
  const sampleText = labels.sampleLabel.replace("{n}", String(result.n))

  return (
    <Card data-slot="confidence-stat" className={cn("text-start", className)}>
      <CardHeader>
        <CardTitle>{labels.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {result.sufficient ? (
          <span className="font-mono text-3xl font-semibold tabular-nums text-foreground">
            <bdi>{result.winRatePct}%</bdi>
          </span>
        ) : (
          <span className="text-base font-medium text-foreground">{labels.inConstruction}</span>
        )}
        <span className="font-mono text-sm tabular-nums text-muted-foreground">
          <bdi>{sampleText}</bdi>
        </span>
        <Badge variant="outline" className="w-fit">
          {provenanceLabel}
        </Badge>
      </CardContent>
    </Card>
  )
}
