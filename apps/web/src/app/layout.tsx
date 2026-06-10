import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Vétéran Trading Platform',
  description: 'Plateforme d\'analyse de trading — usage personnel',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
