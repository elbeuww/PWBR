'use client'

/**
 * MemberRowActions — actions par ligne du tableau membres (ADASH-04, D-16/D-17).
 *
 * dropdown-menu :
 *  - "Offrir du temps gratuit" → Dialog presets (7 j / 1 mois / 3 mois), CTA accent
 *    « Confirmer la prolongation » → grantSubscriptionTime (RPC gated 0021).
 *  - "Suspendre" (destructive) → AlertDialog rouge, motif REQUIS, CTA « Suspendre » →
 *    suspendAccount. Affiché si la ligne n'est PAS déjà suspendue.
 *  - "Réactiver" → confirm léger → unsuspendAccount. Affiché si la ligne est suspendue.
 *
 * Toute mutation passe par les Server Actions gated (anon-client + RPC SECURITY DEFINER) ;
 * jamais d'écriture front, jamais de service_role. Toast sonner au succès ; bouton désactivé
 * pendant `pending`. Couleurs : `--primary` réservé au CTA de prolongation, `--destructive`
 * pour suspendre (D-08, 20-UI-SPEC). Aucun `%` ni chiffre fabriqué dans la copy.
 *
 * Copy verrouillée (20-UI-SPEC, rendue via i18n `admin.*` — source de vérité = messages/fr.json) :
 *  - grantDialog.confirm    → « Confirmer la prolongation »
 *  - suspendDialog.title    → « Suspendre ce compte ? »
 *  - suspendDialog.confirm  → « Suspendre »
 *  - reactivateDialog.confirm → « Réactiver »
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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  grantSubscriptionTime,
  suspendAccount,
  unsuspendAccount,
  type AdminActionResult,
} from '@/app/(admin)/membres/actions'

interface MemberRowActionsProps {
  userId: string
  /** État de suspension de la ligne (D-17) : pilote l'affichage Suspendre vs Réactiver. */
  suspended: boolean
}

/** Presets de durée — calque STRICT de la whitelist PERIODS côté action (T-20-10). */
const PERIODS = ['7 days', '1 month', '3 months'] as const

export function MemberRowActions({ userId, suspended }: MemberRowActionsProps) {
  const t = useTranslations('admin')
  const [isPending, startTransition] = useTransition()
  const [grantOpen, setGrantOpen] = useState(false)
  const [suspendOpen, setSuspendOpen] = useState(false)
  const [reactivateOpen, setReactivateOpen] = useState(false)
  const [period, setPeriod] = useState<string>('1 month')
  const [reason, setReason] = useState('')

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

  /** Libellé FR du preset (pas de date fabriquée — D-08/VITR-03). */
  const periodLabel: Record<string, string> = {
    '7 days': t('grantDialog.period7'),
    '1 month': t('grantDialog.period1m'),
    '3 months': t('grantDialog.period3m'),
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t('members.actionGrant')}>
            <MoreHorizontal className="size-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled={isPending} onSelect={() => setGrantOpen(true)}>
            {t('members.actionGrant')}
          </DropdownMenuItem>
          {suspended ? (
            <DropdownMenuItem disabled={isPending} onSelect={() => setReactivateOpen(true)}>
              {t('members.actionReactivate')}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              variant="destructive"
              disabled={isPending}
              onSelect={() => setSuspendOpen(true)}
            >
              {t('members.actionSuspend')}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Offrir du temps gratuit (D-16) — presets whitelistés, CTA accent */}
      <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('grantDialog.title')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>{t('grantDialog.durationLabel')}</Label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIODS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {periodLabel[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('grantDialog.effect', { duration: periodLabel[period] ?? '' })}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={isPending} onClick={() => setGrantOpen(false)}>
              {t('grantDialog.cancel')}
            </Button>
            <Button
              disabled={isPending}
              onClick={() =>
                run(
                  () => grantSubscriptionTime(buildForm({ period })),
                  () => setGrantOpen(false),
                )
              }
            >
              {t('grantDialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspendre (D-17, destructive) — motif REQUIS */}
      <AlertDialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('suspendDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('suspendDialog.body')}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor={`suspend-reason-${userId}`}>{t('suspendDialog.reasonLabel')}</Label>
            <Textarea
              id={`suspend-reason-${userId}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('suspendDialog.reasonPlaceholder')}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>{t('suspendDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending || reason.trim().length === 0}
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                run(
                  () => suspendAccount(buildForm({ reason })),
                  () => {
                    setSuspendOpen(false)
                    setReason('')
                  },
                )
              }}
            >
              {t('suspendDialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Réactiver (D-17) — confirm léger */}
      <AlertDialog open={reactivateOpen} onOpenChange={setReactivateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('reactivateDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('reactivateDialog.body')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>
              {t('reactivateDialog.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={(e) => {
                e.preventDefault()
                run(() => unsuspendAccount(buildForm({})), () => setReactivateOpen(false))
              }}
            >
              {t('reactivateDialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
