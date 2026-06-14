import type { Metadata } from 'next'

/**
 * Root layout — PASS-THROUGH (Pitfall 7).
 *
 * Le seul <html lang dir> vit dans app/[locale]/layout.tsx (locale dynamique +
 * direction RTL). Ce root layout ne rend AUCUN <html>/<body> pour éviter un
 * second élément racine (DOM invalide, dir non appliqué).
 */
export const metadata: Metadata = {
  title: 'Vétéran Trading Platform',
  description: "Plateforme d'analyse de trading — usage personnel",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children
}
