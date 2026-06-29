/**
 * /[locale]/dashboard/parametres — écran Paramètres de compte (UDASH-06, D-11/D-12).
 *
 * RSC montée dans le shell (dash) (layout = requireUser : gate déjà posé en amont).
 * Sections (UI-SPEC Settings §132) :
 *   1. Compte       : e-mail affiché (session courante, getUser via requireUser — jamais
 *                     service_role, T-19-18) + <PasswordChangeForm/> (client, updateUser).
 *   2. Langue       : <LanguageSwitcher/> existant (Don't Hand-Roll). PAS de toggle thème
 *                     (forcedTheme dark, D-11).
 *   3. Notifications: <NotificationPreferences/> — préférences UI SEULES, aucune delivery
 *                     (D-12, hors scope ; libellé clair).
 *   4. Abonnement   : lien vers la gestion réhébergée /dashboard/abonnement.
 *   5. Déconnexion  : <form action={signOut}> (action existante (auth)/actions.ts), bouton
 *                     direct réversible (pas de modale, UI-SPEC §116).
 *
 * Toutes les chaînes via `dash.settings.*` / `dash.nav.*`. Propriétés logiques (RTL-safe).
 *
 * NOTE ROUTING (D-19-05-A) : placée sous (dash)/dashboard/parametres (URL /dashboard/parametres)
 * pour matcher la nav DashShell figée en 19-02 et les raccourcis de l'overview (19-04). Le
 * route group (dash) n'ajoute rien à l'URL → (dash)/parametres aurait résolu /parametres (orphelin).
 */
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { requireUser } from '@/lib/auth/gate'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { PasswordChangeForm } from '@/components/dash/PasswordChangeForm'
import { NotificationPreferences } from '@/components/dash/NotificationPreferences'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { signOut } from '../../../(auth)/actions'

interface SettingsPageProps {
  params: Promise<{ locale: string }>
}

export default async function DashSettingsPage({ params }: SettingsPageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dash')

  // Session courante (token revalidé serveur) — e-mail lu sans client privilégié (T-19-18).
  const user = await requireUser()

  return (
    <main className="mx-auto max-w-screen-md px-4 py-8 text-start md:px-6">
      <header className="mb-8">
        <h1 className="font-heading text-2xl font-semibold">{t('nav.parametres')}</h1>
        <div className="mt-2 h-px w-16 bg-primary/60" aria-hidden="true" />
      </header>

      <div className="flex flex-col gap-6">
        {/* 1. Compte */}
        <Card>
          <CardHeader>
            <CardTitle>{t('settings.account')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">{t('settings.email')}</span>
              <bdi className="text-sm text-muted-foreground">{user.email}</bdi>
            </div>
            <PasswordChangeForm />
          </CardContent>
        </Card>

        {/* 2. Langue (pas de toggle thème, D-11) */}
        <Card>
          <CardHeader>
            <CardTitle>{t('settings.language')}</CardTitle>
          </CardHeader>
          <CardContent>
            <LanguageSwitcher />
          </CardContent>
        </Card>

        {/* 3. Notifications — préférences UI seules, aucune delivery (D-12) */}
        <Card>
          <CardHeader>
            <CardTitle>{t('settings.notifications')}</CardTitle>
          </CardHeader>
          <CardContent>
            <NotificationPreferences />
          </CardContent>
        </Card>

        {/* 4. Abonnement — lien gestion réhébergée */}
        <Card>
          <CardHeader>
            <CardTitle>{t('nav.abonnement')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href="/dashboard/abonnement"
              className="inline-flex min-h-11 w-fit items-center rounded-md text-sm font-semibold text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {t('settings.manageSubscription')}
            </Link>
          </CardContent>
        </Card>

        {/* 5. Déconnexion — action réversible, bouton direct (pas de modale, UI-SPEC §116) */}
        <form action={signOut}>
          <Button type="submit" variant="destructive" className="w-fit">
            {t('settings.signOut')}
          </Button>
        </form>
      </div>
    </main>
  )
}
