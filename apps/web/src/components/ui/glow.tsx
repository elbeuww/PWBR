/**
 * glow.tsx — primitive néon Tier-2 tokenisée (Phase 16, D-06 / D-08).
 *
 * Le glow de la landing (`.nxl .btn-primary`, `.nxl .mark-tile`) généralisé en
 * affordance réutilisable, liée à la SEULE couche token component (`--glow`). Le
 * glow s'exprime TOUJOURS en `box-shadow` — JAMAIS un utilitaire `ring-*` (anti-
 * collision C-3 ; theme-scan Test 3 doit rester vert). Utilisable sur les cartes
 * Tier-2, les boutons primaires et les états de focus de marque.
 *
 * Deux surfaces d'API (D-06, au choix de l'appelant) :
 *   - `glowClass(intensity)` : une CLASSE utilitaire à composer (shadow-* arbitraire).
 *   - `<Glow>` : un wrapper léger qui applique le glow via style inline (box-shadow).
 *
 * Recettes (sourcées de nexa-landing.css) :
 *   - 'soft'   → `0 8px 30px -10px var(--glow)`   (btn-primary, au repos)
 *   - 'strong' → `0 14px 40px -10px var(--glow)`  (btn-primary, hover)
 *   - 'ring'   → `0 0 22px -4px var(--glow)`       (mark-tile, halo serré)
 *
 * Token-only, sans littéral, RTL-safe (box-shadow est neutre au flux). NON câblé ici.
 */
import * as React from 'react'

export type GlowIntensity = 'soft' | 'strong' | 'ring'

/** Recettes box-shadow référençant la SEULE custom prop component `--glow`. */
const GLOW_SHADOW: Record<GlowIntensity, string> = {
  soft: '0 8px 30px -10px var(--glow)',
  strong: '0 14px 40px -10px var(--glow)',
  ring: '0 0 22px -4px var(--glow)',
}

/**
 * Classe utilitaire Tailwind v4 (arbitrary box-shadow) liée à `var(--glow)`.
 * À composer dans un `className`. Espaces encodés `_` (syntaxe arbitraire Tailwind).
 * N'émet JAMAIS un `ring-*` (D-08).
 */
export function glowClass(intensity: GlowIntensity = 'soft'): string {
  const recipe = GLOW_SHADOW[intensity].replace(/\s+/g, '_')
  return `shadow-[${recipe}]`
}

export interface GlowProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Intensité du halo (recette box-shadow tokenisée). Défaut 'soft'. */
  intensity?: GlowIntensity
  /** Élément/markup enveloppé. */
  children?: React.ReactNode
}

/**
 * Wrapper appliquant le glow tokenisé en box-shadow inline (jamais un ring).
 * Le `style` de l'appelant est préservé puis surchargé par le box-shadow du glow.
 */
export function Glow({ intensity = 'soft', style, children, ...rest }: GlowProps) {
  return (
    <div {...rest} style={{ ...style, boxShadow: GLOW_SHADOW[intensity] }}>
      {children}
    </div>
  )
}

export default Glow
