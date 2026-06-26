/**
 * (admin)/affiliation — file de revue des candidatures affiliées (AFF-01, D-06/D-07/D-08).
 *
 * RSC, mono-FR, HORS [locale]. Layout (admin) → requireRole('superadmin') (404 non-superadmin).
 * Lecture ANON-CLIENT (threat T-20-03) : la policy select superadmin sur affiliate_applications
 * (0016/0017) débloque la lecture sous RLS ; un non-superadmin lit 0 ligne. Affiche status='pending'.
 *
 * Actions (D-08) : approuver (promotion + code vanity, D-07) / rejeter+motif requis — via
 * ApplicationRowActions (service_role re-validé). Badge ambre « En attente » (jamais vert/rouge,
 * D-04). Miroir exact de (admin)/file/page.tsx.
 */
import { getTranslations } from 'next-intl/server'
import { listPendingApplications } from '@app/supabase'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { createClient } from '@/lib/supabase/server'
import { ApplicationRowActions } from '@/components/admin/ApplicationRowActions'

interface QueueRow {
  applicationId: string
  email: string
  socialLinks: string | null
  telegram: string | null
  facebook: string | null
  subscriberCount: number | null
  interactions: string | null
}

async function loadQueue(): Promise<QueueRow[]> {
  const client = await createClient()
  const rows = await listPendingApplications(client)
  return rows.map((a) => ({
    applicationId: a.id,
    email: a.applicant_email,
    socialLinks: a.social_links,
    telegram: a.telegram,
    facebook: a.facebook,
    subscriberCount: a.subscriber_count,
    interactions: a.interactions,
  }))
}

export default async function AdminAffiliationQueuePage() {
  const t = await getTranslations('admin')
  const rows = await loadQueue()

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold">{t('affiliateQueue.title')}</h1>

      <div className="mt-6 w-full overflow-x-auto">
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center">
            <p className="font-medium">{t('affiliateQueue.emptyHeading')}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('affiliateQueue.emptyBody')}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('affiliateQueue.colEmail')}</TableHead>
                <TableHead>{t('affiliateQueue.colSocial')}</TableHead>
                <TableHead>{t('affiliateQueue.colTelegram')}</TableHead>
                <TableHead>{t('affiliateQueue.colFacebook')}</TableHead>
                <TableHead className="text-right">{t('affiliateQueue.colSubscribers')}</TableHead>
                <TableHead>{t('affiliateQueue.colInteractions')}</TableHead>
                <TableHead>{t('affiliateQueue.colStatus')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.applicationId}>
                  <TableCell className="font-medium">
                    <bdi>{r.email}</bdi>
                  </TableCell>
                  <TableCell>
                    <bdi>{r.socialLinks ?? '—'}</bdi>
                  </TableCell>
                  <TableCell>
                    <bdi>{r.telegram ?? '—'}</bdi>
                  </TableCell>
                  <TableCell>
                    <bdi>{r.facebook ?? '—'}</bdi>
                  </TableCell>
                  <TableCell className="text-right">
                    <bdi>{r.subscriberCount ?? '—'}</bdi>
                  </TableCell>
                  <TableCell>
                    <bdi>{r.interactions ?? '—'}</bdi>
                  </TableCell>
                  <TableCell>
                    <Badge className="border-[--risk-moderate]/30 bg-[--risk-moderate]/10 text-[--risk-moderate]">
                      {t('affiliateQueue.badgePending')}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {rows.length > 0 && (
        <div className="mt-4 space-y-3">
          {rows.map((r) => (
            <div
              key={`actions-${r.applicationId}`}
              className="flex items-center justify-between rounded-md border p-3"
            >
              <bdi className="text-sm text-muted-foreground">{r.email}</bdi>
              <ApplicationRowActions applicationId={r.applicationId} applicantEmail={r.email} />
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
