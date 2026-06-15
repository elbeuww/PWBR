# 04 — Travail différé : cluster re-soumission paiement (N-1 / WR-02 / WR-04)

**Statut : OUVERT — différé après revue de code (2026-06-15).**
**Décision fondateur :** corriger les 2 Critical sécu d'abord (faits, fusionnés sur `master`), puis verifier + secure-phase, puis traiter ce cluster dans un plan dédié.

## Contexte
La revue deep (`04-REVIEW.md`) + la re-vérification ont confirmé :
- **CR-01** (anti-replay double-activation) : **CLOSED** (`d3d8284`).
- **CR-02** (coercition `Number()` sur montants atomiques) : **CLOSED** (`82ca218`).

Mais la lecture de l'architecture réelle a révélé un défaut **pré-existant** (non introduit par le fix) :

## Le problème (cluster N-1 + WR-02 + WR-04)
Architecture : `verifyPayment` est appelé **une seule fois** au submit (`HashForm`) ; `VerificationPolling` poll `getPaymentStatus` en **lecture seule** (ne ré-vérifie jamais).

Sur `tx_not_found` (tx pas encore indexée par TronGrid — fréquent car `only_confirmed=true` ⇒ ~1 min de délai), `actions.ts` passe la ligne en `status='rejected'` **sans libérer le `tx_hash` armé**. À la re-soumission du **même hash** (reload → nouvelle réservation) :
- l'ancienne ligne `rejected` détient toujours le hash réel sous `UNIQUE(tx_hash)` global → 23505 → **`replay`**.
- ⇒ une tx non indexée au 1er essai ne peut **jamais** être validée via l'UI.

Cause racine : le schéma placeholder. `tx_hash text NOT NULL` (0012:40) + unique global force les réservations à occuper un placeholder `reservation:<user>:<expected>`, ce qui :
- couple deux index uniques (amount partiel + tx_hash global) → offsets gaspillés sur lignes rejetées stales (WR-04) ;
- empêche de libérer/ré-armer un hash (WR-02).

## Correctif propre (migration 0013 + code)
1. **Migration 0013** : `tx_hash` → **nullable** ; abandonner le placeholder (réservations avec `tx_hash = NULL`, l'unique ignore les NULL) ; l'unicité de réservation portée par le seul index partiel `expected_amount_atomic where status='pending'`.
2. **`reserveOffset`** : insérer `tx_hash = null` (plus de placeholder), retirer le couplage 23505 tx_hash.
3. **`verifyPayment` / `tx_not_found`** : NE PAS garder le hash armé sur une ligne rejetée — soit laisser la ligne `pending` (hash relâché) si on introduit une re-vérification, soit relâcher `tx_hash` (→ NULL) en passant `rejected`, pour que la re-soumission du même hash ne déclenche pas `replay`.
4. **Réemploi réservation** : à la re-réservation, détecter une réservation expirée `rejected` même user/plan et la réutiliser, ou route de récupération explicite (`expired`).
5. **Appliquer la migration via MCP `apply_migration`** (PAS `supabase db push`), régénérer `database.types.ts`.
6. Tests : re-soumission après `tx_not_found` réussit ; pas d'`replay` sur hash non consommé ; offsets non gaspillés.

## Aussi à traiter (warnings revue, hors cluster)
- **WR-01** discovery one-shot TOCTOU → index unique partiel `(user_id) where plan='discovery' and status in ('pending','verified')`, mapper 23505 → `discovery_consumed`.
- **WR-03** fuite `error.message` brut dans les actions admin → mapper en codes typés, logguer le brut côté serveur (pino).
- **WR-05** `not_confirmed` repose en réalité sur le seul `only_confirmed=true` → seuil de confirmations explicite ou test + doc que le param est load-bearing.
- **WR-06** `changePlan(period)` ignore silencieusement la période (contredit D-11) → implémenter via la RPC d'activation, ou retirer `period` de l'API. **Succès partiel silencieux sur mutation d'accès — à prioriser.**
- **IN-01..04** : `unique(user_id)` sur subscriptions ; `parseFloat` display-only PaymentPanel ; `getTransferByHash` mort ; `type==='Transfer'` non asserté.

## Impact UAT immédiat
Si le hash collé est **déjà confirmé** (~1 min après l'envoi), 1er submit → `verified` (UAT OK). Le bug ne mord que sur soumission trop précoce. Non bloquant pour un run UAT contrôlé ; **bloquant avant ouverture communauté/prod.**
