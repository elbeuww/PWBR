'use client'

/**
 * HashForm (PAY-02, D-03/D-04) — saisie + soumission du tx_hash.
 *
 * react-hook-form + zod resolver (validation inline). Le submit appelle la server
 * action verifyPayment(payment_id, hash) — chaque soumission est tracée (D-04). Au
 * retour, on bascule le parent vers VerificationPolling (le polling lit ensuite le
 * statut en live, D-02). Le screenshot (D-03) est OPTIONNEL et n'entre JAMAIS dans
 * la vérification automatique.
 */
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslations } from 'next-intl'
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
import { verifyPayment } from './actions'

interface HashFormProps {
  paymentId: string
  /** Notifie le parent que le hash est soumis → bascule vers le polling. */
  onSubmitted: (hash: string) => void
}

// Hash TRON = 64 hex chars. Validation stricte côté client (UX) ; la vérité reste serveur.
const TX_HASH_RE = /^[0-9a-fA-F]{64}$/

export function HashForm({ paymentId, onSubmitted }: HashFormProps) {
  const t = useTranslations('payment')
  const [pending, setPending] = useState(false)

  const schema = z.object({
    hash: z.string().regex(TX_HASH_RE, { message: t('hash.invalid') }),
  })
  type FormValues = z.infer<typeof schema>

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { hash: '' },
  })

  async function onSubmit(values: FormValues) {
    setPending(true)
    const hash = values.hash.trim()
    // On lance la vérification serveur (arme le UNIQUE + lecture réseau) puis on
    // bascule vers le polling, qui reflète l'état final même si la confirmation tarde.
    await verifyPayment(paymentId, hash)
    onSubmitted(hash)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 text-start" noValidate>
        <FormField
          control={form.control}
          name="hash"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('hash.label')}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  inputMode="text"
                  autoComplete="off"
                  spellCheck={false}
                  dir="ltr"
                  placeholder={t('hash.placeholder')}
                  className="min-h-11 font-mono"
                />
              </FormControl>
              <FormDescription>{t('hash.help')}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={pending} className="min-h-11 w-full">
          {pending ? t('submitting') : t('hash.submit')}
        </Button>
      </form>
    </Form>
  )
}
