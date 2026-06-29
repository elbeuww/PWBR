'use client'

/**
 * NotificationPreferences — préférences d'affichage des notifications (UDASH-06, D-12).
 *
 * UI SEULEMENT : aucune infrastructure d'envoi (e-mail / push / edge function), aucun
 * appel réseau de delivery. Les bascules persistent uniquement en `localStorage`
 * (préférence locale, sans moteur) — l'envoi réel est HORS SCOPE Phase 19 (déféré, D-12).
 * Le libellé `notificationsHint` indique clairement qu'aucune notification n'est envoyée
 * (T-19-20 : éviter qu'une préférence soit prise pour une livraison active).
 *
 * Toutes les chaînes via `dash.settings.*`. Propriétés logiques uniquement (RTL-safe).
 */
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'

const STORAGE_KEY = 'dash.notificationPrefs'

interface Prefs {
  newSignals: boolean
  expiry: boolean
}

const DEFAULT_PREFS: Prefs = { newSignals: true, expiry: true }

function readPrefs(): Prefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_PREFS
    const parsed = JSON.parse(raw) as Partial<Prefs>
    return {
      newSignals: parsed.newSignals ?? DEFAULT_PREFS.newSignals,
      expiry: parsed.expiry ?? DEFAULT_PREFS.expiry,
    }
  } catch {
    return DEFAULT_PREFS
  }
}

export function NotificationPreferences() {
  const t = useTranslations('dash.settings')
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS)

  // Hydrate depuis localStorage après le montage (évite un mismatch SSR).
  useEffect(() => {
    setPrefs(readPrefs())
  }, [])

  function toggle(key: keyof Prefs) {
    setPrefs((current) => ({ ...current, [key]: !current[key] }))
  }

  function save() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
    } catch {
      // Stockage indisponible (mode privé, quota) : préférence non persistée, sans erreur bloquante.
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t('notificationsHint')}</p>

      <label className="flex items-center justify-between gap-3 text-sm">
        <span>{t('notifyNewSignals')}</span>
        <input
          type="checkbox"
          checked={prefs.newSignals}
          onChange={() => toggle('newSignals')}
          className="size-4 accent-[var(--primary)]"
        />
      </label>

      <label className="flex items-center justify-between gap-3 text-sm">
        <span>{t('notifyExpiry')}</span>
        <input
          type="checkbox"
          checked={prefs.expiry}
          onChange={() => toggle('expiry')}
          className="size-4 accent-[var(--primary)]"
        />
      </label>

      <Button type="button" variant="outline" onClick={save} className="w-fit">
        {t('savePreferences')}
      </Button>
    </div>
  )
}
