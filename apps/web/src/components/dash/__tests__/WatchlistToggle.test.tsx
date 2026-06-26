/**
 * WatchlistToggle.test.tsx — garde-fou UDASH-03 : le toggle watchlist est
 * OPTIMISTE avec ROLLBACK, et n'envoie JAMAIS de colonne propriétaire (anti-IDOR).
 *
 * L'environnement Vitest est `node` (pas de jsdom/RTL dans ce repo) : on ne simule
 * donc pas le DOM. La logique optimiste/rollback est extraite dans le helper pur
 * `buildWatchlistToggle` (exporté par le composant), que le composant branche sur
 * `useMutation`. On teste ce helper directement → preuve déterministe, runnable en Node.
 *
 * Behavior couvert (RED→GREEN) :
 *  1. prise en suivi → flip optimiste immédiat (setFollowed(true)) puis insert { setup_id }
 *     SANS aucune colonne propriétaire (default auth.uid() + with check = anti-IDOR).
 *  2. insert échoue → mutationFn throw → onError rollback à l'état précédent + toast.
 *  3. retrait → delete().eq('setup_id', …), flip optimiste à non-suivi.
 *  4. delete échoue → rollback depuis l'état suivi + toast.
 */
import { describe, it, expect, vi } from 'vitest'

// lucide/sonner/client : importés au chargement du module composant. On les neutralise
// pour un test Node isolé (le helper reçoit ses dépendances en arguments, pas via ces imports).
vi.mock('lucide-react', () => ({ Star: () => null }))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
vi.mock('../../../lib/supabase/client', () => ({ createClient: vi.fn() }))
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))

import { buildWatchlistToggle } from '../WatchlistToggle'

const SID = '11111111-1111-1111-1111-111111111111'

type Result = { error: { message: string } | null }

/** Faux client Supabase : chaîne from().insert() et from().delete().eq() → result. */
function makeSupabase(result: Result) {
  const insert = vi.fn().mockResolvedValue(result)
  const eq = vi.fn().mockResolvedValue(result)
  const deleteFn = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ insert, delete: deleteFn }))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { supabase: { from } as any, from, insert, deleteFn, eq }
}

describe('WatchlistToggle : optimiste + rollback + anti-IDOR (UDASH-03)', () => {
  it('prise en suivi : flip optimiste immédiat puis insert { setup_id } sans colonne propriétaire', async () => {
    const setFollowed = vi.fn()
    const notifyError = vi.fn()
    const { supabase, from, insert } = makeSupabase({ error: null })
    const h = buildWatchlistToggle({ supabase, setupId: SID, setFollowed, notifyError })

    // Optimiste : l'icône flippe AVANT toute écriture réseau.
    const ctx = h.onMutate(true)
    expect(setFollowed).toHaveBeenCalledWith(true)
    expect(ctx).toEqual({ previous: false })

    await h.mutationFn(true)
    expect(from).toHaveBeenCalledWith('user_followed_setups')
    expect(insert).toHaveBeenCalledWith({ setup_id: SID })
    // Anti-IDOR : aucune colonne propriétaire envoyée (default auth.uid() + with check).
    expect(insert.mock.calls[0][0]).not.toHaveProperty('user_id')
    expect(notifyError).not.toHaveBeenCalled()
  })

  it('insert échoue : mutationFn throw → onError rollback + toast', async () => {
    const setFollowed = vi.fn()
    const notifyError = vi.fn()
    const { supabase } = makeSupabase({ error: { message: 'denied' } })
    const h = buildWatchlistToggle({ supabase, setupId: SID, setFollowed, notifyError })

    const ctx = h.onMutate(true)
    expect(setFollowed).toHaveBeenLastCalledWith(true)

    await expect(h.mutationFn(true)).rejects.toThrow('denied')

    h.onError(new Error('denied'), true, ctx)
    // Rollback : retour à l'état précédent (non-suivi).
    expect(setFollowed).toHaveBeenLastCalledWith(false)
    expect(notifyError).toHaveBeenCalledTimes(1)
  })

  it('retrait : delete().eq(setup_id) et flip optimiste à non-suivi', async () => {
    const setFollowed = vi.fn()
    const { supabase, deleteFn, eq } = makeSupabase({ error: null })
    const h = buildWatchlistToggle({ supabase, setupId: SID, setFollowed, notifyError: vi.fn() })

    const ctx = h.onMutate(false)
    expect(setFollowed).toHaveBeenCalledWith(false)
    expect(ctx).toEqual({ previous: true })

    await h.mutationFn(false)
    expect(deleteFn).toHaveBeenCalledTimes(1)
    expect(eq).toHaveBeenCalledWith('setup_id', SID)
  })

  it('delete échoue : rollback depuis l’état suivi + toast', async () => {
    const setFollowed = vi.fn()
    const notifyError = vi.fn()
    const { supabase } = makeSupabase({ error: { message: 'net' } })
    const h = buildWatchlistToggle({ supabase, setupId: SID, setFollowed, notifyError })

    const ctx = h.onMutate(false)
    expect(ctx).toEqual({ previous: true })

    await expect(h.mutationFn(false)).rejects.toThrow('net')

    h.onError(new Error('net'), false, ctx)
    expect(setFollowed).toHaveBeenLastCalledWith(true)
    expect(notifyError).toHaveBeenCalledTimes(1)
  })
})
