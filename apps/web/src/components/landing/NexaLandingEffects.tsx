'use client'

import { useEffect } from 'react'

/**
 * NexaLandingEffects — port vanilla de landing.js (design borhane) en composant client.
 *
 * Anime la vitrine `.nxl` : data-rain, parallaxe de scène, tilt 3D, reveal au scroll
 * + compteurs + jauge, barre de progression, nav scrolled. Thème GREEN unique figé
 * (plus de toggle/persistance — Phase 16). TOUT est gardé reduced-motion. AUCUNE lib
 * (D-05). Le texte/i18n est
 * rendu côté serveur (next-intl) — ce composant ne touche QUE le comportement.
 */
const RAIN_POOL = [
  '64,820', '3,418', '2,386', '1.0925', '172.40', '78.40', '31.20', '592.0',
  '+2.4%', '−0.3%', '+1.1%', '+4.2%', '−1.2%', '0.78', '92', '64', '84', '+0.6%', '−0.5%',
]

export function NexaLandingEffects() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('.nxl')
    if (!root) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // Le « hero qui bouge » (data-rain, parallaxe de scène, tilt) est réservé au
    // desktop : sur mobile (≤900px) on garde la scène statique. Demande produit.
    const sceneMotion = !reduce && window.matchMedia('(min-width: 901px)').matches
    const cleanups: Array<() => void> = []

    // ── data-rain ──
    if (sceneMotion) {
      const host = root.querySelector<HTMLElement>('#dataRain')
      if (host && !host.childElementCount) {
        const cols = window.innerWidth < 700 ? 5 : 9
        for (let i = 0; i < cols; i++) {
          const col = document.createElement('div')
          col.className = 'data-col'
          col.style.insetInlineStart = (i / cols) * 100 + i * 0.3 + '%'
          const dur = 11 + ((i * 1.7) % 13)
          col.style.animationDuration = dur.toFixed(1) + 's'
          col.style.animationDelay = (-(i * 1.3) % dur).toFixed(1) + 's'
          let html = ''
          for (let j = 0; j < 18; j++) {
            const p = RAIN_POOL[(i * 7 + j * 3) % RAIN_POOL.length]! // modulo guarantees in-bounds
            const cls = p.charAt(0) === '+' ? 'u' : p.charAt(0) === '−' ? 'd' : ''
            html += '<span class="' + cls + '">' + p + '</span>'
          }
          col.innerHTML = html
          host.appendChild(col)
        }
      }
    }

    // ── Progress + nav scrolled + parallaxe ──
    const progress = root.querySelector<HTMLElement>('.nxl-progress')
    const nav = root.querySelector<HTMLElement>('.nx-nav')
    const layers = Array.from(root.querySelectorAll<HTMLElement>('.scene .layer'))
    let mx = 0, my = 0, sy = 0
    const applyLayers = () => {
      layers.forEach((el) => {
        const dp = parseFloat(el.dataset.depth || '1')
        el.style.transform =
          'translate3d(' + (mx * dp * 22).toFixed(1) + 'px,' + (my * dp * 22 + sy * dp * -0.06).toFixed(1) + 'px,0)'
      })
    }
    const onScroll = () => {
      const st = window.scrollY || document.documentElement.scrollTop
      const h = document.documentElement.scrollHeight - window.innerHeight
      if (progress) progress.style.inlineSize = (h > 0 ? (st / h) * 100 : 0) + '%'
      if (nav) nav.classList.toggle('scrolled', st > 20)
      sy = st
      if (sceneMotion) applyLayers()
    }
    if (sceneMotion) {
      const onMove = (e: MouseEvent) => {
        mx = e.clientX / window.innerWidth - 0.5
        my = e.clientY / window.innerHeight - 0.5
        applyLayers()
      }
      window.addEventListener('mousemove', onMove)
      cleanups.push(() => window.removeEventListener('mousemove', onMove))
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    cleanups.push(() => window.removeEventListener('scroll', onScroll))
    onScroll()

    // ── Reveal + compteurs + jauge ──
    const runCount = (el: HTMLElement) => {
      const target = parseFloat(el.dataset.count || '0')
      const suffix = el.dataset.suffix || ''
      if (reduce) { el.textContent = target + suffix; return }
      const dur = 1300
      let t0: number | null = null
      const step = (ts: number) => {
        if (t0 === null) t0 = ts
        const p = Math.min((ts - t0) / dur, 1)
        const eased = 1 - Math.pow(1 - p, 3)
        el.textContent = (target % 1 === 0 ? Math.round(target * eased) : (target * eased).toFixed(1)) + suffix
        if (p < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }
    const fillGauge = (el: HTMLElement) => {
      const v = el.querySelector<SVGCircleElement>('.gv')
      if (!v) return
      const r = parseFloat(v.getAttribute('r') || '0')
      const c = 2 * Math.PI * r
      const score = parseFloat(el.dataset.score || '0')
      v.style.strokeDasharray = '0 ' + c.toFixed(2)
      requestAnimationFrame(() => {
        setTimeout(() => { v.style.strokeDasharray = ((score / 100) * c).toFixed(2) + ' ' + c.toFixed(2) }, 120)
      })
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          const tgt = en.target as HTMLElement
          tgt.classList.add('in')
          if (tgt.hasAttribute('data-count')) runCount(tgt)
          if (tgt.classList.contains('gauge-big')) fillGauge(tgt)
          io.unobserve(tgt)
        }
      })
    }, { threshold: 0.18 })
    root.querySelectorAll<HTMLElement>('.reveal, [data-count], .gauge-big').forEach((el) => io.observe(el))
    cleanups.push(() => io.disconnect())

    // ── Tilt 3D ──
    if (sceneMotion) {
      root.querySelectorAll<HTMLElement>('.tilt').forEach((card) => {
        const max = parseFloat(card.dataset.tilt || '8')
        const onMove = (e: MouseEvent) => {
          const r = card.getBoundingClientRect()
          const px = (e.clientX - r.left) / r.width - 0.5
          const py = (e.clientY - r.top) / r.height - 0.5
          card.style.transform =
            'perspective(900px) rotateY(' + (px * max).toFixed(2) + 'deg) rotateX(' + (-py * max).toFixed(2) + 'deg)'
        }
        const onLeave = () => { card.style.transform = 'perspective(900px) rotateY(0) rotateX(0)' }
        card.addEventListener('mousemove', onMove)
        card.addEventListener('mouseleave', onLeave)
        cleanups.push(() => { card.removeEventListener('mousemove', onMove); card.removeEventListener('mouseleave', onLeave) })
      })
    }

    return () => cleanups.forEach((fn) => fn())
  }, [])

  return null
}
