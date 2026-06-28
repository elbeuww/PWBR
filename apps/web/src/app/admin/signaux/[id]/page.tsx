/**
 * (admin)/signaux/[id] — détail back-office d'un signal, LECTURE SEULE (ADMIN-04, D-05).
 *
 * RSC, mono-FR, HORS [locale]. Le gate superadmin du layout (admin) protège déjà
 * → 404 pour non-superadmin (T-04-ADMIN-ELEV) : AUCUN re-guard inline dupliqué ici.
 *
 * DIVERGENCE CLÉ vs la route membre [locale]/(member)/signaux/[id] (décision résolue 3) :
 * la route membre lit via le client anon + cookies + filtre par statut actif + RLS abonné
 * (anti-IDOR T-03-IDOR) → un setup expiré/invalidé y donne notFound(). L'admin doit voir
 * N'IMPORTE QUEL setup : on lit via le client ANON (createClient) — la policy 0021
 * `trade_setups` superadmin (is_superadmin()) débloque la lecture cross-statut sous RLS
 * SANS filtre par-ligne. Le gate (layout) EST la frontière d'accès (T-08-08, T-20-03).
 *
 * notFound() (404) UNIQUEMENT quand la ligne est réellement absente. Erreur de requête →
 * throw server-side (loggé) ; le client voit l'error boundary Next, jamais le message brut (M-05).
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  )
}

export default async function AdminSignalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const t = await getTranslations('admin')

  const client = await createClient()
  const { data, error } = await client
    .from('trade_setups')
    .select('*, instruments!inner(canonical_symbol)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(`loadSetup: ${error.message}`)
  if (!data) notFound()

  const instrument = (data.instruments as unknown as { canonical_symbol: string })
    ?.canonical_symbol ?? '—'

  const fields: Array<{ label: string; value: string }> = [
    { label: t('signals.detail.instrument'), value: instrument },
    { label: t('signals.detail.direction'), value: data.direction },
    { label: t('signals.detail.status'), value: data.status },
    { label: t('signals.detail.score'), value: String(data.opportunity_score) },
    { label: t('signals.detail.entry'), value: String(data.entry_price) },
    { label: t('signals.detail.stopLoss'), value: String(data.stop_loss) },
    { label: t('signals.detail.riskReward'), value: String(data.risk_reward) },
    { label: t('signals.detail.createdAt'), value: fmtDateTime(data.created_at) },
    { label: t('signals.detail.validUntil'), value: fmtDateTime(data.valid_until) },
  ]

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Link
        href="/admin/signaux"
        className="text-sm text-muted-foreground underline-offset-2 hover:underline"
      >
        {t('signals.detail.back')}
      </Link>

      <h1 className="mt-4 text-2xl font-semibold">
        <bdi>{`${instrument} · ${data.direction}`}</bdi>
      </h1>

      <dl className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.label} className="border-b border-border/60 pb-2">
            <dt className="text-sm text-muted-foreground">{f.label}</dt>
            <dd className="mt-0.5 font-medium">
              <bdi>{f.value}</bdi>
            </dd>
          </div>
        ))}
      </dl>
    </main>
  )
}
