---
phase: 09-cms-cours-articles-vulgaris-s
plan: 01
subsystem: academie
tags: [mdx, zod, frontmatter, search-params, reading-time, toc, tdd]
requires: []
provides:
  - "FrontmatterSchema (frontière de données D-11) + enums Theme/Niveau/Plateforme (source unique)"
  - "parseAcademyParams/serializeAcademyParams (whitelist Zod multi-axes D-05)"
  - "computeReadingTime (déterministe D-10)"
  - "extractToc (slugs github-slugger cohérents rehype-slug D-10)"
  - "8 dépendances MDX déclarées (versions épinglées)"
affects:
  - "Plan 09-02 (content.ts scan fichiers) consomme FrontmatterSchema"
  - "Plan 09-04 (routes RSC) consomme les 4 modules"
tech-stack:
  added:
    - "next-mdx-remote 6.0.0, @mdx-js/mdx 3.1.1, @mdx-js/react ^3"
    - "gray-matter 4.0.3, rehype-slug 6.0.0, remark-gfm 4.0.1"
    - "github-slugger 2.0.0, reading-time 1.5.0"
  patterns:
    - "Whitelist Zod par enum, hors-enum ignoré, jamais throw (calque signals/searchParams)"
    - "Default import CJS pour reading-time/github-slugger (jamais require)"
    - "Instance fraîche GithubSlugger par appel → dédup cohérente rehype-slug"
key-files:
  created:
    - apps/web/src/lib/academie/frontmatter.ts
    - apps/web/src/lib/academie/frontmatter.test.ts
    - apps/web/src/lib/academie/searchParams.ts
    - apps/web/src/lib/academie/searchParams.test.ts
    - apps/web/src/lib/academie/reading-time.ts
    - apps/web/src/lib/academie/reading-time.test.ts
    - apps/web/src/lib/academie/toc.ts
    - apps/web/src/lib/academie/toc.test.ts
  modified:
    - apps/web/package.json
    - pnpm-lock.yaml
decisions:
  - "8 deps MDX déclarées versions épinglées, aucun @next/mdx (collision ! webpack)"
  - "date frontmatter = z.iso.datetime().or(z.string()) — accepte ISO ou string"
  - "searchParams multi-select par axe → string[] filtré sur enum (D-05)"
metrics:
  duration: "~10 min (post-checkpoint)"
  completed: 2026-06-19
  tasks: 3
  files: 10
---

# Phase 09 Plan 01: Socle pur de l'Académie (frontmatter, filtres, reading-time, TOC) Summary

Socle de logique pure et testable de l'Académie : schéma Zod du frontmatter (frontière D-11), parseur de filtres whitelist multi-axes (D-05, calque signaux), temps de lecture déterministe (D-10) et extraction de sommaire à slugs cohérents rehype-slug (D-10), avec 8 dépendances MDX déclarées aux versions épinglées (aucun `@next/mdx`).

## What Was Built

- **frontmatter.ts** : `FrontmatterSchema` (z.object D-11) + `ThemeEnum`/`NiveauEnum`/`PlateformeEnum` exportés comme source unique des axes. `date` accepte ISO (`z.iso.datetime`) ou string libre.
- **searchParams.ts** : `parseAcademyParams` (multi-select par axe, hors-enum écarté, jamais throw) + `serializeAcademyParams` (round-trip stable). Importe les enums de `frontmatter.ts` (1 import, aucune redéclaration).
- **reading-time.ts** : `computeReadingTime` = `Math.ceil(readingTime(body).minutes)`, default import CJS, déterministe, golden values fr/en/ar = 2 min.
- **toc.ts** : `extractToc` H2/H3 → `{level, text, slug}`, slug via `github-slugger` (cohérent rehype-slug, accents + arabe), dédup `titre`/`titre-1`, ignore les `#` dans les blocs de code fencés.

## Tests

- Suite Vitest ciblée `apps/web/src/lib/academie/` : **35 tests verts (4 fichiers)**.
- TDD strict par tâche : RED (modules introuvables / tests rouges) → GREEN.
- Non-trivialité prouvée : `theme=__invalid__` ABSENT du résultat parsé ; injection `DROP TABLE` → ignorée sans throw ; golden reading-time assertées en dur ; slugs accents/arabe non vides.

## Deviations from Plan

### Install MDX — résolu localement (déviation documentée, pas un échec)

- **Tâche 1.** Le plan anticipait un échec de `pnpm install` côté Windows à cause du `!` dans le chemin projet, avec résolution déléguée à Vercel.
- **Constat réel** : `pnpm --filter web install` a **réussi localement** (résolution + `node_modules`, 148 paquets ajoutés). Le `!` ne casse que `next build`/webpack (loader separator, Pitfall 1), PAS la résolution pnpm.
- **Action** : les 8 deps sont déclarées aux versions épinglées exactes dans `apps/web/package.json` ET résolues dans `node_modules` ; `pnpm-lock.yaml` mis à jour et commité. Aucun `@next/mdx`.
- **Conséquence** : la contrainte « rendu MDX vérifié en Vercel preview, pas en `next build` local » reste valable pour les plans aval (routes RSC), mais l'install des deps n'a pas eu besoin de Vercel.

Aucune autre déviation. Pas de Rule 1/2/4 déclenchée.

## Threats Mitigés

- **T-09-01** (Tampering filtres) : whitelist Zod par enum, `.safeParse` par candidat, hors-enum écarté, jamais throw — testé (valeur invalide absente, injection ignorée).
- **T-09-02** (Tampering frontmatter) : `FrontmatterSchema` à la frontière, invalide → erreur Zod — testé (type/theme/niveau/champs vides rejetés).
- **T-09-SC** (install 8 deps) : versions épinglées, slopcheck OK (RESEARCH), aucun `@next/mdx`, aucun paquet hors liste.

## Commits

- `578219c` chore(09-01): declare 8 MDX deps (pinned, no @next/mdx)
- `30a8276` feat(09-01): frontmatter Zod (D-11) + searchParams whitelist (D-05)
- `23b4cfa` feat(09-01): reading-time déterministe + toc slugs github-slugger (D-10)

## TDD Gate Compliance

Plan `type: tdd`. Par tâche behavior-adding : commit `feat(...)` précédé d'une phase RED vérifiée (tests rouges avant impl). Pas de REFACTOR nécessaire. Tâche 1 (deps) = config-only, exempte du gate.

## Known Stubs

Aucun. Les 4 modules sont des briques pures complètes (pas de placeholder, pas de donnée mockée câblée en dur destinée à l'UI). Les consommateurs (content.ts, routes RSC) arrivent en plans aval.

## Self-Check: PASSED

- Fichiers créés : 8 modules `lib/academie/*` (4 src + 4 tests) — présents.
- Commits `578219c`, `30a8276`, `23b4cfa` — présents dans `git log`.
- 35 tests Vitest verts ; 0 `require(` ; 0 `@next/mdx`.
