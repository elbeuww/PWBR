---
phase: 02-vitrine-publique-trilingue-gate-l-gal
plan: 01
subsystem: design-system
tags: [theming, fonts, shadcn, rtl, i18n, tailwind-v4]
requires:
  - "Socle P1 : next-intl 4.13, [locale]/layout.tsx, globals.css minimal, LanguageSwitcher, lint:i18n"
provides:
  - "Design system de marque : tokens 2 thèmes (CSS-first), ThemeProvider/ThemeToggle, polices self-hostées, composants shadcn/ui, shell layout étendu, namespace theme"
affects:
  - "Toutes les pages des plans 02-02 (Footer/Disclaimer) et 02-03 (home/tarifs/légales) consommeront ces tokens, composants ui/, polices et shell"
tech-stack:
  added:
    - "next-themes@0.4.6 (toggle dark/light, class strategy, no-flash)"
    - "lucide-react@1.18.0 (icônes Sun/Moon)"
    - "@fontsource/ibm-plex-sans-arabic@5.2.9 (source des .woff2 arabes)"
    - "shadcn/ui (radix base, preset nova) — radix-ui@1.5.0, class-variance-authority@0.7.1, clsx@2.1.1, tailwind-merge@3.6.0, tw-animate-css@1.4.0"
  patterns:
    - "Tailwind v4 CSS-first : @custom-variant dark + tokens en @theme/:root/.dark, AUCUN tailwind.config"
    - "next/font/local (IBM Plex Sans Arabic) + next/font/google (Inter) → variables CSS, zéro CDN runtime (D-03)"
    - "next-themes class strategy + suppressHydrationWarning (no-flash)"
key-files:
  created:
    - apps/web/components.json
    - apps/web/src/lib/fonts.ts
    - apps/web/src/lib/utils.ts
    - apps/web/src/fonts/IBMPlexSansArabic-Regular.woff2
    - apps/web/src/fonts/IBMPlexSansArabic-SemiBold.woff2
    - apps/web/src/components/ThemeProvider.tsx
    - apps/web/src/components/ThemeToggle.tsx
    - apps/web/src/components/ui/{button,card,badge,dialog,input,label,dropdown-menu,separator}.tsx
    - apps/web/src/messages/__tests__/theme-parity.test.ts
  modified:
    - apps/web/package.json
    - apps/web/tsconfig.json
    - apps/web/src/app/layout.tsx
    - apps/web/src/app/[locale]/layout.tsx
    - apps/web/src/styles/globals.css
    - apps/web/src/messages/{fr,en,ar}.json
decisions:
  - "D-02-01-A : tokens marque mappés sur les variables shadcn (--primary/--background/…) via @theme inline → les composants ui/ héritent automatiquement de la palette bleue (must_have « shadcn stylés aux tokens de marque »). Pas de double système de couleurs."
  - "D-02-01-B : Inter via next/font/google (self-host build, A5 du RESEARCH) — pas de @fontsource-variable/inter ; le build Google n'a pas échoué."
  - "D-02-01-C : alias @/* → ./src/* ajouté au tsconfig web pour les imports shadcn (@/lib/utils, @/components/ui). Non régressif pour les imports relatifs P1."
  - "D-02-01-D : composant shadcn form NON ajouté (le registre nova/radix ne le fournit pas en standalone ; react-hook-form non requis en P2). Sera ajouté au Plan 02-03 avec le signup form. 8 composants ui/ présents (≥4 exigé)."
  - "D-02-01-E (Pitfall D) : shadcn init committé séparément (013eccf) ; il avait écrit @theme inline + :root/.dark oklch neutres et injecté Geist dans le root layout — restauré/surchargé en Task 3."
  - "D-02-01-F : @destructive mappé sur un gris neutre (jamais rouge) dans les 2 thèmes (D-04 : vert/rouge réservés au trading, absents en P2)."
metrics:
  duration: "~25 min"
  completed: 2026-06-14
  tasks: 3
  files: 24
---

# Phase 2 Plan 01 : Design system de marque (theming, polices, shadcn, shell) Summary

Design system de marque initialisé avant toute page marketing : toggle dark/light no-flash (next-themes class strategy), tokens bleus institutionnels 2 thèmes en Tailwind v4 CSS-first, polices Inter + IBM Plex Sans Arabic self-hostées (zéro CDN), composants shadcn/ui stylés à la marque, et shell `[locale]/layout` étendu chirurgicalement (ThemeProvider + ThemeToggle + slot Footer) sans régresser le socle i18n/RTL P1.

## What Was Built

- **Task 1 (checkpoint supply-chain AR-01-SC)** : approuvé par l'humain avant exécution (3 paquets vérifiés sur npmjs.com — versions exactes, repos officiels pacocoursey/next-themes, lucide-icons/lucide, fontsource/font-files, zéro postinstall).
- **Task 2 (commit 013eccf)** : `pnpm add` exact-pinned (next-themes/lucide-react/@fontsource), `npx shadcn init` (radix base, preset nova) → `components.json` + 8 composants `ui/`, deps shadcn épinglées exactes, polices arabes copiées dans `src/fonts/`, `lib/fonts.ts` (Inter + IBM Plex). Root layout restauré (pass-through P1).
- **Task 3 RED (f1bf813)** : test de parité du namespace `theme` (échoue car absent).
- **Task 3 GREEN (4fb42cf)** : tokens marque 2 thèmes dans `globals.css`, `ThemeProvider`/`ThemeToggle`, greffe `[locale]/layout`, namespace `theme` à parité fr/en/ar.

## Verification

- `tsc -b --noEmit` : vert hors baseline P1 (`forbidden-service-import.ts` — fixture ESLint AUTH-03, D-01-03-BASELINE).
- `pnpm lint:i18n` : exit 0 (labels Close de `ui/dialog` externalisés en prop `closeLabel`).
- Test parité `theme` : 3/3 GREEN.
- `next build` : `✓ Compiled successfully` (fonts/css/layout OK ; l'échec ESLint final = fixture P1 intentionnelle, non régressé).
- Greps acceptance : `@custom-variant dark`=1, `Noto Sans Arabic`=0, `var(--font-ibm-plex-arabic)`=1, `:lang(ar)`=1, `suppressHydrationWarning`=1, ThemeProvider/ThemeToggle présents, zéro classe physique dans ThemeToggle, `next-themes": "0.4.6`=1, components.json présent, 8 ui/, 2 woff2, fonts.ts exporte inter+ibmPlexArabic.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] alias @/* manquant pour les imports shadcn**
- **Found during:** Task 2 (avant shadcn init)
- **Issue:** tsconfig web n'avait pas d'alias `@/*` ; shadcn génère des imports `@/components/ui` et `@/lib/utils`.
- **Fix:** ajout `"@/*": ["./src/*"]` dans `tsconfig.json` (non régressif vs imports relatifs P1).
- **Commit:** 013eccf

**2. [Rule 1 - Bug] ui/dropdown-menu viole exactOptionalPropertyTypes**
- **Found during:** Task 2 (tsc)
- **Issue:** `checked={checked}` (CheckedState | undefined) incompatible avec la prop Radix sous `exactOptionalPropertyTypes: true`.
- **Fix:** `checked={checked ?? false}`.
- **Commit:** 013eccf

**3. [Rule 2 - Critical] shadcn a injecté Geist dans le root layout pass-through**
- **Found during:** Task 2
- **Issue:** `npx shadcn init` a ajouté `import { Geist }` + font dans `src/app/layout.tsx`, qui doit rester un pass-through (invariant Pitfall 7 / D-01-03-E : un seul `<html lang dir>`).
- **Fix:** restauré le root layout à l'état P1 (pass-through `return children`).
- **Commit:** 013eccf

**4. [Rule 1 - Bug] ui/dialog labels « Close » en dur (I18N-03)**
- **Found during:** Task 3 (lint:i18n FAIL)
- **Issue:** `dialog.tsx` généré contient `<span className="sr-only">Close</span>` et `<Button>Close</Button>` en dur → viole le check CI anti-chaîne-en-dur.
- **Fix:** externalisé en prop optionnelle `closeLabel` (l'appelant fournit le label traduit) ; rendu conditionnel si fournie.
- **Commit:** 4fb42cf

### Scope notes
- Composant shadcn `form` non disponible dans le registre nova/radix standalone → reporté au Plan 02-03 (signup form, avec react-hook-form). 8 composants ui/ livrés (≥4 exigé). Voir D-02-01-D.
- `shadcn` CLI retiré des dependencies runtime (on utilise `npx shadcn`).

## Authentication Gates

Aucun (pas d'auth touchée en P2).

## Known Stubs

Aucun stub. Le slot `<Footer />` du layout est documenté par un commentaire (le Footer réel arrive au Plan 02-02) — pas un import cassé, pas de données stub.

## Self-Check: PASSED

- Fichiers créés vérifiés présents : lib/fonts.ts, ThemeProvider.tsx, ThemeToggle.tsx, components.json, fonts/*.woff2, ui/button.tsx, messages/__tests__/theme-parity.test.ts.
- Commits vérifiés présents : 013eccf (Task 2), f1bf813 (RED), 4fb42cf (GREEN).
- Aucune suppression de fichier dans les commits.

## TDD Gate Compliance

Plan-level task `tdd="true"` (Task 3) respecté : commit `test(...)` RED (f1bf813, parité theme échoue) → commit `feat(...)` GREEN (4fb42cf, parité 3/3). Refactor non nécessaire.
