/**
 * (admin)/layout.tsx — back-office mono-langue (FR), HORS [locale] (D-15).
 *
 * requireRole('superadmin') : un non-superadmin reçoit notFound() (404, discrétion)
 * — l'existence du back-office ne fuit pas (threat T-04-ADMIN-ELEV / T-01-08).
 *
 * Le groupe est hors [locale] : il ne bénéficie donc PAS du NextIntlClientProvider du
 * layout localisé. On le fournit ici en FR fixe (admin mono-FR) pour que les composants
 * client (row actions, dialogs) puissent utiliser useTranslations. Toaster monté pour
 * les retours d'action (sonner).
 */
import { NextIntlClientProvider } from 'next-intl'
import { Toaster } from '@/components/ui/sonner'
import frMessages from '@/messages/fr.json'
import { requireRole } from '../../lib/auth/gate'
import { AdminSidebar } from './_components/AdminSidebar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole('superadmin')
  return (
    <NextIntlClientProvider locale="fr" messages={frMessages}>
      <div className="flex min-h-screen bg-background text-foreground">
        <AdminSidebar />
        <div className="min-w-0 flex-1 overflow-x-auto">{children}</div>
      </div>
      <Toaster />
    </NextIntlClientProvider>
  )
}
