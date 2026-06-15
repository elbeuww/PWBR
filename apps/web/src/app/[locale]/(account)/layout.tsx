/**
 * (account)/layout.tsx — segment « compte » exigeant SEULEMENT l'authentification.
 *
 * POURQUOI un groupe distinct de (member) : le layout (member) appelle
 * requireActiveSub() qui REDIRIGE un membre non-abonné vers /tarifs (D-07). Or la
 * page d'abonnement (achat) DOIT être accessible à un membre authentifié mais
 * NON-abonné — c'est précisément là qu'il vient payer. Placer /abonnement sous
 * (member) le rendrait inatteignable (boucle de redirection vers /tarifs).
 *
 * Les route groups `(x)` n'apparaissent PAS dans l'URL : (account)/abonnement et
 * (member)/abonnement produiraient la MÊME URL /[locale]/abonnement. On choisit
 * donc (account) avec le seul gate requireUser() (auth, D-08) — l'abonné comme le
 * non-abonné y accèdent (renouvellement D-11 = même parcours). La RLS Postgres
 * reste la vraie barrière des données ; ici c'est juste la porte UX du parcours d'achat.
 */
import { requireUser } from '../../../lib/auth/gate'

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  await requireUser()
  return <>{children}</>
}
