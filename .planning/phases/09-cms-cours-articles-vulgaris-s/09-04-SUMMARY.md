---
phase: 09-cms-cours-articles-vulgaris-s
plan: 04
subsystem: academie
tags: [rsc, mdx, compile-mdx, sitemap, hreflang, i18n, fallback-i18n, legal-disclaimer, rtl]
requires:
  - "resolveContent / listContent / listAllContent (content.ts, plan 09-02)"
  - "deriveCourse / lessonNavigation (course-model.ts, plan 09-02)"
  - "parseAcademyParams (searchParams.ts, plan 09-01)"
  - "extractToc (toc.ts, plan 09-01) + FrontmatterSchema (frontmatter.ts, 09-01)"
  - "MDX_COMPONENTS / Toc / ContentCard / FilterBar / FallbackBanner (composants, plan 09-03)"
  - "<Disclaimer /> (composant transverse, LEGAL-01)"
  - "next-mdx-remote 6.0.0 + remark-gfm + rehype-slug (déjà installés)"
provides:
  - "Route index /[locale]/academie (RSC public, filtres multi-axes searchParams, articles + cours dérivés)"
  - "Route détail /[locale]/academie/[slug] (article OU page-cours, compileMDX fs, Disclaimer injecté)"
  - "Route leçon /[locale]/academie/[course]/[lesson] (compileMDX fs, nav préc./suiv., Disclaimer injecté)"
  - "render-mdx.ts : compileMDX(fs.readFile) EXCLUSIF (contourne le `!`) + Zod safeParse frontmatter (jamais 500)"
  - "sitemap.ts : trilingue + alternates.languages = locales réelles (pas de fallback, T-09-SEO)"
  - "namespace i18n academy complet, parité stricte fr/en/ar (incl. libellés funnel 09-05)"
affects:
  - "Plan 09-05 consomme les libellés funnel academy (learnBasicsCta, signalExecLink, navAcademy) + valide le rendu en Vercel preview"
tech-stack:
  added: []
  patterns:
    - "Rendu MDX via compileMDX sur fs.readFile (jamais import .mdx, jamais @next/mdx — Pitfall 1 du `!`)"
    - "Disclaimer injecté par la PAGE après {content} (LEGAL-01 non-contournable, hors MDX)"
    - "Frontmatter re-validé Zod safeParse à la page → null → état d'erreur, jamais 500 (T-09-02)"
    - "Cours implicite : page-cours dérivée des leçons (deriveCourse) si aucun fichier type:cours"
    - "sitemap hreflang dissocié du fallback FR (locales réelles seulement, Q3/T-09-SEO)"
    - "exactOptionalPropertyTypes : props optionnelles passées conditionnellement par spread"
key-files:
  created:
    - apps/web/src/lib/academie/render-mdx.ts
    - apps/web/src/app/[locale]/(marketing)/academie/page.tsx
    - apps/web/src/app/[locale]/(marketing)/academie/[slug]/page.tsx
    - apps/web/src/app/[locale]/(marketing)/academie/[course]/[lesson]/page.tsx
    - apps/web/src/app/sitemap.ts
  modified:
    - apps/web/src/messages/fr.json
    - apps/web/src/messages/en.json
    - apps/web/src/messages/ar.json
decisions:
  - "render-mdx.ts extrait pour centraliser le pattern compileMDX(fs) et le partager entre [slug] et [course]/[lesson] (DRY + un seul point de contournement du `!`)"
  - "Cours implicites : les fixtures n'ont aucun fichier type:cours → la page-cours [slug] dérive le parcours des leçons (titre/cover de la 1ʳᵉ leçon)"
  - "sitemap inclut aussi les index /academie par locale (toutes réelles) en plus des contenus"
  - "Base URL sitemap via NEXT_PUBLIC_SITE_URL (placeholder A4), défaut localhost en dev"
metrics:
  duration: "~10 min"
  completed: 2026-06-19
  tasks: 3
  files: 8
---

# Phase 09 Plan 04: Surfaces de lecture RSC de l'Académie Summary

Les 3 routes RSC publiques de l'Académie (index filtré, détail article/page-cours, leçon avec nav préc./suiv.), le sitemap trilingue hreflang, et le namespace i18n `academy` complet à parité stricte fr/en/ar. Le rendu MDX passe EXCLUSIVEMENT par `compileMDX` sur `fs.readFile` (contourne le `!` du chemin projet) ; le `<Disclaimer />` est injecté par la page sur 100% des contenus (LEGAL-01). Livre CMS-01 et CMS-02 (révisé).

## What Was Built

- **Namespace i18n `academy` (Task 1)** — 46 clés à parité STRICTE et récursive fr/en/ar (FR canonique = UI-SPEC §Copywriting). Chrome complet (title/subtitle, filtres, TOC, callout, trade*, nav leçon, fallback, empty/error) + libellés funnel consommés par le Plan 05 (`navAcademy`, `learnBasicsCta`, `signalExecLink`). ICU posés : `readingTime {minutes}`, `courseProgress {current}/{total}`, `lessonCount`/`lessonsCount` (plural, catégories CLDR arabes zero/one/two/few/many/other). Sous-objets `theme.*`/`niveau.*`/`plateforme.*` (consommés par ContentCard/FilterBar) + alias plats `niveauDebutant`/`plateformeMt4`… exigés par le plan. Aucune promesse de gain (no-perf respecté).

- **Route index `/[locale]/academie` (Task 2)** — RSC PUBLIQUE (groupe marketing, AUCUNE gate Supabase/RLS). `listContent(locale)` → catalogue, `parseAcademyParams(sp)` (whitelist Zod, hors-enum ignoré) → filtrage multi-axes en mémoire (D-05). `buildDisplayCards` : articles = cartes simples ; cours = cartes-parcours dérivées (regroupement `type:'lecon'` par `course`, méta de la 1ʳᵉ leçon, `lessonCount`). Conteneur `max-w-6xl`, grille `sm:2 lg:3`, empty state, `<FilterBar />` + `<ContentCard />`.

- **render-mdx.ts (Task 3, brique partagée)** — `renderMdxFile(absPath)` : `fs.readFile` puis `compileMDX({ source, components: MDX_COMPONENTS, options:{ parseFrontmatter:true, mdxOptions:{ remarkPlugins:[remarkGfm], rehypePlugins:[rehypeSlug] }}})`. Frontmatter re-validé par `FrontmatterSchema.safeParse` → `null` si invalide (l'appelant rend un état d'erreur, jamais 500). Extrait aussi le corps brut (frontmatter retiré) pour `extractToc`.

- **Route détail `/[locale]/academie/[slug]` (Task 3)** — `resolveContent(slug, locale)` (garde T-09-PATH déléguée au Plan 02). Si fichier réel : compileMDX → si `type==='cours'` page-parcours, sinon article (cover `next/image`, badges, TOC, `{content}`, Disclaimer). Si `fallback:true` → `<FallbackBanner />` en tête (D-14). Si `resolveContent` null : tente un cours IMPLICITE via `deriveCourse(slug)` (page-parcours = liste ordonnée des leçons + `Progress` + Disclaimer). Slug inexistant partout → `notFound()`.

- **Route leçon `/[locale]/academie/[course]/[lesson]` (Task 3)** — même shell compileMDX + Disclaimer. `lessonNavigation(course, meta.order, catalog)` → 2 liens préc./suiv. (`h-11`, ancrés `me-auto`/`ms-auto` logiques, masqués aux bornes) + indicateur `academy.courseProgress`. Liens via `@/i18n/navigation`.

- **sitemap.ts (Task 3)** — `MetadataRoute.Sitemap`. Index `/academie` pour chaque locale + une entrée par contenu via `listAllContent()`. `alternates.languages` = SEULEMENT les locales réellement présentes (T-09-SEO / Q3) — le fallback FR sous `/ar` n'est PAS annoncé `hreflang=ar`. Base URL via `NEXT_PUBLIC_SITE_URL` (placeholder A4).

## Verification

- `cd apps/web && pnpm exec tsc -b --force` : **0 nouvelle erreur** dans le périmètre academie/sitemap/render-mdx (grep ciblé = 0 ; baseline hors périmètre `forbidden-service-import` inchangée).
- `node scripts/check-i18n-hardcoded.mjs` (lint:i18n) : **exit 0** après chaque tâche.
- Tests parité messages : **18 verts** (academy ajouté ne casse aucune parité existante ; parité academy fr==en==ar vérifiée à 46 clés).
- Suite unit academie : **59 verts** (aucune régression du nouveau render-mdx.ts).
- grep `compileMDX` sur `fs.readFile` présent (render-mdx, consommé par les 2 routes détail) ; `import .*.mdx'` en CODE == 0 ; `@next/mdx` en CODE == 0 (les seules occurrences sont dans la docstring d'avertissement de render-mdx.ts — Pitfall 1).
- `<Disclaimer />` injecté par la PAGE dans `[slug]` ET `[course]/[lesson]` (grep ≥ 1 chacune) ; absent du MDX (mapping Plan 03 sans Disclaimer).
- `sitemap.ts` référence `listAllContent` ; `alternates.languages` construit des locales réelles.
- Aucune gate Supabase/RLS/`requireActiveSub` en CODE dans l'index (la seule occurrence « Supabase » est un commentaire documentant l'absence de gate — surface publique).

> **Rendu MDX réel = Vercel preview (Plan 05), PAS un build local** : `next build` (webpack) casse sur le `!` du chemin et `dev` (turbopack) mésrésout `@app/*` (Pitfall 2). Les gates locaux (tsc + lint:i18n + unit) sont verts ; le rendu visuel/RTL est manual-only en preview.

## Deviations from Plan

### 1. [Rule 3 - Blocking] Conformité `exactOptionalPropertyTypes: true` sur ContentCard
- **Trouvé pendant :** Task 2 (typecheck). `ContentCardProps.lessonCount?: number` n'accepte pas `number | undefined` ; passer `lessonCount={card.lessonCount}` (où `card.lessonCount` est `number | undefined`) violait le tsconfig strict (TS2375).
- **Fix :** prop passée conditionnellement par spread `{...(card.lessonCount !== undefined ? { lessonCount: card.lessonCount } : {})}` (même posture que la déviation 3 du Plan 02).
- **Fichier :** academie/page.tsx. **Commit :** 0fe3824.

### 2. [Rule 2 - Fonctionnalité critique] Brique partagée `render-mdx.ts`
- **Trouvé pendant :** Task 3. Le pattern compileMDX(fs) + Zod safeParse est identique entre `[slug]` et `[course]/[lesson]`. Le dupliquer multiplierait les points de risque du contournement du `!` et de la frontière frontmatter.
- **Choix :** extraire `renderMdxFile(absPath)` dans `lib/academie/render-mdx.ts` (un seul point de vérité pour compileMDX/fs + validation). Le plan listait les 3 fichiers route + sitemap ; ce helper est un ajout de structure non listé mais nécessaire à la correction (DRY, sécurité centralisée).
- **Fichier :** lib/academie/render-mdx.ts (créé). **Commit :** 746cb9a.

### 3. [Conception] Page-cours pour cours IMPLICITES (aucun fichier type:cours)
- **Trouvé pendant :** Task 3. Les fixtures du Plan 02 n'ont aucun fichier `type:'cours'` : les cours sont purement dérivés des leçons (`course-model.ts`). `resolveContent('prendre-en-main-mt5', locale)` renvoie donc `null`.
- **Choix :** la route `[slug]` traite ce cas (Cas B) en dérivant un parcours via `deriveCourse(slug, catalog)` ; titre/cover/résumé dérivés de la leçon d'ordre le plus bas. Couvre D-07 (page-cours) sans exiger un fichier landing par cours. Si un fichier `type:'cours'` explicite existe un jour, le Cas A le rend directement.
- **Fichier :** academie/[slug]/page.tsx. **Commit :** 746cb9a.

### 4. [Conception] sitemap inclut aussi les index /academie par locale
- En plus d'une entrée par contenu, le sitemap émet `/[locale]/academie` pour les 3 locales (toutes réelles) avec leurs alternates — surface SEO de l'index, cohérente avec le pattern hreflang.
- **Fichier :** sitemap.ts. **Commit :** 746cb9a.

Aucune Rule 1/4 déclenchée. Aucune nouvelle dépendance (next-mdx-remote/remark-gfm/rehype-slug déjà installés au Plan 01).

## Threats Mitigés

- **T-09-PATH** (Tampering / Info Disclosure, plus haute sévérité) : résolution `(slug, locale)` déléguée à `resolveContent` (Plan 02, garde slug `^[a-z0-9-]+$` + locale whitelist + confinement `path.resolve` AVANT fs). Les 3 routes ne concatènent jamais de chemin brut — elles passent les params à `resolveContent`/`listContent`.
- **T-09-02** (Tampering frontmatter) : `FrontmatterSchema.safeParse` à la page (render-mdx) ; échec → `null` → état d'erreur, jamais 500.
- **T-09-LEGAL** (Repudiation) : `<Disclaimer />` rendu par la page après `{content}` sur article + page-cours + leçon (non dans le MDX → non-contournable même si un fichier l'omet).
- **T-09-XSS** (accept) : allowlist fixe `MDX_COMPONENTS` (Plan 03), aucun raw-HTML passthrough, contenu repo revu en PR.
- **T-09-SEO** (Info Disclosure SEO) : `alternates.languages` n'annonce que les locales réelles (`listAllContent`) ; le fallback FR sous `/ar` n'est PAS déclaré `hreflang=ar`.

## Threat Flags

Aucun nouveau. La surface (résolution slug/locale via Plan 02, frontière frontmatter, hreflang) reste celle du `<threat_model>` du plan. Aucun nouvel endpoint réseau, aucune auth, aucun accès fichier hors `content/academie/`.

## Known Stubs

- **Progress de cours = 0** : la barre `Progress` de la page-cours et l'indicateur de progression sont posés à `value={0}` (pas de persistance de progression utilisateur — hors périmètre, aucune DB, RESEARCH Q5). Ce n'est pas un stub bloquant : la progression PAR LEÇON (`courseProgress {current}/{total}`) est réelle et dérivée du modèle cours. La progression cumulée par utilisateur est explicitement hors scope (pas de DB en P9).
- Aucun autre stub. Les données proviennent de `content.ts` (fs réel), aucun mock câblé.

## TDD Gate Compliance

Plan `type: execute` (non-TDD) — surfaces RSC de présentation/intégration. Gate TDD non applicable. Vérification = type-level (`tsc` 0 nouvelle erreur) + lint:i18n + parité messages + suite unit academie verte + greps de conformité (compileMDX/fs, Disclaimer, no @next/mdx, hreflang). Rendu MDX/RTL réel = Vercel preview (Plan 05, manual-only — Pitfall 2 du `!`).

## Commits

- `0b1a8c4` feat(09-04): namespace i18n academy (parité stricte fr/en/ar, ICU + libellés funnel 09-05)
- `0fe3824` feat(09-04): route index /academie RSC public (liste + filtres multi-axes searchParams)
- `746cb9a` feat(09-04): routes détail article/cours + leçon (compileMDX fs) + sitemap hreflang

## Self-Check: PASSED

- Fichiers créés : render-mdx.ts, academie/page.tsx, academie/[slug]/page.tsx, academie/[course]/[lesson]/page.tsx, sitemap.ts — présents.
- Fichiers modifiés : messages/{fr,en,ar}.json (academy 46 clés à parité) — présents.
- Commits 0b1a8c4, 0fe3824, 746cb9a — présents dans git log.
- tsc academie scope 0 erreur ; lint:i18n exit 0 ; 18 parité + 59 unit verts ; compileMDX(fs) présent ; `.mdx`/`@next/mdx` en CODE == 0 ; Disclaimer dans les 2 routes détail ; sitemap → listAllContent.
