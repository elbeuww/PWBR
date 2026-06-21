/**
 * app/[locale]/layout.tsx — SEUL <html lang dir> de l'application (Pitfall 7).
 *
 * - Valide la locale (hasLocale) sinon notFound() (frontière d'entrée).
 * - setRequestLocale(locale) : garde le rendu statique (sinon dynamique forcé, Pitfall 3).
 * - <html lang dir> : dir="rtl" en arabe, "ltr" sinon (I18N-02).
 * - Garde anti-flash next-themes posée sur <html> (script pré-paint, no-flash).
 * - ThemeProvider (next-themes, class) autour de NextIntlClientProvider (D-02).
 * - Polices self-hostées exposées en variables CSS sur <body> (D-03, lib/fonts.ts).
 * - Header avec LanguageSwitcher + ThemeToggle ancrés à l'`end` logique (RTL-aware).
 *
 * Source : 01-RESEARCH.md §Pattern 1 ; 02-RESEARCH.md §Pattern 1 ; D-02/D-03/D-10 ; UI-SPEC §Shell
 */
import { NextIntlClientProvider, hasLocale } from 'next-intl'
import { setRequestLocale, getMessages, getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { routing } from '../../i18n/routing'
import { Link } from '../../i18n/navigation'
import { LanguageSwitcher } from '../../components/LanguageSwitcher'
import { ThemeProvider } from '../../components/ThemeProvider'
import { ThemeToggle } from '../../components/ThemeToggle'
import { Footer } from '../../components/Footer'
import { Logo } from '../../components/nexa/Logo'
import { archivo, spaceGrotesk, jetbrainsMono, chakraPetch, notoArabic } from '../../lib/fonts'
import '../../styles/globals.css'

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }
  setRequestLocale(locale)
  const messages = await getMessages()
  // D-08c : entrée funnel permanente vers l'Académie (libellé i18n, nav localisée).
  const tAcademy = await getTranslations('academy')
  // D-15/D-16 : baseline NEXA trilingue rendue au header sous le wordmark.
  const tBaseline = await getTranslations('baseline')

  return (
    <html
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      suppressHydrationWarning
    >
      <body className={[archivo, spaceGrotesk, jetbrainsMono, chakraPetch, notoArabic].map((f) => f.variable).join(' ')}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <NextIntlClientProvider messages={messages}>
            <header className="flex h-14 items-center justify-between bg-secondary px-4 md:px-6">
              {/* D-16 : wordmark NEXA (Logo full) + baseline trilingue (ton sobre vétéran, D-17). */}
              <div className="flex flex-col">
                <Logo variant="full" />
                <span className="text-xs text-muted-foreground tracking-wide">
                  {tBaseline('text')}
                </span>
              </div>
              {/* D-08c : entrée funnel Académie — Link localisé (préserve la locale), libellé i18n. */}
              <Link
                href="/academie"
                className="ms-6 text-sm font-medium text-foreground hover:text-primary"
              >
                {tAcademy('navAcademy')}
              </Link>
              <div className="ms-auto flex items-center gap-2">
                <ThemeToggle />
                <LanguageSwitcher />
              </div>
            </header>
            {children}
            <Footer />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
