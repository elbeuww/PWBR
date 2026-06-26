---
phase: 19-dashboard-utilisateur
plan: 06
subsystem: web-member-write
tags: [watchlist, idor, optimistic, react-query, anon-client, udash-03, toggle]
requires:
  - "19-01: table user_followed_setups LIVE + 3 policies RLS scopées auth.uid() (insert with-check/delete/select) + default auth.uid()"
  - "19-02: namespace i18n dash (dash.watchlist.add/remove/error) à parité fr/en/ar"
  - "19-03: lib/watchlist/queries.ts — fetchFollowedSetupIds (Set<setup_id>) anon RLS-scopé"
provides:
  - "components/dash/WatchlistToggle.tsx — étoile optimiste anti-IDOR (insert/delete anon-client) + helper pur buildWatchlistToggle"
  - "SignalCard/SignalDetail câblés à l'étoile (sibling du Link / en-tête détail) + prop followed? optionnelle"
  - "SignalList propage followed par carte (Set depuis followedIds[], pas de N+1)"
  - "Pages membre signaux (liste + détail) : fetchFollowedSetupIds 1× → prop followed"
affects:
  - "19-07: liste suivis/historique (réutilise le même toggle + l'état initial)"
  - "Phase 21: E2E watchlist (toggle optimiste) + audit RLS anti-IDOR sur user_followed_setups"
tech-stack:
  added: []
  patterns:
    - "Écriture front membre via anon-client navigateur (createClient) — RLS auth.uid() = anti-IDOR, JAMAIS service_role"
    - "Insert minimal { setup_id } sans colonne propriétaire (default auth.uid() + with check) — preuve grep user_id == 0"
    - "Toggle optimiste react-query : onMutate flip / onError rollback+toast — logique extraite en helper pur testable Node (env vitest = node, pas de jsdom)"
    - "Îlot client en SIBLING hors du <Link> (conteneur relatif, end-2 top-2 z-10) — clic non capturé par la navigation"
    - "Set sérialisable RSC→client via prop followedIds[] reconstruit en Set côté liste (1 requête, pas N+1)"
key-files:
  created:
    - apps/web/src/components/dash/WatchlistToggle.tsx
    - apps/web/src/components/dash/__tests__/WatchlistToggle.test.tsx
  modified:
    - apps/web/src/components/signals/SignalCard.tsx
    - apps/web/src/components/signals/SignalDetail.tsx
    - apps/web/src/components/signals/SignalList.tsx
    - apps/web/src/components/signals/__tests__/SignalDetail.test.tsx
    - apps/web/src/app/[locale]/(member)/signaux/page.tsx
    - apps/web/src/app/[locale]/(member)/signaux/[id]/page.tsx
decisions:
  - "D-19-06-A : logique optimiste/rollback extraite dans le helper pur exporté buildWatchlistToggle(deps) plutôt qu'inline dans le composant. L'env Vitest de ce repo est `node` (pas de jsdom/@testing-library) → impossible de simuler un clic DOM. Le helper (mutationFn/onMutate/onError) est testé directement en Node ; le composant le branche sur useMutation. Preuve déterministe de l'optimiste + rollback sans dépendance DOM, zéro install (T-19-SC accept préservé)."
  - "D-19-06-B (DÉVIATION Rule 1) : l'ajout de WatchlistToggle (useMutation) dans SignalDetail a cassé SignalDetail.test.tsx (rendu statique sans QueryClientProvider → throw « No QueryClient set »). Fix : mock de ../../dash/WatchlistToggle dans ce test (sujet = contenu IA VERBATIM, hors périmètre de l'îlot client qui a son propre test dédié)."
  - "D-19-06-C (DÉVIATION Rule 1) : la page détail [id]/page.tsx rendait SignalDetail (→ WatchlistToggle/useMutation) SANS QueryProvider (contrairement à la liste qui l'a déjà). Crash runtime « No QueryClient » évité en enveloppant <SignalDetail> dans <QueryProvider> sur la page détail."
  - "D-19-06-D : étoile lucide `Star` retenue (import résolu — apps/web/node_modules/lucide-react@1.18.0, Pitfall 7 confirmé présent), pas de SVG inline. Remplissage accent via classes CSS fill-[var(--primary)]/text-[var(--primary)] qui priment sur l'attribut inline fill=\"none\" de lucide. Hit-area ≥44px (min-h-11 min-w-11)."
  - "D-19-06-E : aucun nouveau clé i18n ajoutée — dash.watchlist.add/remove/error (19-02) suffisent. Parité fr/en/ar intacte (T-19-25)."
gates:
  manual_only:
    - "Anti-IDOR live (T-19-21) : depuis une session abonné A, tenter (via devtools/PostgREST) un insert user_followed_setups portant user_id de B → doit être rejeté par with check (42501 / 0 ligne). Non automatisable ici (exige 2 sessions live + table seedée) ; le test unitaire prouve que le client n'envoie jamais de colonne propriétaire, la RLS 0020 (19-01) prouve le with check."
    - "Câblage visuel (D-06) : confirmer en navigateur que le clic sur l'étoile ne déclenche PAS la navigation du Link (sibling), flip immédiat + rollback+toast sur coupure réseau, hit-area ≥44px tactile, RTL (étoile au coin end)."
verification:
  - "pnpm vitest run apps/web/src/components/dash/__tests__/WatchlistToggle.test.tsx : 4/4 verts (optimiste + insert sans colonne propriétaire + rollback insert + delete + rollback delete)"
  - "pnpm vitest run apps/web : 223/223 verts (suite signaux non régressée après fix D-19-06-B)"
  - "pnpm typecheck (tsc -b) : vert"
  - "greps : user_id==0 / service_role==0 dans WatchlistToggle.tsx ; useMutation>=1 ; onError>=1 ; createClient>=1 ; hit-area>=1 ; WatchlistToggle dans SignalCard+SignalDetail ; SignalCard sans 'use client' ; fetchFollowedSetupIds 1× par page membre"
metrics:
  duration: ~18min
  completed: 2026-06-26
---

# 19-06 — WatchlistToggle anti-IDOR optimiste + câblage carte/détail

## Réalisé

- **Task 1 (TDD)** : `components/dash/WatchlistToggle.tsx` — étoile de suivi.
  Écriture `user_followed_setups` via **anon-client navigateur** (`createClient`),
  RLS `(select auth.uid())` (0020) = anti-IDOR. Insert minimal `{ setup_id }` (JAMAIS
  de colonne propriétaire : `default auth.uid()` + `with check`). Toggle **optimiste**
  (react-query) : `onMutate` flip immédiat, `onError` rollback + `toast.error`. Logique
  extraite en helper pur `buildWatchlistToggle` (D-19-06-A) → testé en Node. RED
  (`e502e90`, module introuvable) → GREEN (`189b1f5`, 4/4). lucide `Star` rempli
  `--primary`, hit-area ≥44px, aria `dash.watchlist.add/remove`.
- **Task 2** : `SignalCard.tsx` + `SignalDetail.tsx` câblés. L'étoile est un **SIBLING**
  hors du `<Link>` (conteneur relatif, `end-2 top-2 z-10` sur la carte ; en-tête sur le
  détail) → clic non capturé par la navigation. Prop `followed?: boolean` optionnelle
  (rétro-compatible). SignalCard reste server-renderable. Fix régression test (D-19-06-B).
  (`afb63fd`)
- **Task 3** : pages membre `signaux/page.tsx` + `signaux/[id]/page.tsx`. UNE requête
  `fetchFollowedSetupIds(supabase)` (anon RLS) → `followedIds[]` propagé à `SignalList`
  (reconstruit en Set, `followed` par carte, pas de N+1) et `followed` au `SignalDetail`.
  Échec fetch → Set vide (dégradation gracieuse). QueryProvider ajouté à la page détail
  (D-19-06-C). Gate `(member)` requireActiveSub intact (layout inchangé). (`1d94e71`)

## Garde-fous prouvés

- **T-19-21/22 (anti-IDOR + no service-role)** : grep `user_id` == 0 et `service_role`
  == 0 dans WatchlistToggle ; insert ne transporte que `setup_id` ; client anon seul.
- **T-19-23 (clic capturé)** : étoile structurellement SIBLING du `<Link>`.
- **T-19-24 (N+1)** : `fetchFollowedSetupIds` 1× par page → Set, prop par carte.
- **T-19-25 (i18n)** : aria via `dash.watchlist.*` existants, aucune chaîne en dur,
  parité fr/en/ar préservée (zéro clé ajoutée).

## Déviations du plan

### Corrections automatiques (Rule 1 — régressions induites par le câblage)

**1. [Rule 1 - Bug] SignalDetail.test.tsx cassé par l'îlot client**
- **Trouvé pendant** : Task 2
- **Issue** : ajouter `<WatchlistToggle>` (useMutation) dans SignalDetail fait échouer
  son test de rendu statique (`renderToStaticMarkup` sans QueryClientProvider → throw).
- **Fix** : mock `../../dash/WatchlistToggle` dans SignalDetail.test (hors sujet du test
  VERBATIM ; le toggle a son propre test dédié).
- **Fichiers** : apps/web/src/components/signals/__tests__/SignalDetail.test.tsx
- **Commit** : afb63fd

**2. [Rule 1 - Bug] Page détail sans QueryProvider → crash runtime**
- **Trouvé pendant** : Task 3
- **Issue** : `[id]/page.tsx` rend SignalDetail (→ WatchlistToggle/useMutation) sans
  QueryProvider (la page liste l'a déjà via QueryProvider autour de SignalList) →
  « No QueryClient set » au runtime.
- **Fix** : envelopper `<SignalDetail>` dans `<QueryProvider>` sur la page détail.
- **Fichiers** : apps/web/src/app/[locale]/(member)/signaux/[id]/page.tsx
- **Commit** : 1d94e71

Sinon : plan exécuté tel qu'écrit (toggle optimiste, sibling hors Link, fetch 1×).

## Stubs / dette

Aucun stub. Le toggle écrit la vraie table `user_followed_setups` (vide au build,
seedée ultérieurement) ; l'état initial vient de `fetchFollowedSetupIds` (données
réelles RLS-scopées). Le rendu suivis/historique paginé reste à 19-07.

## Self-Check: PASSED

- Fichiers : WatchlistToggle.tsx, WatchlistToggle.test.tsx, SignalCard.tsx,
  SignalDetail.tsx, SignalList.tsx — tous FOUND.
- Commits : e502e90, 189b1f5, afb63fd, 1d94e71 — tous FOUND.
- WatchlistToggle 4/4 ; suite apps/web 223/223 ; typecheck vert ; greps anti-IDOR OK.
