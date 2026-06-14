/**
 * components/Disclaimer.tsx — disclaimer transverse (D-13, LEGAL-01 / VITR-03).
 *
 * Composant RSC minimal et autonome : source UNIQUE de vérité du disclaimer,
 * réutilisé en P3 (espace membre) et P6 (Telegram). Texte = clé i18n `disclaimer.footer`
 * (aucune chaîne en dur, parité fr/en/ar). Classes logiques uniquement (RTL-safe).
 *
 * Source : 02-PATTERNS.md §Disclaimer.tsx ; 02-UI-SPEC §Copywriting (footer permanent).
 */
import { getTranslations } from 'next-intl/server'

export async function Disclaimer() {
  const t = await getTranslations('disclaimer')
  return <p className="text-sm text-muted-foreground ps-4 pe-4">{t('footer')}</p>
}
