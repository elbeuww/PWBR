---
status: complete
phase: 17-fondation-db-scalable-perf-avant-charge
source: [17-01-SUMMARY.md, 17-02-SUMMARY.md, 17-03-SUMMARY.md]
started: 2026-06-25T00:00:00Z
updated: 2026-06-25T01:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Tuer le serveur, vider .next/caches, relancer `pnpm dev` à froid. L'app boot sans erreur, la page Signaux charge, données live remontent de Supabase (RLS wrappées servent toujours l'abonné). Pas de 500, pas d'erreur RLS console.
result: pass

### 2. Badge "nouveaux signaux" live (abonné, INSERT Broadcast)
expected: En session abonné actif sur la page Signaux, un INSERT d'un nouveau `trade_setups` (status=active) fait s'incrémenter le badge « N nouveaux signaux » EN DIRECT, sans refresh.
result: pass

### 3. Shape payload Broadcast (A4)
expected: Dans la console navigateur, le payload Broadcast reçu expose la donnée en `payload.payload.record` (forme realtime.broadcast_changes), PAS `payload.new`. Le mapping SignalList lit le bon chemin.
result: pass
note: Vérifié fonctionnellement via Test 4 — l'UPDATE lit `payload.payload.record.status` et retire la carte en direct ; un shape `payload.new` aurait laissé la carte.

### 4. UPDATE retire la carte en direct (D-14)
expected: Passer un `trade_setups` existant à `status != 'active'` fait disparaître sa carte EN DIRECT dans la session abonné, sans refresh.
result: pass

### 5. Non-abonné ne reçoit AUCUN event (parité sécurité)
expected: En session anonyme / non-abonnée, le même INSERT ne produit AUCUN event Broadcast (la policy RLS `realtime.messages` bloque le canal privé). Le badge ne bouge pas.
result: pass
note: Non-abonné anonyme (incognito) redirigé vers /fr/login par requireActiveSub() — surface Signaux inaccessible, canal jamais monté. Barrière canal (realtime.messages RLS) additionnellement couverte par signals-rls + gate 6.

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
