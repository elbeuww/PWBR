'use client'

import { useEffect, useRef } from 'react'

/**
 * HeroTilt — tilt/parallaxe au pointer, vanilla TS only (UI-02, D-05, Pitfall 2).
 *
 * Île client minimale : le listener `pointermove` écrit dans des CSS custom props
 * (`--tilt-x`/`--tilt-y`), le rendu reste 100% CSS (transform 3D). AUCUNE lib
 * d'animation tierce (moteurs WebGL/3D ou libs de motion interdits, D-05).
 *
 * Double-garde reduced-motion (Pitfall 2) : on teste
 * `matchMedia('(prefers-reduced-motion: reduce)')` AVANT d'attacher le listener.
 * Sous reduced-motion, AUCUN listener n'est posé → la composition reste figée
 * (le transform retombe sur la valeur de repli `0` via `var(--tilt-*, 0deg)`).
 *
 * Le tilt est clampé à ±6deg (mouvement subtil). Cleanup retire le listener.
 */
export function HeroTilt({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Garde reduced-motion AVANT tout addEventListener (Pitfall 2 / D-05).
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      const x = ((e.clientY - r.top) / r.height - 0.5) * -6
      const y = ((e.clientX - r.left) / r.width - 0.5) * 6
      el.style.setProperty('--tilt-x', `${x}deg`)
      el.style.setProperty('--tilt-y', `${y}deg`)
    }
    const onLeave = () => {
      el.style.setProperty('--tilt-x', '0deg')
      el.style.setProperty('--tilt-y', '0deg')
    }

    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerleave', onLeave)
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  return (
    <div
      ref={ref}
      className={className}
      style={{
        transform:
          'perspective(800px) rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg))',
        transition: 'transform 120ms ease-out',
      }}
    >
      {children}
    </div>
  )
}
