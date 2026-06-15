/**
 * (member)/layout.tsx — segment gated par abonnement actif.
 *
 * requireActiveSub() : non-auth → login+returnTo (D-08) ; auth sans abo → /tarifs (D-07).
 * Les pages enfants lisent trade_setups/analyses via anon-client → la RLS re-tranche
 * (ACCESS-02). Le gate est la porte UX ; la RLS est la vraie barrière.
 *
 * ExpiryBanner (PAY-05) : rappel d'expiration J-3/J-1 rendu sur TOUTE la surface membre
 * (sinon orphelin — WIRING-01). `current_period_end` lu en seule lecture via anon-client
 * (RLS "subscriptions: lire les siennes", scope user_id = auth.uid()) — frontière
 * producteur-unique préservée, aucun service_role. Le composant n'affiche rien hors
 * fenêtre J-3/J-1 ou si null.
 */
import { requireActiveSub } from '../../../lib/auth/gate'
import { createClient } from '../../../lib/supabase/server'
import { ExpiryBanner } from '@/components/member/ExpiryBanner'

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const user = await requireActiveSub()

  // Abonnement actif courant (le gate garantit qu'il existe) → fin de période pour le rappel.
  const supabase = await createClient()
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('current_period_end')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('current_period_end', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <>
      <ExpiryBanner currentPeriodEnd={sub?.current_period_end ?? null} />
      {children}
    </>
  )
}
