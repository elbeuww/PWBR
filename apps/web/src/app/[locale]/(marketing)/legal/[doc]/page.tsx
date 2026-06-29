/**
 * /[locale]/legal/[doc] — pages légales placeholder (LEGAL-01, D-14/D-15).
 *
 * Sécurité (threat T-02-04, param arbitraire / énumération) : le segment dynamique
 * `[doc]` est borné par une ALLOWLIST stricte (DOCS) ; tout slug hors allowlist →
 * notFound() AVANT tout rendu (input validation V5). generateStaticParams limite le
 * SSG aux 4 docs autorisés.
 *
 * D-15 : AUCUN texte légal faisant foi n'est rédigé ici — uniquement le titre du doc
 * + le placeholder « en cours de revue juridique ». Aucun rendu HTML brut injecté
 * (threat T-02-07 XSS). Texte = clés i18n du namespace `legal` (parité fr/en/ar).
 *
 * Source : 02-PATTERNS.md §legal/[doc]/page.tsx ; 02-RESEARCH §Security V5.
 */
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'

const DOCS = ['cgu', 'risques', 'confidentialite', 'mentions'] as const

export function generateStaticParams() {
  return DOCS.map((doc) => ({ doc }))
}

export default async function LegalPage({
  params,
}: {
  params: Promise<{ locale: string; doc: string }>
}) {
  const { locale, doc } = await params
  if (!DOCS.includes(doc as (typeof DOCS)[number])) {
    notFound()
  }
  setRequestLocale(locale)
  const t = await getTranslations('legal')

  return (
    <main className="mx-auto max-w-prose px-4 py-12 text-start">
      <h1 className="text-2xl font-semibold">{t(`${doc}.title`)}</h1>
      {/* Filet d'accent néon vitrine Tier 1 (couche token --primary, pas de littéral). */}
      <div className="mt-3 h-px w-16 bg-primary/60" aria-hidden />
      <p className="mt-6 text-muted-foreground">{t('reviewPending')}</p>
    </main>
  )
}
