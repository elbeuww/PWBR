---
phase: 04-paiement-usdt-mvp-abonnement-jalon-encaissement
plan: 04
subsystem: vérification on-chain paiements USDT TRC-20
tags: [trongrid, zod, bigint, verification, tdd, data-sources]
requires:
  - "packages/data-sources/src/trongrid/address.ts (sameAddress — Plan 01)"
  - "packages/core money atomic (USDT_DECIMALS, toAtomic, formatAtomic — Plan 01)"
  - "packages/data-sources/src/trongrid/__fixtures__/nile-trc20-transfer.json (fixture réelle figée Plan 01)"
provides:
  - "verifyTransfer(transfer, ctx) -> VerificationResult (exact/over/under/wrong_token/wrong_recipient/not_confirmed)"
  - "fetchTrc20TransfersForReceiver + getTransferByHash (client TronGrid fetch+Zod+p-retry)"
  - "Trc20TransfersResponseSchema / Trc20TransferSchema (parseur Zod figé sur fixture réelle)"
affects:
  - "Job de vérification de paiement (Wave aval) consomme verifyTransfer"
  - "Server action PAY-02/03 (activation abonnement) sur résultat 'exact'"
tech-stack:
  added: []
  patterns:
    - "Client data-source miroir fred (pLimit + pRetry + Retry-After 429)"
    - "Zod tolérant .passthrough() (miroir marketaux)"
    - "Décision financière BigInt strict (===), zéro float"
key-files:
  created:
    - packages/data-sources/src/trongrid/schema.ts
    - packages/data-sources/src/trongrid/schema.test.ts
    - packages/data-sources/src/trongrid/client.ts
    - packages/data-sources/src/trongrid/verify.ts
    - packages/data-sources/src/trongrid/verify.test.ts
    - packages/data-sources/src/trongrid/index.ts
  modified:
    - packages/data-sources/src/index.ts
decisions:
  - "Identité token par adresse de contrat UNIQUEMENT (sameAddress), jamais symbol/decimals (T-04-FAKETOKEN)"
  - "Marqueur de confirmation modélisé en champ optionnel confirmed?: boolean ; absent = confirmé (only_confirmed=true filtre côté client) ; confirmed===false -> not_confirmed"
  - "over/under -> ambiguous (file superadmin), jamais activation/rejet auto (D-06/D-07, T-04-AUTODECIDE)"
metrics:
  duration: ~25min
  completed: 2026-06-15
  tasks: 3
  files: 7
  tests: "24/24 trongrid (10 address + 5 schema + 9 verify)"
---

# Phase 4 Plan 04 : Vérification on-chain USDT TRC-20 Summary

Logique de vérification on-chain complète — parseur Zod figé sur la fixture Nile réelle, client TronGrid (fetch+Zod+p-retry, miroir fred), et décision des invariants conjoints `verifyTransfer` (token/destinataire/confirmation/montant) en BigInt strict zéro-float, cœur de correction financière du jalon encaissement.

## Tasks

| # | Nom | Type | Commit | Tests |
|---|-----|------|--------|-------|
| 1 | schema.ts — Zod figé sur fixture Nile réelle | tdd | `9c5dfdc` | 5/5 |
| 2 | client.ts — fetch+Zod+p-retry (miroir fred) | auto | `85a0aab` | grep TRON-PRO-API-KEY = 2 |
| 3 | verify.ts — invariants conjoints (decision tree) | tdd | `4c43416` | 9/9 |

## Détail d'implémentation

### Task 1 — schema.ts (RED→GREEN)
- Schéma calqué sur la forme RÉELLE de `__fixtures__/nile-trc20-transfer.json` (Plan 01), pas l'esquisse ASSUMED de RESEARCH.
- `value` conservé en **string atomique** → consommateur fait `BigInt(value)` (jamais Number, Pitfall 4).
- `token_info.address` **requis** (sert l'invariant contrat T-04-FAKETOKEN).
- `.passthrough()` tolérant. Champ optionnel `confirmed?: boolean` ajouté pour l'invariant anti-réorg.
- 5 cas : parse fixture, value string→BigInt 1_000_000_000n, decimals===6, passthrough OK, address requise échoue si absente.

### Task 2 — client.ts (auto)
- Mécanique fred verbatim : `pLimit(2)`, `pRetry({retries:3})`, `onFailedAttempt` respecte Retry-After sur 429.
- Différences TronGrid : clé `TRONGRID_API_KEY` (throw si absente) en **HEADER `TRON-PRO-API-KEY`** (jamais query param — T-04-KEYLEAK) ; base URL conditionnée `TRON_NETWORK==='mainnet'` ; endpoint A `only_confirmed=true&contract_address=…&limit=200`.
- `getTransferByHash` filtre `transaction_id` côté code (endpoint A ne filtre pas par hash).
- Barrels : `trongrid/index.ts` (re-export schema/client/verify/address/types) + ajout au barrel `data-sources/index.ts`.

### Task 3 — verify.ts (RED→GREEN)
- `verifyTransfer(transfer, ctx)` évalue le ET des invariants dans l'ordre du decision tree :
  1. token : `sameAddress(token_info.address, ctx.contract)` sinon `wrong_token` (JAMAIS symbol/decimals).
  2. destinataire : `sameAddress(to, ctx.receiver)` sinon `wrong_recipient`.
  3. confirmation : `confirmed === false` → `not_confirmed`.
  4. montant : `BigInt(value)` comparé `===` strict → `exact` ; `>` → `over` (D-07) ; `<` → `under` (D-06).
- Le 5e invariant (anti-replay) reste hors scope (UNIQUE(tx_hash) DB, Plan 02).
- 9 cas dont faux token homonyme (symbol USDT decimals 6, contrat ≠) rejeté `wrong_token`, et priorité contrat-avant-montant.

## Threat model — mitigations appliquées

| Threat ID | Mitigation livrée |
|-----------|-------------------|
| T-04-FAKETOKEN | identité token = `sameAddress(token_info.address, contract)` uniquement ; test du faux homonyme |
| T-04-REORG | `only_confirmed=true` côté client + `confirmed===false`→not_confirmed côté verify |
| T-04-PREC-V | `BigInt(transfer.value)`, comparaison `===` stricte, zéro float |
| T-04-KEYLEAK | clé en header serveur depuis process.env ; client jamais importé côté navigateur |
| T-04-AUTODECIDE | over/under → ambiguous, jamais activation/rejet auto |

## Deviations from Plan

### Auto-fixes (Rule 2 — fonctionnalité critique manquante)

**1. [Rule 2] Modélisation du marqueur de confirmation**
- **Trouvé pendant :** Task 1/3.
- **Issue :** La fixture réelle figée (Plan 01) ne contient AUCUN champ de confirmation (l'endpoint `only_confirmed=true` filtre déjà côté serveur), or l'invariant `not_confirmed` doit rester testable et activable côté verify (A7, anti-réorg).
- **Fix :** Champ optionnel `confirmed?: boolean` ajouté au schema (préservé par `.passthrough()`). Sémantique déterministe : **absent = confirmé** (la fixture filtrée n'en a pas), `confirmed===false` → `rejected:'not_confirmed'`. L'interface `ctx` du plan reste inchangée.
- **Fichiers :** schema.ts, verify.ts.
- **Commits :** `9c5dfdc`, `4c43416`.

Aucune autre déviation. Interface `verifyTransfer`/`VerificationResult` conforme au plan.

## Known Stubs

Aucun. Toute la logique est câblée et golden-testée sur fixtures.

## Verification

- `npx vitest run packages/data-sources/src/trongrid/schema.test.ts` → 5/5 vert.
- `npx vitest run packages/data-sources/src/trongrid/verify.test.ts` → 9/9 vert.
- `grep -c TRON-PRO-API-KEY` (hors commentaires) dans client.ts → 2 (≥1 requis).
- `pnpm typecheck` (tsc -b --noEmit) → vert.
- Suite trongrid complète : 24/24 (10 address + 5 schema + 9 verify).

## Self-Check: PASSED
- schema.ts, schema.test.ts, client.ts, verify.ts, verify.test.ts, index.ts : créés (FOUND).
- data-sources/src/index.ts : modifié (FOUND).
- Commits 9c5dfdc / 85a0aab / 4c43416 : présents dans git log.
