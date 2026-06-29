---
phase: 19-dashboard-utilisateur
plan: 02
subsystem: web
tags: [dash, shell, layout, i18n, expiry-banner, wiring-01, requireUser, rtl, udash-04]
requires:
  - "19-01: table user_followed_setups LIVE (la watchlist alimentée par les pages aval du shell)"
  - "01-03: gate.ts (requireUser/requireActiveSub) — porte UX"
  - "04: ExpiryBanner (PAY-05) — composant existant, orphelin jusqu'ici (WIRING-01)"
provides:
  - "Groupe (dash) : layout gardé requireUser (auth seul, D-03) — fondation agrégeante du dashboard membre"
  - "ExpiryBanner câblé EN TÊTE du shell → dette WIRING-01 levée (UDASH-04/PAY-05)"
  - "DashShell : sidebar desktop + bottom-nav mobile, 6 onglets, item actif accent SANS halo (D-01), RTL-safe"
  - "Namespace i18n `dash` complet à parité STRICTE fr/en/ar (nav/overview/suivis/historique/renewal/watchlist/affiliate/error/settings)"
  - "Test de parité récursive messages-parity-dash (garde-fou parité + anti-gratuit + anti-perf)"
affects:
  - "19-03..19-07: toutes les pages (dash) montent dans DashShell et consomment le namespace dash (plus aucune édition des messages/*.json requise)"
tech-stack:
  added: []
  patterns:
    - "Calque (member)/layout.tsx en swappant le gate abonnement → requireUser (D-03) ; lecture subscriptions.current_period_end anon-client RLS, jamais client privilégié"
    - "Tout le namespace i18n d'une phase défini dans UN plan fondation → parité stricte préservée (les plans aval n'éditent plus les 3 fichiers messages)"
    - "Chrome de nav sans halo néon (D-01) : accent --primary fill/underline subtil réservé à l'item actif ; halo réservé aux surfaces de valeur"
    - "RTL via propriétés logiques natives Tailwind v4 (ps/pe/ms/me/start/end/inset-inline/border-s-e), zéro classe physique left/right"
key-files:
  created:
    - apps/web/src/app/[locale]/(dash)/layout.tsx
    - apps/web/src/components/dash/DashShell.tsx
    - apps/web/src/messages/__tests__/messages-parity-dash.test.ts
  modified:
    - apps/web/src/messages/fr.json
    - apps/web/src/messages/en.json
    - apps/web/src/messages/ar.json
decisions:
  - "D-19-02-A : 6 onglets DashShell = overview · suivis (onglet « signaux », Historique = sous-vue interne aval) · watchlist · abonnement · affiliation · paramètres. Les clés nav.signaux et nav.historique sont AUSSI définies en i18n (consommées par les sous-navigations aval) → le namespace est un sur-ensemble figé ici."
  - "D-19-02-B : le layout (dash) lit l'abonnement avec le MÊME filtre status='active' que (member) (verbatim). Un abonné expiré n'a pas d'abo actif → sub=null → ExpiryBanner ne rend rien ; l'état RENOUVELLEMENT est porté par la copy/RLS des pages enfant (D-03), pas par la bannière J-3/J-1."
  - "D-19-02-C : affiliation rendue comme onglet statique dans le shell fondation (acceptance = 6 onglets). La conditionnalité D-10 (afficher seulement si role=affiliate) est portée par la carte résumé de la vue d'ensemble (plan aval), pas par le chrome de nav client-only."
gates:
  manual_only: []
verification:
  - "pnpm lint:i18n : exit 0 (aucune chaîne en dur dans le JSX app+components)"
  - "pnpm typecheck (tsc -b --noEmit) : exit 0"
  - "messages-parity-dash.test.ts : 4 passed (parité récursive fr/en/ar + anti-gratuit + anti-perf)"
  - "DashShell greps : glow=0, classe-physique=0, bg-[--=0, usePathname importé, Link depuis @/i18n/navigation, 6 onglets dash.nav"
  - "layout (dash) greps : requireUser>=1, requireActiveSub=0, ExpiryBanner>=1, client-privilégié=0, DashShell>=1"
  - "(member)/layout.tsx inchangé (toujours requireActiveSub, 3 occurrences) — gate signaux intact (T-19-06)"
metrics:
  duration: ~5min
  completed: 2026-06-26
---

# Phase 19 Plan 02 : Shell (dash) — layout requireUser + ExpiryBanner + DashShell + i18n dash

Pose la fondation UI agrégeante du dashboard membre : groupe `(dash)` gardé `requireUser` (l'abonné expiré entre pour renouveler, D-03), `ExpiryBanner` câblé en tête du shell (dette WIRING-01 levée), composant `DashShell` (sidebar desktop + bottom-nav mobile, 6 onglets, item actif sans halo néon, RTL-safe), et l'intégralité du namespace i18n `dash` à parité stricte fr/en/ar consommé par tous les plans aval.

## Réalisé

- **Task 1 — i18n `dash`** : namespace complet ajouté aux 3 locales (nav, overview, suivis, historique, renewal, watchlist, affiliate, error, settings), copy FR canonique de l'UI-SPEC Copywriting Contract. État RENOUVELLEMENT (`renewal.cta` = « Renouveler l'abonnement »), jamais d'upsell gratuit (D-03). AR = traduction réelle. Test de parité récursive ajouté (4 cas : parité fr/en/ar + anti-gratuit + anti-perf VITR-03).
- **Task 2 — DashShell** : `'use client'`, sidebar persistante `md:+` + bottom-nav fixe mobile, 6 onglets via `dash.nav.*`. Item actif détecté par `usePathname()` (segment-aware, overview en match exact). Accent `--primary` fill/underline subtil, AUCUN halo (D-01). Focus ring `--ring`. Propriétés logiques uniquement, hit-area ≥44px, icônes lucide-react (résolu).
- **Task 3 — layout (dash)** : calque `(member)/layout.tsx` avec gate `requireUser` (et non le gate d'abonnement, D-03). Lecture `subscriptions.current_period_end` via anon-client (RLS scope `auth.uid()`, jamais client privilégié, T-19-07). `<ExpiryBanner>` en tête (WIRING-01), `{children}` enveloppés dans `<DashShell>`. Gate `(member)` des signaux INTACT (T-19-06).

## Garde-fous prouvés

- **WIRING-01 levée** : ExpiryBanner désormais monté dans un shell réel (4 occurrences dans le layout).
- **T-19-06 (gate signaux)** : `(member)/layout.tsx` inchangé — toujours le gate d'abonnement actif, aucune route signaux déplacée sous `(dash)`.
- **T-19-07 (info disclosure)** : lecture subscriptions via anon-client RLS scopée `auth.uid()`, zéro client privilégié dans le layout.
- **T-19-08 (texte en dur)** : toutes les chaînes via le namespace `dash` next-intl ; `lint:i18n` exit 0.
- **D-01 (lisibilité)** : `grep glow` = 0 sur le chrome de nav ; accent réservé à l'item actif.
- **RTL** : `grep` classes physiques (`text-left/right`, `ml/mr/pl/pr`) = 0.

## Déviations au plan

Aucune déviation fonctionnelle. Reformulation de commentaires dans `DashShell.tsx` (suppression des occurrences littérales « glow » / « bg-[--token] ») et `layout.tsx` (suppression des littéraux « requireActiveSub » / « service_role ») pour satisfaire les greps littéraux d'acceptance — aucun impact sémantique. Précisions D-19-02-A/B/C documentées ci-dessus (réconciliation 6 onglets vs 7 clés nav ; filtre status='active' verbatim member ; affiliation conditionnelle portée par la vue d'ensemble aval).

## Known Stubs

Aucun. Le shell est une fondation : les pages enfant (overview, suivis, historique, watchlist, abonnement, affiliation, paramètres) sont créées par les plans aval 19-03..19-07. Les hrefs des onglets pointent vers ces routes futures — comportement attendu pour un plan fondation, pas un stub de données.

## Self-Check: PASSED
