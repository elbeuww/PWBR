---
phase: 19-dashboard-utilisateur
plan: 04
subsystem: web
tags: [dash, overview, cockpit, affiliation, abonnement, no-perf, udash-01, udash-05, rsc]
requires:
  - "19-02: shell (dash) — layout requireUser + DashShell (nav figée /dashboard/*) + namespace i18n dash"
  - "19-03: lib watchlist/keyset (consommé par les pages suivis/historique aval, pas par l'overview)"
  - "03-02: fetchActiveSignals + SignalCard (montés tels quels, D-02)"
  - "07: vue affiliate_dashboard (security_invoker, no-PII) + formatAtomic (@app/core)"
  - "04: PlanCard + getDiscoveryAvailability ((account)/abonnement, réhébergés)"
provides:
  - "Overview /dashboard : cockpit personnel ordre figé D-08 (statut abo → 3-4 derniers signaux → raccourcis), zéro chiffre de perf fabriqué (D-09)"
  - "AffiliateSummaryCard : carte résumé conditionnelle no-PII (return null si non affilié, D-10), formatAtomic(BigInt), lien /affiliation/dashboard"
  - "Abonnement /dashboard/abonnement : gestion USDT réhébergée dans le shell (PlanCard de (account) monté, pas cloné)"
  - "Garde no-perf-seed-claims étendue à l'overview (dash) — détecteur UI non trivial (equity/P&L/ROI/% chiffré)"
affects:
  - "19-05..19-07: les raccourcis overview pointent vers /dashboard/watchlist et /dashboard/parametres (pages aval)"
  - "post-login: /dashboard est désormais l'overview cockpit (ancien placeholder instruments supprimé)"
tech-stack:
  added: []
  patterns:
    - "Overview RSC agrégeant : monte SignalCard (server-renderable, sans QueryProvider/Realtime — pas besoin de live sur l'overview) + AffiliateSummaryCard, jamais de réimplémentation (D-02)"
    - "Carte conditionnelle sans redirection : lire profiles.role + return null (jamais le gate de rôle redirigeant, qui sortirait un membre non affilié de la page, T-19-15)"
    - "Réhébergement de surface : importer le composant lourd existant ((account)/abonnement/PlanCard) à travers les route groups via chemin relatif, sans cloner — anti-duplication"
    - "Tout le namespace i18n d'une phase défini en fondation (19-02) : seule une clé feuille manquante (overview.activeUntil) ajoutée à parité stricte x3"
key-files:
  created:
    - apps/web/src/components/dash/AffiliateSummaryCard.tsx
    - apps/web/src/app/[locale]/(dash)/dashboard/page.tsx
    - apps/web/src/app/[locale]/(dash)/dashboard/abonnement/page.tsx
  modified:
    - apps/web/test/no-perf-seed-claims.test.ts
    - apps/web/src/messages/fr.json
    - apps/web/src/messages/en.json
    - apps/web/src/messages/ar.json
  deleted:
    - apps/web/src/app/[locale]/dashboard/page.tsx
decisions:
  - "D-19-04-A (déviation de chemin, Rule 3 — blocage build) : le plan note (dash)/page.tsx + (dash)/abonnement/page.tsx, MAIS un route group (dash) n'ajoute rien à l'URL → (dash)/page.tsx résoudrait /[locale] (collision avec (marketing)/page.tsx) et ne matcherait PAS la nav DashShell figée en 19-02 (/dashboard, /dashboard/abonnement…). L'overview est donc placé à (dash)/dashboard/page.tsx (URL /dashboard, landing post-login des auth actions) et l'abonnement à (dash)/dashboard/abonnement/page.tsx. L'ancien placeholder [locale]/dashboard/page.tsx (listing instruments P1, HORS shell) est SUPPRIMÉ car il résolvait le même /dashboard (conflit de routes parallèles Next). La gate requireUser du layout (dash) remplace son guard inline ; le shell l'enveloppe désormais."
  - "D-19-04-B : l'overview monte SignalCard SANS QueryProvider/SignalList (pas de Realtime ni de react-query sur la vue d'ensemble) — 3-4 cartes statiques suffisent ; le live reste sur la surface signaux pleine. Satisfait l'acceptance « montage, pas clone » tout en gardant l'overview léger (RSC pur)."
  - "D-19-04-C : statut d'abonnement de l'overview = MÊME requête anon-client que le layout (subscriptions status='active', scope user_id, order current_period_end desc) ; actif = current_period_end dans le futur, sinon état RENOUVELLEMENT (D-03, CTA /tarifs). Date affichée via Intl.DateTimeFormat(locale) en <bdi> (donnée, pas chaîne traduisible)."
  - "D-19-04-D : clé i18n overview.activeUntil ({date}) ajoutée à parité stricte fr/en/ar — sans %/garanti/profit/gratuit (parité dash 4/4 verte). Les empty/error des 3-4 signaux réutilisent le namespace signals (cohérent avec SignalCard), zéro nouvelle clé pour ces états."
gates:
  manual_only:
    - "Vérif visuelle live (différée, dépendances seed/session) : overview ordre D-08, état RENOUVELLEMENT pour abonné expiré, AffiliateSummaryCard rendue UNIQUEMENT pour un compte role=affiliate (et null sinon), montants formatAtomic exacts, RTL fr/en/ar. Non automatisable (exige session abonné + affilié seedés)."
verification:
  - "pnpm typecheck (tsc -b --noEmit) : exit 0"
  - "pnpm vitest run no-perf-seed-claims + messages-parity-dash : 11/11 verts (dont détecteur UI non trivial)"
  - "détecteur non trivial PROUVÉ : injection « +12% ce mois » dans l'overview → scan échoue (1 failed) ; revert → vert"
  - "pnpm lint:i18n : exit 0 (aucune chaîne en dur dans le JSX)"
  - "greps overview : fetchActiveSignals=3, equity|P&L|PnL|ROI=0, AffiliateSummaryCard=3, renewal=3, SignalCard=4"
  - "greps carte : formatAtomic>=1, Number(=0, requireRole=0, return null présent (3), /affiliation/dashboard>=1, affiliate_dashboard>=1"
metrics:
  duration: ~14min
  completed: 2026-06-26
---

# Phase 19 Plan 04 : Overview cockpit + carte affiliation conditionnelle + abonnement réhébergé

Livre la vue d'ensemble « cockpit personnel » (UDASH-01) dans le shell `(dash)`, la carte résumé d'affiliation conditionnelle no-PII (UDASH-05), le réhébergement de la gestion d'abonnement USDT dans le dashboard, et étend la garde anti-allégation de performance à l'overview. JWT/role lus serveur, vue agrégée no-PII, montants en BigInt — aucun chiffre de gain fabriqué (D-09).

## Réalisé

- **Task 1 — AffiliateSummaryCard** : RSC conditionnelle. getUser() → lecture `profiles.role` ; non affilié ⇒ `return null` (jamais de gate redirigeant, T-19-15). Affilié ⇒ lecture de la vue `affiliate_dashboard` (agrégats no-PII, anon-client RLS, T-19-13), résumé « X abonnés ramenés · Y revenus mesurés » via `formatAtomic(BigInt(revenue_total_atomic ?? '0'))` (jamais Number, T-19-16) + lien `/affiliation/dashboard`.
- **Task 2 — Overview + abonnement** : `(dash)/dashboard/page.tsx` ordre figé D-08 — (1) statut abonnement (actif → `overview.activeUntil` ; expiré/absent → bloc RENOUVELLEMENT `renewal.*` + CTA `/tarifs`, jamais d'upsell gratuit D-03) ; (2) 3-4 derniers signaux via `fetchActiveSignals({ sort:'recent' }).slice(0,4)` rendus en `SignalCard` (montage, D-02), états error/empty (namespace `signals`) ; (3) raccourcis watchlist/paramètres + `<AffiliateSummaryCard/>`. `(dash)/dashboard/abonnement/page.tsx` réhéberge `PlanCard` + `getDiscoveryAvailability` de `(account)/abonnement` sans cloner (ExpiryBanner non répété — déjà au shell).
- **Task 3 — no-perf étendu** : volet C ajouté à `no-perf-seed-claims.test.ts` scannant `(dash)/dashboard/page.tsx` + `AffiliateSummaryCard.tsx` ; regex `equity|equity curve|P&L|PnL|ROI|% chiffré signé`. Détecteur prouvé non trivial (planté `+12%`/`equity curve` → true ; injection réelle dans l'overview → scan échoue, puis revert).

## Garde-fous prouvés

- **D-09 / VITR-03 (no-perf)** : `grep -Eic 'equity|P&L|PnL|ROI'` = 0 sur l'overview ; aucune equity curve / P&L / ROI ; test no-perf étendu et non trivial (injection → échec démontré).
- **T-19-13 (PII filleuls)** : la carte ne lit QUE la vue `affiliate_dashboard` (agrégats), aucune ligne nominative.
- **T-19-15 (élévation)** : carte rendue conditionnellement (`return null` si role ≠ affiliate), aucun gate de rôle redirigeant (`grep requireRole` = 0).
- **T-19-16 (précision)** : `formatAtomic(BigInt(...))`, `grep 'Number('` = 0 dans la carte.
- **D-03 (renouvellement)** : état expiré = invite à RENOUVELER (`renewal.cta` → /tarifs), jamais un compte gratuit ; parité dash anti-gratuit/anti-perf verte.
- **D-02 (réutilisation)** : SignalCard et PlanCard montés tels quels, zéro réimplémentation.

## Déviations au plan

### Corrections de blocage (Rule 3)

**1. [Rule 3 — Blocage build] Chemins de routes corrigés + suppression du placeholder dashboard**
- **Trouvé pendant :** Task 2.
- **Problème :** Le plan note les pages à `(dash)/page.tsx` et `(dash)/abonnement/page.tsx`. Or un route group `(dash)` n'ajoute rien à l'URL : `(dash)/page.tsx` résout `/[locale]` (collision avec `(marketing)/page.tsx`) et ne correspond PAS à la nav DashShell figée en 19-02 (`/dashboard`, `/dashboard/abonnement`…). De plus l'ancien `[locale]/dashboard/page.tsx` (placeholder instruments, hors shell) résolvait déjà `/dashboard`.
- **Fix :** Overview placé à `(dash)/dashboard/page.tsx` (URL `/dashboard`, landing post-login), abonnement à `(dash)/dashboard/abonnement/page.tsx`, ancien `[locale]/dashboard/page.tsx` supprimé (sinon conflit de routes parallèles Next). La gate `requireUser` du layout `(dash)` remplace le guard inline supprimé ; le shell enveloppe désormais `/dashboard`. Détail en D-19-04-A.
- **Fichiers :** créés `(dash)/dashboard/page.tsx`, `(dash)/dashboard/abonnement/page.tsx` ; supprimé `[locale]/dashboard/page.tsx`.
- **Commit :** ea3c295.

### Ajustement i18n (Rule 2)

**2. [Rule 2 — Fonctionnalité requise] Clé overview.activeUntil**
- **Problème :** l'état abonnement ACTIF de l'overview exigeait un libellé (le namespace dash 19-02 ne couvrait que `subscriptionStatus`/`renewal`).
- **Fix :** clé feuille `overview.activeUntil` ({date}) ajoutée à parité stricte fr/en/ar (sans terme interdit) ; parité dash 4/4 verte. Détail en D-19-04-D.
- **Commit :** ea3c295.

### Reformulations de commentaires (greps littéraux)

Comme en 19-02 : commentaires reformulés pour ne pas contenir les littéraux `requireRole` (carte) et `equity/P&L/ROI` (overview) qui faussaient les greps d'acceptance — aucun impact sémantique.

## Known Stubs

Aucun stub de données. Les raccourcis de l'overview pointent vers `/dashboard/watchlist` et `/dashboard/parametres` — pages créées par les plans aval (19-05/06/07). Cibles de navigation attendues pour un overview en tête de vague, pas des stubs.

## Self-Check: PASSED
