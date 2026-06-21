---
phase: 10-fondation-design-system-nexa
plan: 01
subsystem: design-system-validation
tags: [wave-0, vitest, playwright, tdd-red, oklch, fonts, rtl, no-flash]
requires: []
provides:
  - "Wave-0 validation gates DESIGN-01..04 (5 test files) collectées par Vitest/Playwright"
  - "Vitest glob include élargi (apps/web/tests/**/*.test.ts)"
affects:
  - "Plan 10-02 (fonts) gaté par fonts.test.ts + no-cdn-fonts.spec.ts"
  - "Plan 10-03 (tokens) gaté par design-tokens.test.ts"
  - "no-flash.spec.ts + rtl-logical-props.test.ts = gardes de non-régression wave 02/03"
tech_stack:
  added: []
  patterns:
    - "Text-scan guard sur fichiers source (mirror no-perf-claims.test.ts)"
    - "Playwright request-interception (page.on('request')) pour no-CDN"
    - "addInitScript pré-navigation pour poser un état localStorage avant premier paint"
key_files:
  created:
    - apps/web/src/styles/__tests__/design-tokens.test.ts
    - apps/web/src/styles/__tests__/fonts.test.ts
    - apps/web/src/styles/__tests__/rtl-logical-props.test.ts
    - apps/web/tests/no-cdn-fonts.spec.ts
    - apps/web/tests/no-flash.spec.ts
  modified:
    - vitest.config.ts
decisions:
  - "D-10-01-A : 3 tests unit sous apps/web/src/styles/__tests__/ (voie A PATTERNS) — déjà couverts par le glob 'apps/**/__tests__/**'. Glob ÉLARGI quand même de 'apps/web/tests/**/*.test.ts' (parité/futur), 6 entrées existantes + globals:false préservés."
  - "D-10-01-B (Rule 1) : la séquence '--color-*/--font-*' dans un JSDoc faisait planter le parser oxc (lecture de '*/' comme fin de commentaire → PARSE_ERROR, faux RED). Reformulé en 'valeurs de couleur et de police' → transform OK, vrai RED d'assertion."
  - "D-10-01-C : design-tokens assertion (4) (@theme inline = var() only) est GREEN dès v2.0 (le mapping shadcn est déjà 100% var()) ; seules (1)(2)(3) sont RED — conforme à l'intention (mesure la migration HEX→OKLCH, pas le mapping)."
  - "D-10-01-D : specs Playwright créées + listées seulement (parse/--list OK) ; GREEN déféré au merge wave 02/03 (dev server :3000 requis), conforme au plan."
metrics:
  duration: ~12min
  tasks: 2
  files: 6
  completed: 2026-06-21
---

# Phase 10 Plan 01 : Validation Wave-0 (portes DESIGN-01..04) Summary

Pose les 5 portes de validation Nyquist de la Phase 10 AVANT toute implémentation : 3 gardes Vitest (design-tokens, fonts, rtl-logical-props) + 2 specs Playwright (no-cdn-fonts, no-flash trilingue) encodant DESIGN-01..04, et résout le CONFIG GAP du glob Vitest. Les gardes Vitest échouent (RED) contre l'état v2.0, prouvant qu'elles mesurent la migration des plans 02/03.

## What Was Built

- **design-tokens.test.ts** (DESIGN-01) — scanne `globals.css` : oklch() présent, `--nexa-green-500` défini, aucun HEX de marque obsolète (#1E5FBF/#03d87f/#63279b), `@theme inline` = var() only. 3/4 RED contre v2.0.
- **fonts.test.ts** (DESIGN-02) — scanne `lib/fonts.ts` + `src/fonts/` : 5 vars `--font-*` NEXA, 10 .woff2 attendus, absence Inter/IBM Plex + `next/font/google`. 5/5 RED contre v2.0.
- **rtl-logical-props.test.ts** (DESIGN-04) — text-scan de `globals.css` + `[locale]/layout.tsx` interdisant les classes physiques (ml-/mr-/pl-/pr-/left-/right-). GREEN (garde de non-régression : layout utilise ms-/me-).
- **no-cdn-fonts.spec.ts** (DESIGN-02 runtime) — interception `page.on('request')` asserte zéro requête Google Fonts sur /fr/login.
- **no-flash.spec.ts** (DESIGN-03) — thème stocké `dark` via addInitScript → `<html class="dark">` au premier paint, fr/en/ar.
- **vitest.config.ts** — ajout `apps/web/tests/**/*.test.ts` à l'array include (6 entrées existantes + `globals: false` préservés).

## Verification Results

- `npx vitest run apps/web/src/styles/__tests__` : 3 fichiers COLLECTÉS, 11 tests parsés ; 8 RED (design-tokens 3 + fonts 5), 3 GREEN (rtl 2 + @theme-inline 1). Aucun "No test files found", aucune erreur de transform.
- `npx playwright test --list` : 4 tests dans 2 fichiers listés (no-cdn-fonts 1, no-flash fr/en/ar 3).
- 0 dépendance npm ajoutée.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Faux RED par PARSE_ERROR du parser oxc**
- **Found during:** Task 1 (vérification design-tokens)
- **Issue:** la séquence littérale `*/` à l'intérieur du JSDoc (chaîne `--color-*/--font-*`) était interprétée par le transform oxc/Vitest comme fin de bloc commentaire → `PARSE_ERROR: Unexpected token`. Le fichier ne se transformait pas — "RED" parasite (collecte échouée), interdit par l'acceptance T-10-02.
- **Fix:** reformulé la ligne de commentaire en "valeurs de couleur et de police" (suppression de la séquence `*/`). Le test se transforme et devient un vrai RED d'assertion (3/4 contre v2.0).
- **Files modified:** apps/web/src/styles/__tests__/design-tokens.test.ts
- **Commit:** d25f577

## Threat Mitigations Applied

- **T-10-01** (glob masquant) : une SEULE entrée ajoutée à `include` ; 6 entrées existantes + `globals: false` vérifiés intacts.
- **T-10-02** (RED faussement vert) : preuve de COLLECTE exigée et obtenue (3 Test Files, 11 tests parsés) avant d'accepter le RED ; le PARSE_ERROR initial a justement été attrapé par cette exigence (cf. Rule 1).
- **T-10-SC** (installs) : 0 paquet npm ajouté, aucun checkpoint requis.

## Self-Check: PASSED

- FOUND: apps/web/src/styles/__tests__/design-tokens.test.ts
- FOUND: apps/web/src/styles/__tests__/fonts.test.ts
- FOUND: apps/web/src/styles/__tests__/rtl-logical-props.test.ts
- FOUND: apps/web/tests/no-cdn-fonts.spec.ts
- FOUND: apps/web/tests/no-flash.spec.ts
- FOUND: vitest.config.ts (modified)
- FOUND commit: d25f577 (Task 1)
- FOUND commit: 3563199 (Task 2)
