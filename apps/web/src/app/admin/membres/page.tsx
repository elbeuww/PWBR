/**
 * (admin)/membres — table utilisateurs du cockpit superadmin (ADASH-04, D-13/D-14).
 *
 * RSC, mono-FR, HORS [locale]. Le layout (admin) applique déjà requireRole('superadmin')
 * → 404 pour non-superadmin (T-04-ADMIN-ELEV) : AUCUN guard inline dupliqué ici.
 *
 * Lecture ANON-CLIENT uniquement (threat T-20-03) : la requête est DÉLÉGUÉE à
 * `fetchAdminUsers` (plan 20-03) — pagination keyset + filtres SERVEUR (état d'abonnement,
 * source, recherche email), jamais de filtre en mémoire JS. La policy 0021 `profiles`
 * (superadmin voit tout) débloque la lecture sous RLS ; un non-superadmin lit 0 ligne.
 * Aucune réimplémentation de requête de table inline ici.
 *
 * Colonnes : email · source · statut d'abonnement · plan · expiration · actions.
 * Filtres (D-14) synchronisés via l'URL (GET form → searchParams). Pagination keyset
 * « Charger la page suivante » (D-05, jamais de numéros de page). Mutations par ligne via
 * <MemberRowActions> (Server Actions gated, plan 20-04). DOM borné ~50 lignes.
 */
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
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
import {
  fetchAdminUsers,
  type AdminUserRow,
  type AdminUserSubscription,
} from '@/lib/admin/queries'
import {
  parseAdminUsersParams,
  serializeAdminUsersParams,
} from '@/lib/admin/searchParams'
import { MemberRowActions } from '@/components/admin/MemberRowActions'

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(iso))
}

/** Abonnement le plus pertinent à afficher : actif en priorité, sinon le premier. */
function pickSubscription(subs: AdminUserSubscription[]): AdminUserSubscription | null {
  if (subs.length === 0) return null
  return subs.find((s) => s.status === 'active') ?? subs[0] ?? null
}

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const t = await getTranslations('admin')

  // Filtres + curseur lus de l'URL via le schéma whitelisté (20-01) — anti-injection,
  // jamais de valeur brute. Le curseur est revalidé par sanitizeCursor côté requête.
  const params = parseAdminUsersParams(await searchParams)
  const { rows, nextCursor, error } = await fetchAdminUsers(params)

  const statusLabel: Record<string, string> = {
    active: t('members.statusActive'),
    expired: t('members.statusExpired'),
    none: t('members.statusNone'),
  }
  const sourceLabel: Record<string, string> = {
    demo: t('members.sourceDemo'),
    backtest: t('members.sourceBacktest'),
    live: t('members.sourceLive'),
  }

  // Lien « page suivante » : filtres courants conservés + curseur keyset opaque.
  const nextHref = nextCursor
    ? `?${serializeAdminUsersParams({ ...params, cursor: nextCursor }).toString()}`
    : null

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold">{t('membersTitle')}</h1>

      {/* Filtres serveur (D-14) — GET form synchronisé via l'URL. Soumettre RÉINITIALISE
          le curseur (non rejoué en champ caché) → retour à la première page. */}
      <form className="mt-6 flex flex-wrap items-end gap-3" method="get">
        <div className="grid gap-1.5">
          <label htmlFor="status" className="text-sm text-muted-foreground">
            {t('members.filterStatus')}
          </label>
          <select
            id="status"
            name="status"
            defaultValue={params.status ?? ''}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">{t('members.filterStatusAll')}</option>
            <option value="active">{t('members.filterStatusActive')}</option>
            <option value="expired">{t('members.filterStatusExpired')}</option>
            <option value="none">{t('members.filterStatusNone')}</option>
          </select>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="source" className="text-sm text-muted-foreground">
            {t('members.filterSource')}
          </label>
          <select
            id="source"
            name="source"
            defaultValue={params.source ?? ''}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">{t('members.filterSourceAll')}</option>
            <option value="demo">{t('members.sourceDemo')}</option>
            <option value="backtest">{t('members.sourceBacktest')}</option>
            <option value="live">{t('members.sourceLive')}</option>
          </select>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="q" className="text-sm text-muted-foreground">
            {t('members.colEmail')}
          </label>
          <Input
            id="q"
            name="q"
            type="search"
            defaultValue={params.q ?? ''}
            placeholder={t('members.searchEmail')}
            className="w-64"
          />
        </div>
      </form>

      <div className="mt-6 w-full overflow-x-auto">
        {error ? (
          <div className="rounded-lg border border-dashed p-10 text-center">
            <p className="font-medium">{t('members.errorHeading')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t('members.errorBody')}</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center">
            <p className="font-medium">{t('members.emptyHeading')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t('members.emptyBody')}</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('members.colEmail')}</TableHead>
                <TableHead>{t('members.colSource')}</TableHead>
                <TableHead>{t('members.colStatus')}</TableHead>
                <TableHead>{t('members.colPlan')}</TableHead>
                <TableHead>{t('members.colExpiry')}</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((m: AdminUserRow) => {
                const sub = pickSubscription(m.subscriptions)
                const statusKey = sub ? sub.status : 'none'
                return (
                  <TableRow key={m.id}>
                    <TableCell className="py-2 font-medium">
                      <bdi>{m.email}</bdi>
                    </TableCell>
                    <TableCell className="py-2">
                      <bdi>{sourceLabel[m.source] ?? m.source}</bdi>
                    </TableCell>
                    <TableCell className="py-2">
                      <Badge variant={statusKey === 'active' ? 'default' : 'outline'}>
                        {statusLabel[statusKey] ?? statusKey}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2">
                      {sub
                        ? sub.plan === 'standard'
                          ? t('members.planStandard')
                          : t('members.planDiscovery')
                        : '—'}
                    </TableCell>
                    <TableCell className="py-2">{fmtDate(sub?.current_period_end ?? null)}</TableCell>
                    <TableCell className="py-2">
                      <MemberRowActions userId={m.id} suspended={m.suspended} />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination keyset (D-05) : « Charger la page suivante » seulement, jamais de
          numéros de page. Désactivée quand il n'y a pas de page suivante. */}
      {nextHref && (
        <div className="mt-6 flex justify-center">
          <Link
            href={nextHref}
            className="inline-flex h-9 items-center rounded-md border bg-background px-4 text-sm font-medium hover:bg-accent"
          >
            {t('pagination.loadMore')}
          </Link>
        </div>
      )}
    </main>
  )
}
