import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Eyebrow — surtitre technique NEXA (DESIGN-05).
 *
 * Petite étiquette au-dessus d'un titre, en police accent (Chakra Petch via
 * `font-accent`, token Phase 10), majuscules, interlettrage élargi. Suit le moule
 * cva + data-slot + cn des primitifs (precedent ui/badge.tsx).
 *
 * Couleur : variante `purple` = couche component `var(--accent-brand)` (11-01,
 * flippe clair/sombre) — JAMAIS la primitive `--nexa-purple-*` en dur. Variante
 * `muted` = `text-muted-foreground`. Aucun littéral HEX/OKLCH.
 */
const eyebrowVariants = cva(
  "inline-flex items-center font-accent text-sm font-semibold uppercase tracking-wide",
  {
    variants: {
      tone: {
        purple: "text-[var(--accent-brand)]",
        muted: "text-muted-foreground",
      },
    },
    defaultVariants: {
      tone: "purple",
    },
  },
)

function Eyebrow({
  className,
  tone = "purple",
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof eyebrowVariants>) { // i18n-ignore: annotation de type CVA
  return (
    <span
      data-slot="eyebrow"
      data-tone={tone}
      className={cn(eyebrowVariants({ tone }), className)}
      {...props}
    />
  )
}

export { Eyebrow, eyebrowVariants }
