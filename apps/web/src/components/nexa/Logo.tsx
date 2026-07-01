import { cn } from "@/lib/utils"

/**
 * Logo — identité de marque NEXA (BRAND-03, D-06/D-07/D-08).
 *
 * SVG inline STATIQUE authored (jamais d'injection HTML brute — XSS, T-11-XSS) :
 * mark = « N » violet formé de deux traits angulaires, traversé par une flèche
 * verte montante (up-trend) pointant en haut à droite. Reproduction vectorielle
 * du logo officiel NEXA fourni (fichiers Logo/Nexa*.jpeg).
 *
 * Exception sanctionnée au var()-only (RESEARCH Pattern 9 / A2) : les deux hex de
 * marque (#63279b violet, #03d87f green) sont l'identité chromatique FIXE, INDÉPEN-
 * dante du thème — c'est le SEUL endroit de l'app où un littéral HEX est autorisé
 * hors de la couche 1 des tokens. Tout le reste consomme `var()`.
 *
 * Le wordmark « NEXA » est rendu en `font-display` (Archivo, Phase 10) bold,
 * majuscules, interlettrage large (D-07). `variant="mark"` = symbole seul (favicon
 * /footer) ; `variant="full"` = symbole + wordmark (header).
 */
interface LogoProps {
  variant?: "full" | "mark"
  className?: string
}

// Couleurs de marque FIXES (voir note d'exception ci-dessus).
const BRAND_PURPLE = "#63279b"
const BRAND_GREEN = "#03d87f"

export function Logo({ variant = "full", className }: LogoProps) {
  const brandName = "NEXA" // i18n-ignore: nom de marque (autonyme)

  const mark = (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label={brandName}
      className="block h-7 w-7 shrink-0"
    >
      {/* « N » violet — deux montants + diagonale (up-trend). */}
      <path
        d="M11 47 L11 17 L37 47 L37 17"
        fill="none"
        stroke={BRAND_PURPLE}
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Flèche verte montante : hampe traversant le N vers le haut-droit. */}
      <path
        d="M16 43 L46 16"
        fill="none"
        stroke={BRAND_GREEN}
        strokeWidth="6.5"
        strokeLinecap="round"
      />
      {/* Pointe de flèche (deux barbes ouvertes vers le sud-ouest). */}
      <path
        d="M35 18 L46 16 L44 28"
        fill="none"
        stroke={BRAND_GREEN}
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )

  if (variant === "mark") {
    return <span className={cn("inline-flex items-center", className)}>{mark}</span>
  }

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {mark}
      <span className="font-display text-lg font-bold uppercase tracking-[0.2em] text-foreground">
        NEXA
      </span>
    </span>
  )
}
