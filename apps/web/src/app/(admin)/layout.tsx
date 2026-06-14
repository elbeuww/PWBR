/**
 * (admin)/layout.tsx — back-office mono-langue, HORS [locale] (D-09).
 *
 * requireRole('superadmin') : un non-superadmin reçoit notFound() (404, discrétion)
 * — l'existence du back-office ne fuit pas (threat T-01-08).
 */
import { requireRole } from '../../lib/auth/gate'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole('superadmin')
  return <>{children}</>
}
