/**
 * Steps — liste d'étapes numérotées (D-09, UI-SPEC §Layout 2).
 *
 * `<ol>` stylé, compteur en `bg-secondary` (pas de couleur sémantique). Propriétés
 * logiques uniquement (gap, ms/me) — RTL-safe. Aucun libellé en dur : le contenu
 * des étapes vient du MDX (children), aucun texte à externaliser ici.
 */

interface StepsProps {
  children: React.ReactNode
}

export function Steps({ children }: StepsProps) {
  return <ol className="my-6 flex list-none flex-col gap-4 ps-0 [counter-reset:step]">{children}</ol>
}

interface StepProps {
  children: React.ReactNode
}

export function Step({ children }: StepProps) {
  return (
    <li className="flex items-start gap-3 [counter-increment:step]">
      <span
        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground tabular-nums before:content-[counter(step)]"
        aria-hidden="true"
      />
      <div className="text-base text-foreground">{children}</div>
    </li>
  )
}
