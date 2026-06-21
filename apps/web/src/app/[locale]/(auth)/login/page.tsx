/**
 * /[locale]/login — formulaire de connexion (email + password)
 * Chaînes externalisées via messages `auth` (I18N-03). D-01 : email + mot de passe.
 * Utilities logiques uniquement (text-start, ms/me) — RTL-aware.
 */
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { Link } from '../../../../i18n/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Eyebrow } from '@/components/nexa/Eyebrow'
import { signIn } from '../actions'

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ returnTo?: string }>
}) {
  const { locale } = await params
  const { returnTo } = await searchParams
  setRequestLocale(locale)
  const t = await getTranslations('auth')

  return (
    <main className="mx-auto max-w-sm px-4 py-20 text-start">
      <Eyebrow>{t('eyebrow')}</Eyebrow>
      <h1 className="mt-2 font-display text-2xl font-semibold">{t('loginTitle')}</h1>
      <form action={signIn} className="mt-6 flex flex-col gap-4">
        {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t('emailLabel')}
          <Input type="email" name="email" required autoComplete="email" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t('passwordLabel')}
          <Input type="password" name="password" required autoComplete="current-password" />
        </label>
        <Button type="submit" className="mt-2 w-full">
          {t('loginButton')}
        </Button>
      </form>
      <p className="mt-4 text-sm">
        <Link href="/signup" className="text-[var(--accent-brand)] hover:underline">
          {t('signupButton')}
        </Link>
      </p>
    </main>
  )
}
