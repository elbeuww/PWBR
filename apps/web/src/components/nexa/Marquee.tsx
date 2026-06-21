import { getTranslations } from "next-intl/server"

import { cn } from "@/lib/utils"

/**
 * Marquee — bande défilante NEXA (DESIGN-05, D-14).
 *
 * RSC : affiche les instruments couverts + sessions de marché (forex/crypto/
 * métaux ; Londres/NY/Tokyo), neutre, ZÉRO %, ZÉRO promesse. Le contenu vient de
 * l'i18n (namespace `marquee`), jamais de texte en dur (I18N-03).
 *
 * Animation : pilotée par CSS (`globals.css`, keyframes `nexa-scroll` /
 * `nexa-scroll-rtl`). La piste est statique par défaut ; le défilement n'est armé
 * que sous `@media (prefers-reduced-motion: no-preference)` (D-05). Le sens est
 * inversé en RTL via `[dir="rtl"]` (DESIGN-04). Les items sont dupliqués
 * `aria-hidden` pour une boucle visuelle sans seam ; l'accessibilité passe par
 * `aria-label` sur le conteneur.
 *
 * Propriétés logiques uniquement (`gap-*` est direction-neutre) — aucune classe
 * utilitaire physique (préfixes margin/padding/inset orientés gauche-droite).
 */
export async function Marquee({ className }: { className?: string }) {
  const t = await getTranslations("marquee")
  // next-intl expose les tableaux via t.raw (pas de format ICU sur une liste).
  const items = t.raw("items") as string[]

  return (
    <div
      className={cn("nexa-marquee overflow-hidden", className)}
      role="marquee"
      aria-label={t("label")}
    >
      <ul className="nexa-marquee-track flex w-max items-center gap-6">
        {items.map((item, index) => (
          <li key={`item-${index}`} className="whitespace-nowrap text-sm text-muted-foreground">
            {item}
          </li>
        ))}
        {/* Clone visuel pour une boucle sans seam — masqué aux lecteurs d'écran. */}
        {items.map((item, index) => (
          <li
            key={`clone-${index}`}
            aria-hidden="true"
            className="whitespace-nowrap text-sm text-muted-foreground"
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}
