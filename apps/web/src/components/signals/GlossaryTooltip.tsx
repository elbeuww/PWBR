/**
 * GlossaryTooltip — aide additive au jargon (Plan 03-03 Task 2 ; D-10).
 *
 * ADDITIF uniquement : ajoute un affixe « ? » focusable à côté d'un terme, dont
 * la définition vient du namespace i18n `glossary`. Ne REMPLACE jamais le contenu
 * IA faisant foi (D-10). Trigger ≥44px (zone tactile), focusable clavier, dismiss
 * Esc/blur (Radix), tap-to-open mobile (delayDuration=0).
 */
'use client'

import { useTranslations } from 'next-intl'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip'

export interface GlossaryTooltipProps {
  /** Clé du namespace glossary (rsi/macd/bos/atr). */
  term: 'rsi' | 'macd' | 'bos' | 'atr'
  /** Libellé affiché (le terme lui-même, ex. « RSI »). */
  label: string
}

export function GlossaryTooltip({ term, label }: GlossaryTooltipProps) {
  const t = useTranslations('glossary')
  const tLabel = useTranslations('signalDetail')

  return (
    <span className="inline-flex items-center gap-1">
      <span>{label}</span>
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger
            type="button"
            aria-label={tLabel('glossaryLabel')}
            className="inline-flex size-11 items-center justify-center rounded-full text-xs font-bold text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            ?
          </TooltipTrigger>
          <TooltipContent>{t(term)}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </span>
  )
}
