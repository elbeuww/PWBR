/**
 * (admin)/affiliation/payouts — vue payout des commissions affiliées (AFF-04, D-15).
 *
 * RSC, mono-FR, HORS [locale]. Layout (admin) → requireRole('superadmin') (404 non-superadmin).
 * Lecture service_role LOCAL (commissions status='due' + email affilié via affiliates→profiles ;
 * AUCUNE policy select front hors superadmin). Le superadmin marque payé (tx_hash + montant + date)
 * via PayoutRowAction (RPC mark_commission_paid atomique, anti double-payout DB).
 *
 * Montants en <bdi> + formatAtomic (BigInt ×10⁶, CR-02). Badge ambre « À payer » (jamais vert/rouge,
 * D-04). Lien tx_hash → TronScan target=_blank rel="noopener noreferrer" (anti reverse-tabnabbing).
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
import { PayoutRowAction } from '@/components/admin/PayoutRowAction'

const TRONSCAN_TX = 'https://tronscan.org/#/transaction/'

interface PayoutRow {
  commissionId: string
  email: string
  period: string
  // bigint Postgres sérialisé en string par PostgREST (CR-02) — converti via BigInt() à l'affichage.
  baseAtomic: string
  amountAtomic: string
  status: 'due' | 'paid'
  txHash: string | null
}

async function loadCommissions(): Promise<PayoutRow[]> {
  const client = createAdminServiceClient()
  const { data, error } = await client
    .from('commissions')
    .select(
      'id, period, base_atomic, amount_atomic, status, affiliates!inner(profiles!inner(email)), payouts(tx_hash)',
    )
    .in('status', ['due', 'paid'])
    .order('status', { ascending: true })
    .order('period', { ascending: true })
  if (error) throw new Error(`loadCommissions: ${error.message}`)

  return (data ?? []).map((c) => {
    const affiliate = c.affiliates as unknown as { profiles: { email: string } }
    const payouts = (c.payouts ?? []) as unknown as Array<{ tx_hash: string }>
    return {
      commissionId: c.id,
      email: affiliate?.profiles?.email ?? '—',
      period: c.period,
      baseAtomic: c.base_atomic,
      amountAtomic: c.amount_atomic,
      status: c.status === 'paid' ? 'paid' : 'due',
      txHash: payouts[0]?.tx_hash ?? null,
    }
  })
}

export default async function AdminPayoutsPage() {
  const t = await getTranslations('admin')
  const tPay = await getTranslations('payment')
  const unit = tPay('amountUnit') // « USDT » — autonyme via le système de messages
  const rows = await loadCommissions()

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold">{t('payouts.title')}</h1>

      <div className="mt-6 w-full overflow-x-auto">
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center">
            <p className="font-medium">{t('payouts.emptyHeading')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t('payouts.emptyBody')}</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('payouts.colAffiliate')}</TableHead>
                <TableHead>{t('payouts.colPeriod')}</TableHead>
                <TableHead>{t('payouts.colBase')}</TableHead>
                <TableHead>{t('payouts.colAmount')}</TableHead>
                <TableHead>{t('payouts.colTxHash')}</TableHead>
                <TableHead>{t('payouts.colStatus')}</TableHead>
                <TableHead className="text-right">{t('payouts.actionPay')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.commissionId}>
                  <TableCell className="font-medium">
                    <bdi>{r.email}</bdi>
                  </TableCell>
                  <TableCell>
                    <bdi>{r.period}</bdi>
                  </TableCell>
                  <TableCell>
                    <bdi>{`${formatAtomic(BigInt(r.baseAtomic))} ${unit}`}</bdi>
                  </TableCell>
                  <TableCell>
                    <bdi>{`${formatAtomic(BigInt(r.amountAtomic))} ${unit}`}</bdi>
                  </TableCell>
                  <TableCell>
                    {r.txHash ? (
                      <a
                        href={`${TRONSCAN_TX}${r.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline underline-offset-2"
                      >
                        <bdi>{t('payouts.viewOnTronscan')}</bdi>
                      </a>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    {r.status === 'paid' ? (
                      <Badge variant="secondary" className="text-muted-foreground">
                        {t('payouts.badgePaid')}
                      </Badge>
                    ) : (
                      <Badge className="border-amber-600/30 bg-amber-500/10 text-amber-700 dark:text-amber-400">
                        {t('payouts.badgeDue')}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.status === 'due' ? (
                      <PayoutRowAction commissionId={r.commissionId} />
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
    </main>
  )
}
