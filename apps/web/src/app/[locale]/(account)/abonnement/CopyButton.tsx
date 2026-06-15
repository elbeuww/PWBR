'use client'

/**
 * CopyButton — copie 1-tap (adresse / montant), action PRIMAIRE sur mobile.
 *
 * Icône Copy → Check au succès (revert ~2 s) + toast sonner. Repli si l'API
 * Clipboard échoue (sélection manuelle, message localisé). Touch target ≥44px.
 */
import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

interface CopyButtonProps {
  value: string
  label: string
  successToast: string
  failToast: string
  /** Mobile : bouton large (action primaire) ; desktop : compact. */
  primary?: boolean
}

export function CopyButton({ value, label, successToast, failToast, primary }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success(successToast)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(failToast)
    }
  }

  return (
    <Button
      type="button"
      variant={primary ? 'default' : 'outline'}
      onClick={onCopy}
      aria-label={label}
      className="min-h-11 min-w-11 gap-2"
    >
      {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      <span>{label}</span>
    </Button>
  )
}
