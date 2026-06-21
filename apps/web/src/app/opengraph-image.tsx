/**
 * app/opengraph-image.tsx — image OG NEXA via next/og (BRAND-03, D-10).
 *
 * Fichier metadata RACINE (RESEARCH Pattern 8), 1200x630 (défaut OG). Compose le
 * mark hexagonal + wordmark NEXA + baseline « Nouvelle Ère · Alliance d'Échange »
 * sur fond ink #0a0e1a, dégradé de marque #03d87f → #63279b (hex exacts autorisés,
 * asset de marque). Ton sobre, AUCUNE promesse de gain, aucun % (T-11-LEGAL).
 * next/og natif next@15. Contenu statique authored (T-11-OG-XSS).
 */
import { ImageResponse } from 'next/og'

export const alt = 'NEXA — Nouvelle Ère · Alliance d\'Échange'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 32,
          background: '#0a0e1a',
        }}
      >
        <svg width="180" height="180" viewBox="0 0 48 48">
          <defs>
            <linearGradient id="og" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#03d87f" />
              <stop offset="1" stopColor="#63279b" />
            </linearGradient>
          </defs>
          <path
            d="M24 2 L42 13 L42 35 L24 46 L6 35 L6 13 Z"
            fill="none"
            stroke="url(#og)"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path d="M16 34 L16 14 L20 14 L28 27 L28 14 L32 14 L32 34 L28 34 L20 21 L20 34 Z" fill="url(#og)" />
        </svg>
        <div
          style={{
            fontSize: 96,
            fontWeight: 700,
            letterSpacing: 24,
            color: '#ffffff',
            display: 'flex',
          }}
        >
          NEXA
        </div>
        <div style={{ fontSize: 36, color: '#9aa4b2', display: 'flex' }}>
          Nouvelle Ère · Alliance d&apos;Échange
        </div>
      </div>
    ),
    { ...size },
  )
}
