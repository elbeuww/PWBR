/**
 * app/apple-icon.tsx — apple touch icon NEXA via next/og (BRAND-03, D-09).
 *
 * Fichier metadata RACINE (RESEARCH Pattern 8), 180x180 (défaut Apple). Même mark
 * hexagonal que le favicon, fond ink #0a0e1a, dégradé de marque #03d87f → #63279b.
 * next/og natif next@15. Asset statique authored (T-11-OG-XSS).
 */
import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0e1a',
        }}
      >
        <svg width="150" height="150" viewBox="0 0 48 48">
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#03d87f" />
              <stop offset="1" stopColor="#63279b" />
            </linearGradient>
          </defs>
          <path
            d="M24 2 L42 13 L42 35 L24 46 L6 35 L6 13 Z"
            fill="none"
            stroke="url(#g)"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path d="M16 34 L16 14 L20 14 L28 27 L28 14 L32 14 L32 34 L28 34 L20 21 L20 34 Z" fill="url(#g)" />
        </svg>
      </div>
    ),
    { ...size },
  )
}
