---
phase: quick-260617-nsh
plan: 01
subsystem: apps/web build/config
tags: [build, webpack, next15, monorepo, transpilePackages, ssr]
requires: []
provides:
  - "Client Component wrapper CandleChartLazy (dynamic ssr:false hors RSC)"
  - "Build webpack (next build) + extensionAlias .js->.ts pour packages workspace"
  - "@app/data-sources transpilé"
affects:
  - apps/web/next.config.ts
  - apps/web/package.json
tech-stack:
  added: []
  patterns:
    - "dynamic(ssr:false) hébergé dans un Client Component, jamais dans un RSC (Next 15)"
    - "webpack resolve.extensionAlias .js->.ts/.tsx pour packages monorepo exportant du TS source"
    - "lint exécuté séparément (pnpm lint/CI), eslint.ignoreDuringBuilds au build"
key-files:
  created:
    - apps/web/src/components/signals/CandleChartLazy.tsx
  modified:
    - apps/web/src/app/[locale]/(member)/signaux/[id]/page.tsx
    - apps/web/next.config.ts
    - apps/web/package.json
    - apps/web/src/app/(admin)/file/actions.ts
    - packages/supabase/src/database.types.ts
    - apps/web/tsconfig.json
    - packages/supabase/src/repositories/snapshots.ts
    - apps/web/src/lib/signals/queries.ts
    - apps/web/src/components/ui/sonner.tsx
    - apps/web/src/app/(admin)/membres/actions.ts
    - apps/web/src/lib/supabase/__lint_fixtures__/forbidden-service-import.ts
    - packages/data-sources/src/finnhub/client.ts
    - apps/web/src/lib/qr/qrcodegen.ts
    - apps/web/src/lib/qr/QrCode.tsx
    - apps/web/src/lib/qr/toSvgPath.ts
    - apps/web/src/lib/qr/__tests__/qrcodegen.test.ts
decisions:
  - "Build webpack (next build) au lieu de turbopack : applique extensionAlias .js->.ts que turbopack ne fait pas pour les packages workspace TS-source."
  - "extensionAlias webpack résout les imports .js des barrels @app/* (constants.js -> constants.ts)."
  - "eslint.ignoreDuringBuilds : la fixture intentionnelle forbidden-service-import.ts (AUTH-03, DOIT échouer pnpm lint) ne casse plus le build prod ; la garde reste active via pnpm lint/CI."
  - "Frontière argent : colonnes Postgres bigint typées string (PostgREST sérialise bigint en string ; number lossy >2^53, CR-02). Type-only, math BigInt inchangée."
  - "Option C exécutée : ~50 erreurs de type corrigées (type-only), sans toucher la math argent ni la sémantique des requêtes. 419 tests verts inchangés."
metrics:
  duration: ~85 min
  completed: 2026-06-17
  status: COMPLET — tsc --noEmit 0 erreur + build webpack OK + 419 tests verts
---

# Quick 260617-nsh : Fix build production web (apps/web) Summary

Les 3 erreurs build webpack ciblées par le plan sont résolues ET la dette de types pré-existante (Option C validée par checkpoint) est entièrement résorbée. `pnpm --filter web exec tsc --noEmit` → **0 erreur** ; `pnpm --filter web build` (webpack, chemin propre) → **✓ Compiled successfully** ; suite vitest jobs/golden → **419/419 verts** (aucune régression).

## Ce qui a été fait

- **Task 1 (d221cae)** : `CandleChartLazy.tsx` (`'use client'` ligne 1) héberge `dynamic(() => import('./CandleChart')..., { ssr: false })`. La page RSC `signaux/[id]/page.tsx` ne déclare plus `dynamic`/`ssr:false` (interdit en Server Component Next 15) et monte `<CandleChartLazy>` avec des props identiques.
- **Task 2 (2ad3496)** : `package.json` build = `next build` (webpack ; `dev` reste `--turbopack`). `next.config.ts` : `transpilePackages += @app/data-sources` ; hook `webpack` posant `resolve.extensionAlias['.js'] = ['.ts','.tsx','.js']` (les packages `@app/*` exportent du TS source avec imports `.js`) ; `eslint.ignoreDuringBuilds: true`.

## Preuve de build (chemin propre)

Le dossier projet contient un `!` (`Potatos WILL BECOME RICH !`) — réservé par la syntaxe loader webpack → `next build` échoue localement IN-PLACE (ValidationError sur `context`/`output.path`/`cacheDirectory`/`module.rules[].test`). Erreur 100% environnementale (cwd physique), pas liée au code ; Vercel checkout n'a pas de `!`.

Build prouvé via copie du working tree + `pnpm install --frozen-lockfile` dans `C:\ptr_buildcheck` (sans `!`), réplique exacte de Vercel :
- AVANT extensionAlias : `Module not found: Can't resolve './time/constants.js'` (+ candle/sessions/atomic/output) — Erreur 2 du plan, confirmée.
- APRÈS extensionAlias : **`✓ Compiled successfully in ~2-10s`** + `Skipping linting`. Les 3 erreurs du plan (ssr:false, Module not found .js, @app/data-sources) ÉLIMINÉES.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking build] extensionAlias webpack manquant**
- **Found during:** Task 2 (build webpack réel).
- **Issue:** Le plan supposait que `next build` (webpack) applique seul l'alias `.js->.ts` pour les transpilePackages. Faux : webpack ne le fait pas par défaut → `Module not found: Can't resolve './*.js'` sur les barrels `@app/core`/`@app/supabase`/`@app/data-sources`.
- **Fix:** Hook `webpack` dans `next.config.ts` posant `resolve.extensionAlias` (`.js->.ts/.tsx/.js`, idem .mjs/.cjs).
- **Commit:** 2ad3496

**2. [Rule 3 - Blocking build] fixture lint intentionnelle casse le build prod**
- **Found during:** Task 2 (étape lint de `next build`).
- **Issue:** `__lint_fixtures__/forbidden-service-import.ts` DOIT échouer `pnpm lint` (test de la garde AUTH-03/D-07). `next build` re-linte → la fixture casse le build prod Vercel.
- **Fix:** `eslint.ignoreDuringBuilds: true`. Le lint reste appliqué via `pnpm lint` (`eslint .` racine) + CI : la règle de sécurité AUTH-03 reste active ET la fixture continue d'échouer là où c'est voulu. Fixture et règle ESLint INCHANGÉES.
- **Commit:** 2ad3496

**3. [Rule 3 - Blocking build] changePlan period sous exactOptionalPropertyTypes**
- **Found during:** Task 2 (typecheck du build).
- **Issue:** `apps/web/src/app/(admin)/file/actions.ts:97` passe `period: undefined` à `ChangePlanInput.period?: string` → TS2379. Pré-existant, masqué jusqu'ici (turbopack + chemin cassé empêchaient le typecheck de build).
- **Fix:** Inclure la clé `period` UNIQUEMENT si définie. Runtime identique.
- **Commit:** 70b84ee

## Résolution dette de types (Option C — checkpoint validé)

Le checkpoint a tranché **Option C** : corriger toute la dette de types maintenant, contrainte "ne pas toucher la logique métier" levée UNIQUEMENT pour aligner des types (jamais la math, jamais la sémantique des requêtes). ~50 erreurs corrigées, classées en 4 catégories, 1 commit atomique par catégorie. Garde-fou systématique : suite vitest (419 tests) relancée après chaque changement dans `packages/*` — toujours verte.

### CAT B — Frontière argent (0f69954, type-only, math intacte)
- `database.types.ts` : colonnes Postgres `bigint` de `payments` (`amount_atomic`, `expected_amount_atomic`) re-typées `number → string`. PostgREST sérialise bigint en string ; le runtime fait déjà `.toString()` (CR-02 "JAMAIS Number()"). Le bug était le type généré (faux >2^53), pas le runtime. Commentaire regen-safe ajouté.
- `apps/web/tsconfig.json` : `target ES2017 → ES2020` (BigInt literals de `packages/core/money/atomic.ts`). `atomic.ts` NON modifié.
- Cascade éliminée : payments.ts(106,153,246), file/page.tsx(51), membres/page.tsx(79).

### CAT C — Vitrine + packages partagés (e4b379c, type-only)
- `snapshots.ts` : `getLatestSnapshotsByKind` retourne `?? null` par champ (déstructuration tuple `| undefined` sous noUncheckedIndexedAccess ; tableau toujours longueur 3). Golden combine-engine vert.
- `signals/queries.ts` : `SetupsQuery` dérivé de `buildBaseSetupsQuery(from('trade_setups').select(SELECT_COLUMNS))` au lieu du `from()` générique (union toutes tables → paramètre colonne `.eq` inféré `never`). Sémantique de requête INCHANGÉE.

### CAT D — Mécanique (a771481)
- `sonner.tsx` : `resolvedTheme` garde NonNullable (exactOptionalPropertyTypes).
- `membres/actions.ts` : spread conditionnel de `period` (cohérent file/actions.ts 70b84ee).
- fixture lint `forbidden-service-import.ts` : import du vrai export `serviceClient` (`createServiceRoleClient` n'a jamais existé) ; intention "import interdit" préservée.
- `web tsconfig + package.json` : ajout paths/deps `@app/core` + `@app/data-sources` (utilisés par abonnement/actions.ts ; résout TS2307 + cascade return manquant + param `t` implicit any).
- `data-sources/finnhub/client.ts` : triple-slash `/// <reference path="./finnhub.d.ts" />` pour charger le shim ambient quand web type-check la source.

### CAT A — Lib QR B-04-03 (c6868d9, type-only, algo Nayuki intact)
- `qrcodegen.ts` : assertions non-null `!` sur accès tableau bornés par construction (tables ECC/version, matrice carrée de modules, `runHistory` longueur fixe 7). Aucune ligne d'algo modifiée — golden test QR toujours vert (inclus dans les 419).
- `QrCode.tsx` : `dir` (attribut HTML absent des typings SVGProps React) passé via spread typé.
- `toSvgPath.ts` + `qrcodegen.test.ts` : mêmes guards noUncheckedIndexedAccess.

## Vérification finale (2 résultats exacts)

- `pnpm --filter web exec tsc --noEmit` (IN-PLACE, chemin avec `!`) → **0 erreur**.
- `pnpm --filter web build` (webpack) :
  - IN-PLACE → échoue (`ValidationError` webpack : `!` réservé dans context/output.path/cacheDirectory). 100% environnemental (cwd physique), pas le code. Vercel checkout n'a pas de `!`.
  - Chemin propre (copie working tree + `pnpm install` dans `_nsh_buildcheck` sans `!`) → **`✓ Compiled successfully`** + `Checking validity of types ...` OK + `✓ Generating static pages (44/44)`. Dossier de check supprimé après.
- `pnpm -w test` → **419/419 verts** (56 fichiers), relancé après chaque changement `packages/*`.

JAMAIS utilisé : `typescript.ignoreBuildErrors`. JAMAIS modifié : la math argent (atomic.ts / toAtomic / formatAtomic) ni la sémantique des requêtes Supabase.

## Commits

- d221cae : fix Task 1 (CandleChartLazy + page RSC)
- 2ad3496 : fix Task 2 (build webpack + extensionAlias + transpilePackages + eslint.ignoreDuringBuilds)
- 70b84ee : fix auto Rule 3 (changePlan period)
- 0f69954 : CAT B — colonnes argent bigint→string + target ES2020
- e4b379c : CAT C — snapshots ?? null + type concret trade_setups query
- a771481 : CAT D — fixes mécaniques (sonner, membres, fixture, paths/deps, finnhub shim)
- c6868d9 : CAT A — guards non-null lib QR (type-only)

## Self-Check: PASSED

- apps/web/src/components/signals/CandleChartLazy.tsx : FOUND
- apps/web/next.config.ts (extensionAlias + eslint) : FOUND
- apps/web/package.json (build: next build + @app/* deps) : FOUND
- packages/supabase/src/database.types.ts (bigint→string) : FOUND
- packages/data-sources/src/finnhub/client.ts (triple-slash ref) : FOUND
- Commits d221cae / 2ad3496 / 70b84ee / 0f69954 / e4b379c / a771481 / c6868d9 : FOUND dans git log
- `tsc --noEmit` 0 erreur (in-place) : VÉRIFIÉ
- Build webpack `✓ Compiled successfully` (chemin propre) : VÉRIFIÉ
- 419/419 tests verts : VÉRIFIÉ
