---
phase: 04-paiement-usdt-mvp-abonnement-jalon-encaissement
plan: 01
subsystem: paiement-on-chain (fondations déterministes)
status: PARTIAL — bloqué au checkpoint réseau Task 1
tags: [money, bigint, tron, base58check, golden-test, tdd, checkpoint]
requires: []
provides:
  - "packages/core: toAtomic/formatAtomic/USDT_DECIMALS/SCALE (BigInt zéro-float)"
  - "packages/data-sources: base58ToHex/hexToBase58/sameAddress (base58check vérifié)"
affects:
  - "Plan 04 (parseur TronGrid) — toujours BLOQUÉ : attend la fixture API réelle (Task 1)"
tech-stack:
  added: []   # aucune dépendance npm (crypto natif uniquement, pas de tronweb)
  patterns:
    - "BigInt de bout en bout pour la monnaie — jamais Number/parseFloat/* 1e6"
    - "base58check via double-sha256 crypto natif — golden values déterministes"
key-files:
  created:
    - packages/core/src/money/atomic.ts
    - packages/core/src/money/atomic.test.ts
    - packages/data-sources/src/trongrid/address.ts
    - packages/data-sources/src/trongrid/address.test.ts
    - packages/data-sources/src/trongrid/__fixtures__/GOLDEN.md
  modified:
    - packages/core/src/index.ts
  blocked-not-created:
    - packages/data-sources/src/trongrid/__fixtures__/nile-trc20-transfer.json
decisions:
  - D-04-01-A
  - D-04-01-B
  - D-04-01-C
metrics:
  duration: ~12 min
  completed: PARTIAL (2/3 tâches déterministes ; Task 1 checkpoint bloqué)
  tests: 27 verts (atomic 17 + address 10)
---

# Phase 4 Plan 01 : Fondations déterministes paiement on-chain — Summary (PARTIEL)

Conversion monétaire atomique BigInt zéro-float (`9.02 → 9020000n`) et normalisation
d'adresse TRON base58check (checksum vérifié, sans tronweb) posées en TDD et
golden-testées hors-ligne ; le checkpoint réseau qui fige la **forme réelle** de la
réponse TronGrid Nile reste **bloqué** faute de clé API et de TX testnet.

## État du plan : PARTIAL / blocked-on-checkpoint

| Task (ordre PLAN) | Type | État | Commits |
|-------------------|------|------|---------|
| Task 1 — checkpoint réseau (fixture TronGrid Nile réelle + confirmation A1-A7) | checkpoint:human-verify (blocking-human) | **BLOQUÉ** | — |
| Task 2 — atomic.ts (BigInt zéro-float) | tdd | ✅ vert (17/17) | `fc17427` RED, `d1f83bb` GREEN |
| Task 3 — address.ts (base58check) | tdd | ✅ vert (10/10) | `b0d8c0a` RED, `b6c9ae3` GREEN |

Les deux briques déterministes pures (qui n'exigent AUCUN réseau) sont livrées et
vertes. La 3ᵉ tâche — figer la vérité on-chain sur une vraie transaction — ne peut
pas être réalisée de façon autonome (voir blocage ci-dessous). **Le plan n'est PAS
complet** ; il est en cours, arrêté au checkpoint réseau.

## Ce qui a été construit

### Task 2 — `packages/core/src/money/atomic.ts` (PAY-01, T-04-PREC)
- `USDT_DECIMALS = 6n`, `SCALE = 10n ** 6n`, `toAtomic(string): bigint`, `formatAtomic(bigint): string`.
- Parsing par regex stricte `/^(\d+)(?:\.(\d{1,6}))?$/` + arithmétique BigInt pure.
  **Aucun** `Number` / `parseFloat` / `* 1e6` (vérifié : 0 occurrence dans atomic.ts).
- Golden : `toAtomic("9.02") === 9020000n` (cas NON représentable en float), round-trip
  `toAtomic(formatAtomic(x)) === x`, throw sur >6 décimales / format invalide / négatif.
- Barrel `packages/core/src/index.ts` ré-exporte les 4 symboles (extension `.js`).

### Task 3 — `packages/data-sources/src/trongrid/address.ts` (PAY-02, T-04-ADDR, T-04-CRYPTO)
- `base58ToHex` / `hexToBase58` / `sameAddress`, ~110 lignes déterministes.
- Checksum base58check = `sha256(sha256(payload))[0..4]` via `crypto` natif — `base58ToHex`
  **throw** sur checksum corrompu (jamais comparer une adresse non vérifiée).
- **Zéro dépendance tronweb** ; sha256 jamais réimplémenté (seul analog : marketaux/client.ts).
- Golden values dans `__fixtures__/GOLDEN.md`, **calculées hors-ligne par double-sha256**
  (donc reproductibles, pas inventées) :
  - `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t` (USDT mainnet) → `41a614f803b6fd780986a42c78ec9c7f77e6ded13c`
  - `TL1y3hnprGvKWAdAGRjZnoWJmEp5q8D9qR` → `416e36db7034c9c00f631e7c95e44529525a09a10f`
  - cas négatif `TR7NH...6u` (dernier char flippé) → throw.

## BLOCAGE — Checkpoint réseau Task 1 (ce que l'humain doit fournir)

Task 1 ne peut PAS être complété de façon autonome. Constats vérifiés :
- `apps/web/.env` n'existe pas ; aucune entrée `TRON_*` / `TRON-PRO-API-KEY` dans aucun `.env.example`.
- Accès réseau à TronGrid Nile indisponible (déjà bloqué pendant la recherche → A1-A7 ASSUMED).

**Aucune fixture ni golden value API n'a été fabriquée** (interdiction explicite). Pour
débloquer, l'humain (ops, hors-code) doit fournir :

1. **Une clé TronGrid** (tier gratuit) + endpoint Nile testnet.
2. **Une vraie TX USDT-test Nile** : un compte ayant reçu un transfert USDT-test confirmé.
3. Frapper et coller la réponse JSON BRUTE dans le fichier attendu :
   `packages/data-sources/src/trongrid/__fixtures__/nile-trc20-transfer.json`
   via `GET https://nile.trongrid.io/v1/accounts/{RECEIVE_ADDR_NILE}/transactions/trc20?only_confirmed=true&contract_address={USDT_NILE}&limit=10`
   header `TRON-PRO-API-KEY: <clé>`.
4. Confirmer dans `GOLDEN.md` les points ASSUMED (A1 noms de champs `from`/`to`/`value`/
   `token_info.address`/`token_info.decimals` + base58 vs hex ; A2 `only_confirmed`/
   `contract_address` supportés ; A3 header ; A5 `decimals===6` ; A6 **contrat USDT Nile**
   ≠ mainnet ; A7 seuil de confirmations).

**Resume-signal** : tape `approved` avec la fixture + golden API collées, OU décris le
blocage persistant (clé / accès réseau / wallet manquant). Une fois fait, le Plan 04
(parseur Zod TronGrid) est débloqué.

## Décisions

- **D-04-01-A** : golden values base58check **calculées hors-ligne** par double-sha256
  (crypto natif), donc déterministes et reproductibles — pas une frappe réseau. Cela
  permet de livrer `address.ts` golden-testé SANS attendre le checkpoint réseau, qui ne
  concerne que la **forme de réponse API** (`nile-trc20-transfer.json`), pas la crypto d'adresse.
- **D-04-01-B** : `GOLDEN.md` créé maintenant (golden crypto-locales + section « ASSUMED
  encore bloqué » listant A1-A7), mais `nile-trc20-transfer.json` NON créé — séparation
  nette entre golden déterministes et fixture réseau.
- **D-04-01-C** : ordre d'exécution = Task 2 puis Task 3 (déterministes) avant le
  checkpoint Task 1 ; le checkpoint ne bloque que le Plan 04 aval (parseur API), pas ces
  deux briques.

## Déviations vs plan

Aucune déviation de code (Rules 1-4). Seule déviation de séquence : exécution des tâches
déterministes (Task 2/3) avant le checkpoint réseau (Task 1), car elles n'en dépendent
pas — les golden d'adresse sont calculables hors-ligne (D-04-01-A). Conforme à la
consigne « ne pas fabriquer la fixture ».

## Vérification

- `npx vitest run packages/core/src/money/atomic.test.ts` → 17/17 vert.
- `npx vitest run packages/data-sources/src/trongrid/address.test.ts` → 10/10 vert.
- `npx tsc -b` → aucune nouvelle erreur dans atomic.ts / address.ts (baseline P1 inchangée).
- `nile-trc20-transfer.json` → **ABSENT par design** (bloqué au checkpoint réseau).

## Self-Check: PASSED

- atomic.ts, atomic.test.ts, address.ts, address.test.ts, GOLDEN.md, index.ts → présents.
- Commits fc17427 / d1f83bb / b0d8c0a / b6c9ae3 → présents dans git log.
- nile-trc20-transfer.json → absent (attendu : checkpoint réseau non franchi).
