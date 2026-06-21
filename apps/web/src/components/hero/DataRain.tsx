/**
 * DataRain — pluie de données subtile en fond lointain (UI-02, D-03).
 *
 * RSC purement décoratif (`aria-hidden`), `pointer-events: none`, faible opacité,
 * positionné `inset-0` derrière le contenu hero (z-index 0). Le rendu vient d'un
 * `repeating-linear-gradient` consommant `var(--primary)` (token vert de marque)
 * — aucun caractère/glyphe JS (DOM/CPU minimal, D-03).
 *
 * Animation : keyframe `nexa-rain` (background-position) dans `globals.css`,
 * armée seulement sous `@media (prefers-reduced-motion: no-preference)` (D-05).
 * Sous reduced-motion la pluie reste figée à faible opacité (ambiance préservée).
 *
 * Toute la mécanique vit dans la classe `.nexa-datarain` (globals.css) — pas de
 * style inline, propriétés direction-neutres (RTL-safe).
 */
export function DataRain({ className }: { className?: string }) {
  return <div aria-hidden="true" className={`nexa-datarain ${className ?? ""}`} />
}
