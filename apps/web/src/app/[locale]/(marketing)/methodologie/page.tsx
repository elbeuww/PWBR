/**
 * /[locale]/methodologie — page méthodologie de mesure (TRACK-03, D-14).
 *
 * Explique en langage vulgarisé COMMENT un trade est compté, sans aucun chiffre
 * inventé (méthode uniquement) : définition TP1-avant-SL (D-01), trade flat valorisé
 * au close (D-02), granularité H1 (D-03), règle de distance sur heure ambiguë (D-04),
 * R moyen vs expectancy (D-10, A2), périodes all-time + 90j (D-11), seuil N≥30 (D-09).
 *
 * Cible du lien « Voir la méthodologie » du TrackRecordBlock. Prose max-w-prose.
 * Disclaimer LEGAL-01 adjacent (D-15). setRequestLocale (SSG) ; getTranslations
 * ('methodology') ; classes logiques uniquement (text-start) ; aucune chaîne en dur.
 *
 * Source : 05-UI-SPEC §MethodologyPage ; §Copywriting Contract methodology.
 */
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { Disclaimer } from '@/components/Disclaimer'

export default async function MethodologyPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('methodology')

  const sections = [
    { title: t('definitionTitle'), body: t('definitionBody') },
    { title: t('flatTitle'), body: t('flatBody') },
    { title: t('granularityTitle'), body: t('granularityBody') },
    { title: t('tieBreakTitle'), body: t('tieBreakBody') },
    { title: t('metricsTitle'), body: t('metricsBody') },
    { title: t('periodsTitle'), body: t('periodsBody') },
    { title: t('thresholdTitle'), body: t('thresholdBody') },
  ]

  return (
    <main className="mx-auto max-w-prose px-4 py-16 text-start md:px-6">
      <h1 className="font-heading text-2xl font-semibold">{t('title')}</h1>
      <p className="mt-4 text-base text-muted-foreground">{t('intro')}</p>

      <div className="mt-10 space-y-8">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="text-base font-semibold">{section.title}</h2>
            <p className="mt-2 text-base text-muted-foreground">{section.body}</p>
          </section>
        ))}
      </div>

      <div className="mt-12 border-t border-border pt-6">
        <Disclaimer />
      </div>
    </main>
  )
}
