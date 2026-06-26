/**
 * KeysetList — liste paginée par CURSEUR keyset des setups suivis (UDASH-02,
 * Plan 19-07, Task 1 ; D-04/D-05).
 *
 * Server-renderable (pas de 'use client') : la pagination se fait par LIEN URL
 * (`?cursor=<opaque>`), pas par état client ni react-query. AUCUN décalage de
 * page (D-05) → l'index keyset (0020) donne un Index Scan. Le `nextCursor` provient de
 * `fetchFollowedSetups` (19-03) ; il est déjà opaque base64url (URL-safe).
 *
 * Color law (D-03/D-05 P10) : la couleur directionnelle (--signal-*) habille
 * UNIQUEMENT le badge de direction. Le score/risque restent neutres (jamais
 * « vert = gagnant »). En historique, l'issue = `outcome` (TP/SL/neutre) +
 * `realized_r` MESURÉS (jamais un % de gain agrégé fabriqué, D-09/VITR-03).
 *
 * RTL : propriétés logiques uniquement (text-start, ms/me/ps/pe, gap, px/py).
 * Aucune classe physique left/right. Valeurs numériques encadrées <bdi>.
 */
import { useTranslations } from 'next-intl'
import { Link } from '../../i18n/navigation'
import { Card, CardContent } from '../ui/card'
import { Skeleton } from '../ui/skeleton'
import type { FollowedRow } from '../../lib/watchlist/queries'

export type KeysetVariant = 'suivis' | 'historique'

interface KeysetListProps {
  rows: FollowedRow[]
  nextCursor: string | null
  /** Chemin localisé de la surface (ex. `/dashboard/suivis`) — base du lien curseur. */
  basePath: string
  locale: string
  variant: KeysetVariant
}

/** Capitalise la 1re lettre pour reconstruire la clé i18n (riskLow/riskHigh…). */
function capitalize(s: string): string {
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

/** R:R à une décimale, sans encoder de couleur. */
function formatRr(rr: number): string {
  return Number.isFinite(rr) ? rr.toFixed(1) : '—'
}

/** Issue → clé i18n connue (hit_tp/hit_sl/flat) ; inconnue → null (ne rien rendre). */
function issueKey(outcome: string): 'hit_tp' | 'hit_sl' | 'flat' | null {
  return outcome === 'hit_tp' || outcome === 'hit_sl' || outcome === 'flat' ? outcome : null
}

export function KeysetList({ rows, nextCursor, basePath, locale, variant }: KeysetListProps) {
  const t = useTranslations('dash')
  const tSig = useTranslations('signals')

  // État VIDE (jamais suivi) — copy selon la surface (renewal est géré en amont par la page).
  if (rows.length === 0) {
    return (
      <section className="mt-6 rounded-xl bg-[var(--card)] p-8 text-center ring-1 ring-[var(--border)]">
        <h2 className="text-lg font-semibold">{t(`${variant}.emptyTitle`)}</h2>
        <p className="mx-auto mt-2 max-w-prose text-sm text-[var(--muted-foreground)]">
          {t(`${variant}.emptyBody`)}
        </p>
      </section>
    )
  }

  return (
    <div className="mt-6 flex flex-col gap-3 text-start">
      <ul className="flex flex-col gap-3">
        {rows.map((row) => {
          const setup = row.trade_setups
          const isLong = setup.direction === 'long'
          // Token directionnel flip-safe — UNIQUEMENT le badge de direction (D-03/D-05 P10).
          const directionClass = isLong
            ? 'bg-[var(--signal-bullish)]/10 text-[var(--signal-bullish)]'
            : 'bg-[var(--signal-bearish)]/10 text-[var(--signal-bearish)]'
          const issue =
            variant === 'historique' && setup.prediction_outcomes
              ? issueKey(setup.prediction_outcomes.outcome)
              : null
          const realizedR =
            variant === 'historique' && setup.prediction_outcomes
              ? setup.prediction_outcomes.realized_r
              : null

          return (
            <li key={row.id}>
              <Link
                href={`/signaux/${row.setup_id}`}
                className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                aria-label={t('list.viewDetail')}
              >
                <Card className="transition-shadow hover:ring-[var(--foreground)]/20">
                  <CardContent className="flex flex-wrap items-center gap-3 pt-(--card-spacing)">
                    <span className="font-mono text-sm font-semibold">
                      {setup.instruments.symbol}
                    </span>
                    <span
                      className={`inline-flex min-h-6 items-center rounded-4xl px-2 py-0.5 text-xs font-medium ${directionClass}`}
                    >
                      {isLong ? tSig('direction.long') : tSig('direction.short')}
                    </span>
                    <span className="inline-flex min-h-6 items-center rounded-4xl bg-[var(--muted)] px-2 py-0.5 text-xs font-medium text-[var(--muted-foreground)]">
                      {tSig('filters.risk')}: {tSig(`filters.risk${capitalize(setup.risk_level)}`)}
                    </span>
                    <span className="inline-flex min-h-6 items-center rounded-4xl bg-[var(--muted)] px-2 py-0.5 text-xs font-medium text-[var(--muted-foreground)]">
                      R:R <bdi className="font-mono">1:{formatRr(setup.risk_reward)}</bdi>
                    </span>
                    <span className="font-mono text-sm font-medium text-[var(--muted-foreground)]">
                      <bdi>{setup.opportunity_score}</bdi>
                    </span>

                    {/* Historique : issue MESURÉE (outcome + realized_r), jamais un % fabriqué. */}
                    {issue ? (
                      <span className="inline-flex min-h-6 items-center gap-1 rounded-4xl bg-[var(--muted)] px-2 py-0.5 text-xs font-medium text-[var(--foreground)]">
                        {t(`list.issue.${issue}`)}
                        {realizedR !== null ? (
                          <bdi className="font-mono">
                            {realizedR.toFixed(2)} {t('list.rUnit')}
                          </bdi>
                        ) : null}
                      </span>
                    ) : null}

                    <span className="ms-auto text-sm font-semibold text-[var(--primary)]">
                      {t('list.viewDetail')}
                    </span>
                  </CardContent>
                </Card>
              </Link>
            </li>
          )
        })}
      </ul>

      {/* Pagination keyset (D-05) : lien « page suivante » par CURSEUR opaque, jamais de décalage. */}
      {nextCursor ? (
        <Link
          href={`${basePath}?cursor=${nextCursor}`}
          className="inline-flex min-h-11 w-fit items-center rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          {t('list.nextPage')}
        </Link>
      ) : null}

      <span className="sr-only">{locale}</span>
    </div>
  )
}

/**
 * Sous-navigation Suivis ⇄ Historique (D-19-02-A : Historique = sous-vue interne de
 * la surface Suivis, atteinte depuis la surface elle-même, pas depuis le chrome de
 * nav principal). Liens localisés ; l'onglet courant porte aria-current.
 */
export function KeysetTabs({ active }: { active: KeysetVariant }) {
  const t = useTranslations('dash.nav')
  const tabs: ReadonlyArray<{ key: KeysetVariant; href: string; label: string }> = [
    { key: 'suivis', href: '/dashboard/suivis', label: t('suivis') },
    { key: 'historique', href: '/dashboard/historique', label: t('historique') },
  ]
  return (
    <nav className="mt-6 flex gap-2 border-b border-[var(--border)]" aria-label={t('suivis')}>
      {tabs.map((tab) => {
        const isActive = tab.key === active
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={isActive ? 'page' : undefined}
            className={[
              'min-h-11 px-3 py-2 text-sm text-start outline-none',
              'focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
              isActive
                ? 'border-b-2 border-[var(--primary)] font-medium text-[var(--primary)]'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
            ].join(' ')}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}

/** État de CHARGEMENT (D-18/UI-SPEC §135) — squelette de lignes pendant le fetch RSC. */
export function KeysetSkeleton() {
  return (
    <div className="mt-6 flex flex-col gap-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  )
}
