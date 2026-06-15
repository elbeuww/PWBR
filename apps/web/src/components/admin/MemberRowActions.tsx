'use client'

/**
 * MemberRowActions — actions par ligne du tableau membres (ADMIN-01, D-13).
 *
 * dropdown-menu : "Activer / Prolonger", "Changer de plan", destructive "Révoquer / Suspendre".
 * - Révoquer → alert-dialog de confirmation (destructive rouge, T-04-DESTRUCT).
 * - Changer de plan / Activer → dialog avec select plan + durée.
 * Toute mutation passe par les Server Actions (service_role) ; jamais d'écriture front.
 */
import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  activateMember,
  changeMemberPlan,
  revokeMember,
  type AdminActionResult,
} from '@/app/(admin)/membres/actions'

interface MemberRowActionsProps {
  userId: string
  /** Dernier payment activable (pour "Activer / Prolonger"). Absent → action désactivée. */
  lastPaymentId: string | null
  currentPlan: 'discovery' | 'standard'
}

const PERIODS = ['7 days', '1 month', '3 months'] as const

export function MemberRowActions({ userId, lastPaymentId, currentPlan }: MemberRowActionsProps) {
  const t = useTranslations('admin')
  const [isPending, startTransition] = useTransition()
  const [revokeOpen, setRevokeOpen] = useState(false)
  const [planOpen, setPlanOpen] = useState(false)
  const [plan, setPlan] = useState<'discovery' | 'standard'>(currentPlan)
  const [period, setPeriod] = useState<string>('1 month')

  function run(action: () => Promise<AdminActionResult>, onDone?: () => void) {
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

  function buildForm(extra: Record<string, string>): FormData {
    const fd = new FormData()
    fd.set('user_id', userId)
    for (const [k, v] of Object.entries(extra)) fd.set(k, v)
    return fd
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t('members.actionChangePlan')}>
            <MoreHorizontal className="size-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            disabled={!lastPaymentId || isPending}
            onSelect={() => {
              if (!lastPaymentId) return
              run(() =>
                activateMember(buildForm({ payment_id: lastPaymentId, plan, period })),
              )
            }}
          >
            {t('members.actionActivate')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setPlanOpen(true)}>
            {t('members.actionChangePlan')}
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setRevokeOpen(true)}>
            {t('members.actionRevoke')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Révoquer — confirmation destructive (T-04-DESTRUCT) */}
      <AlertDialog open={revokeOpen} onOpenChange={setRevokeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('revokeDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('revokeDialog.body')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>{t('revokeDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={(e) => {
                e.preventDefault()
                run(() => revokeMember(buildForm({})), () => setRevokeOpen(false))
              }}
            >
              {t('revokeDialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Changer de plan / ajuster durée */}
      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
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
            <Button variant="outline" disabled={isPending} onClick={() => setPlanOpen(false)}>
              {t('adjustDialog.cancel')}
            </Button>
            <Button
              disabled={isPending}
              onClick={() =>
                run(
                  () => changeMemberPlan(buildForm({ plan, period })),
                  () => setPlanOpen(false),
                )
              }
            >
              {t('adjustDialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
