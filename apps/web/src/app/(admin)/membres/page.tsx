/**
 * (admin)/membres — vue back-office des membres (ADMIN-01, D-13/D-14/D-15).
 *
 * RSC, mono-FR, HORS [locale]. Le layout (admin) applique déjà requireRole('superadmin')
 * → 404 pour non-superadmin (T-04-ADMIN-ELEV) : AUCUN guard inline dupliqué ici.
 *
 * Lecture via service_role LOCAL (déviation actée Plan 06 : `profiles` n'a pas de policy
 * superadmin → la jointure email échoue sous RLS anon). Sûr : RSC server-only, jamais bundle.
 * Toute MUTATION reste dans membres/actions.ts (service_role + re-guard superadmin).
 *
 * Colonnes (D-14) : email · statut · plan · expiration · dernier paiement.
 * Filtres (D-14) : statut (select) + recherche email — synchronisés via l'URL (searchParams).
 */
import { getTranslations } from 'next-intl/server'
import { formatAtomic } from '@app/core'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { createAdminServiceClient } from '@/lib/supabase/admin-service'
import { MemberRowActions } from '@/components/admin/MemberRowActions'

type EffectiveStatus = 'active' | 'expired' | 'inactive'

interface MemberView {
  userId: string
  email: string
  status: EffectiveStatus
  plan: 'discovery' | 'standard'
  currentPeriodEnd: string | null
  lastPaymentAmountAtomic: number | null
  lastPaymentAt: string | null
  lastPaymentId: string | null
}

/** Statut effectif : active si non-échu, expired si échu, inactive sinon. */
function effectiveStatus(status: string, periodEnd: string | null): EffectiveStatus {
  if (status === 'active' && periodEnd && periodEnd > new Date().toISOString()) return 'active'
  if (status === 'expired' || (status === 'active' && periodEnd && periodEnd <= new Date().toISOString()))
    return 'expired'
  return 'inactive'
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(iso))
}

async function loadMembers(statusFilter: string | null, emailFilter: string | null): Promise<MemberView[]> {
  const client = createAdminServiceClient()

  // Abonnements + email du profil (service_role bypass RLS).
  const { data: subs, error } = await client
    .from('subscriptions')
    .select('user_id, status, plan, current_period_end, profiles!inner(email)')
    .order('current_period_end', { ascending: true, nullsFirst: false })
  if (error) throw new Error(`loadMembers subscriptions: ${error.message}`)

  // Dernier paiement vérifié par user (pour la colonne D-14 + activer/prolonger).
  const userIds = (subs ?? []).map((s) => s.user_id)
  const lastPaymentByUser = new Map<string, { amount: number | null; at: string | null; id: string }>()
  if (userIds.length > 0) {
    const { data: pays, error: payErr } = await client
      .from('payments')
      .select('id, user_id, amount_atomic, expected_amount_atomic, verified_at, created_at, status')
      .in('user_id', userIds)
      .order('created_at', { ascending: false })
    if (payErr) throw new Error(`loadMembers payments: ${payErr.message}`)
    for (const p of pays ?? []) {
      if (lastPaymentByUser.has(p.user_id)) continue // déjà le plus récent (tri desc)
      lastPaymentByUser.set(p.user_id, {
        amount: p.amount_atomic ?? p.expected_amount_atomic ?? null,
        at: p.verified_at ?? p.created_at,
        id: p.id,
      })
    }
  }

  let rows: MemberView[] = (subs ?? []).map((s) => {
    const profile = s.profiles as unknown as { email: string }
    const last = lastPaymentByUser.get(s.user_id)
    return {
      userId: s.user_id,
      email: profile?.email ?? '—',
      status: effectiveStatus(s.status, s.current_period_end),
      plan: s.plan === 'standard' ? 'standard' : 'discovery',
      currentPeriodEnd: s.current_period_end,
      lastPaymentAmountAtomic: last?.amount ?? null,
      lastPaymentAt: last?.at ?? null,
      lastPaymentId: last?.id ?? null,
    }
  })

  if (statusFilter && statusFilter !== 'all') {
    rows = rows.filter((r) => r.status === statusFilter)
  }
  if (emailFilter) {
    const needle = emailFilter.toLowerCase()
    rows = rows.filter((r) => r.email.toLowerCase().includes(needle))
  }
  return rows
}

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; email?: string }>
}) {
  const t = await getTranslations('admin')
  const params = await searchParams
  const statusFilter = params.status ?? 'all'
  const emailFilter = params.email ?? ''
  const members = await loadMembers(statusFilter, emailFilter)

  const statusLabel: Record<EffectiveStatus, string> = {
    active: t('members.statusActive'),
    inactive: t('members.statusInactive'),
    expired: t('members.statusExpired'),
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold">{t('membersTitle')}</h1>

      {/* Filtres (D-14) — GET form synchronisé via l'URL */}
      <form className="mt-6 flex flex-wrap items-end gap-3" method="get">
        <div className="grid gap-1.5">
          <label htmlFor="status" className="text-sm text-muted-foreground">
            {t('members.filterStatus')}
          </label>
          <select
            id="status"
            name="status"
            defaultValue={statusFilter}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="all">{t('members.filterStatus')}</option>
            <option value="active">{t('members.filterStatusActive')}</option>
            <option value="inactive">{t('members.filterStatusInactive')}</option>
            <option value="expired">{t('members.filterStatusExpired')}</option>
          </select>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="email" className="text-sm text-muted-foreground">
            {t('members.colEmail')}
          </label>
          <Input
            id="email"
            name="email"
            type="search"
            defaultValue={emailFilter}
            placeholder={t('members.searchEmail')}
            className="w-64"
          />
        </div>
      </form>

      <div className="mt-6 w-full overflow-x-auto">
        {members.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center">
            <p className="font-medium">{t('members.emptyHeading')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t('members.emptyBody')}</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('members.colEmail')}</TableHead>
                <TableHead>{t('members.colStatus')}</TableHead>
                <TableHead>{t('members.colPlan')}</TableHead>
                <TableHead>{t('members.colExpiry')}</TableHead>
                <TableHead>{t('members.colLastPayment')}</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.userId}>
                  <TableCell className="font-medium">
                    <bdi>{m.email}</bdi>
                  </TableCell>
                  <TableCell>
                    <Badge variant={m.status === 'active' ? 'default' : 'outline'}>
                      {statusLabel[m.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {m.plan === 'standard' ? t('members.planStandard') : t('members.planDiscovery')}
                  </TableCell>
                  <TableCell>{fmtDate(m.currentPeriodEnd)}</TableCell>
                  <TableCell>
                    {m.lastPaymentAmountAtomic !== null ? (
                      <bdi>
                        {formatAtomic(BigInt(m.lastPaymentAmountAtomic))} USDT
                      </bdi>
                    ) : (
                      '—'
                    )}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {fmtDate(m.lastPaymentAt)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <MemberRowActions
                      userId={m.userId}
                      lastPaymentId={m.lastPaymentId}
                      currentPlan={m.plan}
                    />
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
