/**
 * (member)/layout.tsx — segment gated par abonnement actif.
 *
 * requireActiveSub() : non-auth → login+returnTo (D-08) ; auth sans abo → /tarifs (D-07).
 * Les pages enfants lisent trade_setups/analyses via anon-client → la RLS re-tranche
 * (ACCESS-02). Le gate est la porte UX ; la RLS est la vraie barrière.
 */
import { requireActiveSub } from '../../../lib/auth/gate'

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  await requireActiveSub()
  return <>{children}</>
}
