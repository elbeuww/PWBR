import { cn } from "@/lib/utils"

/**
 * Logo — identité de marque NEXA (BRAND-03, D-06/D-07/D-08).
 *
 * SVG inline STATIQUE authored (jamais d'injection HTML brute — XSS, T-11-XSS) :
 * mark emblème hexagonal portant un glyphe « N », rempli par un dégradé
 * `#03d87f` (green) → `#63279b` (purple).
 *
 * Exception sanctionnée au var()-only (RESEARCH Pattern 9 / A2) : ces deux hex
 * sont l'identité chromatique FIXE de la marque, indépendante du thème — c'est le
 * SEUL endroit de l'app où un littéral HEX est autorisé hors de la couche 1 des
 * tokens. Tout le reste consomme `var()`.
 *
 * Le wordmark « NEXA » est rendu en `font-display` (Archivo, Phase 10) bold,
 * majuscules, interlettrage large (D-07). `variant="mark"` = hexagone seul (favicon
 * /footer) ; `variant="full"` = mark + wordmark (header).
 *
 * Chaque instance du dégradé porte un id unique (suffixe `variant`) pour éviter une
 * collision d'`id` si plusieurs `<Logo>` coexistent dans le DOM.
 */
interface LogoProps {
  variant?: "full" | "mark"
  className?: string
}

export function Logo({ variant = "full", className }: LogoProps) {
  const gradientId = `nexa-grad-${variant}`
  const brandName = "NEXA" // i18n-ignore: nom de marque (autonyme)

  const mark = (
    <svg
      viewBox="0 0 48 48"
      role="img"
      aria-label={brandName}
      className="block h-7 w-7 shrink-0"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#03d87f" />
          <stop offset="1" stopColor="#63279b" />
        </linearGradient>
      </defs>
      {/* Emblème hexagonal (D-06). */}
      <path
        d="M24 2 L42 13 L42 35 L24 46 L6 35 L6 13 Z"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* Glyphe « N » plein dans l'emblème. */}
      <path
        d="M16 34 L16 14 L20 14 L28 27 L28 14 L32 14 L32 34 L28 34 L20 21 L20 34 Z"
        fill={`url(#${gradientId})`}
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
