'use client'

/**
 * PayoutRowAction — marque une commission payée (AFF-04, D-15).
 *
 * « Marquer comme payé » (primary, action positive) → alert-dialog avec saisie OBLIGATOIRE
 * tx_hash + montant + date (D-15, traçabilité on-chain). Confirm désactivé tant qu'un champ
 * est vide. Le montant lisible (USDT) est converti en atomique (BigInt ×10⁶) via toAtomic AVANT
 * l'envoi (CR-02 : jamais Number côté serveur). Mutation via Server Action (service_role/RPC).
 */
import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { toAtomic } from '@app/core'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { payCommission, type PayoutActionResult } from '@/app/admin/affiliation/payouts/actions'

interface PayoutRowActionProps {
  commissionId: string
}

export function PayoutRowAction({ commissionId }: PayoutRowActionProps) {
  const t = useTranslations('admin')
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [txHash, setTxHash] = useState('')
  const [amount, setAmount] = useState('')
  const [paidAt, setPaidAt] = useState('')

  function run(action: () => Promise<PayoutActionResult>, onDone?: () => void) {
    startTransition(async () => {
      const res = await action()
      if (res.ok) {
        toast.success(t('actionSuccess'))
        onDone?.()
      } else {
        toast.error(t('actionError'))
      }
    })
  }

  function submit() {
    let amountAtomic: string
    try {
      // Montant lisible (USDT) → atomique BigInt ×10⁶ (CR-02, zéro float).
      amountAtomic = toAtomic(amount.trim()).toString()
    } catch {
      toast.error(t('actionError'))
      return
    }
    const fd = new FormData()
    fd.set('commission_id', commissionId)
    fd.set('tx_hash', txHash.trim())
    fd.set('amount_atomic', amountAtomic)
    fd.set('paid_at', paidAt)
    run(
      () => payCommission(fd),
      () => {
        setOpen(false)
        setTxHash('')
        setAmount('')
        setPaidAt('')
      },
    )
  }

  const ready = txHash.trim().length > 0 && amount.trim().length > 0 && paidAt.length > 0

  return (
    <>
      <Button size="sm" disabled={isPending} onClick={() => setOpen(true)}>
        {t('payouts.actionPay')}
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('payouts.payDialog.title')}</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor={`txhash-${commissionId}`}>{t('payouts.payDialog.txHashLabel')}</Label>
              <Input
                id={`txhash-${commissionId}`}
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                placeholder={t('payouts.payDialog.txHashPlaceholder')}
                spellCheck={false}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`amount-${commissionId}`}>{t('payouts.payDialog.amountLabel')}</Label>
              <Input
                id={`amount-${commissionId}`}
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={t('payouts.payDialog.amountPlaceholder')}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`paidat-${commissionId}`}>{t('payouts.payDialog.dateLabel')}</Label>
              <Input
                id={`paidat-${commissionId}`}
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>
              {t('payouts.payDialog.cancel')}
            </AlertDialogCancel>
            <Button disabled={isPending || !ready} onClick={submit}>
              {t('payouts.payDialog.confirm')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
