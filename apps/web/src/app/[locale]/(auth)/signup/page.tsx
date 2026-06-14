/**
 * /[locale]/signup — formulaire d'inscription (email + password)
 * Chaînes externalisées via messages `auth` (I18N-03). D-01 : email + mot de passe.
 * Utilities logiques uniquement (text-start) — RTL-aware.
 */
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { Link } from '../../../../i18n/navigation'
import { signUp } from '../actions'

export default async function SignupPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('auth')

  return (
    <main className="mx-auto max-w-sm px-4 py-20 text-start">
      <h1 className="text-2xl font-semibold">{t('signupTitle')}</h1>
      <form action={signUp} className="mt-6 flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          {t('emailLabel')}
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            className="rounded-md border border-black/15 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t('passwordLabel')}
          <input
            type="password"
            name="password"
            required
            minLength={6}
            autoComplete="new-password"
            className="rounded-md border border-black/15 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          className="mt-2 rounded-md bg-[#2563EB] px-4 py-2 font-semibold text-white"
        >
          {t('signupButton')}
        </button>
      </form>
      <p className="mt-4 text-sm">
        <Link href="/login">{t('loginButton')}</Link>
      </p>
    </main>
  )
}
