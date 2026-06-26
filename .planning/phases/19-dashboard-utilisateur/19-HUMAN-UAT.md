---
status: partial
phase: 19-dashboard-utilisateur
source: [19-VERIFICATION.md]
started: 2026-06-26T00:00:00Z
updated: 2026-06-26T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Vue d'ensemble (cockpit) en live
expected: Connecté avec un compte abonné actif et une DB seedée, `/dashboard` rend le cockpit personnel (UDASH-01) avec des données réelles — pas de claims de performance (equity/P&L/ROI absents), carte affiliation visible uniquement si affilié.
result: [pending]

### 2. ExpiryBanner à J-3 / J-1
expected: Avec un abonnement proche de l'expiration (≤3 jours) en DB, l'`ExpiryBanner` s'affiche en tête du shell `(dash)` avec le CTA de renouvellement (résout WIRING-01).
result: [pending]

### 3. Abonné expiré → 0 ligne + état renewal
expected: Connecté avec un compte expiré, les surfaces Suivis et Historique lisent 0 ligne (barrière RLS `has_active_subscription()` + `!inner`) et affichent l'état **renewal** (« Renouveler »), pas l'état empty. Anti-IDOR live confirmé.
result: [pending]

### 4. Plan keyset → Index Scan
expected: `EXPLAIN` sur la requête `user_followed_setups ⋈ trade_setups` keyset (via MCP `execute_sql` sur la DB distante, seed à l'échelle) montre un **Index Scan** sur l'index keyset 0020 — pas de Seq Scan.
result: [pending]

### 5. WatchlistToggle : flip optimiste + rollback
expected: Dans le navigateur, cliquer l'étoile sur `SignalCard` / `SignalDetail` bascule l'état immédiatement (optimiste) ; en cas d'échec réseau l'état revient en arrière (rollback) avec `toast.error`. L'étoile est un sibling du `<Link>` (pas de navigation parasite au clic).
result: [pending]

### 6. Test anti-IDOR vert avec credentials
expected: Avec `.env.test` (URL + clés Supabase de test) renseigné, `user-followed-rls.test.ts` ne skip plus et passe : l'insert avec `user_id` usurpé est rejeté par la RLS (erreur non-null).
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
