'use client'

/**
 * AutoSubmitSelect — <select> qui soumet son formulaire GET parent au changement.
 *
 * Les filtres du cockpit (membres, file…) sont des `<form method="get">` RSC synchronisés
 * via l'URL. Sans bouton submit ni auto-submit, choisir une valeur ne filtrait pas (il
 * fallait valider via Entrée dans la recherche — UAT 20 Test 5). Ce wrapper appelle
 * `form.requestSubmit()` à chaque changement : comportement naturel d'un dropdown de filtre.
 * Reste non contrôlé (defaultValue) → la soumission GET porte la valeur choisie + les autres
 * champs du form. Le champ recherche conserve son Entrée-pour-soumettre habituel.
 */
import type { ReactNode } from 'react'

interface AutoSubmitSelectProps {
  id: string
  name: string
  defaultValue?: string
  className?: string
  children: ReactNode
}

export function AutoSubmitSelect({ children, ...props }: AutoSubmitSelectProps) {
  return (
    <select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()}>
      {children}
    </select>
  )
}
