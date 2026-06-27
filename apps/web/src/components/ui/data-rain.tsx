'use client'

/**
 * data-rain.tsx — primitive ambiante néon Tier-2 tokenisée (Phase 16, D-06 / D-14).
 *
 * Généralisation LÉGÈRE de la data-rain de la landing (`.nxl .data-rain` / `.data-col`)
 * en primitive ambiante réutilisable. Les colonnes haussières/baissières sont liées à
 * la couche token (`--signal-bullish` / `--signal-bearish`) via `color-mix` — jamais
 * les anciennes vars de la landing ni un littéral hex. Le CSS (keyframes + couleurs)
 * vit dans globals.css sous `.nxl-data-rain` ; ce composant n'injecte que les colonnes.
 *
 * Réduction de mouvement (D-14, double-gardée) :
 *   - L'animation CSS est gardée par `@media (prefers-reduced-motion: no-preference)`
 *     dans globals.css → en reduced-motion la composition reste statique (pas d'anim).
 *   - JS : si reduced-motion, on n'assigne aucune durée d'animation (rien ne bouge),
 *     mais les colonnes sont quand même rendues → la composition est préservée.
 *
 * Surfaces CALMES uniquement (auth, empty states, en-tête vue d'ensemble membre) —
 * JAMAIS au-dessus de données denses. `aria-hidden` (décoratif). NON câblé ici.
 */
import { useEffect, useRef } from 'react'

/** Échantillons numériques décoratifs (signe → couleur haussier/baissier). */
const RAIN_POOL = [
  '64,820', '3,418', '2,386', '1.0925', '172.40', '78.40', '31.20', '592.0',
  '+2.4%', '−0.3%', '+1.1%', '+4.2%', '−1.2%', '0.78', '92', '64', '84', '+0.6%', '−0.5%',
] as const

export interface DataRainProps {
  /** Nombre de colonnes (défaut auto : 5 en < 700px, 9 sinon). */
  columns?: number
  /** Opacité globale du voile (défaut très subtil 0.18 — variante ambiante). */
  opacity?: number
}

export function DataRain({ columns, opacity = 0.18 }: DataRainProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host || host.childElementCount) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const cols = columns ?? (window.innerWidth < 700 ? 5 : 9)

    for (let i = 0; i < cols; i++) {
      const col = document.createElement('div')
      col.className = 'nxl-data-col'
      col.style.insetInlineStart = (i / cols) * 100 + i * 0.3 + '%'
      // Garde JS : aucune durée d'animation en reduced-motion (composition figée, D-14).
      if (!reduce) {
        const dur = 11 + ((i * 1.7) % 13)
        col.style.animationDuration = dur.toFixed(1) + 's'
        col.style.animationDelay = (-(i * 1.3) % dur).toFixed(1) + 's'
      }
      let html = ''
      for (let j = 0; j < 18; j++) {
        const p = RAIN_POOL[(i * 7 + j * 3) % RAIN_POOL.length] as string // modulo guarantees in-bounds
        const cls = p.charAt(0) === '+' ? 'u' : p.charAt(0) === '−' ? 'd' : ''
        html += '<span class="' + cls + '">' + p + '</span>'
      }
      col.innerHTML = html
      host.appendChild(col)
    }

    return () => {
      host.replaceChildren()
    }
  }, [columns])

  return (
    <div
      ref={hostRef}
      className="nxl-data-rain"
      style={{ opacity }}
      aria-hidden="true"
    />
  )
}

export default DataRain
