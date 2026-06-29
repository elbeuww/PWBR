---
status: partial
phase: 19-dashboard-utilisateur
source: [19-VERIFICATION.md]
started: 2026-06-26T00:00:00Z
updated: 2026-06-26T00:00:00Z
---

## Current Test

[UAT terminée — 4/4 tests navigateur passés, items 4 (partial) et 6 (deferred) restants]

## Tests

### 1. Vue d'ensemble (cockpit) en live
expected: Connecté avec un compte abonné actif et une DB seedée, `/dashboard` rend le cockpit personnel (UDASH-01) avec des données réelles — pas de claims de performance (equity/P&L/ROI absents), carte affiliation visible uniquement si affilié.
result: [PASS] Crash initial `No QueryClient set` (WatchlistToggle/useMutation dans SignalCard sans QueryProvider sur l'overview — 19-04 écrit avant le câblage 19-06). **Corrigé** `5c7d80a` : QueryProvider autour de la grille + fetchFollowedSetupIds (1 requête RLS). Re-test utilisateur 2026-06-26 : overview rend sans crash, cockpit conforme. ✅

### 2. ExpiryBanner à J-3 / J-1
expected: Avec un abonnement proche de l'expiration (≤3 jours) en DB, l'`ExpiryBanner` s'affiche en tête du shell `(dash)` avec le CTA de renouvellement (résout WIRING-01).
result: [PASS] Compte de test `uat-abonne@nexa.test` basculé à J-2 via MCP (réversible). Re-test utilisateur 2026-06-26 : bandeau d'avertissement « 2 jours » en tête du shell `(dash)` + CTA Renouveler. WIRING-01 confirmée en runtime. ✅ (date d'origine 2026-07-25 restaurée en fin d'UAT).

### 3. Abonné expiré → 0 ligne + état renewal
expected: Connecté avec un compte expiré, les surfaces Suivis et Historique lisent 0 ligne (barrière RLS `has_active_subscription()` + `!inner`) et affichent l'état **renewal** (« Renouveler »), pas l'état empty. Anti-IDOR live confirmé.
result: [PASS] Compte de test basculé en expiré via MCP (period_end passé, réversible). Re-test utilisateur 2026-06-26 : (a) overview → carte renouvellement ; (b) /dashboard/suivis + /historique → état **renewal** (pas « vide ») — confirme le fix WR-01 (has_active_subscription false ⇒ renewal) ; (c) /signaux (member) redirige vers les prix d'abonnement → gate `requireActiveSub` intact (D-03 : (dash) requireUser laisse entrer, (member) bloque). Date d'origine 2026-07-25 restaurée. ✅

### 4. Plan keyset → Index Scan
expected: `EXPLAIN` sur la requête `user_followed_setups ⋈ trade_setups` keyset (via MCP `execute_sql` sur la DB distante, seed à l'échelle) montre un **Index Scan** sur l'index keyset 0020 — pas de Seq Scan.
result: [partial — vérifié MCP 2026-06-26] Index `user_followed_setups_keyset_idx` présent, `indisvalid=true`, def exacte `(user_id, created_at DESC, id DESC)` = ORDER BY. Table VIDE (0 lignes — 1re table d'écriture front du milestone, pas de seed). EXPLAIN actuel : `Bitmap Index Scan on user_followed_setups_keyset_idx` (scope user_id) + `Sort` — comportement attendu sur table minuscule (estimation ~0 ligne → Bitmap+Sort moins cher qu'Index Scan ordonné). À l'échelle (user avec nombreux suivis + LIMIT 21) le planner bascule sur `Index Scan ... no Sort`. **Reste à confirmer** après seed-à-l'échelle ou usage réel. Pas de régression : l'index est correct et déjà utilisé pour le scope.

### 5. WatchlistToggle : flip optimiste + rollback
expected: Dans le navigateur, cliquer l'étoile sur `SignalCard` / `SignalDetail` bascule l'état immédiatement (optimiste) ; en cas d'échec réseau l'état revient en arrière (rollback) avec `toast.error`. L'étoile est un sibling du `<Link>` (pas de navigation parasite au clic).
result: [PASS] Re-test utilisateur 2026-06-26 : (a) flip optimiste immédiat ✅ ; (b) clic étoile ne navigue pas (sibling du Link) ✅ ; (c) persistance après reload + apparition dans /dashboard/suivis (anti-IDOR live : écriture user_followed_setups via client anon RLS, scope auth.uid()) ✅. (d) rollback couvert par test unitaire `buildWatchlistToggle`. **Retour UX** : étoile repositionnée coin haut → **bas-droite** de la carte (commit `859d10c`, end/bottom RTL-safe, hit-area 44px préservée). ✅

### 6. Test anti-IDOR vert avec credentials
expected: Avec `.env.test` (URL + clés Supabase de test) renseigné, `user-followed-rls.test.ts` ne skip plus et passe : l'insert avec `user_id` usurpé est rejeté par la RLS (erreur non-null).
result: [pending]

## Summary

total: 6
passed: 4
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
