/**
 * /[locale]/affiliation/dashboard — portail affilié no-PII (AFF-02, D-13/D-14).
 * (Relocalisé depuis (affiliate)/dashboard : collisionnait avec le dashboard général
 * /[locale]/dashboard — debug admin-route-unreachable, 2026-06-19.)
 *
 * RSC trilingue (FR/EN/AR + RTL via utilities logiques). `requireRole('affiliate')`
 * en tête (porte UX ; la non-fuite repose sur la RLS, pas le gate).
 *
 * No-PII strict (D-13, T-07-PII) : on lit UNIQUEMENT la vue `affiliate_dashboard`
 * (security_invoker=true, scope auth.uid()) via `createServerSupabaseClient`
 * (anon/auth-client RSC, RLS isolation — JAMAIS service_role, Pitfall 6 / T-07-RLS-ISO).
 * La vue ne renvoie QUE des compteurs agrégés : aucune ligne individuelle, aucun
 * identifiant personnel, aucune date d'inscription nominative. Pas de table nominative.
 *
 * D-14 (revenus cumul + mois courant) : lecture de `revenue_total_atomic` ET
 * `revenue_current_month_atomic`. Les montants atomiques arrivent en `string`
 * (PostgREST sérialise bigint en string, CR-02) → affichés via `formatAtomic(BigInt(...))`,
 * JAMAIS coercés en Number (perte de précision > 2⁵³, T-07-FLOAT). Tous en `<bdi>`.
 *
 * Palier & progression dérivés du NOMBRE D'INSCRITS via @app/core (TIERS, affiliateRateBps) —
 * source unique alignée bit-à-bit sur le SQL. Aucune classe vert/rouge (D-04).
 */
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { TIERS, affiliateRateBps, formatAtomic } from '@app/core'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { requireRole } from '../../../../lib/auth/gate'
import { Disclaimer } from '@/components/Disclaimer'
import { RevenueTabs } from './RevenueTabs'

/** Formate un montant atomique (string|null) en « X.YY UNIT », sans jamais passer par Number. */
function fmtAtomic(atomic: string | null, unit: string): string {
  return `${formatAtomic(BigInt(atomic ?? '0'))} ${unit}`
}

/** Pourcentage lisible depuis des basis points (800 → « 8 »). Entier pur, pas de float. */
function bpsToPercent(bps: number): string {
  return String(bps / 100)
}

export default async function AffiliateDashboardPage() {
  // Porte UX (affiliate sinon redirect '/'). L'isolation des données reste RLS-scopée.
  await requireRole('affiliate')

  const t = await getTranslations('affiliate')
  const tPay = await getTranslations('payment')
  const unit = tPay('amountUnit') // « USDT »

  // Lecture auth-client RSC (RLS, jamais service_role). La vue est déjà scopée auth.uid().
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('affiliate_dashboard')
    .select(
      'total_signups, active_referrals, revenue_total_atomic, revenue_current_month_atomic, commissions_due_atomic, commissions_paid_atomic',
    )
    .maybeSingle()

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 text-start">
        <h1 className="text-2xl font-semibold">{t('dashboard.title')}</h1>
        <p className="mt-6 text-muted-foreground">{t('dashboard.loadError')}</p>
      </main>
    )
  }

  const signups = data?.total_signups ?? 0
  const activeReferrals = data?.active_referrals ?? 0
  const rateBps = affiliateRateBps(signups)
  const currentTier = TIERS.find((tier) => tier.rateBps === rateBps) ?? null

  // Progression vers le palier suivant : premier palier dont la borne basse > signups.
  const nextTier = TIERS.find((tier) => tier.minSignups > signups) ?? null
  const remaining = nextTier ? nextTier.minSignups - signups : 0
  // Borne basse du palier courant pour la barre (au palier 1, borne = 1).
  const currentMin = currentTier?.minSignups ?? 1
  const span = nextTier ? nextTier.minSignups - currentMin : 1
  const progressValue =
    nextTier && span > 0 ? Math.min(100, Math.max(0, ((signups - currentMin) / span) * 100)) : 100

  // Empty state : aucun inscrit encore (D-13 — agrégats seuls, jamais de ligne filleul).
  if (signups === 0) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 text-start">
        <h1 className="text-2xl font-semibold">{t('dashboard.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('dashboard.subtitle')}</p>
        <div className="mt-8 rounded-lg border border-dashed p-10 text-center">
          <p className="font-semibold">{t('dashboard.emptyHeading')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('dashboard.emptyBody')}</p>
        </div>
        <div className="mt-8 border-t pt-6">
          <Disclaimer />
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 text-start">
      <h1 className="text-2xl font-semibold">{t('dashboard.title')}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t('dashboard.subtitle')}</p>

      {/* Tuiles de métriques (D-14, agrégats seuls — zéro PII filleul) */}
      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* Palier & taux actuel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('dashboard.tierLabel')}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <Badge className="bg-primary/10 text-primary">
              {t('tiers.tierName', { tier: currentTier?.tier ?? 1 })}
            </Badge>
            <span className="text-lg font-semibold">
              <bdi dir="ltr">{bpsToPercent(rateBps)}%</bdi>
            </span>
          </CardContent>
        </Card>

        {/* Inscrits via le code (détermine le taux, D-02) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {t('dashboard.signupsLabel')}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help text-muted-foreground" aria-hidden="true">
                      ⓘ
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{t('dashboard.signupsHint')}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              <bdi dir="ltr">{signups}</bdi>
            </p>
          </CardContent>
        </Card>

        {/* Abonnés actifs ramenés (détermine le montant, distinct des inscrits, D-02) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {t('dashboard.activeReferralsLabel')}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help text-muted-foreground" aria-hidden="true">
                      ⓘ
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{t('dashboard.activeReferralsHint')}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              <bdi dir="ltr">{activeReferrals}</bdi>
            </p>
          </CardContent>
        </Card>

        {/* Revenus générés — cumul / mois courant (D-14) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('dashboard.revenueLabel')}</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueTabs
              totalFormatted={fmtAtomic(data?.revenue_total_atomic ?? null, unit)}
              currentMonthFormatted={fmtAtomic(data?.revenue_current_month_atomic ?? null, unit)}
            />
          </CardContent>
        </Card>

        {/* Commissions dues (ambre — en attente, jamais rouge) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('dashboard.commissionsDueLabel')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-amber-700 dark:text-amber-400">
              <bdi>{fmtAtomic(data?.commissions_due_atomic ?? null, unit)}</bdi>
            </p>
          </CardContent>
        </Card>

        {/* Commissions payées (neutre — état résolu) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('dashboard.commissionsPaidLabel')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-muted-foreground">
              <bdi>{fmtAtomic(data?.commissions_paid_atomic ?? null, unit)}</bdi>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Progression vers le palier suivant */}
      <section className="mt-8">
        <h2 className="text-xl font-semibold">{t('dashboard.progressTitle')}</h2>
        <Card className="mt-3">
          <CardContent className="pt-6">
            {nextTier ? (
              <>
                <Progress
                  value={progressValue}
                  aria-valuenow={Math.round(progressValue)}
                  aria-valuemax={100}
                />
                <p className="mt-3 text-sm text-muted-foreground">
                  {t('dashboard.progressToNext', {
                    remaining,
                    nextTier: nextTier.tier,
                    nextRate: bpsToPercent(nextTier.rateBps),
                  })}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{t('dashboard.maxTierReached')}</p>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Grille des 8 paliers (lecture seule, référence pédagogique) */}
      <section className="mt-8">
        <h2 className="text-xl font-semibold">{t('tiers.gridTitle')}</h2>
        <div className="mt-3 w-full overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('tiers.colTier')}</TableHead>
                <TableHead>{t('tiers.colSignups')}</TableHead>
                <TableHead>{t('tiers.colRate')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {TIERS.map((tier) => {
                const isCurrent = tier.tier === (currentTier?.tier ?? 0)
                return (
                  <TableRow key={tier.tier} className={isCurrent ? 'bg-primary/10' : undefined}>
                    <TableCell className="font-medium">
                      {t('tiers.tierName', { tier: tier.tier })}
                      {isCurrent && (
                        <Badge className="ms-2 bg-primary/10 text-primary">{t('tiers.current')}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <bdi dir="ltr">
                        {tier.maxSignups === null
                          ? `${tier.minSignups}+`
                          : `${tier.minSignups}–${tier.maxSignups}`}
                      </bdi>
                    </TableCell>
                    <TableCell>
                      <bdi dir="ltr">{bpsToPercent(tier.rateBps)}%</bdi>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </section>

      <div className="mt-8 border-t pt-6">
        <Disclaimer />
      </div>
    </main>
  )
}
