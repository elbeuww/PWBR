/**
 * /[locale]/signup — formulaire d'inscription (email + password)
 * Chaînes externalisées via messages `auth` (I18N-03). D-01 : email + mot de passe.
 * Utilities logiques uniquement (text-start) — RTL-aware.
 */
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { Link } from '../../../../i18n/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Eyebrow } from '@/components/nexa/Eyebrow'
import { glowClass } from '@/components/ui/glow'
import { DataRain } from '@/components/ui/data-rain'
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
    <main className="relative mx-auto max-w-sm px-4 py-20 text-start">
      {/* Surface calme (auth) → data-rain ambiant très subtil, reduced-motion gardé. */}
      <DataRain />
      <Eyebrow>{t('eyebrow')}</Eyebrow>
      <h1 className="mt-2 font-display text-2xl font-semibold">{t('signupTitle')}</h1>
      <form action={signUp} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t('emailLabel')}
          <Input type="email" name="email" required autoComplete="email" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t('passwordLabel')}
          <Input
            type="password"
            name="password"
            required
            minLength={6}
            autoComplete="new-password"
          />
        </label>
        {/* Accent Tier 2 discret : glow tokenisé (box-shadow var(--glow)), jamais un ring. */}
        <Button type="submit" className={`mt-2 w-full ${glowClass('soft')}`}>
          {t('signupButton')}
        </Button>
      </form>
      <p className="mt-4 text-sm">
        <Link href="/login" className="text-primary hover:underline">
          {t('loginButton')}
        </Link>
      </p>
    </main>
  )
}
