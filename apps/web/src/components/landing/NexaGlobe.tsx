'use client'

import { useEffect, useRef } from 'react'
import createGlobe from 'cobe'

/**
 * NexaGlobe — vrai globe terrestre (cobe, WebGL ~5KB) pour le hero `.nxl`.
 *
 * Remplace l'ancien globe CSS (texture plate qui glissait). cobe rend une vraie
 * sphère avec projection correcte : les continents se compriment vers les bords
 * en tournant. Couleurs alignées sur le thème GREEN du DS v3.
 *
 * Mouvement réservé au desktop (demande produit « hero qui bouge = PC uniquement »)
 * + respect de prefers-reduced-motion : sur mobile/reduced-motion on rend une seule
 * frame puis on détruit l'instance (globe figé, zéro conso GPU/batterie).
 */
export function NexaGlobe() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const sceneMotion =
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
      window.matchMedia('(min-width: 901px)').matches

    let phi = 0
    let width = 0
    const onResize = () => {
      width = canvas.offsetWidth
    }
    onResize()
    window.addEventListener('resize', onResize)

    const globe = createGlobe(canvas, {
      devicePixelRatio: 2,
      width: width * 2,
      height: width * 2,
      phi: 0,
      theta: 0.3,
      dark: 1,
      diffuse: 1.2,
      mapSamples: 16000,
      mapBrightness: 6,
      baseColor: [0.12, 0.38, 0.24],
      markerColor: [0.5, 1, 0.72],
      glowColor: [0.2, 0.65, 0.42],
      markers: [],
      onRender: (state) => {
        if (sceneMotion) phi += 0.004
        state.phi = phi
        state.width = width * 2
        state.height = width * 2
      },
    })

    // Mobile / reduced-motion : cobe reste monté mais `phi` n'avance pas → globe
    // affiché et totalement statique (zéro mouvement, conforme « hero = PC only »).
    return () => {
      window.removeEventListener('resize', onResize)
      globe.destroy()
    }
  }, [])

  return <canvas ref={canvasRef} className="globe-canvas" aria-hidden />
}
