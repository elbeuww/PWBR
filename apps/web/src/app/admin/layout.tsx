/**
 * admin/layout.tsx — back-office mono-langue (FR), HORS [locale] (D-15).
 *
 * requireRole('superadmin') : un non-superadmin reçoit notFound() (404, discrétion)
 * — l'existence du back-office ne fuit pas (threat T-04-ADMIN-ELEV / T-01-08).
 *
 * RACINE PROPRE (Pitfall 7) : étant hors [locale], ce segment ne partage PAS le
 * <html>/<body> du layout localisé, et le root app/layout.tsx est un pass-through.
 * Il fournit donc SON PROPRE <html lang="fr"><body> + polices + ThemeProvider dark
 * (D-04), sinon Next lève « Missing <html> and <body> tags in the root layout ».
 *
 * Hors [locale] = pas de NextIntlClientProvider localisé : on le fournit ici en FR
 * fixe (admin mono-FR) pour que les composants client (row actions, dialogs) puissent
 * utiliser useTranslations. Toaster monté pour les retours d'action (sonner).
 */
import { NextIntlClientProvider } from 'next-intl'
import { ThemeProvider } from '@/components/ThemeProvider'
import { Toaster } from '@/components/ui/sonner'
import frMessages from '@/messages/fr.json'
import { archivo, spaceGrotesk, jetbrainsMono, chakraPetch, notoArabic } from '@/lib/fonts'
import { requireRole } from '../../lib/auth/gate'
import { AdminSidebar } from './_components/AdminSidebar'
import '../../styles/globals.css'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole('superadmin')
  return (
    <html lang="fr" dir="ltr" suppressHydrationWarning>
      <body
        className={[archivo, spaceGrotesk, jetbrainsMono, chakraPetch, notoArabic]
          .map((f) => f.variable)
          .join(' ')}
      >
        <ThemeProvider attribute="class" forcedTheme="dark">
          <NextIntlClientProvider locale="fr" messages={frMessages}>
            <div className="flex min-h-screen bg-background text-foreground">
              <AdminSidebar />
              {/* pt mobile : la barre ☰ est fixe (h-14) → décale le contenu dessous. */}
              <div className="min-w-0 flex-1 overflow-x-auto pt-14 md:pt-0">{children}</div>
            </div>
            <Toaster />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
