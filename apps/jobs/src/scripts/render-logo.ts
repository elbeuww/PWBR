/**
 * render-logo — rasterise le mark NEXA de production (mêmes paths que app/icon.tsx)
 * en un PNG carré 512×512 utilisable comme photo de canal Telegram.
 *
 * Source de vérité : apps/web/src/app/icon.tsx — hexagone + glyphe « N », dégradé de
 * marque #03d87f → #63279b sur fond ink #0a0e1a (D-08/D-10). Rendu via Chromium
 * (@playwright/test déjà présent) → aucun nouveau package, hex exacts garantis.
 *
 * Usage : pnpm --filter jobs exec tsx src/scripts/render-logo.ts
 * Sortie : brand/nexa-logo.png
 */
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const SIZE = 512

// SVG mark : viewBox 48 du logo de prod, centré dans un carré ink avec marge.
const html = `<!doctype html><html><body style="margin:0">
<div style="width:${SIZE}px;height:${SIZE}px;background:#0a0e1a;display:flex;align-items:center;justify-content:center">
  <svg width="360" height="360" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#03d87f"/>
        <stop offset="1" stop-color="#63279b"/>
      </linearGradient>
    </defs>
    <path d="M24 2 L42 13 L42 35 L24 46 L6 35 L6 13 Z" fill="none" stroke="url(#g)" stroke-width="3" stroke-linejoin="round"/>
    <path d="M16 34 L16 14 L20 14 L28 27 L28 14 L32 14 L32 34 L28 34 L20 21 L20 34 Z" fill="url(#g)"/>
  </svg>
</div></body></html>`

async function main(): Promise<void> {
  const out = resolve(process.cwd(), 'brand/nexa-logo.png')
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE } })
    await page.setContent(html, { waitUntil: 'networkidle' })
    await page.screenshot({ path: out, clip: { x: 0, y: 0, width: SIZE, height: SIZE } })
    console.log('✓ Logo NEXA rendu :', out, `(${SIZE}×${SIZE})`)
  } finally {
    await browser.close()
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err)
  console.error('render-logo a échoué :', msg)
  process.exitCode = 1
})
