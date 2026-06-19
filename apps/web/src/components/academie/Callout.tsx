/**
 * Callout — encadré pédago attention/astuce (D-09, UI-SPEC §Color).
 *
 * RSC (pas de 'use client'). Libellés via getTranslations('academy').
 *
 * PAS de couleur sémantique vert/rouge/ambre (D-04 : réservé au trading). La
 * distinction attention/astuce passe par l'ICÔNE + le LIBELLÉ i18n, jamais par
 * la seule couleur (a11y, threat T-09-A11Y) :
 *  - attention : bg-card border-s-4 border-primary + AlertTriangle text-foreground
 *  - astuce    : bg-card border-s-4 border-border  + Lightbulb text-muted-foreground
 *
 * Filet logique `border-s-4` (RTL-safe), propriétés logiques uniquement.
 */
import { getTranslations } from 'next-intl/server'
import { AlertTriangle, Lightbulb } from 'lucide-react'

interface CalloutProps {
  variant?: 'attention' | 'astuce'
  children: React.ReactNode
}

export async function Callout({ variant = 'attention', children }: CalloutProps) {
  const t = await getTranslations('academy')
  const isAttention = variant === 'attention'

  const borderClass = isAttention ? 'border-primary' : 'border-border'
  const Icon = isAttention ? AlertTriangle : Lightbulb
  const iconClass = isAttention ? 'text-foreground' : 'text-muted-foreground'
  const label = isAttention ? t('calloutAttention') : t('calloutAstuce')

  return (
    <aside className={`my-6 rounded-lg border-s-4 bg-card p-4 ${borderClass}`}>
      <div className="flex items-center gap-2">
        <Icon className={`size-4 shrink-0 ${iconClass}`} aria-hidden="true" />
        <span className="text-sm font-semibold text-foreground">{label}</span>
      </div>
      <div className="mt-2 text-base text-foreground">{children}</div>
    </aside>
  )
}
