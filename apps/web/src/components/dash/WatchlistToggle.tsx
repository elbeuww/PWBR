'use client'

/**
 * WatchlistToggle — étoile de suivi d'un trade_setup (Plan 19-06 ; UDASH-03).
 *
 * SEULE écriture front membre du milestone. Écrit `user_followed_setups` via le
 * client anon NAVIGATEUR (`createClient()` = createBrowserSupabaseClient) qui porte
 * la session par cookies → la RLS `(select auth.uid())` (migration 0020) scope
 * l'écriture à l'utilisateur courant.
 *
 * Anti-IDOR (T-19-21/22, RESEARCH Pattern 2 + Pitfall 1) : on n'envoie JAMAIS de
 * colonne propriétaire depuis le client. La colonne porte `default auth.uid()` et la
 * policy `with check (... = (select auth.uid()))` ; l'insert ne transporte QUE
 * `setup_id`. Aucun client privilégié (service-role) ici : l'écriture EST la donnée
 * de l'utilisateur (contrairement aux paiements).
 *
 * Toggle OPTIMISTE (react-query, D-06) : flip immédiat de l'icône (`onMutate`),
 * rollback de l'état + `toast.error` si l'écriture échoue (`onError`). Hit-area
 * ≥44px (`min-h-11 min-w-11`). `aria-label` via le namespace i18n `dash.watchlist.*`.
 * Étoile remplie en accent `--primary` quand suivie (surface de valeur, accent
 * autorisé — distinct de la nav, D-01).
 */
import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useMutation } from '@tanstack/react-query'
import { Star } from 'lucide-react'
import { toast } from 'sonner'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@app/supabase'
import { createClient } from '../../lib/supabase/client'

/** Contexte de rollback : l'état de suivi AVANT le flip optimiste. */
interface ToggleContext {
  previous: boolean
}

/** Callbacks branchés sur react-query (`mutationFn`/`onMutate`/`onError`). */
export interface WatchlistToggleHandlers {
  mutationFn: (nextFollowed: boolean) => Promise<void>
  onMutate: (nextFollowed: boolean) => ToggleContext
  onError: (error: unknown, nextFollowed: boolean, context: ToggleContext | undefined) => void
}

interface BuildWatchlistToggleDeps {
  supabase: SupabaseClient<Database>
  setupId: string
  /** Setter d'état local (flip optimiste / rollback). */
  setFollowed: (value: boolean) => void
  /** Notifie l'échec (toast). Isolé pour la testabilité Node. */
  notifyError: () => void
}

/**
 * Construit les callbacks optimiste/rollback du toggle. Pur et sans React → testable
 * en environnement Node (le composant et le test partagent cette logique).
 *
 * - `mutationFn(true)`  → insert { setup_id } (JAMAIS de colonne propriétaire).
 * - `mutationFn(false)` → delete().eq('setup_id', …).
 * - `onMutate(next)`    → flip optimiste vers `next`, renvoie l'état précédent.
 * - `onError(_, _, ctx)`→ rollback à `ctx.previous` + notifie l'échec.
 */
export function buildWatchlistToggle(deps: BuildWatchlistToggleDeps): WatchlistToggleHandlers {
  return {
    async mutationFn(nextFollowed: boolean): Promise<void> {
      if (nextFollowed) {
        // Insert minimal : seulement setup_id. La colonne propriétaire est posée par
        // `default auth.uid()` côté DB ; l'envoyer du client = surface IDOR (interdit).
        const { error } = await deps.supabase
          .from('user_followed_setups')
          .insert({ setup_id: deps.setupId })
        if (error) throw new Error(error.message)
      } else {
        const { error } = await deps.supabase
          .from('user_followed_setups')
          .delete()
          .eq('setup_id', deps.setupId)
        if (error) throw new Error(error.message)
      }
    },
    onMutate(nextFollowed: boolean): ToggleContext {
      const previous = !nextFollowed
      deps.setFollowed(nextFollowed) // flip optimiste immédiat
      return { previous }
    },
    onError(_error: unknown, _nextFollowed: boolean, context: ToggleContext | undefined): void {
      if (context) deps.setFollowed(context.previous) // rollback
      deps.notifyError()
    },
  }
}

export interface WatchlistToggleProps {
  setupId: string
  initialFollowed?: boolean
}

export function WatchlistToggle({ setupId, initialFollowed = false }: WatchlistToggleProps) {
  const t = useTranslations('dash')
  // Client navigateur unique par montage (porte la session pour la RLS).
  const supabase = useMemo(() => createClient(), [])
  const [followed, setFollowed] = useState(initialFollowed)

  const handlers = useMemo(
    () =>
      buildWatchlistToggle({
        supabase,
        setupId,
        setFollowed,
        notifyError: () => toast.error(t('watchlist.error')),
      }),
    [supabase, setupId, t],
  )

  const mutation = useMutation<void, Error, boolean, ToggleContext>({
    mutationFn: handlers.mutationFn,
    onMutate: handlers.onMutate,
    onError: handlers.onError,
  })

  const label = followed ? t('watchlist.remove') : t('watchlist.add')

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={followed}
      title={label}
      disabled={mutation.isPending}
      onClick={() => mutation.mutate(!followed)}
      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
    >
      {/* La présentation CSS `fill`/`text` prime sur l'attribut inline fill="none" de
          lucide → l'étoile suivie est remplie en accent `--primary`. */}
      <Star
        aria-hidden="true"
        className={
          followed
            ? 'h-5 w-5 fill-[var(--primary)] text-[var(--primary)]'
            : 'h-5 w-5 fill-none'
        }
      />
    </button>
  )
}
