/**
 * FallbackBanner — bandeau de repli de traduction (D-14, UI-SPEC §Layout 5).
 *
 * RSC. Rendu en TÊTE de contenu quand `(slug, locale)` manque mais existe en FR : on
 * sert la version FR + ce bandeau, JAMAIS un 404 (content.ts pose `fallback:true`).
 *
 * `Alert` shadcn variant NEUTRE (`default`) — jamais `destructive`/rouge (D-04). Icône
 * lucide `Languages`. Copy `academy.fallbackBanner`. Propriétés logiques uniquement.
 */
import { getTranslations } from 'next-intl/server'
import { Languages } from 'lucide-react'
import { Alert, AlertDescription } from '../ui/alert'

export async function FallbackBanner() {
  const t = await getTranslations('academy')

  return (
    <Alert variant="default" className="mb-8">
      <Languages aria-hidden="true" />
      <AlertDescription>{t('fallbackBanner')}</AlertDescription>
    </Alert>
  )
}
