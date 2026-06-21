/**
 * WireframeGlobe — globe filaire rotatif NEXA (UI-02, D-02/D-05).
 *
 * SVG inline STATIQUE authored (jamais d'injection HTML brute) : méridiens
 * (ellipses verticales) + parallèles (ellipses horizontales) + contour, tracés
 * par un dégradé green→purple consommant la couche component des tokens
 * (`var(--primary)` green de marque, `var(--accent-brand)` purple) — décoratif,
 * donc `var()` autorisé, aucun littéral chromatique.
 *
 * Animation : pilotée par CSS (`globals.css`, keyframe `nexa-globe-spin`). La
 * classe `.nexa-globe` n'est animée que sous
 * `@media (prefers-reduced-motion: no-preference)` (D-05). Sous reduced-motion le
 * globe reste figé mais TOUJOURS rendu (composition préservée). transform-only =
 * composé GPU, pas de reflow.
 *
 * `aria-hidden` : purement décoratif, n'apporte aucune information textuelle.
 */
export function WireframeGlobe({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      aria-hidden="true"
      className={`nexa-globe ${className ?? ""}`}
    >
      <defs>
        <linearGradient id="nexa-globe-grad" x1="0" y1="0" x2="200" y2="200">
          <stop offset="0" stopColor="var(--primary)" />
          <stop offset="1" stopColor="var(--accent-brand)" />
        </linearGradient>
      </defs>
      <g
        fill="none"
        stroke="url(#nexa-globe-grad)"
        strokeWidth="0.8"
        opacity="0.55"
      >
        {/* Contour du globe. */}
        <circle cx="100" cy="100" r="88" />
        {/* Méridiens (ellipses verticales de plus en plus étroites). */}
        <ellipse cx="100" cy="100" rx="88" ry="88" />
        <ellipse cx="100" cy="100" rx="62" ry="88" />
        <ellipse cx="100" cy="100" rx="30" ry="88" />
        <line x1="100" y1="12" x2="100" y2="188" />
        {/* Parallèles (lignes horizontales d'un pôle à l'autre). */}
        <ellipse cx="100" cy="100" rx="88" ry="30" />
        <ellipse cx="100" cy="100" rx="88" ry="62" />
        <line x1="12" y1="100" x2="188" y2="100" />
      </g>
    </svg>
  )
}
