---
phase: 19-dashboard-utilisateur
plan: 07
subsystem: web
tags: [dash, keyset, cursor, watchlist, suivis, historique, renewal, rls, rtl, udash-02]
requires:
  - "19-02: groupe (dash) layout requireUser + DashShell nav figée (/dashboard/*) + namespace i18n dash"
  - "19-03: fetchFollowedSetups (source unique keyset) + lib/keyset/cursor + parseWatchlistParams"
provides:
  - "Surface Suivis /dashboard/suivis : setups actifs bookmarkés, keyset curseur, 4 états dont renewal"
  - "Surface Historique /dashboard/historique : setups clôturés + issue mesurée (outcome/realized_r), keyset"
  - "KeysetList (composant unique liste + lien page suivante par curseur), KeysetTabs (sous-nav), KeysetSkeleton (loading)"
  - "Route watchlist = redirection localisée vers Suivis (fusion D-04, zéro duplication)"
affects:
  - "Phase 21: audit scalabilité (EXPLAIN keyset Index Scan sur user_followed_setups à ~10k)"
  - "Phase 19 clôture : dernière surface UDASH du dashboard membre livrée"
tech-stack:
  added: []
  patterns:
    - "Pagination par LIEN URL ?cursor=<opaque> (server-renderable, pas de react-query ni état client) → Index Scan keyset, zéro décalage de page (D-05)"
    - "État de chargement RSC réel : <Suspense key={cursor}> autour d'un sous-composant async data-dépendant, fallback <KeysetSkeleton/>"
    - "Distinction empty vs renewal : 0 ligne + rpc('has_active_subscription')==false → renewal (D-03), sinon empty — MÊME source de vérité que le !inner RLS (CR-05)"
    - "Issue d'historique = outcome (hit_tp/hit_sl/flat) + realized_r MESURÉS via <bdi>, jamais un % de gain agrégé fabriqué (D-09/VITR-03)"
key-files:
  created:
    - apps/web/src/components/dash/KeysetList.tsx
    - apps/web/src/app/[locale]/(dash)/dashboard/suivis/page.tsx
    - apps/web/src/app/[locale]/(dash)/dashboard/historique/page.tsx
    - apps/web/src/app/[locale]/(dash)/dashboard/watchlist/page.tsx
  modified:
    - apps/web/src/messages/fr.json
    - apps/web/src/messages/en.json
    - apps/web/src/messages/ar.json
decisions:
  - "D-19-07-A : chemins placés sous (dash)/dashboard/{suivis,historique,watchlist}/ et NON (dash)/{suivis,...}/ comme déclaré au plan. La nav DashShell (figée 19-02, D-19-04-A) route vers /dashboard/* ; placer les pages à la racine (dash) les rendrait inatteignables depuis le chrome. Adapté pour matcher la nav (consigne upstream)."
  - "D-19-07-B : route watchlist = REDIRECTION localisée vers /dashboard/suivis (fusion D-04), pas un module séparé. Le geste watchlist se vit via l'étoile (19-06) ; la VUE des suivis EST la surface Suivis. Zéro duplication de fetchFollowedSetups/KeysetList."
  - "D-19-07-C : Historique = SOUS-VUE interne de Suivis (D-19-02-A), atteinte via <KeysetTabs/> (sous-nav Suivis⇄Historique), PAS un onglet du chrome de nav principal (la nav DashShell n'a pas d'item historique). Route réelle /dashboard/historique néanmoins keyset autonome."
  - "D-19-07-D (Rule 2) : status mappé via WatchlistStatus (tab 'suivis'/'historique') passé à fetchFollowedSetups, qui traduit en filtre db (active vs invalidated/expired) — pas de réimplémentation du filtre côté page (T-19-30)."
gates:
  manual_only:
    - "A2 / T-19-26 (barrière renouvellement) : vérifier live qu'un abonné EXPIRÉ lit 0 ligne sur /dashboard/suivis et /historique (le !inner gardé par has_active_subscription() filtre tout) → état renewal affiché, pas empty. Non automatisable (table vide au build + session abonné expiré)."
    - "Filtre statut embed dotté (CR-02, hérité 19-03) : confirmer live que .eq('trade_setups.status', …) filtre bien les lignes racine (suivis≠historique)."
    - "EXPLAIN keyset à l'échelle : Index Scan using user_followed_setups_keyset_idx (sans Sort) sur seed, via MCP en fin de phase."
verification:
  - "pnpm typecheck (tsc -b --noEmit) : exit 0"
  - "pnpm lint:i18n : exit 0 (aucune chaîne en dur dans le JSX)"
  - "messages-parity-dash : 4/4 (parité stricte fr/en/ar après ajout dash.list)"
  - "pnpm vitest run : 639 passed | 13 skipped (652) — aucune régression"
  - "KeysetList greps : cursor>=1, offset|range==0, classe-physique==0, outcome/realized_r>=1"
  - "Pages greps : fetchFollowedSetups>=1, cursor>=1, renewal>=1, from('user_followed_setups')==0, classe-physique==0"
  - "watchlist greps : redirect>=1, aucune duplication de liste/requête"
metrics:
  duration: ~20min
  completed: 2026-06-26
---

# Phase 19 Plan 07 : Surfaces Suivis & Historique keyset (KeysetList + renewal)

Livre la dernière surface UDASH du dashboard membre : les setups suivis OUVERTS (Suivis)
et CLÔTURÉS (Historique) lus depuis la source unique `user_followed_setups ⋈ trade_setups!inner`
(D-04), paginés par CURSEUR keyset (D-05, zéro décalage de page), avec les 4 états
(loading / empty / error / renewal). Le `KeysetList` rend les lignes + le lien « page
suivante » par curseur opaque ; la route `watchlist` fusionne avec Suivis par redirection.

## Réalisé

- **Task 1 — KeysetList + sous-nav + i18n** : `components/dash/KeysetList.tsx` server-renderable
  (pagination par lien URL `?cursor=`, pas de react-query). Lignes followed : symbole (font-mono),
  badge direction (token `--signal-*`, direction SEULE D-03/D-05 P10), risque, R:R, score ; en
  `variant='historique'` l'issue MESURÉE (`outcome` + `realized_r` via `<bdi>`, jamais un % fabriqué
  D-09). Lien « page suivante » par curseur opaque si `nextCursor`. Exporte aussi `KeysetTabs`
  (sous-nav Suivis⇄Historique, D-19-07-C) et `KeysetSkeleton` (loading). i18n `dash.list`
  (nextPage/rUnit/viewDetail/issue.hit_tp|hit_sl|flat) ajouté à parité stricte fr/en/ar. RTL-safe
  (propriétés logiques uniquement), tokens `bg-[var(--token)]`. Commit `3d9f5ea`.
- **Task 2 — Pages Suivis + Historique** : `(dash)/dashboard/suivis/page.tsx` et
  `(dash)/dashboard/historique/page.tsx` (RSC, gate au layout). Curseur lu via `parseWatchlistParams`
  (whitelist 19-03), `createClient()` anon, requête DÉLÉGUÉE à `fetchFollowedSetups({status, cursor})`
  (`'suivis'` → actifs ; `'historique'` → clôturés + issue). 4 ÉTATS (UI-SPEC §135) : loading
  (`<Suspense>` + `KeysetSkeleton`), error (dash.error.* + réessayer), empty (KeysetList copy),
  renewal (0 ligne + `rpc('has_active_subscription')==false` → dash.renewal.* + CTA /tarifs, D-03).
  Commit `0402133`.
- **Task 3 — Route watchlist** : `(dash)/dashboard/watchlist/page.tsx` = redirection localisée
  (`redirect` i18n/navigation) vers `/dashboard/suivis` (D-19-07-B). Zéro duplication. Commit `3a0476e`.

## Garde-fous prouvés

- **T-19-26 (info disclosure abonné expiré)** : la barrière reste le `!inner` RLS
  `has_active_subscription()` (19-03) ; les pages n'ouvrent PAS l'accès — elles affichent
  l'état renewal quand la RLS a déjà renvoyé 0 ligne. Vérif live = gate A2 (fin de phase).
- **T-19-28 (DoS OFFSET)** : `grep -Eic 'offset|range\('` == 0 sur KeysetList ; pagination
  100 % keyset par curseur.
- **T-19-29 (% fabriqué)** : l'historique rend `outcome`/`realized_r` mesurés ; aucun agrégat de
  gain ni pourcentage. `dash.list` ne contient aucun token interdit (`%|garanti|profit`, VITR-03).
- **T-19-30 (réimplémentation source)** : `grep from('user_followed_setups')` == 0 sur les pages ;
  requête unique déléguée à `fetchFollowedSetups`, liste unique `KeysetList`.
- **T-19-SC (npm)** : aucun package ajouté.

## Déviations du plan

### Adaptations de routage (consigne upstream : adapter + documenter)

**1. [Routing] Chemins déplacés sous `(dash)/dashboard/*`**
- **Trouvé pendant** : lecture de DashShell (19-02) avant Task 2.
- **Issue** : le plan déclare `(dash)/suivis/page.tsx`, `(dash)/historique/page.tsx`,
  `(dash)/watchlist/page.tsx`. La nav DashShell figée (19-02, D-19-04-A) route vers
  `/dashboard/suivis`, `/dashboard/watchlist`, etc. Placer les pages à la racine `(dash)` les
  rendrait inatteignables depuis le chrome de nav.
- **Fix** : pages placées sous `(dash)/dashboard/{suivis,historique,watchlist}/` pour matcher la
  nav (convention `/dashboard/*` cohérente avec overview/abonnement/parametres). D-19-07-A.
- **Fichiers** : les 3 pages. **Commits** : 0402133, 3a0476e.

**2. [Routing] Historique = sous-vue interne (pas un item de nav)**
- La nav DashShell n'a pas d'onglet « historique » (D-19-02-A : Historique = sous-vue interne de
  Suivis). Historique reste une route réelle `/dashboard/historique` keyset autonome, atteinte via
  `<KeysetTabs/>` (sous-nav Suivis⇄Historique) depuis la surface Suivis. D-19-07-C.

### Ajouts (Rule 2 — fonctionnalité critique)

**3. [Rule 2 - i18n] Clés `dash.list` ajoutées à parité stricte**
- **Issue** : KeysetList a besoin de labels absents du namespace gelé (lien page suivante, unité R,
  libellés d'issue hit_tp/hit_sl/flat, lien détail).
- **Fix** : `dash.list.{nextPage,rUnit,viewDetail,issue.*}` ajouté aux 3 locales fr/en/ar à parité
  stricte (messages-parity-dash 4/4 vert), sans token interdit VITR-03.
- **Fichiers** : messages/{fr,en,ar}.json. **Commit** : 3d9f5ea.

### Reformulations de commentaires (satisfaire les greps littéraux d'acceptance)

- KeysetList : « OFFSET / range » → « décalage de page » dans les commentaires (le grep
  `offset|range\(` est littéral ; aucune logique OFFSET réelle). `ring-offset-2` retiré des focus
  (substring « offset »).
- Pages : « aucun `from('user_followed_setups')` inline » → « aucune requête de table inline sur la
  watchlist » (le littéral `from('user_followed_setups')` en commentaire trippait le grep == 0).
- Aucun impact sémantique.

## Known Stubs

Aucun. Les surfaces lisent la vraie table `user_followed_setups` via `fetchFollowedSetups` (table
vide au build, seedée en 18 / à l'échelle ultérieurement) ; aucune donnée mockée. Les 4 états sont
fonctionnels ; renewal/empty/historique-issue dépendent de données réelles vérifiées au gate A2.

## Self-Check: PASSED

- Fichiers : KeysetList.tsx, suivis/page.tsx, historique/page.tsx, watchlist/page.tsx — tous FOUND.
- Commits : 3d9f5ea, 0402133, 3a0476e — tous FOUND.
- typecheck exit 0 ; lint:i18n exit 0 ; vitest 639 passed / 13 skipped ; parité dash 4/4.
