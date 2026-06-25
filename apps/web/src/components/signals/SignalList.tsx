'use client'

/**
 * SignalList — overlay client de la liste : react-query (repli) + canal Realtime
 * (Plan 03-02 Task 3 ; MEMB-05, D-13/14/16).
 *
 * SÉCURITÉ (T-03-RT / T-17-BC-CLI) : la lecture navigateur passe par createClient()
 * de @/lib/supabase/client (= createBrowserSupabaseClient) qui PORTE la session via
 * cookies → realtime.setAuth() injecte ce JWT dans le socket Realtime, et la policy
 * RLS sur realtime.messages (has_active_subscription(), migration 0017) filtre QUI
 * peut écouter le canal privé (un non-abonné ne reçoit rien). La clé service côté
 * front est interdite.
 *
 * Realtime via Broadcast from Database (D-04 / SCALE-05, migration 0017) :
 *  - Canal PRIVÉ 'topic:new-signals' (config.private) alimenté par le trigger
 *    broadcast_trade_setup_changes() côté DB — fan-out global, pas de filtrage RLS
 *    par-message-par-subscriber (goulot postgres_changes à 10k évité, Pitfall 8).
 *  - event INSERT → incrémente un compteur « nouveaux » (D-13).
 *    L'insertion réelle N'A LIEU qu'au clic du badge (anti-reflow).
 *  - event UPDATE (Pitfall 4) → si payload.payload.record.status !== 'active',
 *    retire la carte en direct (D-14). ATTENTION shape Broadcast :
 *    payload.payload.record (PAS payload.new comme en postgres_changes, A4).
 *  - subscribe : si l'état n'atteint pas SUBSCRIBED → repli refetch react-query
 *    (refetchInterval) + note discrète signals.realtimeLost (D-16).
 *  - cleanup : removeChannel au démontage (robuste si le canal est créé dans la
 *    promesse setAuth() — variable mutable + flag d'annulation).
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
    // Le canal privé exige realtime.setAuth() (Realtime Authorization) AVANT
    // l'abonnement → mise en place async. On garde la référence du canal dans une
    // variable mutable + un flag d'annulation pour que le cleanup retire bien le
    // canal même s'il est créé après le démontage (race promesse/unmount).
    let channel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false

    async function setupBroadcast() {
      // Injecte le JWT de session dans le socket Realtime (requis canal privé).
      await supabase.realtime.setAuth()
      if (cancelled) return

      channel = supabase
        .channel('topic:new-signals', { config: { private: true } })
        .on('broadcast', { event: 'INSERT' }, () => {
          // D-13 : on signale un nouveau, on n'insère PAS directement (anti-reflow).
          setNewCount((c) => c + 1)
        })
        .on('broadcast', { event: 'UPDATE' }, (payload) => {
          // Pitfall 4 / A4 : shape Broadcast = payload.payload.record (PAS payload.new).
          // Pas de filtre de statut → on capte la transition active→non-active.
          const next = payload.payload?.record as { id?: string; status?: string }
          if (next?.id && next.status && next.status !== 'active') {
            setRemovedIds((prev) => {
              const updated = new Set(prev)
              updated.add(next.id as string)
              return updated
            })
          }
        })
        .subscribe((status) => {
          // D-16 / WR-01 : ne basculer en repli QUE sur un échec réel. Les états
          // transitoires ('SUBSCRIBING') ne sont PAS une perte de connexion — sinon
          // une fausse alerte "connexion perdue" apparaît à chaque montage.
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            setRealtimeLost(true)
          } else if (status === 'SUBSCRIBED') {
            setRealtimeLost(false)
          }
          // 'SUBSCRIBING' (et autres états intermédiaires) → connexion en cours, no-op.
        })
    }

    void setupBroadcast()

    return () => {
      cancelled = true
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [supabase])

  // Au clic du badge : applique les nouveaux (refetch) et remet le compteur à 0.
  // WR-02 : NE PAS vider removedIds — les signaux retirés en direct (devenus
  // expired/invalidated) doivent rester cachés. Les vider les ferait réapparaître
  // brièvement avant que le refetch ne les retire à nouveau (flash incohérent).
  // Le refetch renvoie uniquement les actifs ; le filtre removedIds reste cohérent.
  function revealNew() {
    setNewCount(0)
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
