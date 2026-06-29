/**
 * /[locale]/dashboard/watchlist — alias de la vue SUIVIS (UDASH-02, Plan 19-07 Task 3 ;
 * D-04 fusion).
 *
 * DÉCISION (D-19-07-B, Claude's Discretion) : la « watchlist » N'EST PAS un module
 * séparé. Le geste watchlist se vit via l'ÉTOILE (WatchlistToggle, 19-06) ; la VUE des
 * éléments suivis EST la surface Suivis (setups ouverts bookmarkés). Cette route est
 * donc une REDIRECTION localisée vers `/dashboard/suivis` — zéro duplication de la
 * requête (`fetchFollowedSetups`) ni de la liste (`KeysetList`). L'onglet de nav
 * `dash.nav.watchlist` (DashShell figé 19-02) mène ainsi à une vue cohérente.
 *
 * `redirect` localisé (i18n/navigation) → conserve le préfixe de locale courant.
 */
import { getLocale } from 'next-intl/server'
import { redirect } from '@/i18n/navigation'

export default async function WatchlistPage() {
  const locale = await getLocale()
  redirect({ href: '/dashboard/suivis', locale })
}
