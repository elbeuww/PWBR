'use client'

/**
 * ApplicationRowActions — actions par ligne de la file de revue des candidatures (AFF-01, D-07/D-08).
 *
 * - « Approuver » (primary) → dialog avec saisie du code vanity (input borné A-Z0-9, D-06).
 *   Le superadmin pose le code (jamais l'affilié, D-07). Erreur code pris → message i18n.
 * - « Rejeter » (destructive gris) → alert-dialog avec textarea MOTIF requis (confirm désactivé
 *   tant que le motif est vide, T-07-DESTRUCT).
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  approveApplication,
  rejectApplication,
  type QueueActionResult,
} from '@/app/(admin)/affiliation/actions'

interface ApplicationRowActionsProps {
  applicationId: string
  applicantEmail: string
}

const CODE_PATTERN = /^[A-Z0-9]{3,20}$/

export function ApplicationRowActions({ applicationId, applicantEmail }: ApplicationRowActionsProps) {
  const t = useTranslations('admin')
  const [isPending, startTransition] = useTransition()
  const [approveOpen, setApproveOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [code, setCode] = useState('')
  const [motif, setMotif] = useState('')

  function run(action: () => Promise<QueueActionResult>, onDone?: () => void) {
    startTransition(async () => {
      const res = await action()
      if (res.ok) {
        toast.success(t('actionSuccess'))
        onDone?.()
      } else if (res.error === 'code_taken') {
        toast.error(t('affiliateQueue.errors.codeTaken'))
      } else {
        toast.error(t('actionError'))
      }
    })
  }

  function form(extra: Record<string, string>): FormData {
    const fd = new FormData()
    fd.set('application_id', applicationId)
    fd.set('applicant_email', applicantEmail)
    for (const [k, v] of Object.entries(extra)) fd.set(k, v)
    return fd
  }

  const normalizedCode = code.toUpperCase().trim()
  const codeValid = CODE_PATTERN.test(normalizedCode)

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button size="sm" disabled={isPending} onClick={() => setApproveOpen(true)}>
        {t('affiliateQueue.actionApprove')}
      </Button>
      <Button
        size="sm"
        variant="destructive"
        disabled={isPending}
        onClick={() => setRejectOpen(true)}
      >
        {t('affiliateQueue.actionReject')}
      </Button>

      {/* Approuver — saisie du code vanity (D-06/D-07, superadmin pose le code) */}
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('affiliateQueue.approveDialog.title')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor={`code-${applicationId}`}>
              {t('affiliateQueue.approveDialog.codeLabel')}
            </Label>
            <Input
              id={`code-${applicationId}`}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t('affiliateQueue.approveDialog.codePlaceholder')}
              autoCapitalize="characters"
              spellCheck={false}
            />
            <p className="text-xs text-muted-foreground">
              {t('affiliateQueue.approveDialog.codeHint')}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={isPending} onClick={() => setApproveOpen(false)}>
              {t('affiliateQueue.approveDialog.cancel')}
            </Button>
            <Button
              disabled={isPending || !codeValid}
              onClick={() =>
                run(
                  () => approveApplication(form({ code: normalizedCode })),
                  () => {
                    setApproveOpen(false)
                    setCode('')
                  },
                )
              }
            >
              {t('affiliateQueue.approveDialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejeter — motif REQUIS (D-08, T-07-DESTRUCT) */}
      <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('affiliateQueue.rejectDialog.title')}</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="grid gap-2">
            <Label htmlFor={`motif-${applicationId}`}>
              {t('affiliateQueue.rejectDialog.motifLabel')}
            </Label>
            <Textarea
              id={`motif-${applicationId}`}
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder={t('affiliateQueue.rejectDialog.motifPlaceholder')}
              required
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>
              {t('affiliateQueue.rejectDialog.cancel')}
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={isPending || motif.trim().length === 0}
              onClick={() =>
                run(
                  () => rejectApplication(form({ reject_reason: motif.trim() })),
                  () => {
                    setRejectOpen(false)
                    setMotif('')
                  },
                )
              }
            >
              {t('affiliateQueue.rejectDialog.confirm')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
