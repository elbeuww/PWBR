---
status: partial
phase: 03-espace-membre-signaux-gated-rls
source: [03-VERIFICATION.md]
started: 2026-06-15T00:00:00Z
updated: 2026-06-15T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Rendu visuel grille SignalCard (D-03 color law)
expected: Naviguer vers /fr/signaux en abonné actif → cartes affichées avec actif/direction/score/risque/R:R/fraîcheur ; direction long en vert, short en rouge, score en couleur neutre (--primary)
result: [pending]

### 2. Filtres style + risque URL-sync
expected: Appliquer style (day/swing) + risque (low/medium/high/extreme) → URL modifiée (?style=day&risk=medium), liste filtrée, filtres cumulables, bouton Réinitialiser visible
result: [pending]

### 3. Filtre classe d'actif (CR-02 pré-résolution)
expected: Filtrer par classe 'crypto' via le select FilterBar → seuls les instruments crypto apparaissent (la pré-résolution des instrument_ids filtre réellement, aucune fuite d'autres classes)
result: [pending]

### 4. CandleChart lightweight-charts v5
expected: Ouvrir /fr/signaux/[id] d'un trade actif → chart chandeliers monté client-only (next/dynamic ssr:false), 3 price lines légendées : entrée (bleu dashed), SL (rouge), TP (vert)
result: [pending]

### 5. Contenu IA VERBATIM (niveaux 1 + 2)
expected: Détail → niveau 1 veteran_note VERBATIM ; niveau 2 (dépliable) raisons technique/fondamentale/news VERBATIM + invalidation VERBATIM ; aucune reformulation, aucun HTML injecté
result: [pending]

### 6. Badge Realtime INSERT
expected: Page signaux ouverte, publication d'un nouveau setup status=active → badge 'N nouveaux' apparaît sans reflow, disparaît au clic, nouvelle carte insérée
result: [pending]

### 7. Retrait live UPDATE (D-14)
expected: Un signal passe active → expired pendant que la liste est ouverte → la carte disparaît en direct (removedIds) sans recharger
result: [pending]

### 8. Repli Realtime CHANNEL_ERROR
expected: Couper la connexion Realtime → message 'signals.realtimeLost' discret, liste continue de se rafraîchir toutes les 60s
result: [pending]

### 9. Test E2E Playwright signals-rls.spec.ts
expected: Avec .env.local (NEXT_PUBLIC_SUPABASE_URL/ANON_KEY) + next dev + Supabase live → 3 tests verts : non-abonné lit 0 trade_setup, non-abonné redirigé vers /tarifs, visiteur non-auth redirigé vers /login?returnTo= (skip propre sans env)
result: [pending]

### 10. Anti-IDOR signal expiré (T-03-IDOR)
expected: Accès direct à /fr/signaux/[id] avec un id de signal expiré (status=expired) → notFound() (404), aucune fuite de données
result: [pending]

## Summary

total: 10
passed: 0
issues: 0
pending: 10
skipped: 0
blocked: 0

## Gaps
