'use client'

/**
 * SignalList — overlay client de la liste : react-query (repli) + canal Realtime
 * (Plan 03-02 Task 3 ; MEMB-05, D-13/14/16).
 *
 * SÉCURITÉ (T-03-RT) : la lecture navigateur passe par createClient() de
 * @/lib/supabase/client (= createBrowserSupabaseClient) qui PORTE la session via
 * cookies → la RLS has_active_subscription() filtre les events postgres_changes
 * (un non-abonné ne reçoit rien). La clé service côté front est interdite.
 *
 * Realtime (dépend de la migration 0011, Wave 1) :
 *  - INSERT (filter status=eq.active) → incrémente un compteur « nouveaux » (D-13).
 *    L'insertion réelle N'A LIEU qu'au clic du badge (anti-reflow).
 *  - UPDATE SANS filtre de statut (Pitfall 4) → si p.new.status !== 'active',
 *    retire la carte en direct (D-14).
 *  - subscribe : si l'état n'atteint pas SUBSCRIBED → repli refetch react-query
 *    (refetchInterval) + note discrète signals.realtimeLost (D-16).
 *  - cleanup : removeChannel au démontage.
 *
 * Le contenu reste lecture seule ; aucune écriture ; aucune clé service privilégiée.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '../../lib/supabase/client'
import { fetchActiveSignals, type SignalRow } from '../../lib/signals/queries'
import type { SignalsParams } from '../../lib/signals/searchParams'
import { SignalCard } from './SignalCard'
import { RealtimeBadge } from './RealtimeBadge'
import { Skeleton } from '../ui/skeleton'

interface SignalListProps {
  initialData: SignalRow[]
  filters: SignalsParams
  locale: string
}

const REFETCH_FALLBACK_MS = 60_000 // repli D-16 si Realtime tombe

export function SignalList({ initialData, filters, locale }: SignalListProps) {
  const t = useTranslations('signals')
  // Un client navigateur unique par montage (porte la session pour la RLS Realtime).
  const supabase = useMemo(() => createClient(), [])

  // Repli D-16 : refetch périodique activé seulement si le canal ne SUBSCRIBE pas.
  const [realtimeLost, setRealtimeLost] = useState(false)
  // Compteur de nouveaux signaux (badge D-13) — insertion seulement au clic.
  const [newCount, setNewCount] = useState(0)
  // IDs retirés en direct (transition de statut, D-14).
  const [removedIds, setRemovedIds] = useState<Set<string>>(() => new Set())

  const queryKey = useMemo(
    () => ['signals', filters.style, filters.risk, filters.class, filters.asset, filters.sort],
    [filters.style, filters.risk, filters.class, filters.asset, filters.sort],
  )

  const { data, isFetching, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const result = await fetchActiveSignals(supabase, filters)
      if (result.error) throw new Error(result.error)
      return result.data
    },
    initialData,
    refetchInterval: realtimeLost ? REFETCH_FALLBACK_MS : false,
  })

  // Stable refetch ref pour le callback Realtime (pas de re-souscription au refetch).
  const refetchRef = useRef(refetch)
  refetchRef.current = refetch

  useEffect(() => {
    const channel = supabase
      .channel('signals-active')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'trade_setups', filter: 'status=eq.active' },
        () => {
          // D-13 : on signale un nouveau, on n'insère PAS directement (anti-reflow).
          setNewCount((c) => c + 1)
        },
      )
      .on(
        'postgres_changes',
        // Pitfall 4 : pas de filtre de statut → on capte la transition active→non-active.
        { event: 'UPDATE', schema: 'public', table: 'trade_setups' },
        (payload) => {
          const next = payload.new as { id?: string; status?: string }
          if (next?.id && next.status && next.status !== 'active') {
            setRemovedIds((prev) => {
              const updated = new Set(prev)
              updated.add(next.id as string)
              return updated
            })
          }
        },
      )
      .subscribe((status) => {
        // D-16 : si le canal n'atteint pas SUBSCRIBED, basculer en repli refetch.
        setRealtimeLost(status !== 'SUBSCRIBED')
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  // Au clic du badge : applique les nouveaux (refetch) et remet le compteur à 0.
  function revealNew() {
    setNewCount(0)
    setRemovedIds(new Set())
    void refetchRef.current()
  }

  const visible = (data ?? []).filter((s) => !removedIds.has(s.id))

  return (
    <div className="mt-2">
      {realtimeLost ? (
        <p className="mt-4 text-xs text-muted-foreground">{t('realtimeLost')}</p>
      ) : null}

      <RealtimeBadge count={newCount} onReveal={revealNew} />

      {isFetching && visible.length === 0 ? (
        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((signal) => (
            <SignalCard key={signal.id} signal={signal} locale={locale} />
          ))}
        </div>
      )}
    </div>
  )
}
