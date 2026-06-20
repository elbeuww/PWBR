'use client'

/**
 * ApplicationForm (AFF-01, surface 1 — UI-SPEC §Surface candidature).
 *
 * react-hook-form + zodResolver (validation inline UX). La vérité reste serveur :
 * submitApplication revalide tout en Zod (≥1 canal, nb abonnés entier ≥0). Le submit
 * passe par la server action service_role (aucun insert client direct — la table n'a
 * pas de policy front, D-08 / Open Q1).
 *
 * Anti double-submit (bouton `disabled` pendant pending). Succès → toast `sonner` +
 * reset + bascule sur un état « candidature reçue ». Échec → toast d'erreur i18n.
 * Aucune classe vert/rouge (D-04 — réservé au trading). CTA primary (accent réservé).
 */
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { submitApplication, type ApplicationErrorCode } from './actions'

interface ApplicationFormProps {
  /** Email de session (candidat connecté) — masque le champ email si présent. */
  sessionEmail: string | null
}

export function ApplicationForm({ sessionEmail }: ApplicationFormProps) {
  const t = useTranslations('affiliate')
  const [pending, setPending] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Schéma client (UX) — miroir du serveur. ≥1 canal d'audience, abonnés entier ≥0.
  const schema = z
    .object({
      email: sessionEmail
        ? z.string().optional()
        : z.string().email({ message: t('application.errors.email') }),
      socialLinks: z.string().trim().max(2000).optional().default(''),
      telegram: z.string().trim().max(500).optional().default(''),
      facebook: z.string().trim().max(500).optional().default(''),
      subscriberCount: z.coerce
        .number({ message: t('application.errors.subscriberCount') })
        .int({ message: t('application.errors.subscriberCount') })
        .min(0, { message: t('application.errors.subscriberCount') }),
      interactions: z.string().trim().max(2000).optional().default(''),
    })
    .refine((v) => (v.socialLinks ?? '') !== '' || (v.telegram ?? '') !== '' || (v.facebook ?? '') !== '', {
      message: t('application.errors.channel'),
      path: ['socialLinks'],
    })
  type FormValues = z.input<typeof schema>

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '',
      socialLinks: '',
      telegram: '',
      facebook: '',
      subscriberCount: 0,
      interactions: '',
    },
  })

  async function onSubmit(values: FormValues) {
    setPending(true)
    const fd = new FormData()
    if (!sessionEmail && values.email) fd.set('email', values.email)
    fd.set('socialLinks', values.socialLinks ?? '')
    fd.set('telegram', values.telegram ?? '')
    fd.set('facebook', values.facebook ?? '')
    fd.set('subscriberCount', String(values.subscriberCount ?? 0))
    fd.set('interactions', values.interactions ?? '')

    const res = await submitApplication(fd)
    setPending(false)

    if (res.ok) {
      toast.success(t('application.success'))
      form.reset()
      setSubmitted(true)
    } else {
      toast.error(t(`application.errors.${res.error}` as `application.errors.${ApplicationErrorCode}`))
    }
  }

  if (submitted) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="font-semibold">{t('application.receivedHeading')}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t('application.receivedBody')}</p>
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 text-start" noValidate>
        {!sessionEmail && (
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('application.emailLabel')}</FormLabel>
                <FormControl>
                  <Input {...field} type="email" autoComplete="email" dir="ltr" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="socialLinks"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('application.socialLinksLabel')}</FormLabel>
              <FormControl>
                <Textarea {...field} rows={2} />
              </FormControl>
              <FormDescription>{t('application.socialLinksHelp')}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="telegram"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('application.telegramLabel')}</FormLabel>
              <FormControl>
                <Input {...field} dir="ltr" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="facebook"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('application.facebookLabel')}</FormLabel>
              <FormControl>
                <Input {...field} dir="ltr" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="subscriberCount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('application.subscriberCountLabel')}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value as number}
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  dir="ltr"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="interactions"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('application.interactionsLabel')}</FormLabel>
              <FormControl>
                <Textarea {...field} rows={3} />
              </FormControl>
              <FormDescription>{t('application.interactionsHelp')}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={pending} className="min-h-11 w-full">
          {pending ? t('application.submitting') : t('application.submit')}
        </Button>
      </form>
    </Form>
  )
}
