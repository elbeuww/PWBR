---
phase: 09-cms-cours-articles-vulgaris-s
plan: 02
subsystem: academie
tags: [mdx, fs, gray-matter, path-traversal, fallback-i18n, course-model, tdd]
requires:
  - "FrontmatterSchema (frontière D-11, plan 09-01)"
  - "computeReadingTime (D-10, plan 09-01)"
  - "routing.locales (i18n)"
provides:
  - "resolveContent(slug,locale) → fichier réel + fallback FR (D-14), garde path-traversal (T-09-PATH)"
  - "listContent(locale) → catalogue frontmatter-seul (gray-matter) typé + readingMinutes"
  - "listAllContent() → locales réellement présentes par slug (sitemap, sans fallback)"
  - "deriveCourse / lessonNavigation : modèle cours pur (ordre, prev/next, progression D-04/D-07)"
  - "11 fixtures MDX trilingues de preuve (D-03)"
affects:
  - "Plan 09-04 (routes RSC) consomme content.ts + course-model.ts"
  - "Plan 09-04 sitemap.ts consomme listAllContent()"
tech-stack:
  added: []
  patterns:
    - "Garde path-traversal AVANT accès disque : regex slug + whitelist locale + path.resolve confiné sous CONTENT_ROOT"
    - "Index frontmatter-seul (gray-matter, jamais compileMDX au scan)"
    - "Fallback FR par slug (D-14) côté résolution ET catalogue"
    - "CONTENT_ROOT résolu via import.meta.url (indépendant du cwd : Vitest root + Vercel)"
    - "Fonctions cours PURES (catalogue en argument, zéro I/O)"
key-files:
  created:
    - apps/web/src/lib/academie/content.ts
    - apps/web/src/lib/academie/content.test.ts
    - apps/web/src/lib/academie/course-model.ts
    - apps/web/src/lib/academie/course-model.test.ts
    - apps/web/content/academie/articles/ratio-risque-rendement.fr.mdx
    - apps/web/content/academie/articles/ratio-risque-rendement.en.mdx
    - apps/web/content/academie/articles/ratio-risque-rendement.ar.mdx
    - apps/web/content/academie/articles/comprendre-le-levier.fr.mdx
    - apps/web/content/academie/articles/comprendre-le-levier.en.mdx
    - apps/web/content/academie/cours/prendre-en-main-mt5/01-installer-mt5.fr.mdx
    - apps/web/content/academie/cours/prendre-en-main-mt5/01-installer-mt5.en.mdx
    - apps/web/content/academie/cours/prendre-en-main-mt5/01-installer-mt5.ar.mdx
    - apps/web/content/academie/cours/prendre-en-main-mt5/02-ouvrir-une-position.fr.mdx
    - apps/web/content/academie/cours/prendre-en-main-mt5/02-ouvrir-une-position.en.mdx
    - apps/web/content/academie/cours/prendre-en-main-mt5/03-poser-tp-sl.fr.mdx
  modified: []
decisions:
  - "CONTENT_ROOT dérivé de import.meta.url (../../../content/academie) — robuste au cwd Vitest/Vercel, pas process.cwd()"
  - "Optionnels CatalogEntry/LessonNav typés `T | undefined` pour exactOptionalPropertyTypes"
  - "findAbsPath cherche articles/ puis scanne cours/* (slug de leçon ≠ chemin direct)"
metrics:
  duration: "~12 min"
  completed: 2026-06-19
  tasks: 3
  files: 15
---

# Phase 09 Plan 02: Couche fichiers de l'Académie (content + modèle cours) Summary

Couche de lecture fichiers de l'Académie : `content.ts` (scan `fs.readdir` + `gray-matter` frontmatter-seul, résolution `(slug, locale)` avec fallback FR D-14, garde path-traversal de plus haute sévérité) et `course-model.ts` (dérivation cours/leçons pure, sans DB), prouvées par 11 fixtures MDX trilingues réelles.

## What Was Built

- **content.ts** :
  - `resolveContent(slug, locale)` → `{absPath, locale, fallback}` ou `null`. Garde path-traversal (T-09-PATH) appliquée AVANT tout accès disque : `slug` validé `^[a-z0-9-]+$`, `locale` ∈ `routing.locales`, `path.resolve` confiné par `startsWith(CONTENT_ROOT + sep)`. Fallback D-14 : locale absente mais FR présent → version FR `fallback:true`, jamais `null` si le FR existe.
  - `listContent(locale)` → catalogue typé, scan + `gray-matter` (frontmatter SEUL, aucun compile MDX), validé par `FrontmatterSchema` (frontière D-11/T-09-02), `readingMinutes` via `computeReadingTime` sur le corps brut. Applique le fallback FR par slug.
  - `listAllContent()` → locales RÉELLEMENT présentes par slug (sitemap Plan 04, exclut les fallbacks).
  - `CONTENT_ROOT` dérivé de `import.meta.url` (indépendant du cwd).
- **course-model.ts** (PUR, zéro I/O) : `deriveCourse(courseSlug, catalog)` (filtre `type==='lecon' && course===slug`, tri `order` croissant + tie-break `slug`, total) ; `lessonNavigation(courseSlug, order, catalog)` (prev/next voisins, `undefined` aux bornes, `current/total`).
- **11 fixtures MDX trilingues** : 2 articles (`ratio-risque-rendement` fr/en/ar avec `<Callout>`+`<TradeExample>` ; `comprendre-le-levier` fr/en — fixture fallback D-14), cours `prendre-en-main-mt5` (3 leçons ordonnées avec `<Steps>`+`<Callout variant="astuce">`, leçon 1 fr/en/ar, leçon 2 fr/en, leçon 3 fr seul — fixture fallback).

## Tests

- Suite Vitest `academie/` : **59 tests verts (6 fichiers)** — 35 (Wave 1) + 17 (content) + 7 (course-model).
- TDD strict : RED (module introuvable) → GREEN pour content.ts et course-model.ts.
- Non-trivialité prouvée :
  - Path-traversal : `../../etc/passwd`, `a/b`, `Abc`, slug vide, locale `xx` → tous `null`, `fs.readFile` jamais appelé (assertion `vi.spyOn`).
  - Fallback D-14 : `comprendre-le-levier` (ar manquant) et leçon 3 (en manquant) → `{locale:'fr', fallback:true}`, jamais `null`.
  - Index frontmatter-seul : aucun champ `content`/`body` compilé exposé.
  - course-model : ordre sur ≥3 leçons, prev/next `undefined` aux bornes, tie-break sur `order` dupliqué.

> Commande gate effective : `cd apps/web && pnpm exec vitest run --root ../.. academie`. Le `pnpm --filter web test` documenté n'a pas de script `test` défini dans `apps/web/package.json` (voir Déviations).

## Deviations from Plan

### 1. [Rule 3 - Blocking] Import routing : `@/i18n/routing` → `../../i18n/routing`
- **Trouvé pendant :** Task 1 (GREEN). Vitest ne résout pas l'alias `@/`.
- **Fix :** import relatif (convention réelle du codebase, cf. `LanguageSwitcher.tsx`).
- **Fichier :** content.ts. **Commit :** 884a2cb.

### 2. [Rule 3 - Blocking] CONTENT_ROOT via `import.meta.url` au lieu de `process.cwd()`
- **Trouvé pendant :** Task 1. Vitest tourne avec `--root` workspace → `process.cwd()` ≠ apps/web.
- **Fix :** racine dérivée du module (`apps/web/src/lib/academie` → `../../../content/academie`). Robuste pour Vitest ET Vercel (le fichier vit toujours dans apps/web).
- **Fichier :** content.ts. **Commit :** 884a2cb.

### 3. [Rule 1 - Bug] Conformité `exactOptionalPropertyTypes: true`
- **Trouvé pendant :** typecheck post-Task 2. Optionnels `CatalogEntry`/`LessonNav` et groupes regex `parseFileName` violaient le tsconfig strict.
- **Fix :** optionnels typés `T | undefined`, garde `m[1]/m[2] !== undefined`, cast test via `unknown`.
- **Fichiers :** content.ts, content.test.ts, course-model.ts. **Commit :** 232c69c.

### 4. Commande de test documentée non opérationnelle (noté, non bloquant)
- `pnpm --filter web test` ne produit rien : pas de script `test` dans `apps/web/package.json`. Gate réel utilisé : `pnpm exec vitest run --root ../.. academie` depuis `apps/web`. À aligner dans un plan ultérieur si souhaité (script `test` manquant — pré-existant).

## Threats Mitigés

- **T-09-PATH** (Tampering / Info Disclosure — plus haute sévérité) : `slug ^[a-z0-9-]+$` + `locale ∈ routing.locales` + `path.resolve` confiné AVANT tout accès disque ; aucune concaténation brute — testé (5 vecteurs rejetés, `fs.readFile` jamais atteint).
- **T-09-02** (Tampering frontmatter) : `FrontmatterSchema.parse` à chaque scan ; frontmatter invalide → throw Zod, jamais catalogué silencieusement.
- **T-09-MDX** (accept) : fixtures écrites par l'agent, revues en PR git ; aucun MDX utilisateur compilé.

## Threat Flags

Aucun nouveau. La surface (résolution slug/locale + frontière frontmatter) reste celle du `<threat_model>` du plan.

## Known Stubs

Aucun. `content.ts` et `course-model.ts` sont des briques complètes. Le rendu MDX réel (compileMDX, composants pédago) et les routes RSC arrivent au Plan 09-04 — hors périmètre de ce plan (couche fichiers pure/fs).

## TDD Gate Compliance

Plan `type: tdd`. Task 1 (content) et Task 2 (course-model) : RED vérifié (module introuvable) → commit `feat(...)`. Task 3 (fixtures) = contenu de preuve, exempt du gate (pas de source behavior-adding). Pas de REFACTOR nécessaire ; un commit `fix(...)` de conformité TS strict en suivant.

## Commits

- `2c30b0a` feat(09-02): 11 fixtures MDX trilingues de preuve (D-03, fallback D-14)
- `884a2cb` feat(09-02): content.ts scan fs + résolution (slug,locale) + fallback D-14
- `ca10b30` feat(09-02): course-model.ts dérivation cours/leçons pure (D-04/D-07)
- `232c69c` fix(09-02): conform content/course-model to exactOptionalPropertyTypes

## Self-Check: PASSED

- Fichiers créés : content.ts, content.test.ts, course-model.ts, course-model.test.ts + 11 fixtures MDX — présents.
- Commits 2c30b0a, 884a2cb, ca10b30, 232c69c — présents dans git log.
- 59 tests Vitest verts ; key_links `from './frontmatter'` == 1, `computeReadingTime` == 3 ; `<Disclaimer` dans fixtures == 0 ; course-model `node:fs`/`gray-matter` == 0.
