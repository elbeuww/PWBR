'use client'

/**
 * QueueRowActions — actions par ligne de la file de validation (ADMIN-02, D-08).
 *
 * - "Activer le paiement" (primary) → activatePayment (service_role, D-07).
 * - "Rejeter" (destructive) → alert-dialog avec textarea MOTIF requis (confirm désactivé
 *   tant que le motif est vide, T-04-DESTRUCT).
 * - "Ajuster durée / plan" → dialog (changePlan).
 * Toute mutation via Server Actions (service_role).
 */
import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  activatePayment,
  rejectPayment,
  adjustPayment,
  type QueueActionResult,
} from '@/app/admin/file/actions'

interface QueueRowActionsProps {
  paymentId: string
  userId: string
  plan: 'discovery' | 'standard'
}

const PERIODS = ['7 days', '1 month', '3 months'] as const

export function QueueRowActions({ paymentId, userId, plan: initialPlan }: QueueRowActionsProps) {
  const t = useTranslations('admin')
  const [isPending, startTransition] = useTransition()
  const [rejectOpen, setRejectOpen] = useState(false)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [motif, setMotif] = useState('')
  const [plan, setPlan] = useState<'discovery' | 'standard'>(initialPlan)
  const [period, setPeriod] = useState<string>('1 month')

  function run(action: () => Promise<QueueActionResult>, onDone?: () => void) {
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

  function form(extra: Record<string, string>): FormData {
    const fd = new FormData()
    fd.set('payment_id', paymentId)
    fd.set('user_id', userId)
    for (const [k, v] of Object.entries(extra)) fd.set(k, v)
    return fd
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button
        size="sm"
        disabled={isPending}
        onClick={() => run(() => activatePayment(form({ plan, period })))}
      >
        {t('queue.actionActivate')}
      </Button>
      <Button size="sm" variant="outline" disabled={isPending} onClick={() => setAdjustOpen(true)}>
        {t('queue.actionAdjust')}
      </Button>
      <Button
        size="sm"
        variant="destructive"
        disabled={isPending}
        onClick={() => setRejectOpen(true)}
      >
        {t('queue.actionReject')}
      </Button>

      {/* Rejeter — motif REQUIS (D-08, T-04-DESTRUCT) */}
      <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('rejectDialog.title')}</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="grid gap-2">
            <Label htmlFor={`motif-${paymentId}`}>{t('rejectDialog.motifLabel')}</Label>
            <Textarea
              id={`motif-${paymentId}`}
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder={t('rejectDialog.motifPlaceholder')}
              required
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>{t('rejectDialog.cancel')}</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={isPending || motif.trim().length === 0}
              onClick={() =>
                run(
                  () => rejectPayment(form({ reject_reason: motif.trim() })),
                  () => {
                    setRejectOpen(false)
                    setMotif('')
                  },
                )
              }
            >
              {t('rejectDialog.confirm')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Ajuster durée / plan */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('adjustDialog.title')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>{t('adjustDialog.planLabel')}</Label>
              <Select value={plan} onValueChange={(v) => setPlan(v as 'discovery' | 'standard')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="discovery">{t('members.planDiscovery')}</SelectItem>
                  <SelectItem value="standard">{t('members.planStandard')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>{t('adjustDialog.durationLabel')}</Label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIODS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={isPending} onClick={() => setAdjustOpen(false)}>
              {t('adjustDialog.cancel')}
            </Button>
            <Button
              disabled={isPending}
              onClick={() =>
                run(
                  () => adjustPayment(form({ plan, period })),
                  () => setAdjustOpen(false),
                )
              }
            >
              {t('adjustDialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
