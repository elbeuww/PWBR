import { getTranslations } from 'next-intl/server'

import { ScoreRing, type ScoreRisk } from '@/components/nexa/ScoreRing'

/**
 * FloatingCards — cartes flottantes de setups anonymisés (UI-02, D-01).
 *
 * RSC : les données viennent de l'i18n (`hero.cards`, ÉDUCATIVES et anonymisées,
 * jamais de la DB). Chaque carte montre `instrument · direction · score /100 ·
 * niveau de risque` — ZÉRO %, AUCUN chiffre de gain (D-01, BRAND-04). Le score est
 * rendu via `ScoreRing` (couleur = RISQUE, jamais « vert = gagnant », D-12).
 *
 * Les cartes sont positionnées en logique (auto-margins/offsets direction-neutres)
 * pour un effet flottant ; aucune propriété physique (RTL-safe). Les surfaces
 * consomment `bg-card`/`border-border` (tokens component).
 */
type HeroCard = {
  instrument: string
  direction: string
  score: number
  risk: ScoreRisk
  riskLabel: string
}

export async function FloatingCards({
  className,
  ariaLabel,
}: {
  className?: string
  ariaLabel?: string
}) {
  const t = await getTranslations('hero')
  const tScore = await getTranslations('scoreRing')
  const cards = t.raw('cards') as HeroCard[]

  return (
    <ul aria-label={ariaLabel} className={`grid gap-3 ${className ?? ''}`}>
      {cards.map((card, index) => {
        const ariaLabel = tScore('ariaTemplate', {
          score: card.score,
          risk: card.riskLabel,
        })
        return (
          <li
            key={`hero-card-${index}`}
            data-slot="hero-card"
            className="flex items-center gap-3 rounded-xl border border-border bg-card/80 px-4 py-3 shadow-lg backdrop-blur-sm"
            style={{
              // Décalage logique alterné → effet « flottant » sans classe physique.
              marginInlineStart: index % 2 === 0 ? 0 : 'auto',
              marginInlineEnd: index % 2 === 0 ? 'auto' : 0,
              maxInlineSize: '20rem',
            }}
          >
            <ScoreRing
              score={card.score}
              risk={card.risk}
              size={44}
              label={ariaLabel}
            />
            <div className="min-w-0">
              <p className="font-accent text-sm font-semibold tracking-wide text-card-foreground">
                <bdi>{card.instrument}</bdi>
                <span className="text-muted-foreground"> · {card.direction}</span>
              </p>
              <p className="text-xs text-muted-foreground">{card.riskLabel}</p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
