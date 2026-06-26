/**
 * AffiliateSummaryCard — carte résumé d'affiliation CONDITIONNELLE (UDASH-05, D-10).
 *
 * RSC server-renderable (pas de 'use client') montée dans l'overview (dash). Rendu
 * conditionnel STRICT : on lit `profiles.role` après getUser() et on retourne `null`
 * si l'utilisateur n'est PAS affilié — on N'UTILISE PAS le gate de rôle redirigeant
 * (il ferait quitter la page à tout membre non affilié, T-19-15) : on conditionne le
 * rendu, on ne redirige jamais.
 *
 * No-PII (T-19-13) : on lit UNIQUEMENT la vue `affiliate_dashboard` (security_invoker,
 * scope auth.uid()) via le client anon (RLS, jamais service_role). La vue ne renvoie que
 * des agrégats — aucune ligne nominative, aucun filleul individuel.
 *
 * Précision montants (T-19-16) : `revenue_total_atomic` arrive en `string` (PostgREST
 * sérialise bigint en string) → affiché via `formatAtomic(BigInt(...))`, JAMAIS coercé
 * en Number (perte de précision > 2^53). Aucune allégation de performance fabriquée :
 * seuls des revenus MESURÉS (D-09).
 */
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatAtomic } from '@app/core'
import { Card, CardContent } from '@/components/ui/card'

export async function AffiliateSummaryCard() {
  const supabase = await createClient()

  // Session serveur (token revalidé). Pas de session → rien à afficher.
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  // Rôle lu après getUser (jamais le JWT, D-V2-05). Non affilié → rendu conditionnel :
  // on retourne null SANS rediriger (gate de rôle redirigeant proscrit ici, T-19-15).
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile || profile.role !== 'affiliate') return null

  // Vue no-PII (agrégats seuls, scope auth.uid() par RLS) — anon-client, jamais service_role.
  const { data, error } = await supabase
    .from('affiliate_dashboard')
    .select('active_referrals, revenue_total_atomic')
    .maybeSingle()
  if (error || !data) return null

  const t = await getTranslations('dash.affiliate')
  const tPay = await getTranslations('payment')
  const unit = tPay('amountUnit') // « USDT »

  const subscribers = data.active_referrals ?? 0
  // formatAtomic(BigInt(...)) — JAMAIS Number (perte de précision > 2^53, T-19-16).
  const revenue = `${formatAtomic(BigInt(data.revenue_total_atomic ?? '0'))} ${unit}`

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-(--card-spacing) text-start">
        <p className="text-sm text-muted-foreground">
          <bdi>{t('summary', { subscribers, revenue })}</bdi>
        </p>
        <Link
          href="/affiliation/dashboard"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {t('link')}
        </Link>
      </CardContent>
    </Card>
  )
}
