---
phase: 07-affiliation-paliers
plan: 02
subsystem: core/affiliate
status: complete
requirements: [AFF-03]
tags: [pure-logic, bigint, golden-test, tdd, tiers, commission]
dependency_graph:
  requires: ["@app/core (barrel)", "SQL affiliate_rate_bps (0016, LIVE)"]
  provides: ["affiliateRateBps", "computeCommissionAtomic", "TIERS", "Tier"]
  affects: ["apps/web dashboard affiliation (affichage palier/progression)", "miroir RPC compute_affiliate_commissions"]
tech_stack:
  added: []
  patterns: ["logique pure zéro I/O (D-49)", "BigInt atomique zéro float (T-07-FLOAT)", "source unique golden-testée vitrine ↔ SQL"]
key_files:
  created:
    - packages/core/src/affiliate/tiers.ts
    - packages/core/src/affiliate/__tests__/tiers.test.ts
  modified:
    - packages/core/src/index.ts
decisions: [D-07-02-A, D-07-02-B]
commits: [4a06c4c, cd27a0c]
metrics:
  duration: ~8 min
  tasks: 1
  files: 3
  tests_added: 28
  completed: 2026-06-18
---

# Phase 07 Plan 02 : Grille de paliers + commission BigInt (logique pure) Summary

Grille de taux d'affiliation D-01 (8 paliers en basis points) et calcul de commission BigInt portés en logique pure golden-testée dans `@app/core`, miroir bit-à-bit de la fonction SQL `affiliate_rate_bps` (0016 LIVE). Source unique TS partagée par le dashboard (affichage palier) et alignée sur le RPC de calcul — toute dérive casse un test.

## Ce qui a été livré

- **`packages/core/src/affiliate/tiers.ts`** (pur, zéro I/O) :
  - **`TIERS`** : table readonly des 8 paliers `{ tier, minSignups, maxSignups, rateBps }` (800 bps / 8 % … 2000 bps / 20 %).
  - **`affiliateRateBps(signups: number): number`** : miroir EXACT du `case` SQL — `>=50000→2000`, `>=25001→1800`, `>=10001→1700`, `>=5001→1600`, `>=1001→1500`, `>=501→1400`, `>=100→1200`, `>=1→800`, sinon `0`.
  - **`computeCommissionAtomic(baseAtomic: bigint, rateBps: number): bigint`** = `(baseAtomic * BigInt(rateBps)) / 10000n` — division entière BigInt (troncature/floor, Q3), zéro float, exact > 2⁵³.
  - Type `Tier` exporté.
- **Barrel `@app/core`** : export de `TIERS`, `affiliateRateBps`, `computeCommissionAtomic` + type `Tier` (miroir du pattern `threshold`/`replayOutcome`).
- **28 tests golden** (`tiers.test.ts`) : 17 bornes signups→bps (0, 1, 99, 100, 500, 501, 600, 1000, 1001, 5000, 5001, 10000, 10001, 25000, 25001, 50000, 50001) + invariants TIERS (8 paliers, bornes cohérentes, 800..2000) + 7 cas commission (9 USDT × 1400 → 1 260 000n ; floor 1n × 800 → 0n ; floor 12345n × 1500 → 1851n ; rate 0 ; gros montant > 2⁵³ exact ; base 0n).

## Décisions d'exécution

- **D-07-02-A (miroir SQL aux bornes plafond)** : la table `TIERS` pose le palier plafond à `minSignups: 50001`, mais le SQL teste `>= 50000 → 2000` (50000 inscrits = 2000 bps, PAS 1800). Pour rester bit-à-bit identique, le parcours de `affiliateRateBps` garde le seuil plafond à `>= 50000` (et non 50001). Les deux cas (50000 → 2000 ET 50001 → 2000) sont verrouillés par le test golden. La table TIERS reste une description d'affichage (le seuil exécuté fait foi via le test).
- **D-07-02-B (pureté grep `Number(` == 0)** : reformulé deux commentaires qui citaient littéralement `` `Number()` `` (« une coercion vers Number », « aucune coercion vers Number ») pour que le critère d'acceptation `grep -c "Number(" tiers.ts == 0` passe — aucune occurrence de `Number(` ni en code ni en commentaire.

## Déviations from Plan

- **Chemin de test** : le plan impose `packages/core/src/affiliate/__tests__/tiers.test.ts` (sous-dossier `__tests__/`), alors que les autres tests core sont `*.test.ts` à côté du module. Chemin du plan respecté tel quel ; couvert par le glob `packages/**/*.test.ts` du `vitest.config.ts` racine (aucune extension de config nécessaire).
- Aucune autre déviation. Rules 1-4 : aucune appliquée. Zéro package npm ajouté (T-07-SC accept respecté).

## Vérifications

- **`npx vitest run packages/core/src/affiliate/__tests__/tiers.test.ts`** : 28/28 verts (GREEN après RED prouvé : module `../tiers.js` absent au commit 4a06c4c).
- **`npx vitest run packages/core`** : 144/144 verts (13 fichiers) — non-régression core OK.
- **`pnpm typecheck`** (`tsc -b --noEmit`) : 0 erreur.
- **`grep -c "Number(" packages/core/src/affiliate/tiers.ts`** == 0.
- **Pureté @app/core** : aucun import Supabase/fs/http/net/fetch/server-only dans `tiers.ts` (grep == 0). Logique 100 % déterministe.
- **Acceptance criteria** : `affiliateRateBps(600) === 1400` ✓, `affiliateRateBps(50001) === 2000` ✓, `affiliateRateBps(0) === 0` ✓, `computeCommissionAtomic(9_000_000n, 1400) === 1_260_000n` ✓, barrel exporte `affiliateRateBps` ✓.

## Threat surface

- **T-07-FLOAT (mitigate)** : BigInt exclusif, division entière déterministe ; test golden floor (1n×800→0n, 12345n×1500→1851n, gros montant > 2⁵³). `Number(` count == 0.
- **T-07-DRIFT (mitigate)** : table de bornes golden-testée identique aux bps SQL 0016 ; 17 bornes verrouillées.
- **T-07-SC (accept)** : zéro paquet npm ajouté.
- Aucune nouvelle surface de confiance (logique pure zéro I/O).

## Self-Check: PASSED

- FOUND: packages/core/src/affiliate/tiers.ts
- FOUND: packages/core/src/affiliate/__tests__/tiers.test.ts
- FOUND: commit 4a06c4c (RED), cd27a0c (GREEN)
