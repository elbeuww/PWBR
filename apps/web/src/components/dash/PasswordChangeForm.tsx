'use client'

/**
 * PasswordChangeForm — changement de mot de passe du compte (UDASH-06, D-11).
 *
 * Client Component : soumission via le client Supabase NAVIGATEUR
 * (`@/lib/supabase/client` = createBrowserSupabaseClient) qui porte la session
 * courante. `supabase.auth.updateUser({ password })` opère sur la session active
 * (token revalidé serveur) — AUCUN user_id n'est reçu ni envoyé (T-19-17 : pas de
 * changement de mot de passe d'un autre compte possible). Aucun client privilégié,
 * aucun service_role ici (frontière navigateur).
 *
 * Validation côté client AVANT l'appel : longueur minimale + égalité des deux saisies.
 * Toutes les chaînes proviennent du namespace `dash.settings.*` (zéro texte en dur,
 * T-19-19). Propriétés logiques uniquement (RTL-safe).
 */
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const MIN_PASSWORD_LENGTH = 8

type ErrorKey = 'passwordTooShort' | 'passwordMismatch' | 'passwordUpdateError'

type Status =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success' }
  | { kind: 'error'; messageKey: ErrorKey }

export function PasswordChangeForm() {
  const t = useTranslations('dash.settings')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (password.length < MIN_PASSWORD_LENGTH) {
      setStatus({ kind: 'error', messageKey: 'passwordTooShort' })
      return
    }
    if (password !== confirm) {
      setStatus({ kind: 'error', messageKey: 'passwordMismatch' })
      return
    }

    setStatus({ kind: 'submitting' })
    const supabase = createClient()
    // Opère sur la session courante (token revalidé), aucun identifiant de compte transmis.
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setStatus({ kind: 'error', messageKey: 'passwordUpdateError' })
      return
    }

    setPassword('')
    setConfirm('')
    setStatus({ kind: 'success' })
  }

  const isSubmitting = status.kind === 'submitting'

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-password">{t('newPassword')}</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={MIN_PASSWORD_LENGTH}
          required
          aria-describedby="new-password-hint"
        />
        <p id="new-password-hint" className="text-xs text-muted-foreground">
          {t('passwordMinHint')}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirm-password">{t('confirmPassword')}</Label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          required
        />
      </div>

      <div aria-live="polite" className="min-h-5 text-sm">
        {status.kind === 'success' && (
          <p className="text-primary">{t('passwordUpdated')}</p>
        )}
        {status.kind === 'error' && (
          <p className="text-destructive">{t(status.messageKey)}</p>
        )}
      </div>

      <Button type="submit" disabled={isSubmitting} className="w-fit">
        {t('changePassword')}
      </Button>
    </form>
  )
}
