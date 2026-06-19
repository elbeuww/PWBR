---
phase: 09-cms-cours-articles-vulgaris-s
plan: 03
subsystem: academie
tags: [react, rsc, mdx, components, rtl, i18n, ui-spec, no-green-red]
requires:
  - "TocItem (lib/academie/toc.ts, plan 09-01)"
  - "ThemeEnum/NiveauEnum/PlateformeEnum (frontmatter.ts, 09-01)"
  - "parseAcademyParams whitelist multi-axes (searchParams.ts, 09-01)"
  - "@/i18n/navigation (Link/useRouter/usePathname localisés)"
  - "ui/{card,badge,alert} déjà présents (Registry Safety)"
provides:
  - "MDX_COMPONENTS — mapping allowlist fixe (Callout/Steps/Step/Figure/TradeExample/h2 ancré) injectable à compileMDX (D-09)"
  - "Callout (attention/astuce) — distinction icône+libellé i18n, jamais couleur (D-04/T-09-A11Y)"
  - "TradeExample — encadré exemple, valeurs prix/SL/TP/R:R en <bdi> (anti-inversion RTL)"
  - "Toc sticky desktop, item courant text-primary, slugs cohérents rehype-slug"
  - "ContentCard (article/cours) — Card+Badge outline, cover 16:9, méta ICU"
  - "FilterBar multi-axes → URL (navigation localisée, préserve locale)"
  - "FallbackBanner — Alert neutre (jamais destructive), copy academy.fallbackBanner (D-14)"
affects:
  - "Plan 09-04 (routes RSC) consomme les 9 composants + MDX_COMPONENTS dans compileMDX"
tech-stack:
  added: []
  patterns:
    - "Composants pédago RSC : libellés via getTranslations('academy'), classes logiques uniquement"
    - "Distinction sémantique par icône+libellé i18n, jamais par couleur (a11y + D-04 no green/red)"
    - "Valeurs numériques trading enveloppées <bdi> (Pitfall 4 RTL)"
    - "MDX allowlist fixe (T-09-XSS) ; Disclaimer hors mapping, injecté par la page (LEGAL-01)"
    - "FilterBar multi-select par axe via URLSearchParams.getAll/append (logique tableau, pas set)"
    - "Navigation interne via @/i18n/navigation (jamais next/navigation pour Link/useRouter)"
key-files:
  created:
    - apps/web/src/components/academie/Callout.tsx
    - apps/web/src/components/academie/Steps.tsx
    - apps/web/src/components/academie/Figure.tsx
    - apps/web/src/components/academie/TradeExample.tsx
    - apps/web/src/components/academie/mdx-components.tsx
    - apps/web/src/components/academie/Toc.tsx
    - apps/web/src/components/academie/ContentCard.tsx
    - apps/web/src/components/academie/FallbackBanner.tsx
    - apps/web/src/components/academie/FilterBar.tsx
  modified: []
decisions:
  - "Callout/TradeExample/Toc/ContentCard/FallbackBanner = RSC (getTranslations server) ; FilterBar = client ('use client', interaction URL)"
  - "Steps exporte Steps + Step (compteur CSS [counter-increment] bg-secondary, pas de couleur)"
  - "ContentCard reçoit href + champs primitifs (pas le CatalogEntry brut) → découplage présentation/données pour le Plan 04"
  - "Toc.currentSlug optionnel (l'accent text-primary est posé par la page/scroll-spy au Plan 04)"
  - "Clés i18n academy.* (theme.*/niveau.*/plateforme.*/trade*/callout*/lessonCount ICU count) CONSOMMÉES ici, DÉCLARÉES au Plan 04"
metrics:
  duration: "~15 min"
  completed: 2026-06-19
  tasks: 3
  files: 9
---

# Phase 09 Plan 03: Bibliothèque de présentation de l'Académie Summary

Les 9 composants React de l'Académie (4 pédago MDX + mapping, TOC, carte de contenu, FilterBar, bandeau fallback), strictement conformes à l'UI-SPEC APPROUVÉE : palette héritée P2 sans aucune couleur vert/rouge, propriétés logiques RTL, valeurs trading en `<bdi>`, namespace i18n `academy`, navigation localisée — prêts à être consommés par les routes RSC du Plan 04.

## What Was Built

- **Composants pédago (Task 1)** :
  - `Callout.tsx` (RSC) : `variant: 'attention' | 'astuce'`. attention = `border-s-4 border-primary` + `AlertTriangle text-foreground` + `academy.calloutAttention` ; astuce = `border-s-4 border-border` + `Lightbulb text-muted-foreground` + `academy.calloutAstuce`. Distinction par icône + libellé, JAMAIS par couleur (T-09-A11Y, D-04).
  - `Steps.tsx` : `Steps` (`<ol>` list-none, `[counter-reset:step]`) + `Step` (compteur CSS `bg-secondary`, `[counter-increment:step]` + `before:content-[counter(step)]`).
  - `Figure.tsx` : `next/image` 16:9, `alt` requis, `<figcaption text-sm text-muted-foreground>`.
  - `TradeExample.tsx` (RSC) : `Card bg-card border border-border p-6`, libellés `academy.tradeEntry/tradeStopLoss/tradeTakeProfit/tradeRr` atténués, CHAQUE valeur prix/SL/TP/R:R enveloppée dans `<bdi>` (Pitfall 4). Aucune couleur sémantique.
  - `mdx-components.tsx` : `MDX_COMPONENTS = { Callout, Steps, Step, Figure, TradeExample, h2: HeadingWithAnchor }`. `HeadingWithAnchor` réutilise l'`id` rehype-slug (titre ancré cliquable). `<Disclaimer />` VOLONTAIREMENT absent du mapping (injecté par la page, LEGAL-01, RESEARCH Pattern 2).
- **Présentation index/détail (Task 2)** :
  - `Toc.tsx` (RSC) : `items: TocItem[]` + `currentSlug?`, liens d'ancrage `text-sm`, item courant `text-primary`, `lg:sticky` côté `end` logique, titre `academy.tocTitle`.
  - `ContentCard.tsx` (RSC) : `Card` + `Badge variant="outline"` (jamais `default` au repos), cover `next/image` 16:9, titre `text-xl font-semibold`, résumé `line-clamp-2`, méta `academy.readingTime` (ICU `{minutes}`). Variante cours : badge `academy.courseBadge` + `academy.lessonCount` (ICU count) + CTA `academy.startCourse` ; article : CTA `academy.readArticle`. Lien `@/i18n/navigation`.
  - `FallbackBanner.tsx` (RSC) : `Alert variant="default"` (NEUTRE, jamais destructive), icône `Languages`, copy `academy.fallbackBanner` (D-14).
- **FilterBar (Task 3)** : `'use client'`, calque `signals/FilterBar`. `useRouter`/`usePathname` de `../../i18n/navigation` (préserve la locale), `useSearchParams` de `next/navigation` (lecture seule). 3 axes (thème/niveau/plateforme) MULTI-SELECT via `URLSearchParams.getAll/append` (toggle ajoute/retire de l'array, pas d'écrasement). Chip actif = `Badge variant="default"`, repos = `outline`, `min-h-11`. « Réinitialiser » (`academy.resetFilters`) si filtre actif. `router.replace(..., { scroll: false })`.

## Verification

- `cd apps/web && pnpm exec tsc -b --force` : **AUCUNE nouvelle erreur** dans `components/academie/*` (grep ciblé = 0). La baseline pré-existante hors périmètre demeure (`forbidden-service-import.ts`, `app/[locale]/affiliation/*`, `lib/academie/*.test.ts`, `lib/academie/toc.ts`, `lib/admin/jobs.test.ts`) — non touchée par ce plan.
- `node scripts/check-i18n-hardcoded.mjs` (lint:i18n) : **exit 0** après chaque tâche (aucune chaîne en dur ; tout via `academy`).
- grep vert/rouge/ambre dans `components/academie` = **0**.
- grep `<bdi>` dans `TradeExample.tsx` = 2 (≥ 1).
- grep `next/navigation` pour Link/useRouter dans les composants = **0** (seul `useSearchParams` lecture seule, autorisé).
- `MDX_COMPONENTS` mappe Callout/Steps/Step/Figure/TradeExample/h2 ; aucun `<Disclaimer />` dans l'objet du mapping.

## Deviations from Plan

### 1. [Rule 2 - Fonctionnalité critique] `Steps` exporte aussi un sous-composant `Step`
- **Trouvé pendant :** Task 1. Un `<ol>` numéroté pédago a besoin d'items individuels dans le MDX. Le plan ne nommait que `Steps`.
- **Fix :** export de `Step` (item, compteur CSS `bg-secondary`) en plus de `Steps`, ajouté au mapping `MDX_COMPONENTS`. Aucune couleur, conforme UI-SPEC.
- **Fichiers :** Steps.tsx, mdx-components.tsx. **Commit :** 51cebfb.

### 2. [Conception] `ContentCard` reçoit des props primitives (pas `CatalogEntry` brut)
- **Trouvé pendant :** Task 2. Coupler la carte au type `CatalogEntry` de `content.ts` mêlerait présentation et couche fichiers.
- **Choix :** props primitives (`href`, `type`, `titre`, `resume`, `cover`, `theme`, `niveau`, `plateforme?`, `readingMinutes`, `lessonCount?`). Le Plan 04 mappe `CatalogEntry` → props et construit `href` localisé. Découplage net présentation/données.
- **Fichier :** ContentCard.tsx. **Commit :** 827fe3f.

### 3. [Conception] `Toc.currentSlug` optionnel
- L'accent `text-primary` de l'item courant dépend du scroll/route, déterminé par la page consommatrice (Plan 04). La prop est optionnelle pour rester RSC-pur ici.

Aucune Rule 1/3/4 déclenchée. Aucune nouvelle dépendance (Registry Safety respecté).

## Threats Mitigés

- **T-09-A11Y** (qualité/a11y, Callout) : distinction attention/astuce par icône `AlertTriangle`/`Lightbulb` + libellé i18n, jamais par la seule couleur — conforme D-04 (pas de vert/rouge).
- **T-09-XSS** (accept → mapping fixe) : `MDX_COMPONENTS` = allowlist fixe de composants maison, aucun raw-HTML passthrough, aucune exécution distante. Le contenu MDX reste du repo revu en PR.
- **T-09-01** (Tampering FilterBar → URL) : la FilterBar n'écrit que des valeurs d'enum internes (constantes `THEME/NIVEAU/PLATEFORME_OPTIONS`). La frontière de confiance reste la lecture RSC `parseAcademyParams` (Plan 01, hors-enum ignoré). Aucune string libre injectée.

## Threat Flags

Aucun nouveau. La surface (chips → URL, rendu de composants à allowlist) reste celle du `<threat_model>` du plan.

## Known Stubs

Aucun stub bloquant. Les clés i18n `academy.*` (theme/niveau/plateforme.*, trade*, callout*, readingTime/lessonCount ICU, tocTitle, fallbackBanner, courseBadge, startCourse, readArticle, resetFilters, filter*) sont CONSOMMÉES ici et DÉCLARÉES au Plan 04 (`messages/{fr,en,ar}.json`, namespace `academy`) — séquençage explicite du plan (objective : « le namespace i18n academy est posé en Plan 04 »). `lint:i18n` (chaînes en dur) passe ; la parité des clés sera validée au Plan 04 quand le namespace existera. Ce n'est pas un stub UI : aucune donnée mockée câblée, aucun placeholder visuel.

## TDD Gate Compliance

Plan `type: execute` (non-TDD) — couche présentation pure (composants React). Gate TDD non applicable. Vérification = type-level (`tsc` zéro nouvelle erreur) + lint:i18n + greps de conformité UI-SPEC. Rendu visuel vérifié en Vercel preview (VALIDATION.md manual-only ; `next build` local non viable, Pitfall 2 du `!`).

## Commits

- `51cebfb` feat(09-03): composants pédago MDX (Callout/Steps/Figure/TradeExample) + mapping
- `827fe3f` feat(09-03): Toc sticky + ContentCard (article/cours) + FallbackBanner (D-14)
- `7335798` feat(09-03): FilterBar multi-axes (thème/niveau/plateforme) → URL

## Self-Check: PASSED

- 9 fichiers `components/academie/*` créés — présents.
- Commits 51cebfb, 827fe3f, 7335798 — présents dans git log.
- tsc : 0 erreur dans `components/academie` ; lint:i18n exit 0 ; vert/rouge = 0 ; `<bdi>` ≥ 1 dans TradeExample ; `next/navigation` Link/useRouter = 0.
