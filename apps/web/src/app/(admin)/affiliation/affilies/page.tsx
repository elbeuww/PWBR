/**
 * (admin)/affiliation/affilies — vue affiliés + performances (ADMIN-03, part 1).
 *
 * RSC, mono-FR, HORS [locale]. Layout (admin) → garde superadmin (404 non-superadmin) ; aucun
 * pré-gate de rôle dans cette page (pas de mutation). Lecture service_role LOCAL des TABLES DE BASE
 * (affiliates/referrals/commissions) — JAMAIS la vue agrégée par-utilisateur (security_invoker=true +
 * auth.uid()-scoped → VIDE sous service_role, RESEARCH A3 / décision 4). Agrégation par affilié en JS :
 * nb filleuls + commissions dues/payées.
 *
 * Montants en <bdi> + formatAtomic (BigInt ×10⁶, CR-02 : coercion atomique via BigInt uniquement,
 * jamais de conversion vers le type flottant natif sur un montant atomique).
 * Lien header → /admin/affiliation/payouts (le workflow de payout vit dans la page existante, D-09/D-10).
 */
import { getTranslations } from 'next-intl/server'
import { formatAtomic } from '@app/core'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { createAdminServiceClient } from '@/lib/supabase/admin-service'

const PAYOUTS_HREF = '/admin/affiliation/payouts'

interface AffiliatePerfRow {
  affiliateId: string
  email: string
  referralCount: number
  // bigint atomique (string PostgREST) cumulé en BigInt — affiché via formatAtomic, jamais coercé en flottant.
  commissionsDueAtomic: bigint
  commissionsPaidAtomic: bigint
}

async function loadAffiliatePerfs(): Promise<AffiliatePerfRow[]> {
  const client = createAdminServiceClient()
  // Agrégat depuis les TABLES DE BASE (A3) — referrals(count) = compteur PostgREST,
  // commissions(amount_atomic, status) = lignes brutes sommées par statut en JS.
  const { data, error } = await client
    .from('affiliates')
    .select(
      'id, profiles!inner(email), referrals(count), commissions(amount_atomic, status)',
    )
  if (error) throw new Error(`loadAffiliatePerfs: ${error.message}`)

  const rows = (data ?? []).map((a) => {
    const profile = a.profiles as unknown as { email: string }
    const referrals = (a.referrals ?? []) as unknown as Array<{ count: number }>
    const commissions = (a.commissions ?? []) as unknown as Array<{
      amount_atomic: string
      status: string
    }>

    let commissionsDueAtomic = 0n
    let commissionsPaidAtomic = 0n
    for (const c of commissions) {
      const atomic = BigInt(c.amount_atomic)
      if (c.status === 'paid') {
        commissionsPaidAtomic += atomic
      } else {
        commissionsDueAtomic += atomic
      }
    }

    return {
      affiliateId: a.id,
      email: profile?.email ?? '—',
      referralCount: referrals[0]?.count ?? 0,
      commissionsDueAtomic,
      commissionsPaidAtomic,
    }
  })

  // Tri par commissions dues décroissantes (le plus actionnable d'abord).
  rows.sort((x, y) =>
    y.commissionsDueAtomic > x.commissionsDueAtomic
      ? 1
      : y.commissionsDueAtomic < x.commissionsDueAtomic
        ? -1
        : 0,
  )
  return rows
}

export default async function AdminAffiliatesPerfPage() {
  const t = await getTranslations('admin')
  const tPay = await getTranslations('payment')
  const unit = tPay('amountUnit') // « USDT » — autonyme via le système de messages
  const referralFmt = new Intl.NumberFormat('fr-FR')
  const rows = await loadAffiliatePerfs()

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{t('affiliates.title')}</h1>
        <a
          href={PAYOUTS_HREF}
          className="text-sm text-primary underline underline-offset-2"
        >
          {t('affiliates.toPayouts')}
        </a>
      </div>

      <div className="mt-6 w-full overflow-x-auto">
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center">
            <p className="font-medium">{t('affiliates.emptyHeading')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t('affiliates.emptyBody')}</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('affiliates.colEmail')}</TableHead>
                <TableHead className="text-end">{t('affiliates.colReferrals')}</TableHead>
                <TableHead>{t('affiliates.colDue')}</TableHead>
                <TableHead>{t('affiliates.colPaid')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.affiliateId}>
                  <TableCell className="font-medium">
                    <bdi>{r.email}</bdi>
                  </TableCell>
                  <TableCell className="text-end">
                    <bdi>{referralFmt.format(r.referralCount)}</bdi>
                  </TableCell>
                  <TableCell>
                    <bdi>{`${formatAtomic(BigInt(r.commissionsDueAtomic))} ${unit}`}</bdi>
                  </TableCell>
                  <TableCell>
                    <bdi>{`${formatAtomic(BigInt(r.commissionsPaidAtomic))} ${unit}`}</bdi>
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
