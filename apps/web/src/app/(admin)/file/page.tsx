/**
 * (admin)/file — file de validation des paiements ambigus (ADMIN-02, D-06/D-07/D-08/D-15).
 *
 * RSC, mono-FR, HORS [locale]. Layout (admin) → requireRole('superadmin') (404 non-superadmin).
 * Lecture service_role LOCAL (cf. admin-service.ts). Les sous-paiements (D-06) et sur-paiements
 * (D-07) atterrissent en status='ambiguous' et apparaissent ici (badge amber « À valider »).
 *
 * Colonnes : membre · montant attendu / reçu (both <bdi>, formatAtomic) · hash TronScan
 * (target=_blank rel="noopener noreferrer" — anti reverse-tabnabbing, T-04-EXTLINK) · capture.
 * Actions (D-08) : activer / rejeter+motif requis / ajuster — via QueueRowActions (service_role).
 */
import { getTranslations } from 'next-intl/server'
import { formatAtomic } from '@app/core'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { createAdminServiceClient } from '@/lib/supabase/admin-service'
import { QueueRowActions } from '@/components/admin/QueueRowActions'

const TRONSCAN_TX = 'https://tronscan.org/#/transaction/'

interface QueueRow {
  paymentId: string
  userId: string
  email: string
  plan: 'discovery' | 'standard'
  // bigint Postgres sérialisé en string par PostgREST (CR-02) — converti via BigInt() à l'affichage.
  expectedAmountAtomic: string
  receivedAmountAtomic: string | null
  txHash: string
  screenshotUrl: string | null
}

async function loadQueue(): Promise<QueueRow[]> {
  const client = createAdminServiceClient()
  const { data, error } = await client
    .from('payments')
    .select(
      'id, user_id, plan, expected_amount_atomic, amount_atomic, tx_hash, screenshot_url, profiles!inner(email)',
    )
    .eq('status', 'ambiguous')
    .order('created_at', { ascending: true })
  if (error) throw new Error(`loadQueue: ${error.message}`)

  return (data ?? []).map((p) => {
    const profile = p.profiles as unknown as { email: string }
    return {
      paymentId: p.id,
      userId: p.user_id,
      email: profile?.email ?? '—',
      plan: p.plan === 'standard' ? 'standard' : 'discovery',
      expectedAmountAtomic: p.expected_amount_atomic,
      receivedAmountAtomic: p.amount_atomic,
      txHash: p.tx_hash,
      screenshotUrl: p.screenshot_url,
    }
  })
}

export default async function AdminQueuePage() {
  const t = await getTranslations('admin')
  const tPay = await getTranslations('payment')
  const unit = tPay('amountUnit') // « USDT » — autonyme via le système de messages
  const rows = await loadQueue()

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold">{t('queueTitle')}</h1>

      <div className="mt-6 w-full overflow-x-auto">
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center">
            <p className="font-medium">{t('queue.emptyHeading')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t('queue.emptyBody')}</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('queue.colMember')}</TableHead>
                <TableHead>{t('queue.colExpected')}</TableHead>
                <TableHead>{t('queue.colReceived')}</TableHead>
                <TableHead>{t('queue.colHash')}</TableHead>
                <TableHead>{t('queue.colStatus')}</TableHead>
                <TableHead className="text-right">{t('queue.colScreenshot')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.paymentId}>
                  <TableCell className="font-medium">
                    <bdi>{r.email}</bdi>
                  </TableCell>
                  <TableCell>
                    <bdi>{`${formatAtomic(BigInt(r.expectedAmountAtomic))} ${unit}`}</bdi>
                  </TableCell>
                  <TableCell>
                    {r.receivedAmountAtomic !== null ? (
                      <bdi>{`${formatAtomic(BigInt(r.receivedAmountAtomic))} ${unit}`}</bdi>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    <a
                      href={`${TRONSCAN_TX}${r.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline underline-offset-2"
                    >
                      <bdi>{t('queue.viewOnTronscan')}</bdi>
                    </a>
                  </TableCell>
                  <TableCell>
                    <Badge className="border-amber-600/30 bg-amber-500/10 text-amber-700 dark:text-amber-400">
                      {t('queue.badgeToValidate')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {r.screenshotUrl ? (
                      <a
                        href={r.screenshotUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline underline-offset-2"
                      >
                        <bdi>{t('queue.colScreenshot')}</bdi>
                      </a>
                    ) : (
                      '—'
                    )}
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
              key={`actions-${r.paymentId}`}
              className="flex items-center justify-between rounded-md border p-3"
            >
              <bdi className="text-sm text-muted-foreground">{r.email}</bdi>
              <QueueRowActions paymentId={r.paymentId} userId={r.userId} plan={r.plan} />
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
