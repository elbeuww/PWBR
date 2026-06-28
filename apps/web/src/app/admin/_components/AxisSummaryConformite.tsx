/**
 * AxisSummaryConformite — panneau d'axe « Conformité » du cockpit superadmin (Plan
 * 20-05, D-18).
 *
 * RSC server-only : lit le feu LEGAL_REVIEW_DONE via `isLegalReviewDone()` (env,
 * jamais exposé au client) + la version de l'artefact légal en vigueur et sa date de
 * revue. Panneau READ-ONLY (aucune action, aucune mutation) — la synthèse de
 * conformité vit sur le tableau de bord, il n'existe pas de page détail dédiée.
 *
 * Feu (D-08) : revue faite → --signal-bullish (vert) ; revue NON faite / état illisible
 * → --destructive (rouge, défaut sûr). Aucun chiffre fabriqué.
 */
import 'server-only'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { isLegalReviewDone } from '@/lib/legal-gate'

export function AxisSummaryConformite() {
  const done = isLegalReviewDone()
  const version = process.env.LEGAL_REVIEW_VERSION?.trim() || '—'
  const reviewedAt = process.env.LEGAL_REVIEW_DATE?.trim() || '—'

  const dotClass = done ? 'bg-[var(--signal-bullish)]' : 'bg-destructive'
  const statusLabel = done ? 'Revue juridique validée' : 'Revue juridique non validée'

  return (
    <Card>
      <CardHeader>
        <h2 className="text-[28px] font-semibold leading-tight">Conformité</h2>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">Statut de la revue légale</span>
          <span className="flex items-center gap-2 text-xl font-semibold">
            <span className={`size-3 rounded-full ${dotClass}`} aria-hidden />
            <span className="text-base">{statusLabel}</span>
          </span>
        </div>

        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted-foreground">Version de l'artefact</dt>
            <dd className="font-mono tabular-nums">{version}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted-foreground">Date de revue</dt>
            <dd className="font-mono tabular-nums">{reviewedAt}</dd>
          </div>
        </dl>

        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Lecture serveur · source&nbsp;: LEGAL_REVIEW_DONE (env) · panneau en lecture seule.
        </p>
      </CardContent>
    </Card>
  )
}
