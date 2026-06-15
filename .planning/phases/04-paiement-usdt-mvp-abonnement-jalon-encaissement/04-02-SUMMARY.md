---
phase: 04-paiement-usdt-mvp-abonnement-jalon-encaissement
plan: 02
subsystem: paiement — couche données (table payments, RLS, RPC atomique, repos service_role)
status: PARTIAL — bloqué au checkpoint LIVE apply (Task 2, owned orchestrateur)
tags: [money, supabase, migration, rls, rpc, anti-replay, service-role, checkpoint]
requires:
  - "0008 is_superadmin() (RLS superadmin payments)"
  - "0009 subscriptions + has_active_subscription() (RPC d'activation upsert)"
provides:
  - "supabase/migrations/0012_payments.sql: table payments + RLS producteur-unique + UNIQUE(tx_hash) GLOBAL + offset reservation + RPC activate_subscription_for_payment"
  - "packages/supabase: reserveOffset (D-05), insertPendingPayment (23505->ReplayError), getByHash, transitionPayment, OFFSET_RESERVATION_MINUTES"
  - "packages/supabase: activateForPayment (RPC), expireDue (job Plan 06), changePlan (admin Plan 06)"
  - ".env.example: TRONGRID_API_KEY, USDT_RECEIVE_ADDRESS, USDT_CONTRACT_ADDRESS, TRON_NETWORK"
affects:
  - "Plan 05 (server action soumission paiement) — consomme reserveOffset + insertPendingPayment + OFFSET_RESERVATION_MINUTES"
  - "Plan 06 (admin + job) — consomme transitionPayment + activateForPayment + expireDue + changePlan"
  - "BLOQUÉ aval: les repos ne sont pleinement type-safe qu'après application LIVE 0012 + régénération database.types.ts (Task 2 orchestrateur)"
tech-stack:
  added: []   # aucune dépendance npm
  patterns:
    - "UNIQUE(tx_hash) GLOBAL = seul garde-fou inviolable anti double-crédit (le check applicatif a une TOCTOU)"
    - "RPC atomique security definer + revoke execute (service_role bypass) — payment->verified ET sub->active en 1 transaction"
    - "index unique partiel sur pending non expiré = réservation d'offset (D-05), un seul montant attendu actif"
    - "BigInt monétaire au repo (expected/amount_atomic) ; conversion Number à la frontière supabase-js"
key-files:
  created:
    - supabase/migrations/0012_payments.sql
    - packages/supabase/src/repositories/payments.ts
    - packages/supabase/src/repositories/subscriptions.ts
  modified:
    - packages/supabase/src/index.ts
    - .env.example
  blocked-not-modified:
    - packages/supabase/src/database.types.ts   # Task 2 (live apply + gen types) = orchestrateur
decisions:
  - D-04-02-A
  - D-04-02-B
  - D-04-02-C
metrics:
  duration: ~14 min
  completed: PARTIAL (2/3 tâches déterministes ; Task 2 = checkpoint LIVE apply bloqué)
  tests: vérifs statiques 0012 (multi-critère + RLS/RPC count) + 11 key-links + tsc -b --force vert
---

# Phase 4 Plan 02 : Couche données paiement — Summary (PARTIEL)

Migration `0012_payments.sql` (table `payments`, RLS producteur-unique, `UNIQUE(tx_hash)`
GLOBAL anti-replay, réservation d'offset D-05, RPC atomique `activate_subscription_for_payment`
security definer + revoke execute) écrite et committée ; repositories service_role typés
(`payments` dont `reserveOffset` + mapping 23505→`ReplayError`, `subscriptions` dont
`activateForPayment` via RPC) + barrel + `.env.example` étendus. **L'application LIVE de la
migration (Task 2) est un checkpoint `[BLOCKING]` réservé à l'orchestrateur** : elle n'est
PAS faite ici (jamais `supabase db push`, jamais d'apply MCP par cet exécuteur).

## État du plan : PARTIAL / blocked-at-live-apply

| Task (ordre PLAN) | Type | État | Commits |
|-------------------|------|------|---------|
| Task 1 — migration 0012 (table + RLS + UNIQUE + offset + RPC) | auto | ✅ écrite + vérifs statiques OK | `72f49a5` |
| Task 2 — [BLOCKING] apply_migration LIVE + régénérer types | checkpoint:human-action | **BLOQUÉ** (owned orchestrateur) | — |
| Task 3 — repos payments + subscriptions + barrel + .env | auto | ✅ tsc vert | `eccc956` |

## Ce qui a été construit

### Task 1 — `supabase/migrations/0012_payments.sql` (PAY-03/04/06, ADMIN-01/02)
- Table `public.payments` : `id`, `user_id` (FK profiles on delete cascade), `tx_hash`,
  `plan` check `('discovery','standard')`, `expected_amount_atomic bigint`, `amount_atomic
  bigint` (null pending), `status` check `('pending','verified','rejected','ambiguous')`
  default `pending`, `reject_reason`, `screenshot_url`, `reservation_expires_at`, `created_at`,
  `verified_at`. RLS activée.
- Index : `payments_tx_hash_global_idx` UNIQUE GLOBAL (anti-replay, PAY-04) ;
  `payments_expected_amount_active_idx` UNIQUE partiel `where status='pending' and
  reservation_expires_at > now()` (offset D-05) ; `payments_status_created_idx` (lecture admin).
- Commentaire SQL canonique D-05 présent au-dessus de l'index offset :
  `-- D-05 : durée de réservation = OFFSET_RESERVATION_MINUTES (60 min), valeur canonique
  partagée avec packages/supabase/repositories/payments.ts et Plan 05`.
- RLS (vérifié statiquement) : **1 INSERT** (`with check (user_id = auth.uid() and
  status = 'pending')`) + **2 SELECT** (self `user_id=auth.uid()` ; superadmin
  `is_superadmin()`) + **0 update/delete** (transitions service_role, D-08).
- RPC `activate_subscription_for_payment(p_payment_id uuid, p_user_id uuid, p_plan text,
  p_period interval)` plpgsql `security definer set search_path = public` : UPDATE
  payment→verified si encore pending (raise sinon → anti double-activation) puis UPSERT
  subscription active avec prolongation D-11 (`greatest(coalesce(current_period_end, now()),
  now()) + p_period`). `revoke execute ... from public, anon, authenticated` (A8 lockdown).

### Task 3 — repos service_role + barrel + env
- `packages/supabase/src/repositories/payments.ts` : `type ServiceClient`, doc-bloc « JAMAIS
  importé depuis apps/web (D-07) » ; `export const OFFSET_RESERVATION_MINUTES = 60` (canonique) ;
  `reserveOffset` (montant attendu unique = base + offset déterministe, boucle bornée sur
  23505 via `payments_expected_amount_active_idx`, `expected_amount_atomic` JAMAIS dérivé d'une
  entrée client) ; `insertPendingPayment` (23505 sur tx_hash → `ReplayError` typée, Pitfall 2) ;
  `getByHash` ; `transitionPayment` (status-only rejected/ambiguous, jamais delete). Erreurs
  typées `ReplayError`/`OffsetExhaustedError`.
- `packages/supabase/src/repositories/subscriptions.ts` : `activateForPayment` →
  `client.rpc('activate_subscription_for_payment', {...})` ; `expireDue` (job Plan 06) ;
  `changePlan` (admin Plan 06). Pattern d'erreur `throw new Error('...failed: '+msg)`.
- Barrel `index.ts` ré-exporte les deux repos + `OFFSET_RESERVATION_MINUTES` + erreurs typées
  (service-client jamais exposé, D-07).
- `.env.example` : `TRONGRID_API_KEY`, `USDT_RECEIVE_ADDRESS`, `USDT_CONTRACT_ADDRESS`,
  `TRON_NETWORK` (sans valeurs ; D-01 : clé privée jamais en code/DB).

## BLOCAGE — Checkpoint LIVE apply Task 2 (ce que l'orchestrateur doit exécuter via MCP)

La migration 0012 existe en SQL mais **n'est PAS dans la base live**. Convention repo
(CRITIQUE, D-01-01-D / 0006) : application via le MCP Supabase `apply_migration`, **JAMAIS**
`supabase db push`. Cet exécuteur n'a PAS l'outil d'application en money-table. À exécuter par
l'orchestrateur après confirmation humaine explicite :

1. **`apply_migration`** — name `0012_payments`, contenu = `supabase/migrations/0012_payments.sql`.
2. **`generate_typescript_types`** → écrire le résultat dans
   `packages/supabase/src/database.types.ts` (ajouter `payments` Row/Insert/Update + la
   fonction `activate_subscription_for_payment` dans `Database['public']['Functions']`).
   NE PAS fabriquer ce contenu à la main / inventer de stubs.
3. **`list_tables`** — confirmer `payments` (colonnes, `UNIQUE(tx_hash)`, RLS activée, RPC présente).
4. **`get_advisors` (security)** — les WARN security-definer sur la RPC sont EXPECTED BY DESIGN
   (D-01-01-D / Pitfall 6), non bloquants ; vérifier qu'aucun NOUVEL avertissement bloquant
   n'apparaît.
5. Après régénération, re-run `pnpm typecheck` (doit rester vert ; remplacera le cast local de
   `subscriptions.ts` par la vraie signature RPC).

**Resume-signal** : « applied » + sortie `list_tables`/`get_advisors`, OU description de l'échec.

## Décisions

- **D-04-02-A** : `reserveOffset` pose un placeholder déterministe `tx_hash =
  reservation:{user_id}:{expected}` à la réservation (pas de tx réelle pré-paiement). Le
  tx_hash réel arrive via `insertPendingPayment` (Plan 05). Cela permet à `reserveOffset` de
  s'appuyer sur DEUX index uniques (offset partiel + tx_hash global) sans NULL sur `tx_hash`
  (la colonne est `not null`). La collision 23505 fait avancer l'offset (boucle bornée Open Q1).
- **D-04-02-B** : RPC `activate_subscription_for_payment` upsert « manuel » (SELECT puis
  INSERT/UPDATE) plutôt qu'`ON CONFLICT` — `subscriptions` n'a pas de contrainte unique sur
  `user_id` (un user peut historiser plusieurs lignes), donc on prolonge la plus récente (D-11).
  L'UPDATE payment gardé `status='pending'` + `row_count=0 → raise` protège contre la double
  activation (idempotence négative).
- **D-04-02-C** : `activateForPayment` caste `client.rpc(...)` localement car la signature de
  la fonction est ABSENTE de `database.types.ts` tant que Task 2 (gen types) n'est pas faite —
  conforme à la consigne « ne pas inventer de stubs de types pour forcer un vert ». Le cast
  garde la forme d'appel exacte (`rpc('activate_subscription_for_payment', { p_payment_id,
  p_user_id, p_plan, p_period })`) et sera retiré après régénération.

## Déviations vs plan

Aucune déviation de code (Rules 1-4). Déviation de séquence : Task 3 (déterministe) exécutée
après Task 1 et AVANT le checkpoint Task 2 (live apply), car les repos compilent contre les
types actuels sans nécessiter l'application live — `client.from('payments')` ne hard-erreur
pas avec la structure de types générée (table inconnue → dégradation gracieuse), et l'appel RPC
est casté (D-04-02-C). Conforme à la consigne « ne pas db push, l'orchestrateur owns l'apply ».

Condition attendue documentée (NON un échec) : les repos ne sont **pleinement type-safe**
qu'après application live 0012 + régénération `database.types.ts`. `tsc -b --force` est vert
aujourd'hui (pas d'erreur introduite), mais le type `payments` reste absent jusqu'à Task 2.

## Vérification

- `node -e` multi-critère 0012 (5 assertions hors commentaires) → « 0012 multi-criteria OK »
  (tx_hash_global_idx, activate_subscription_for_payment, revoke execute, status='pending',
  payments_expected_amount_active_idx).
- `node -e` RLS/RPC statique → « insert=1 select=2 update/delete=0, security definer+search_path
  OK, revoke OK ».
- `node -e` key-links (11) → « all key-links OK » (reserveOffset, OFFSET_RESERVATION_MINUTES=60,
  23505→ReplayError, rpc activate_subscription_for_payment, barrel re-exports, 4 vars .env).
- `pnpm typecheck` puis `npx tsc -b --force` → vert (aucune nouvelle erreur ; baseline inchangée).
- `apply_migration` LIVE → **NON exécuté** (checkpoint orchestrateur, par design).

## Self-Check: PASSED

- 0012_payments.sql, payments.ts, subscriptions.ts, index.ts (modifié), .env.example (modifié) → présents.
- Commits 72f49a5 (migration), eccc956 (repos+barrel+env) → présents dans git log.
- database.types.ts → NON modifié (attendu : Task 2 live apply = orchestrateur).
