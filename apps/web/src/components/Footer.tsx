/**
 * components/Footer.tsx — footer global (LEGAL-01, présence transverse).
 *
 * RSC : rend la nav légale localisée (4 docs de l'allowlist via Link i18n) + le
 * <Disclaimer /> transverse. Présent sur TOUTES les pages (greffé dans le shell
 * [locale]/layout.tsx) → disclaimer factuel visible partout, dans les 3 langues.
 *
 * - Liens via @/i18n/navigation (auto-préfixés par locale), JAMAIS next/link.
 * - Toutes les chaînes via getTranslations (namespace `legal`) — zéro chaîne en dur.
 * - RTL-safe (classes logiques ps/pe/ms/me, text-start) ; cible tappable ≥44px
 *   (min-h-11 + padding) + focus-visible (a11y, cohérent avec LanguageSwitcher).
 * - Surface secondaire de marque (bg-muted, token Plan 01). Aucune promesse de
 *   gain ni '%' (VITR-03).
 *
 * Source : 02-PATTERNS.md §Footer.tsx ; 02-UI-SPEC §Color/Spacing.
 */
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { Disclaimer } from '@/components/Disclaimer'
import { Logo } from '@/components/nexa/Logo'

// Allowlist alignée sur legal/[doc]/page.tsx (D-14). Si un doc est ajouté là,
// l'ajouter ici pour qu'il apparaisse dans la nav du footer.
const DOCS = ['cgu', 'risques', 'confidentialite', 'mentions'] as const

export async function Footer() {
  const t = await getTranslations('legal')

  return (
    <footer className="bg-muted px-4 py-8 md:px-6">
      {/* Marque NEXA (mark seul, densité footer — BRAND-01). */}
      <div className="mb-6">
        <Logo variant="full" />
      </div>
      <nav aria-label={t('navTitle')} className="mb-6">
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {DOCS.map((doc) => (
            <li key={doc}>
              <Link
                href={`/legal/${doc}`}
                className="inline-flex min-h-11 items-center rounded-md px-2 py-2 text-muted-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {t(`${doc}.navLabel`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <Disclaimer />
    </footer>
  )
}
