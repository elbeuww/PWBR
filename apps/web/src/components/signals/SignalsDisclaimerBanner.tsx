/**
 * SignalsDisclaimerBanner — bandeau disclaimer dédié à la surface signaux
 * (Plan 03-02 Task 2 ; D-20, LEGAL-01).
 *
 * RSC (getTranslations). Non-dismissible (obligation légale) — pas d'état, pas de
 * bouton de fermeture. Vient EN PLUS du <Disclaimer> transverse (footer P2).
 * Chaîne via next-intl (signals.disclaimerBanner). Classes logiques (ps/pe).
 */
import { getTranslations } from 'next-intl/server'

export async function SignalsDisclaimerBanner() {
  const t = await getTranslations('signals')

  return (
    <p
      role="note"
      className="mt-4 rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground"
    >
      {t('disclaimerBanner')}
    </p>
  )
}
