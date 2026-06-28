/**
 * (admin)/file — file de validation des paiements ambigus (ADMIN-02, D-06/D-07/D-08/D-15).
 *
 * RSC, mono-FR, HORS [locale]. Layout (admin) → requireRole('superadmin') (404 non-superadmin).
 * Lecture ANON-CLIENT (threat T-20-03) : la policy 0021 `payments`/`profiles` superadmin
 * débloque la jointure email sous RLS ; un non-superadmin lit 0 ligne. Les sous-paiements
 * (D-06) et sur-paiements (D-07) atterrissent en status='ambiguous' et apparaissent ici
 * (badge amber « À valider »).
 *
 * Pagination keyset (D-05, calque membres) : tri `(created_at desc, id desc)`,
 * curseur opaque sanitizé (ISO+UUID) AVANT interpolation `.or()` (PostgREST ne paramètre
 * pas `.or()`), « Charger la page suivante » — jamais de numéros de page, DOM borné.
 *
 * Colonnes : membre · montant attendu / reçu (both <bdi>, formatAtomic) · hash TronScan
 * (target=_blank rel="noopener noreferrer" — anti reverse-tabnabbing, T-04-EXTLINK) · capture.
 * Actions (D-08) : activer / rejeter+motif requis / ajuster — via QueueRowActions (gated).
 */
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
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
import { createClient } from '@/lib/supabase/server'
import { decodeCursor, encodeCursor } from '@/lib/keyset/cursor'
import { QueueRowActions } from '@/components/admin/QueueRowActions'

const TRONSCAN_TX = 'https://tronscan.org/#/transaction/'
const PAGE_SIZE = 50

// Garde-fous de forme (anti-injection T-20-13, miroir lib/admin/queries.ts) : le curseur
// décodé est interpolé dans `.or()` (non paramétré). Un id non-UUID ou un timestamp non-ISO
// pourrait porter une virgule/parenthèse et altérer le filtre → rejet vers première page.
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T[\d:.]+(?:[+-]\d{2}:?\d{2}|Z)?$/
const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

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
  createdAt: string
}

interface QueueResult {
  rows: QueueRow[]
  nextCursor: string | null
  error: string | null
}

async function loadQueue(rawCursor: string | undefined): Promise<QueueResult> {
  const client = await createClient()

  let query = client
    .from('payments')
    .select(
      'id, user_id, plan, expected_amount_atomic, amount_atomic, tx_hash, screenshot_url, created_at, profiles!inner(email)',
    )
    .eq('status', 'ambiguous')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(PAGE_SIZE + 1)

  // Curseur sanitizé AVANT le `.or()` : forme suspecte → première page (jamais throw).
  const decoded = decodeCursor(rawCursor)
  const cursor =
    decoded && ISO_TIMESTAMP.test(decoded.createdAt) && UUID.test(decoded.id) ? decoded : null
  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    )
  }

  const { data, error } = await query
  if (error) return { rows: [], nextCursor: null, error: error.message }

  const all = (data ?? []).map((p) => {
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
      createdAt: p.created_at,
    } satisfies QueueRow
  })

  const hasNext = all.length > PAGE_SIZE
  const rows = hasNext ? all.slice(0, PAGE_SIZE) : all
  const last = rows[rows.length - 1]
  const nextCursor =
    hasNext && last ? encodeCursor({ createdAt: last.createdAt, id: last.paymentId }) : null

  return { rows, nextCursor, error: null }
}

export default async function AdminQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>
}) {
  const t = await getTranslations('admin')
  const tPay = await getTranslations('payment')
  const unit = tPay('amountUnit') // « USDT » — autonyme via le système de messages
  const { cursor } = await searchParams
  const { rows, nextCursor, error } = await loadQueue(cursor)

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold">{t('queueTitle')}</h1>

      <div className="mt-6 w-full overflow-x-auto">
        {error ? (
          <div className="rounded-lg border border-dashed p-10 text-center">
            <p className="font-medium">{t('members.errorHeading')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t('members.errorBody')}</p>
          </div>
        ) : rows.length === 0 ? (
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
                  <TableCell className="py-2 font-medium">
                    <bdi>{r.email}</bdi>
                  </TableCell>
                  <TableCell className="py-2">
                    <bdi>{`${formatAtomic(BigInt(r.expectedAmountAtomic))} ${unit}`}</bdi>
                  </TableCell>
                  <TableCell className="py-2">
                    {r.receivedAmountAtomic !== null ? (
                      <bdi>{`${formatAtomic(BigInt(r.receivedAmountAtomic))} ${unit}`}</bdi>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="py-2">
                    <a
                      href={`${TRONSCAN_TX}${r.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline underline-offset-2"
                    >
                      <bdi>{t('queue.viewOnTronscan')}</bdi>
                    </a>
                  </TableCell>
                  <TableCell className="py-2">
                    <Badge className="border-[--risk-moderate]/30 bg-[--risk-moderate]/10 text-[--risk-moderate]">
                      {t('queue.badgeToValidate')}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2 text-right">
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

      {/* Pagination keyset (D-05) : « Charger la page suivante » seulement. */}
      {nextCursor && (
        <div className="mt-6 flex justify-center">
          <Link
            href={`?cursor=${encodeURIComponent(nextCursor)}`}
            className="inline-flex h-9 items-center rounded-md border bg-background px-4 text-sm font-medium hover:bg-accent"
          >
            {t('pagination.loadMore')}
          </Link>
        </div>
      )}
    </main>
  )
}
