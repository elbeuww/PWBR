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
import { setRequestLocale, getMessages } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { routing } from '../../i18n/routing'
import { LanguageSwitcher } from '../../components/LanguageSwitcher'
import { ThemeProvider } from '../../components/ThemeProvider'
import { ThemeToggle } from '../../components/ThemeToggle'
import { inter, ibmPlexArabic } from '../../lib/fonts'
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

  return (
    <html
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      suppressHydrationWarning
    >
      <body className={`${inter.variable} ${ibmPlexArabic.variable}`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <NextIntlClientProvider messages={messages}>
            <header className="flex h-14 items-center justify-between bg-secondary px-4 md:px-6">
              <span className="font-semibold">Vétéran Trading</span> {/* i18n-ignore: marque */}
              <div className="ms-auto flex items-center gap-2">
                <ThemeToggle />
                <LanguageSwitcher />
              </div>
            </header>
            {children}
            {/* Slot Footer global (<Footer /> avec <Disclaimer />) — arrive au Plan 02-02. */}
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
