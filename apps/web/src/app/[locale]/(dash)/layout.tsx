/**
 * (dash)/layout.tsx — shell du dashboard utilisateur (UDASH-04, D-03/D-08).
 *
 * Gate = requireUser() (auth SEUL), et NON le gate d'abonnement actif : un abonné
 * EXPIRÉ doit pouvoir entrer pour RENOUVELER (D-03). La RLS reste la vraie barrière sur
 * les pages enfant (suivis/historique/watchlist → 0 ligne si l'abonnement n'est plus
 * actif) — le gate d'abonnement actif du groupe (member) reste INTACT, non déplacé ici
 * (T-19-06).
 *
 * ExpiryBanner (PAY-05, WIRING-01) : rappel d'expiration J-3/J-1 rendu EN TÊTE du shell
 * (D-08). `current_period_end` lu en seule lecture via anon-client (RLS « subscriptions :
 * lire les siennes », scope user_id = auth.uid()) — jamais le client privilégié
 * (T-19-07). Le composant n'affiche rien hors fenêtre J-3/J-1 ou si null.
 */
import { requireUser } from '../../../lib/auth/gate'
import { createClient } from '../../../lib/supabase/server'
import { ExpiryBanner } from '@/components/member/ExpiryBanner'
import { DashShell } from '@/components/dash/DashShell'

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()

  // Fin de période de l'abonnement actif (le cas échéant) → rappel J-3/J-1. Un abonné
  // expiré n'a pas d'abo actif : sub est null → ExpiryBanner ne rend rien (D-03/D-10).
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
    <DashShell>
      <ExpiryBanner currentPeriodEnd={sub?.current_period_end ?? null} />
      {children}
    </DashShell>
  )
}
