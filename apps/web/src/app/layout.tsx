import type { Metadata } from 'next'

/**
 * Root layout — PASS-THROUGH (Pitfall 7).
 *
 * Le seul <html lang dir> vit dans app/[locale]/layout.tsx (locale dynamique +
 * direction RTL). Ce root layout ne rend AUCUN <html>/<body> pour éviter un
 * second élément racine (DOM invalide, dir non appliqué).
 */
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: 'NEXA — Nouvelle Ère · Alliance d\'Échange',
  description: "NEXA : plateforme éducative d'analyse de marché — contenu pédagogique, sans promesse de gain.",
  openGraph: {
    title: 'NEXA — Nouvelle Ère · Alliance d\'Échange',
    description: "NEXA : plateforme éducative d'analyse de marché — contenu pédagogique, sans promesse de gain.",
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children
}
